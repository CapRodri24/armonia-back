const service = require("../services/paisajesService");

function responderError(error, res, next) {
  if (error instanceof service.ErrorPaisaje) {
    return res.status(error.status).json({ success: false, message: error.message });
  }
  if (error.code === "23503") return res.status(409).json({ success: false, message: "El registro tiene asociaciones y no se puede eliminar." });
  if (error.code === "23505") return res.status(409).json({ success: false, message: "Ya existe un registro con esos datos." });
  return next(error);
}

async function listar(req, res, next) {
  try { res.json({ success: true, data: await service.listar() }); }
  catch (error) { responderError(error, res, next); }
}
async function obtener(req, res, next) {
  try { res.json({ success: true, data: await service.obtener(req.params.id) }); }
  catch (error) { responderError(error, res, next); }
}
async function crear(req, res, next) {
  try {
    const id = await service.crear(req.body);
    res.status(201).json({ success: true, message: "Paisaje creado correctamente.", data: { id_paisaje: id } });
  } catch (error) { responderError(error, res, next); }
}
async function actualizar(req, res, next) {
  try {
    const id = await service.actualizar(req.params.id, req.body);
    res.json({ success: true, message: "Paisaje actualizado correctamente.", data: { id_paisaje: id } });
  } catch (error) { responderError(error, res, next); }
}
async function eliminar(req, res, next) {
  try { await service.eliminar(req.params.id); res.json({ success: true, message: "Paisaje eliminado correctamente." }); }
  catch (error) { responderError(error, res, next); }
}
module.exports = { listar, obtener, crear, actualizar, eliminar };