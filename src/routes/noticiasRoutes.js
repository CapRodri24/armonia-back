const express = require("express");
const controller = require("../controllers/noticiasController");
const { authenticate } = require("../middleware/loginMiddleware");

const router = express.Router();
router.use(authenticate);
router.get("/", controller.listar);
router.get("/categorias", controller.categorias);
router.get("/:id", controller.obtener);
router.post("/", controller.crear);
router.put("/:id", controller.actualizar);
router.delete("/:id", controller.eliminar);
module.exports = router;