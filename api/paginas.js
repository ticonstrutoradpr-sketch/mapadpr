// GET /api/paginas?dias=30: uma linha por pagina do site, com visitas, sessoes, cliques, movimentos,
// profundidade media de rolagem e quanto veio de celular. Alimenta o painel. Sem senha, por decisao
// da dona (21/09): dados anonimos e agregados, abre direto.
import { parametrosDeConsulta } from '../lib/eventos.js';
import { consultar, bancoConfigurado } from '../lib/db.js';
import { preflight, json } from '../lib/http.js';

export default async function handler(req, res) {
  if (preflight(req, res)) return;
  if (req.method !== 'GET') return json(res, 405, { ok: false, motivo: 'metodo' });
  const p = parametrosDeConsulta(req.query);
  if (!bancoConfigurado()) return json(res, 503, { ok: false, motivo: 'banco' });
  try {
    const r = await consultar(
      `SELECT site, pagina,
              count(*) FILTER (WHERE tipo = 'view')::int AS visitas,
              count(DISTINCT sessao) FILTER (WHERE tipo = 'view')::int AS sessoes,
              count(*) FILTER (WHERE tipo = 'click')::int AS cliques,
              count(*) FILTER (WHERE tipo = 'move')::int AS movimentos,
              round(avg(prof) FILTER (WHERE tipo = 'scroll'))::int AS profundidade_media,
              count(*) FILTER (WHERE tipo = 'view' AND dispositivo = 'mobile')::int AS visitas_mobile,
              max(criado_em) AS ultimo
         FROM eventos
        WHERE criado_em > now() - ($1::text || ' days')::interval
        GROUP BY 1, 2
        ORDER BY visitas DESC, cliques DESC
        LIMIT 500`,
      [String(p.dias)]
    );
    return json(res, 200, { ok: true, dias: p.dias, paginas: r.rows });
  } catch (e) {
    console.error('[paginas] falha na consulta', e && e.message);
    return json(res, 500, { ok: false, motivo: 'consulta' });
  }
}
