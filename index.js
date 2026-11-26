const express = require("express");
const cors = require("cors");
const { connectDB } = require("./db");
const loginRoutes = require("./src/routes/loginRoutes");
const paisajesRoutes = require("./src/routes/paisajesRoutes");
const paisajesPublicosRoutes = require("./src/routes/paisajesPublicosRoutes");

const programasPublicosRoutes = require("./src/routes/programasPublicosRoutes");
const programasRoutes = require("./src/routes/programasRoutes");

const noticiasRoutes = require("./src/routes/noticiasRoutes");
const noticiasPublicosRoutes = require("./src/routes/noticiasPublicosRoutes");
const nosotrosRoutes = require("./src/routes/nosotrosRoutes");
const nosotrosPublicosRoutes = require("./src/routes/nosotrosPublicosRoutes");
const recursosRoutes = require("./src/routes/recursosRoutes");
const recursosPublicosRoutes = require("./src/routes/recursosPublicosRoutes");
const dashboardRoutes = require("./src/routes/dashboardRoutes");
const contenidoPublicoRoutes = require("./src/routes/contenidoPublicoRoutes");
const souvenirsRoutes = require("./src/routes/souvenirsRoutes");
const souvenirsPublicosRoutes = require("./src/routes/souvenirsPublicosRoutes");
const app = express();
// En desarrollo funciona sin .env del frontend. En producción configurar
// FRONTEND_URL en el entorno del backend con el origen real de la web.
const allowedOrigins = ["http://localhost:8080", "https://armoniabo.netlify.app", "https://armoniabolivia.org", "https://www.armoniabolivia.org", ...(process.env.FRONTEND_URL ? [process.env.FRONTEND_URL.replace(/\/$/, "")] : [])];
const corsOptions = {
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error(`El origen ${origin} no tiene permiso de acceso.`));
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
};

app.use(cors(corsOptions));
// Varias imágenes en BYTEA viajan codificadas en base64 dentro del JSON.
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

app.use("/api/login", loginRoutes);
app.use("/api/admin/paisajes", paisajesRoutes);
app.use("/api/paisajes", paisajesPublicosRoutes);
app.use("/api/admin/programas", programasRoutes);
app.use("/api/programas", programasPublicosRoutes);
app.use("/api/admin/noticias", noticiasRoutes);
app.use("/api/noticias", noticiasPublicosRoutes);
app.use("/api/admin/nosotros", nosotrosRoutes);
app.use("/api/nosotros", nosotrosPublicosRoutes);
app.use("/api/admin/recursos", recursosRoutes);
app.use("/api/recursos", recursosPublicosRoutes);
app.use("/api/admin/dashboard", dashboardRoutes);
app.use("/api/contenido", contenidoPublicoRoutes);
app.use("/api/admin/souvenirs", souvenirsRoutes);
app.use("/api/souvenirs", souvenirsPublicosRoutes);

app.use((err, req, res, next) => {
  console.error(err.stack || err);
  if (err.type === "entity.too.large") {
    return res.status(413).json({ success: false, message: "La solicitud contiene demasiados datos o imágenes." });
  }
  res.status(500).json({
    success: false,
    message: "Error interno del servidor",
    error: process.env.NODE_ENV === "development" ? err.message : undefined,
  });
});

app.use((req, res) => {
  res.status(404).json({ success: false, message: `Ruta no encontrada: ${req.originalUrl}` });
});

const startServer = async () => {
  try {
    await connectDB();
    const PORT = process.env.PORT || 5000;
    app.listen(PORT, () => console.log(`Servidor corriendo en el puerto ${PORT}`));
  } catch (error) {
    console.error("Error al iniciar el servidor:", error);
    process.exit(1);
  }
};

startServer();
