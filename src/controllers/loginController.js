const jwt = require("jsonwebtoken");
const loginService = require("../services/loginService");

function crearToken(usuario) {
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
    throw new Error("JWT_SECRET debe contener al menos 32 caracteres");
  }
  return jwt.sign(
    { sub: usuario.id_usuario },
    process.env.JWT_SECRET,
    { algorithm: "HS256", expiresIn: "8h", issuer: "armonia-api" }
  );
}

async function iniciarSesion(req, res, next) {
  try {
    const { usuario, contrasena } = req.body || {};
    if (
      typeof usuario !== "string" ||
      typeof contrasena !== "string" ||
      !usuario.trim() ||
      !contrasena ||
      usuario.trim().length > 80 ||
      contrasena.length > 1024
    ) {
      return res.status(400).json({
        success: false,
        message: "Ingresa un usuario y una contraseña válidos.",
      });
    }

    const cuenta = await loginService.autenticarUsuario(usuario.trim(), contrasena);
    if (!cuenta) {
      return res.status(401).json({
        success: false,
        message: "Usuario o contraseña incorrectos.",
      });
    }

    return res.json({
      success: true,
      data: { token: crearToken(cuenta), usuario: cuenta },
    });
  } catch (error) {
    return next(error);
  }
}

async function sesionActual(req, res) {
  return res.json({ success: true, data: { usuario: req.user } });
}

module.exports = { iniciarSesion, sesionActual };