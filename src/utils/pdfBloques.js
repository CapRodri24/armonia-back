// PDF subidos en los bloques de noticias, programas y paisajes.
// Se guardan en archivo_pdf (BYTEA), la misma tabla que usan los Recursos.
const MAX_PDF = 10 * 1024 * 1024;

function validarPdf(pdf, ErrorTipo) {
  if (!pdf || typeof pdf !== "object" || Array.isArray(pdf)) throw new ErrorTipo("Adjunta el archivo PDF del bloque.");
  if (pdf.id_archivo_pdf !== undefined && pdf.id_archivo_pdf !== null) {
    const id = String(pdf.id_archivo_pdf);
    if (!/^[1-9]\d{0,17}$/.test(id)) throw new ErrorTipo("Identificador de PDF inválido.");
    return { id_archivo_pdf: id };
  }
  const match = /^data:application\/pdf;base64,([A-Za-z0-9+/]+={0,2})$/.exec(typeof pdf.archivo === "string" ? pdf.archivo : "");
  if (!match) throw new ErrorTipo("El archivo del bloque debe ser un PDF.");
  const bytes = Buffer.from(match[1], "base64");
  if (!bytes.length || bytes.length > MAX_PDF) throw new ErrorTipo("Cada PDF debe pesar como máximo 10 MB.");
  if (bytes.toString("ascii", 0, 5) !== "%PDF-") throw new ErrorTipo("El archivo no es un PDF válido.");
  let nombre = (typeof pdf.nombre_archivo === "string" ? pdf.nombre_archivo.trim() : "")
    .replace(/[/\\\x00-\x1f\x7f]/g, "_").slice(0, 255) || "documento.pdf";
  if (!nombre.toLowerCase().endsWith(".pdf")) nombre = `${nombre.slice(0, 251)}.pdf`;
  return { archivo: bytes, nombre_archivo: nombre };
}

async function guardarPdf(client, pdf, ErrorTipo) {
  if (pdf.id_archivo_pdf) {
    const result = await client.query("SELECT 1 FROM archivo_pdf WHERE id_archivo_pdf=$1", [pdf.id_archivo_pdf]);
    if (!result.rowCount) throw new ErrorTipo("Uno de los PDF ya no existe.");
    return pdf.id_archivo_pdf;
  }
  const result = await client.query(
    "INSERT INTO archivo_pdf (archivo, nombre_archivo) VALUES ($1,$2) RETURNING id_archivo_pdf::text AS id",
    [pdf.archivo, pdf.nombre_archivo]
  );
  return result.rows[0].id;
}

async function obtenerPdf(client, id) {
  const result = await client.query(
    "SELECT id_archivo_pdf::text AS id_archivo_pdf, nombre_archivo, tamano_bytes::integer AS tamano_bytes FROM archivo_pdf WHERE id_archivo_pdf=$1",
    [id]
  );
  return result.rows[0] || null;
}

// Borra los PDF que ya no usa ningún bloque ni recurso (por ejemplo, al quitar un bloque).
async function limpiarPdfHuerfanos(client) {
  await client.query(`
    DELETE FROM archivo_pdf a
    WHERE NOT EXISTS (SELECT 1 FROM bloque_editorial b WHERE b.id_archivo_pdf = a.id_archivo_pdf)
      AND NOT EXISTS (SELECT 1 FROM recurso_pdf r WHERE r.id_archivo_pdf = a.id_archivo_pdf)`);
}

module.exports = { MAX_PDF, validarPdf, guardarPdf, obtenerPdf, limpiarPdfHuerfanos };
