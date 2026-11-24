const service = require("../services/noticiasPublicosService");

async function listar(req, res, next) {
  try {
    return res.json({ success: true, data: await service.listar() });
  } catch (error) { return next(error); }
}

async function obtener(req, res, next) {
  try {
    const data = await service.obtener(req.params.id);
    if (!data) return res.status(404).json({ success: false, message: "Noticia no encontrada." });
    return res.json({ success: true, data });
  } catch (error) { return next(error); }
}

async function imagen(req,res,next) {
  try { const data=await service.obtenerImagen(req.params.id); if (!data) return res.sendStatus(404); res.set("Content-Type",data.mime); res.set("X-Content-Type-Options","nosniff"); res.set("Cache-Control","public, max-age=300"); return res.send(data.archivo); } catch(e) { return next(e); }
}
module.exports = { listar, obtener, imagen };