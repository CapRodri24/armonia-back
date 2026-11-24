const express = require("express");
const cors = require("cors");
const { connectDB } = require("./db");
const loginRoutes = require("./src/routes/loginRoutes");
const paisajesRoutes = require("./src/routes/paisajesRoutes");

const app = express();
const allowedOrigins = ["http://localhost:8080"];
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