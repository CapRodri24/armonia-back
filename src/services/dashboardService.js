const { pool } = require('../../db');

async function resumen() {
  const { rows } = await pool.query(`
    SELECT
      (SELECT count(*) FROM paisaje)::text AS paisajes,
      COALESCE((SELECT json_agg(json_build_object(
        'id', p.id_paisaje::text, 'titulo', c.titulo_es,
        'programas', (SELECT count(*) FROM programa pr WHERE pr.id_paisaje = p.id_paisaje)::text
      ) ORDER BY p.id_paisaje) FROM paisaje p JOIN contenido_editorial c ON c.id_contenido = p.id_contenido), '[]'::json) AS relaciones_paisajes,
      (SELECT count(*) FROM noticia n JOIN programa pr ON pr.id_programa = n.id_programa)::text AS noticias_asociadas,
      (SELECT count(*) FROM noticia WHERE id_programa IS NULL)::text AS noticias_independientes,
      (SELECT count(*) FROM noticia n WHERE n.id_programa IS NOT NULL AND NOT EXISTS (SELECT 1 FROM programa pr WHERE pr.id_programa = n.id_programa))::text AS noticias_pendientes,
      (SELECT count(*) FROM programa)::text AS programas,
      (SELECT count(*) FROM noticia)::text AS noticias,
      (SELECT count(*) FROM nosotros)::text AS nosotros,
      (SELECT count(*) FROM recurso)::text AS recursos,
      (SELECT count(*) FROM nosotros WHERE tipo = 'junta_directiva')::text AS junta,
      (SELECT count(*) FROM nosotros WHERE tipo = 'nuestro_equipo')::text AS equipo,
      (SELECT count(*) FROM nosotros WHERE tipo = 'socios_y_aliados')::text AS socios,
      (SELECT count(DISTINCT id_archivo_pdf) FROM recurso_pdf)::text AS pdfs,
      COALESCE((SELECT json_agg(json_build_object('id', id, 'tipo', tipo, 'titulo', titulo, 'fecha', to_char(fecha, 'YYYY-MM-DD HH24:MI')) ORDER BY fecha DESC, tipo, id DESC) FROM (
        SELECT * FROM (
          SELECT id_contenido::text AS id, tipo::text, titulo_es AS titulo, updated_at AS fecha FROM contenido_editorial
          UNION ALL
          SELECT id_nosotros::text, 'nosotros', nombre, updated_at FROM nosotros
          UNION ALL
          SELECT id_recurso::text, 'recurso', titulo_es, updated_at FROM recurso
        ) AS registros ORDER BY fecha DESC, tipo, id DESC LIMIT 8
      ) AS recientes), '[]'::json) AS recientes,
      to_char(timezone('America/La_Paz', now()), 'YYYY-MM-DD HH24:MI') AS consultado_en
  `);
  return rows[0];
}
module.exports = { resumen };