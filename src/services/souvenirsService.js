// Tienda de souvenirs: productos (nombre, colores, tallas, precio, imagen)
// y promociones (combos con precio especial y vigencia).
const { pool } = require("../../db");

class ErrorSouvenir extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

const MAX_IMAGEN = 5 * 1024 * 1024;
const texto = (v) => (typeof v === "string" ? v.trim() : "");

function validarId(valor) {
  const s = String(valor ?? "");
  if (!/^[1-9]\d{0,17}$/.test(s)) throw new ErrorSouvenir("Identificador inválido.");
  return s;
}

function validarPrecio(valor, obligatorio) {
  if ((valor === null || valor === undefined || valor === "") && !obligatorio) return null;
  const n = typeof valor === "number" ? valor : Number(String(valor).replace(",", "."));
  if (!Number.isFinite(n) || n < 0 || n > 1000000) throw new ErrorSouvenir("Escribe un precio válido en bolivianos.");
  return Math.round(n * 100) / 100;
}

function validarLista(valor, nombre, maxItems, maxLargo) {
  if (valor === undefined || valor === null) return [];
  if (!Array.isArray(valor)) throw new ErrorSouvenir(`La lista de ${nombre} no es válida.`);
  const lista = [...new Set(valor.map(texto).filter(Boolean))];
  if (lista.length > maxItems) throw new ErrorSouvenir(`Máximo ${maxItems} ${nombre}.`);
  if (lista.some((x) => x.length > maxLargo)) throw new ErrorSouvenir(`Cada valor de ${nombre} admite como máximo ${maxLargo} caracteres.`);
  return lista;
}

function validarImagen(imagen, obligatoria) {
  if (!imagen) {
    if (obligatoria) throw new ErrorSouvenir("Sube la imagen del producto.");
    return null;
  }
  if (imagen.id_imagen) return { id_imagen: validarId(imagen.id_imagen) };
  const m = /^data:(image\/(?:jpeg|png|webp|gif));base64,([A-Za-z0-9+/]+={0,2})$/.exec(texto(imagen.archivo));
  if (!m) throw new ErrorSouvenir("La imagen debe ser JPG, PNG, WEBP o GIF.");
  const bytes = Buffer.from(m[2], "base64");
  if (!bytes.length || bytes.length > MAX_IMAGEN) throw new ErrorSouvenir("La imagen debe pesar como máximo 5 MB.");
  const mime = m[1];
  const real = mime === "image/png" ? bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
    : mime === "image/jpeg" ? bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
    : mime === "image/gif" ? ["GIF87a", "GIF89a"].includes(bytes.toString("ascii", 0, 6))
    : bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP";
  if (!real) throw new ErrorSouvenir("El archivo no coincide con el formato de imagen indicado.");
  return { archivo: bytes, mime, nombre_archivo: texto(imagen.nombre_archivo).slice(0, 255) || "souvenir" };
}

async function guardarImagen(client, imagen, anterior) {
  if (!imagen) return null;
  if (imagen.id_imagen) {
    // Solo se puede conservar la imagen que ya tenía este registro.
    if (imagen.id_imagen !== String(anterior ?? "")) throw new ErrorSouvenir("La imagen indicada no pertenece a este registro.");
    return imagen.id_imagen;
  }
  const r = await client.query(
    "INSERT INTO imagen (archivo, nombre_archivo, mime) VALUES ($1,$2,$3) RETURNING id_imagen::text AS id",
    [imagen.archivo, imagen.nombre_archivo, imagen.mime]
  );
  return r.rows[0].id;
}

// Borra la imagen anterior si ya no la usa ningún producto ni promoción.
async function limpiarImagen(client, id) {
  if (!id) return;
  await client.query(`
    DELETE FROM imagen i WHERE i.id_imagen = $1
      AND NOT EXISTS (SELECT 1 FROM souvenir s WHERE s.id_imagen = i.id_imagen)
      AND NOT EXISTS (SELECT 1 FROM souvenir_promocion p WHERE p.id_imagen = i.id_imagen)`, [id]);
}

