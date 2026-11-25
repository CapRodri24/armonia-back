const express = require("express");
const controller = require("../controllers/noticiasController");
const { authenticate } = require("../middleware/loginMiddleware");

const router = express.Router();

// Ruta pública
router.get("/categorias", controller.categorias);

// Autenticación obligatoria para las siguientes rutas
router.use(authenticate);

router.get("/", controller.listar);
router.get("/:id", controller.obtener);
router.post("/", controller.crear);
router.put("/:id", controller.actualizar);
router.delete("/:id", controller.eliminar);

module.exports = router;