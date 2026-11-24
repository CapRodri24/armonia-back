const express = require("express");
const controller = require("../controllers/programasPublicosController");
const router = express.Router();
router.get("/", controller.listar);
router.get("/:id", controller.obtener);
module.exports = router;