async function tx(fn) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const r = await fn(client);
    await client.query("COMMIT");
    return r;
  } catch (e) { await client.query("ROLLBACK"); throw e; }
  finally { client.release(); }
}

// ---------- Productos ----------
const selectProducto = `
  SELECT s.id_souvenir::text AS id_souvenir, s.nombre_es, s.nombre_en, s.colores_es, s.colores_en,
         s.tallas, s.precio::float8 AS precio, s.id_imagen::text AS id_imagen, s.disponible
  FROM souvenir s`;

function validarProducto(d) {
  if (!d || typeof d !== "object") throw new ErrorSouvenir("Datos de producto inválidos.");
  const nombre_es = texto(d.nombre_es);
  if (!nombre_es) throw new ErrorSouvenir("Escribe el nombre del producto.");
  if (nombre_es.length > 150) throw new ErrorSouvenir("El nombre admite como máximo 150 caracteres.");
  const nombre_en = (texto(d.nombre_en) || nombre_es).slice(0, 150);
  const colores_es = validarLista(d.colores_es, "colores", 20, 40);
  let colores_en = validarLista(d.colores_en, "colores", 20, 40);
  if (colores_en.length !== colores_es.length) colores_en = colores_es;
  const tallas = validarLista(d.tallas, "tallas", 20, 20);
  const precio = validarPrecio(d.precio, true);
  const disponible = d.disponible !== false;
  return { nombre_es, nombre_en, colores_es, colores_en, tallas, precio, disponible };
}

async function listarProductos() {
  return (await pool.query(`${selectProducto} ORDER BY s.created_at, s.id_souvenir`)).rows;
}

async function crearProducto(d) {
  const p = validarProducto(d);
  const imagen = validarImagen(d.imagen, true);
  if (imagen.id_imagen) throw new ErrorSouvenir("Sube la imagen del producto.");
  return tx(async (c) => {
    const idImagen = await guardarImagen(c, imagen, null);
    const r = await c.query(
      `INSERT INTO souvenir (nombre_es,nombre_en,colores_es,colores_en,tallas,precio,id_imagen,disponible)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id_souvenir::text AS id`,
      [p.nombre_es, p.nombre_en, p.colores_es, p.colores_en, p.tallas, p.precio, idImagen, p.disponible]);
    return r.rows[0].id;
  });
}

async function actualizarProducto(id, d) {
  id = validarId(id);
  const p = validarProducto(d);
  const imagen = validarImagen(d.imagen, true);
  return tx(async (c) => {
    const actual = (await c.query("SELECT id_imagen::text AS id_imagen FROM souvenir WHERE id_souvenir=$1 FOR UPDATE", [id])).rows[0];
    if (!actual) throw new ErrorSouvenir("Producto no encontrado.", 404);
    const idImagen = await guardarImagen(c, imagen, actual.id_imagen);
    await c.query(
      `UPDATE souvenir SET nombre_es=$1,nombre_en=$2,colores_es=$3,colores_en=$4,tallas=$5,precio=$6,id_imagen=$7,disponible=$8
       WHERE id_souvenir=$9`,
      [p.nombre_es, p.nombre_en, p.colores_es, p.colores_en, p.tallas, p.precio, idImagen, p.disponible, id]);
    if (idImagen !== actual.id_imagen) await limpiarImagen(c, actual.id_imagen);
    return id;
  });
}

async function eliminarProducto(id) {
  id = validarId(id);
  return tx(async (c) => {
    const r = await c.query("DELETE FROM souvenir WHERE id_souvenir=$1 RETURNING id_imagen::text AS id_imagen", [id]);
    if (!r.rowCount) throw new ErrorSouvenir("Producto no encontrado.", 404);
    await limpiarImagen(c, r.rows[0].id_imagen);
  });
}

