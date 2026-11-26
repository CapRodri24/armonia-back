const express = require("express");
const { query } = require("../../db");

const router = express.Router();

// PDF subidos en bloques de noticias, programas y paisajes (lectura pública, sin JWT).
// Por defecto se muestra en el navegador; con ?descargar=1 se descarga.
router.get("/pdf/:id", async (req, res, next) => {
  try {
    const id = String(req.params.id);
    if (!/^[1-9]\d{0,17}$/.test(id)) return res.status(404).json({ success: false, message: "PDF no disponible." });
    const result = await query(`
      SELECT p.archivo, p.nombre_archivo
      FROM archivo_pdf p
      WHERE p.id_archivo_pdf = $1
        AND EXISTS (SELECT 1 FROM bloque_editorial b WHERE b.id_archivo_pdf = p.id_archivo_pdf AND b.tipo = 'pdf')
    `, [id]);
    if (!result.rowCount) return res.status(404).json({ success: false, message: "PDF no disponible." });
    const { archivo, nombre_archivo: nombre } = result.rows[0];
    const seguro = nombre.replace(/[/\\\x00-\x1f\x7f"]/g, "_");
    const ascii = seguro.replace(/[^\x20-\x7e]/g, "_");
    const modo = req.query.descargar ? "attachment" : "inline";
    res.set("Content-Type", "application/pdf");
    res.set("Content-Disposition", `${modo}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(seguro)}`);
    res.set("Content-Length", String(archivo.length));
    res.set("Cache-Control", "public, max-age=3600");
    res.set("X-Content-Type-Options", "nosniff");
    return res.end(archivo);
  } catch (error) { return next(error); }
});

module.exports = router;
