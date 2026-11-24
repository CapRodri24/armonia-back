const service = require("../services/programasPublicosService");

async function listar(req, res, next) {
  try {
    return res.json({ success: true, data: await service.listar() });
  } catch (error) { return next(error); }
}

async function obtener(req, res, next) {
  try {
    const data = await service.obtener(req.params.id);
    if (!data) return res.status(404).json({ success: false, message: "Programa no encontrado." });
    return res.json({ success: true, data });
  } catch (error) { return next(error); }
}

module.exports = { listar, obtener };