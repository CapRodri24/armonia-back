const bcrypt = require('bcryptjs');
const { pool } = require('./db');

const COSTO = 10;
const BCRYPT = /^\$2[aby]\$(?:0[4-9]|[12][0-9]|3[01])\$[./A-Za-z0-9]{53}$/;

async function hashAllPasswords() {
  let client;
  let transaccion = false;
  try {
    client = await pool.connect();
    await client.query('BEGIN');
    transaccion = true;
    const { rows } = await client.query(`
      SELECT id_usuario, contrasena_hash
      FROM usuario
      ORDER BY id_usuario
      FOR UPDATE
    `);
    let actualizados = 0;
    let omitidos = 0;
    for (const registro of rows) {
      const original = registro.contrasena_hash;
      if (typeof original !== 'string' || !original.trim()) {
        throw new Error(`Contraseña vacía en usuario ID ${registro.id_usuario}.`);
      }
      if (BCRYPT.test(original)) {
        omitidos++;
        continue;
      }
      if (/^\$2/.test(original.trim())) {
        throw new Error(`Posible hash bcrypt inválido en usuario ID ${registro.id_usuario}. Revísalo antes de continuar.`);
      }
      if (Buffer.byteLength(original, 'utf8') > 72) {
        throw new Error(`Contraseña superior a 72 bytes en usuario ID ${registro.id_usuario}.`);
      }
      const hash = await bcrypt.hash(original, COSTO);
      await client.query(
        'UPDATE usuario SET contrasena_hash = $1 WHERE id_usuario = $2',
        [hash, registro.id_usuario]
      );
      actualizados++;
    }
    await client.query('COMMIT');
    transaccion = false;
    console.log(`Proceso completado. Actualizados: ${actualizados}. Hashes existentes conservados: ${omitidos}.`);
  } catch (error) {
    if (client && transaccion) {
      try { await client.query('ROLLBACK'); }
      catch { console.error('No se pudo confirmar la reversión de la transacción.'); }
    }
    console.error('No se completó el proceso:', error.message);
    process.exitCode = 1;
  } finally {
    if (client) client.release();
    await pool.end();
  }
}

hashAllPasswords().catch(() => {
  console.error('Error inesperado al cerrar el proceso.');
  process.exitCode = 1;
});