// ---------- Promociones ----------
const selectPromocion = `
  SELECT p.id_promocion::text AS id_promocion, p.titulo_es, p.titulo_en,
         COALESCE(p.descripcion_es,'') AS descripcion_es, COALESCE(p.descripcion_en,'') AS descripcion_en,
         p.id_imagen::text AS id_imagen, p.precio::float8 AS precio,
         to_char(p.fecha_inicio,'YYYY-MM-DD') AS fecha_inicio, to_char(p.fecha_fin,'YYYY-MM-DD') AS fecha_fin, p.activa,
         COALESCE((SELECT json_agg(json_build_object('id_souvenir', pp.id_souvenir::text, 'cantidad', pp.cantidad) ORDER BY pp.orden)
                   FROM souvenir_promocion_producto pp WHERE pp.id_promocion = p.id_promocion), '[]'::json) AS productos
  FROM souvenir_promocion p`;

function validarFecha(valor) {
  const v = texto(valor);
  if (!v) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v) || Number.isNaN(Date.parse(`${v}T00:00:00Z`))) throw new ErrorSouvenir("Fecha inválida.");
  return v;
}

function validarPromocion(d) {
  if (!d || typeof d !== "object") throw new ErrorSouvenir("Datos de promoción inválidos.");
  const titulo_es = texto(d.titulo_es);
  if (!titulo_es) throw new ErrorSouvenir("Escribe el título de la promoción.");
  if (titulo_es.length > 150) throw new ErrorSouvenir("El título admite como máximo 150 caracteres.");
  const titulo_en = (texto(d.titulo_en) || titulo_es).slice(0, 150);
  const descripcion_es = texto(d.descripcion_es);
  if (descripcion_es.length > 1000) throw new ErrorSouvenir("La descripción admite como máximo 1000 caracteres.");
  const descripcion_en = texto(d.descripcion_en) || descripcion_es;
  const precio = validarPrecio(d.precio, false);
  const fecha_inicio = validarFecha(d.fecha_inicio);
  const fecha_fin = validarFecha(d.fecha_fin);
  if (fecha_inicio && fecha_fin && fecha_fin < fecha_inicio) throw new ErrorSouvenir("La fecha de fin no puede ser anterior a la de inicio.");
  if (!Array.isArray(d.productos ?? [])) throw new ErrorSouvenir("La lista de productos no es válida.");
  const productos = [];
  for (const item of d.productos ?? []) {
    const id_souvenir = validarId(item?.id_souvenir);
    const cantidad = Number(item?.cantidad ?? 1);
    if (!Number.isInteger(cantidad) || cantidad < 1 || cantidad > 99) throw new ErrorSouvenir("La cantidad de cada producto debe estar entre 1 y 99.");
    if (productos.some((x) => x.id_souvenir === id_souvenir)) throw new ErrorSouvenir("Un producto está repetido en la promoción.");
    productos.push({ id_souvenir, cantidad });
  }
  if (productos.length > 20) throw new ErrorSouvenir("Máximo 20 productos por promoción.");
  return { titulo_es, titulo_en, descripcion_es, descripcion_en, precio, fecha_inicio, fecha_fin, activa: d.activa !== false, productos };
}

async function guardarProductosPromocion(c, idPromocion, productos) {
  await c.query("DELETE FROM souvenir_promocion_producto WHERE id_promocion=$1", [idPromocion]);
  for (let i = 0; i < productos.length; i++) {
    const existe = await c.query("SELECT 1 FROM souvenir WHERE id_souvenir=$1", [productos[i].id_souvenir]);
    if (!existe.rowCount) throw new ErrorSouvenir("Uno de los productos de la promoción ya no existe.");
    await c.query("INSERT INTO souvenir_promocion_producto (id_promocion,id_souvenir,cantidad,orden) VALUES ($1,$2,$3,$4)",
      [idPromocion, productos[i].id_souvenir, productos[i].cantidad, i + 1]);
  }
}

async function listarPromociones() {
  return (await pool.query(`${selectPromocion} ORDER BY p.created_at DESC, p.id_promocion DESC`)).rows;
}

