const express = require("express");
const { iniciarSesion, sesionActual } = require("../controllers/loginController");
const { authenticate } = require("../middleware/loginMiddleware");

const router = express.Router();

router.post("/", iniciarSesion);
router.get("/me", authenticate, sesionActual);

module.exports = router;