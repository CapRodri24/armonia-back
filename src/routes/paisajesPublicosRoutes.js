const express = require("express");
const controller = require("../controllers/paisajesPublicosController");

const router = express.Router();
// Rutas de solo lectura, sin JWT: datos públicos de paisajes.
router.get("/imagenes/:id", controller.imagen);
router.get("/:id", controller.obtener);
router.get("/", controller.listar);
module.exports = router;