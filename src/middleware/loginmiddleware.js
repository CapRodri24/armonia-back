const jwt = require("jsonwebtoken");
const { buscarUsuarioPorId } = require("../services/loginService");

async function authenticate(req, res, next) {
  const authorization = req.headers.authorization;
  if (!authorization || !/^Bearer\s+\S+$/i.test(authorization)) {
    return res.status(401).json({ success: false, message: "No se proporcionó un token válido." });
  }
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
    return next(new Error("JWT_SECRET no está configurado correctamente"));
  }
  try {
    const token = authorization.replace(/^Bearer\s+/i, "");
    const payload = jwt.verify(token, process.env.JWT_SECRET, {
      algorithms: ["HS256"],
      issuer: "armonia-api",
    });
    if (typeof payload !== "object" || !/^\d+$/.test(String(payload.sub ?? ""))) {
      return res.status(401).json({ success: false, message: "Token de sesión inválido." });
    }
    const usuario = await buscarUsuarioPorId(String(payload.sub));
    if (!usuario) {
      return res.status(401).json({ success: false, message: "La cuenta ya no está disponible." });
    }
    req.user = usuario;
    return next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError || error instanceof jwt.TokenExpiredError) {
      return res.status(401).json({ success: false, message: "La sesión es inválida o ha expirado." });
    }
    return next(error);
  }
}

module.exports = { authenticate };