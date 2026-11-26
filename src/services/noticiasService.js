const { pool } = require("../../db");
const { validarPdf, guardarPdf, obtenerPdf, limpiarPdfHuerfanos } = require("../utils/pdfBloques");

class ErrorNoticia extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

const mimePermitidos = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const tipos = new Set(["parrafo", "subtitulo", "imagen", "carrusel", "enlace", "video", "pdf"]);
const MAX_IMAGEN = 5 * 1024 * 1024;

function validarId(value) {
  const valueString = String(value);
  if (!/^\d+$/.test(valueString) || BigInt(valueString) < 1n) throw new ErrorNoticia("Identificador inválido.");
  return valueString;
}

function texto(value) {
  return typeof value === "string" ? value.trim() : "";
}

// Fecha de la noticia en formato YYYY-MM-DD. Si no llega, se usa la fecha actual.
function validarFecha(value) {
  const fecha = texto(value);
  if (!fecha) return null;
  const partes = /^(\d{4})-(\d{2})-(\d{2})$/.exec(fecha);
  if (!partes) throw new ErrorNoticia("Fecha de la noticia inválida.");
  const [anio, mes, dia] = partes.slice(1).map(Number);
  const d = new Date(Date.UTC(anio, mes - 1, dia));
  if (anio < 1900 || anio > 2100 || d.getUTCMonth() !== mes - 1 || d.getUTCDate() !== dia) {
    throw new ErrorNoticia("Fecha de la noticia inválida.");
  }
  return fecha;
}

function validarImagen(imagen) {
  if (!imagen || typeof imagen !== "object" || Array.isArray(imagen)) throw new ErrorNoticia("Falta una imagen.");
  if (imagen.id_imagen !== undefined && imagen.id_imagen !== null) {
    return { id_imagen: validarId(imagen.id_imagen), credito: texto(imagen.credito) };
  }
  if (typeof imagen.archivo !== "string") throw new ErrorNoticia("Adjunta un archivo de imagen válido.");
  const match = /^data:(image\/(?:jpeg|png|webp|gif));base64,([A-Za-z0-9+/]+={0,2})$/.exec(imagen.archivo);
  if (!match || !mimePermitidos.has(match[1])) throw new ErrorNoticia("Formato de imagen no permitido.");
  const bytes = Buffer.from(match[2], "base64");
  if (!bytes.length || bytes.length > MAX_IMAGEN) throw new ErrorNoticia("Cada imagen debe pesar entre 1 byte y 5 MB.");
  const real = match[1] === "image/png" ? bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))
    : match[1] === "image/jpeg" ? bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
    : match[1] === "image/gif" ? ["GIF87a", "GIF89a"].includes(bytes.toString("ascii", 0, 6))
    : bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP";
  if (!real) throw new ErrorNoticia("El archivo no coincide con el formato de imagen indicado.");
  return {
    archivo: bytes, mime: match[1],
    nombre_archivo: texto(imagen.nombre_archivo).slice(0, 255) || "imagen",
    credito: texto(imagen.credito)
  };
}

