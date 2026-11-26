const { query } = require("../../db");

function comprobarId(id) {
  return typeof id === "string" && /^[1-9]\d*$/.test(id) && id.length <= 18;
}

async function listar() {
  const result = await query(`
    SELECT pr.id_programa::text AS id_programa, p.id_paisaje::text AS id_paisaje,
           pc.titulo_es AS paisaje_titulo_es, pc.titulo_en AS paisaje_titulo_en,
           c.titulo_es, c.titulo_en, p.color,
           portada.id_imagen::text AS id_imagen_portada,
           resumen.texto_es AS descripcion_es,
           resumen.texto_en AS descripcion_en,
           (SELECT count(*)::integer FROM bloque_editorial b
            WHERE b.id_contenido = c.id_contenido) AS cantidad_bloques
    FROM programa pr
    JOIN paisaje p ON p.id_paisaje = pr.id_paisaje
    JOIN contenido_editorial pc ON pc.id_contenido = p.id_contenido
    JOIN contenido_editorial c ON c.id_contenido = pr.id_contenido
    LEFT JOIN LATERAL (
      SELECT COALESCE(b.id_imagen, ci.id_imagen) AS id_imagen
      FROM bloque_editorial b
      LEFT JOIN LATERAL (
        SELECT ci.id_imagen FROM carrusel_imagen ci
        WHERE ci.id_bloque = b.id_bloque ORDER BY ci.orden LIMIT 1
      ) ci ON b.tipo = 'carrusel'
      WHERE b.id_contenido = c.id_contenido
        AND b.tipo IN ('imagen', 'carrusel')
        AND COALESCE(b.id_imagen, ci.id_imagen) IS NOT NULL
      ORDER BY b.orden LIMIT 1
    ) portada ON TRUE
    LEFT JOIN LATERAL (
      SELECT b.texto_es, b.texto_en
      FROM bloque_editorial b
      WHERE b.id_contenido = c.id_contenido AND b.tipo = 'parrafo'
      ORDER BY b.orden LIMIT 1
    ) resumen ON TRUE
    WHERE c.tipo = 'programa' 
    ORDER BY c.created_at, pr.id_programa
  `);
  return result.rows;
}

async function obtener(id) {
  if (!comprobarId(id)) return null;
  const result = await query(`
    SELECT pr.id_programa::text AS id_programa, p.id_paisaje::text AS id_paisaje,
           pc.titulo_es AS paisaje_titulo_es, pc.titulo_en AS paisaje_titulo_en,
           c.id_contenido::text AS id_contenido,
           c.titulo_es, c.titulo_en, p.color
    FROM programa pr
    JOIN paisaje p ON p.id_paisaje = pr.id_paisaje
    JOIN contenido_editorial pc ON pc.id_contenido = p.id_contenido
    JOIN contenido_editorial c ON c.id_contenido = pr.id_contenido
    WHERE pr.id_programa = $1 AND c.tipo = 'programa'
  `, [id]);
  if (!result.rowCount) return null;
  const programa = result.rows[0];
  const bloques = await query(`
    SELECT b.id_bloque::text AS id_bloque, b.tipo, b.orden,
           b.texto_es, b.texto_en, b.pie_es, b.pie_en,
           b.url, b.id_imagen::text AS id_imagen,
           b.id_archivo_pdf::text AS id_archivo_pdf,
           ap.nombre_archivo AS pdf_nombre, ap.tamano_bytes::integer AS pdf_tamano
    FROM bloque_editorial b
    LEFT JOIN archivo_pdf ap ON ap.id_archivo_pdf = b.id_archivo_pdf
    WHERE b.id_contenido = $1 ORDER BY b.orden
  `, [programa.id_contenido]);
  const fotos = await query(`
    SELECT ci.id_bloque::text AS id_bloque, ci.id_imagen::text AS id_imagen,
           ci.orden, ci.pie_es, ci.pie_en,
           i.credito
    FROM carrusel_imagen ci
    JOIN bloque_editorial b ON b.id_bloque = ci.id_bloque
    JOIN imagen i ON i.id_imagen = ci.id_imagen
    WHERE b.id_contenido = $1
    ORDER BY ci.id_bloque, ci.orden
  `, [programa.id_contenido]);
  const imagenes = await query(`
    SELECT b.id_bloque::text AS id_bloque, i.credito
    FROM bloque_editorial b JOIN imagen i ON i.id_imagen = b.id_imagen
    WHERE b.id_contenido = $1 AND b.tipo = 'imagen'
  `, [programa.id_contenido]);
  const meta = new Map(imagenes.rows.map((item) => [item.id_bloque, item]));
  const carruseles = new Map();
  for (const foto of fotos.rows) {
    if (!carruseles.has(foto.id_bloque)) carruseles.set(foto.id_bloque, []);
    carruseles.get(foto.id_bloque).push({
      id_imagen: foto.id_imagen,
      credito: foto.credito, pie_es: foto.pie_es, pie_en: foto.pie_en,
    });
  }
  return {
    ...programa,
    bloques: bloques.rows.map((b) => ({
      ...b,
      ...(b.tipo === 'imagen' ? { imagen: meta.get(b.id_bloque) || null } : {}),
      ...(b.tipo === 'carrusel' ? { imagenes: carruseles.get(b.id_bloque) || [] } : {}),
    })),
  };
}

module.exports = { listar, obtener };