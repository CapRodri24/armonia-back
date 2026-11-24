const bcrypt = require("bcryptjs");
const { query } = require("../../db");

async function autenticarUsuario(usuario, contrasena) {
  const resultado = await query(
    `SELECT id_usuario, usuario, contrasena_hash
       FROM usuario
      WHERE usuario = $1
      LIMIT 1`,
    [usuario]
  );

  const registro = resultado.rows[0];
  if (!registro) return null;

  const coincide = await bcrypt.compare(contrasena, registro.contrasena_hash);
  if (!coincide) return null;

  return {
    id_usuario: String(registro.id_usuario),
    usuario: registro.usuario,
  };
}

async function buscarUsuarioPorId(idUsuario) {
  const resultado = await query(
    `SELECT id_usuario, usuario FROM usuario WHERE id_usuario = $1 LIMIT 1`,
    [idUsuario]
  );
  const registro = resultado.rows[0];
  return registro
    ? { id_usuario: String(registro.id_usuario), usuario: registro.usuario }
    : null;
}

module.exports = { autenticarUsuario, buscarUsuarioPorId };