function validarEntrada(data) {
  if (!data || typeof data !== "object" || Array.isArray(data)) throw new ErrorNoticia("Datos de noticia inválidos.");
  const titulo_es = texto(data.titulo_es);
  const titulo_en = texto(data.titulo_en);
  if (!titulo_es || !titulo_en) throw new ErrorNoticia("Los títulos en español e inglés son obligatorios.");
  const id_programa = data.id_programa ? validarId(data.id_programa) : null;
  const id_categoria_noticia = texto(data.id_categoria_noticia);
  if (!id_categoria_noticia) throw new ErrorNoticia("Selecciona una categoría.");
  if (!Array.isArray(data.bloques)) throw new ErrorNoticia("Envía una lista de bloques.");
  if (data.bloques.length > 100) throw new ErrorNoticia("Máximo 100 bloques por noticia.");
  const bloques = data.bloques.map((bloque) => {
    if (!bloque || !tipos.has(bloque.tipo)) throw new ErrorNoticia("Tipo de bloque no permitido.");
    const b = {
      tipo: bloque.tipo, texto_es: texto(bloque.texto_es), texto_en: texto(bloque.texto_en),
      pie_es: texto(bloque.pie_es), pie_en: texto(bloque.pie_en), url: texto(bloque.url)
    };
    if (["parrafo", "subtitulo"].includes(b.tipo) && (!b.texto_es || !b.texto_en)) {
      throw new ErrorNoticia("Los párrafos y subtítulos deben incluir ambos idiomas.");
    }
    if (["enlace", "video"].includes(b.tipo)) {
      b.texto_es = ""; b.texto_en = "";
      let uri;
      try { uri = new URL(b.url); } catch { throw new ErrorNoticia("URL de bloque inválida."); }
      if (!["https:", "http:"].includes(uri.protocol)) throw new ErrorNoticia("Solo se admiten enlaces HTTP o HTTPS.");
      if (b.tipo === "video" && !/(^|\.)(youtube\.com|youtu\.be|youtube-nocookie\.com)$/.test(uri.hostname)) {
        throw new ErrorNoticia("El video debe utilizar una URL de YouTube.");
      }
    }
    if (b.tipo === "imagen") b.imagen = validarImagen(bloque.imagen);
    if (b.tipo === "pdf") {
      b.texto_es = ""; b.texto_en = ""; b.url = ""; b.pie_es = ""; b.pie_en = "";
      b.pdf = validarPdf(bloque.pdf, ErrorNoticia);
    }
    if (b.tipo === "carrusel") {
      if (!Array.isArray(bloque.imagenes) || bloque.imagenes.length < 2 || bloque.imagenes.length > 30) {
        throw new ErrorNoticia("Un carrusel debe contener entre 2 y 30 imágenes.");
      }
      b.imagenes = bloque.imagenes.map(validarImagen);
    }
    return b;
  });
  const fecha_publicacion = validarFecha(data.fecha_publicacion);
  const autor = texto(data.autor);
  if (autor.length > 200) throw new ErrorNoticia("El nombre del autor admite como máximo 200 caracteres.");
  return { titulo_es, titulo_en, fecha_publicacion, autor, id_programa, id_categoria_noticia, bloques };
}

async function guardarImagen(client, imagen) {
  if (imagen.id_imagen) {
    const result = await client.query("SELECT id_imagen FROM imagen WHERE id_imagen = $1", [imagen.id_imagen]);
    if (!result.rowCount) throw new ErrorNoticia("Una de las imágenes ya no existe.");
    await client.query(
      "UPDATE imagen SET credito=$1 WHERE id_imagen=$2",
      [imagen.credito, imagen.id_imagen]
    );
    return imagen.id_imagen;
  }
  const result = await client.query(
    `INSERT INTO imagen (archivo, nombre_archivo, mime, credito)
     VALUES ($1,$2,$3,$4) RETURNING id_imagen`,
    [imagen.archivo, imagen.nombre_archivo, imagen.mime, imagen.credito]
  );
  return String(result.rows[0].id_imagen);
}

async function guardarBloques(client, idContenido, bloques) {
  await insertarBloques(client, idContenido, bloques);
  await limpiarPdfHuerfanos(client);
}

async function insertarBloques(client, idContenido, bloques) {
  for (let i = 0; i < bloques.length; i++) {
    const b = bloques[i];
    const idImagen = b.tipo === "imagen" ? await guardarImagen(client, b.imagen) : null;
    const idPdf = b.tipo === "pdf" ? await guardarPdf(client, b.pdf, ErrorNoticia) : null;
    const result = await client.query(
      `INSERT INTO bloque_editorial (id_contenido, tipo, orden, texto_es, texto_en, id_imagen, pie_es, pie_en, url, id_archivo_pdf)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id_bloque`,
      [idContenido, b.tipo, i + 1, b.texto_es || null, b.texto_en || null, idImagen,
        b.pie_es || null, b.pie_en || null, b.url || null, idPdf]
    );
    if (b.tipo === "carrusel") {
      for (let j = 0; j < b.imagenes.length; j++) {
        const idFoto = await guardarImagen(client, b.imagenes[j]);
        await client.query(
          "INSERT INTO carrusel_imagen (id_bloque, id_imagen, orden) VALUES ($1,$2,$3)",
          [result.rows[0].id_bloque, idFoto, j + 1]
        );
      }
    }
  }
}

