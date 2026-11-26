const express = require("express");
const service = require("../services/souvenirsService");

// Catálogo público de souvenirs (sin JWT).
const router = express.Router();

router.get("/", async (req, res, next) => {
  try { res.json({ success: true, data: await service.catalogoPublico() }); }
  catch (error) { next(error); }
});

router.get("/imagenes/:id", async (req, res, next) => {
  try {
    const img = await service.imagenPublica(req.params.id);
    if (!img) return res.status(404).end();
    res.set("Content-Type", img.mime);
    res.set("Cache-Control", "public, max-age=3600");
    res.set("X-Content-Type-Options", "nosniff");
    res.set("Content-Length", String(img.archivo.length));
    return res.end(img.archivo);
  } catch (error) { return next(error); }
});

module.exports = router;