async function crearPromocion(d) {
  const p = validarPromocion(d);
  const imagen = validarImagen(d.imagen, false);
  if (imagen?.id_imagen) throw new ErrorSouvenir("La imagen indicada no pertenece a este registro.");
  return tx(async (c) => {
    const idImagen = await guardarImagen(c, imagen, null);
    const r = await c.query(
      `INSERT INTO souvenir_promocion (titulo_es,titulo_en,descripcion_es,descripcion_en,id_imagen,precio,fecha_inicio,fecha_fin,activa)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id_promocion::text AS id`,
      [p.titulo_es, p.titulo_en, p.descripcion_es || null, p.descripcion_en || null, idImagen, p.precio, p.fecha_inicio, p.fecha_fin, p.activa]);
    await guardarProductosPromocion(c, r.rows[0].id, p.productos);
    return r.rows[0].id;
  });
}

async function actualizarPromocion(id, d) {
  id = validarId(id);
  const p = validarPromocion(d);
  const imagen = validarImagen(d.imagen, false);
  return tx(async (c) => {
    const actual = (await c.query("SELECT id_imagen::text AS id_imagen FROM souvenir_promocion WHERE id_promocion=$1 FOR UPDATE", [id])).rows[0];
    if (!actual) throw new ErrorSouvenir("Promoción no encontrada.", 404);
    const idImagen = await guardarImagen(c, imagen, actual.id_imagen);
    await c.query(
      `UPDATE souvenir_promocion SET titulo_es=$1,titulo_en=$2,descripcion_es=$3,descripcion_en=$4,id_imagen=$5,precio=$6,
       fecha_inicio=$7,fecha_fin=$8,activa=$9 WHERE id_promocion=$10`,
      [p.titulo_es, p.titulo_en, p.descripcion_es || null, p.descripcion_en || null, idImagen, p.precio, p.fecha_inicio, p.fecha_fin, p.activa, id]);
    await guardarProductosPromocion(c, id, p.productos);
    if (actual.id_imagen && idImagen !== actual.id_imagen) await limpiarImagen(c, actual.id_imagen);
    return id;
  });
}

async function eliminarPromocion(id) {
  id = validarId(id);
  return tx(async (c) => {
    const r = await c.query("DELETE FROM souvenir_promocion WHERE id_promocion=$1 RETURNING id_imagen::text AS id_imagen", [id]);
    if (!r.rowCount) throw new ErrorSouvenir("Promoción no encontrada.", 404);
    await limpiarImagen(c, r.rows[0].id_imagen);
  });
}

// ---------- Público ----------
async function catalogoPublico() {
  const productos = (await pool.query(`${selectProducto} WHERE s.disponible ORDER BY s.created_at, s.id_souvenir`)).rows;
  // Vigentes según la fecha de La Paz; solo con productos disponibles.
  const promociones = (await pool.query(`${selectPromocion}
    WHERE p.activa
      AND (p.fecha_inicio IS NULL OR p.fecha_inicio <= TIMEZONE('America/La_Paz', NOW())::date)
      AND (p.fecha_fin IS NULL OR p.fecha_fin >= TIMEZONE('America/La_Paz', NOW())::date)
    ORDER BY p.created_at DESC, p.id_promocion DESC`)).rows;
  const disponibles = new Set(productos.map((p) => p.id_souvenir));
  for (const promo of promociones) promo.productos = promo.productos.filter((x) => disponibles.has(x.id_souvenir));
  return { productos, promociones };
}

async function imagenPublica(id) {
  if (!/^[1-9]\d{0,17}$/.test(String(id))) return null;
  const r = await pool.query(`
    SELECT i.archivo, i.mime FROM imagen i
    WHERE i.id_imagen = $1 AND (
      EXISTS (SELECT 1 FROM souvenir s WHERE s.id_imagen = i.id_imagen)
      OR EXISTS (SELECT 1 FROM souvenir_promocion p WHERE p.id_imagen = i.id_imagen))`, [String(id)]);
  return r.rows[0] || null;
}

module.exports = {
  ErrorSouvenir,
  listarProductos, crearProducto, actualizarProducto, eliminarProducto,
  listarPromociones, crearPromocion, actualizarPromocion, eliminarPromocion,
  catalogoPublico, imagenPublica,
};