async function categorias() {
  return (await pool.query("SELECT id_categoria_noticia,nombre_es,nombre_en FROM categoria_noticia ORDER BY nombre_es")).rows;
}
async function listar() {
  return (await pool.query(`SELECT n.id_noticia::text AS id_noticia, COALESCE(n.id_programa::text,'') AS id_programa,
           n.id_categoria_noticia, cat.nombre_es AS categoria_titulo_es,
           COALESCE(pc.titulo_es,'') AS programa_titulo_es,
           COALESCE(l.color,'#2381C4') AS color,
           c.id_contenido::text AS id_contenido, c.titulo_es, c.titulo_en,
           to_char(c.fecha_publicacion, 'YYYY-MM-DD"T"HH24:MI:SS') AS fecha_publicacion,
  to_char(c.updated_at, 'YYYY-MM-DD"T"HH24:MI:SS') AS updated_at,
  (SELECT count(*)::integer FROM bloque_editorial b WHERE b.id_contenido=c.id_contenido) AS cantidad_bloques
  FROM noticia n JOIN contenido_editorial c ON c.id_contenido=n.id_contenido
    JOIN categoria_noticia cat ON cat.id_categoria_noticia=n.id_categoria_noticia
    LEFT JOIN programa p ON p.id_programa=n.id_programa
    LEFT JOIN contenido_editorial pc ON pc.id_contenido=p.id_contenido
    LEFT JOIN paisaje l ON l.id_paisaje=p.id_paisaje ORDER BY c.fecha_publicacion DESC,n.id_noticia DESC`)).rows;
}
async function obtener(id) {
  id = validarId(id);
  const client = await pool.connect();
  try {
    const result = await client.query(`SELECT n.id_noticia::text AS id_noticia, COALESCE(n.id_programa::text,'') AS id_programa,
           n.id_categoria_noticia, cat.nombre_es AS categoria_titulo_es,
           COALESCE(pc.titulo_es,'') AS programa_titulo_es,
           COALESCE(l.color,'#2381C4') AS color,
           c.id_contenido::text AS id_contenido, c.titulo_es, c.titulo_en,
           to_char(c.fecha_publicacion, 'YYYY-MM-DD"T"HH24:MI:SS') AS fecha_publicacion, COALESCE(n.autor,'') AS autor FROM noticia n JOIN contenido_editorial c ON c.id_contenido=n.id_contenido
    JOIN categoria_noticia cat ON cat.id_categoria_noticia=n.id_categoria_noticia
    LEFT JOIN programa p ON p.id_programa=n.id_programa
    LEFT JOIN contenido_editorial pc ON pc.id_contenido=p.id_contenido
    LEFT JOIN paisaje l ON l.id_paisaje=p.id_paisaje WHERE n.id_noticia=$1`, [id]);
    if (!result.rowCount) throw new ErrorNoticia("Noticia no encontrada.",404);
    const landscape = result.rows[0];
    const blocks = await client.query(`
      SELECT b.id_bloque::text AS id_bloque, b.tipo, b.orden, b.texto_es, b.texto_en,
             b.pie_es, b.pie_en, b.url, b.id_imagen::text AS id_imagen,
             b.id_archivo_pdf::text AS id_archivo_pdf
      FROM bloque_editorial b WHERE b.id_contenido=$1 ORDER BY b.orden`, [landscape.id_contenido]);
    const resultBlocks = [];
    for (const b of blocks.rows) {
      if (b.tipo === "imagen") b.imagen = await obtenerImagen(client, b.id_imagen);
      if (b.tipo === "pdf") b.pdf = await obtenerPdf(client, b.id_archivo_pdf);
      if (b.tipo === "carrusel") {
        const fotos = await client.query(
          "SELECT id_imagen::text AS id_imagen FROM carrusel_imagen WHERE id_bloque=$1 ORDER BY orden", [b.id_bloque]);
        b.imagenes = [];
        for (const f of fotos.rows) b.imagenes.push(await obtenerImagen(client, f.id_imagen));
      }
      resultBlocks.push(b);
    }
    return { ...landscape, bloques: resultBlocks };
  } finally {
    client.release();
  }
}

