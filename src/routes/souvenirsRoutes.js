const express = require("express");
const service = require("../services/souvenirsService");
const { authenticate } = require("../middleware/loginMiddleware");

// Administración de souvenirs (requiere sesión).
const router = express.Router();
router.use(authenticate);

const accion = (fn) => async (req, res, next) => {
  try { await fn(req, res); }
  catch (error) {
    if (error instanceof service.ErrorSouvenir) return res.status(error.status).json({ success: false, message: error.message });
    if (error.code === "23503") return res.status(409).json({ success: false, message: "El registro tiene asociaciones y no se puede eliminar." });
    return next(error);
  }
};

router.get("/productos", accion(async (req, res) => res.json({ success: true, data: await service.listarProductos() })));
router.post("/productos", accion(async (req, res) => res.status(201).json({ success: true, message: "Producto creado correctamente.", data: { id_souvenir: await service.crearProducto(req.body) } })));
router.put("/productos/:id", accion(async (req, res) => res.json({ success: true, message: "Producto actualizado correctamente.", data: { id_souvenir: await service.actualizarProducto(req.params.id, req.body) } })));
router.delete("/productos/:id", accion(async (req, res) => { await service.eliminarProducto(req.params.id); res.json({ success: true, message: "Producto eliminado correctamente." }); }));

router.get("/promociones", accion(async (req, res) => res.json({ success: true, data: await service.listarPromociones() })));
router.post("/promociones", accion(async (req, res) => res.status(201).json({ success: true, message: "Promoción creada correctamente.", data: { id_promocion: await service.crearPromocion(req.body) } })));
router.put("/promociones/:id", accion(async (req, res) => res.json({ success: true, message: "Promoción actualizada correctamente.", data: { id_promocion: await service.actualizarPromocion(req.params.id, req.body) } })));
router.delete("/promociones/:id", accion(async (req, res) => { await service.eliminarPromocion(req.params.id); res.json({ success: true, message: "Promoción eliminada correctamente." }); }));

module.exports = router;
