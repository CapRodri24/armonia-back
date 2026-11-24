const service = require("../services/noticiasService");

function responderError(error, res, next) {
  if (typeof service.ErrorNoticia === "function" && error instanceof service.ErrorNoticia) {
    return res.status(error.status).json({ success: false, message: error.message });
  }
  if (error?.code === "23503") return res.status(409).json({ success: false, message: "El registro tiene asociaciones y no se puede eliminar." });
  if (error?.code === "23505") return res.status(409).json({ success: false, message: "Ya existe un registro con esos datos." });
  return next(error instanceof Error ? error : new Error("Error inesperado en el servicio de noticias."));
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
    res.status(201).json({ success: true, message: "Noticia creada correctamente.", data: { id_noticia: id } });
  } catch (error) { responderError(error, res, next); }
}
async function actualizar(req, res, next) {
  try {
    const id = await service.actualizar(req.params.id, req.body);
    res.json({ success: true, message: "Noticia actualizada correctamente.", data: { id_noticia: id } });
  } catch (error) { responderError(error, res, next); }
}
async function eliminar(req, res, next) {
  try { await service.eliminar(req.params.id); res.json({ success: true, message: "Noticia eliminada correctamente." }); }
  catch (error) { responderError(error, res, next); }
}
async function categorias(req,res,next) { try { res.json({success:true,data:await service.categorias()}); } catch(e) { responderError(e,res,next); } }
module.exports = { categorias, listar, obtener, crear, actualizar, eliminar };