const service = require("../services/paisajesPublicosService");

async function listar(req, res, next) {
  try {
    return res.json({ success: true, data: await service.listar() });
  } catch (error) { return next(error); }
}

async function obtener(req, res, next) {
  try {
    const data = await service.obtener(req.params.id);
    if (!data) return res.status(404).json({ success: false, message: "Paisaje no encontrado." });
    return res.json({ success: true, data });
  } catch (error) { return next(error); }
}

async function imagen(req, res, next) {
  try {
    const data = await service.obtenerImagen(req.params.id);
    if (!data) return res.status(404).end();
    const buffer = data.archivo;
    res.set("Content-Type", data.mime);
    res.set("Cache-Control", "public, max-age=3600");
    res.set("X-Content-Type-Options", "nosniff");
    res.set("Content-Length", String(buffer.length));
    return res.end(buffer);
  } catch (error) { return next(error); }
}

module.exports = { listar, obtener, imagen };