async function obtenerImagen(client, id) {
  const result = await client.query(
    "SELECT id_imagen::text AS id_imagen, encode(archivo,'base64') AS base64, mime, nombre_archivo, credito FROM imagen WHERE id_imagen=$1", [id]);
  if (!result.rowCount) throw new ErrorNoticia("Imagen no encontrada.", 404);
  const img = result.rows[0];
  return { id_imagen: img.id_imagen, archivo: `data:${img.mime};base64,${img.base64.replace(/\s/g, "")}`,
    nombre_archivo: img.nombre_archivo, credito: img.credito };
}

async function validarAsociaciones(client, input) {
  const cat = await client.query("SELECT 1 FROM categoria_noticia WHERE id_categoria_noticia=$1 FOR KEY SHARE",[input.id_categoria_noticia]);
  if (!cat.rowCount) throw new ErrorNoticia("La categoría seleccionada no existe.");
  if (input.id_programa) {
    const pr = await client.query("SELECT 1 FROM programa WHERE id_programa=$1 FOR KEY SHARE",[input.id_programa]);
    if (!pr.rowCount) throw new ErrorNoticia("El programa seleccionado no existe.");
  }
}

async function crear(data) {
  const input = validarEntrada(data);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await validarAsociaciones(client, input);
    const contenido = await client.query(
      // La fecha elegida se combina con la hora actual de La Paz para mantener el orden de publicación.
      `INSERT INTO contenido_editorial (tipo,titulo_es,titulo_en,fecha_publicacion)
       VALUES ('noticia',$1,$2,COALESCE($3::date + TIMEZONE('America/La_Paz', NOW())::time, TIMEZONE('America/La_Paz', NOW())))
       RETURNING id_contenido`,
      [input.titulo_es, input.titulo_en, input.fecha_publicacion]
    );
    const idContenido = contenido.rows[0].id_contenido;
    const noticia = await client.query(
      "INSERT INTO noticia (id_contenido,id_programa,id_categoria_noticia,autor) VALUES ($1,$2,$3,$4) RETURNING id_noticia::text AS id_noticia",
      [idContenido, input.id_programa, input.id_categoria_noticia, input.autor || null]
    );
    await guardarBloques(client, idContenido, input.bloques);
    await client.query("COMMIT");
    return noticia.rows[0].id_noticia;
  } catch (error) { await client.query("ROLLBACK"); throw error; }
  finally { client.release(); }
}

async function actualizar(id, data) {
  id = validarId(id);
  const input = validarEntrada(data);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const existing = await client.query("SELECT id_contenido FROM noticia WHERE id_noticia=$1 FOR UPDATE", [id]);
    if (!existing.rowCount) throw new ErrorNoticia("Noticia no encontrada.", 404);
    const idContenido = existing.rows[0].id_contenido;
    await validarAsociaciones(client, input);
    // Cambia solo el día y conserva la hora original de publicación.
    await client.query(
      "UPDATE contenido_editorial SET titulo_es=$1,titulo_en=$2,fecha_publicacion=COALESCE($4::date + fecha_publicacion::time, fecha_publicacion) WHERE id_contenido=$3",
      [input.titulo_es, input.titulo_en, idContenido, input.fecha_publicacion]
    );
    await client.query("UPDATE noticia SET id_programa=$1,id_categoria_noticia=$2,autor=$3 WHERE id_noticia=$4", [input.id_programa,input.id_categoria_noticia,input.autor || null,id]);
    await client.query("DELETE FROM bloque_editorial WHERE id_contenido=$1", [idContenido]);
    await guardarBloques(client, idContenido, input.bloques);
    await client.query("COMMIT");
    return id;
  } catch (error) { await client.query("ROLLBACK"); throw error; }
  finally { client.release(); }
}

async function eliminar(id) {
  id = validarId(id);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const existing = await client.query("SELECT id_contenido FROM noticia WHERE id_noticia=$1 FOR UPDATE", [id]);
    if (!existing.rowCount) throw new ErrorNoticia("Noticia no encontrada.", 404);
    await client.query("DELETE FROM contenido_editorial WHERE id_contenido=$1", [existing.rows[0].id_contenido]);
    await limpiarPdfHuerfanos(client);
    await client.query("COMMIT");
  } catch (error) { await client.query("ROLLBACK"); throw error; }
  finally { client.release(); }
}

module.exports = { categorias, listar, obtener, crear, actualizar, eliminar, ErrorNoticia };