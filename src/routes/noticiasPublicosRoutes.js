const express = require("express");
const controller = require("../controllers/noticiasPublicosController");
const router = express.Router();
router.get("/", controller.listar);
router.get("/imagenes/:id",controller.imagen);
router.get("/:id", controller.obtener);
module.exports = router;