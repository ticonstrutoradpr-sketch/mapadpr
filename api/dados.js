// GET /api/dados?site=&pagina=&tipo=click|move&dias=30&disp=todos: pontos agregados de uma pagina
// para o mapa (t.js desenha por cima da pagina real). Sem senha, por decisao da dona (21/09): os
// dados sao anonimos e agregados; quem tem o endereco abre direto.
import { parametrosDeConsulta } from '../lib/eventos.js';
import { consultar, bancoConfigurado } from '../lib/db.js';
import { preflight, json } from '../lib/http.js';

export default async function handler(req, res) {
  if (preflight(req, res)) return;
  if (req.method !== 'GET') return json(res, 405, { ok: false, motivo: 'metodo' });
  const p = parametrosDeConsulta(req.query);
  if (!p.site) return json(res, 400, { ok: false, motivo: 'site' });
  if (!bancoConfigurado()) return json(res, 503, { ok: false, motivo: 'banco' });
  try {
    // Agrega em celulas pequenas (0,1% da largura x 8 px) para o mapa nao carregar milhoes de pontos.
    const pontos = await consultar(
      `SELECT round(xr::numeric, 3)::float AS xr, (y / 8) * 8 AS y, count(*)::int AS n
         FROM eventos
        WHERE site = $1 AND pagina = $2 AND tipo = $3
          AND criado_em > now() - ($4::text || ' days')::interval
          AND ($5 = 'todos' OR dispositivo = $5)
        GROUP BY 1, 2
        ORDER BY n DESC
        LIMIT 20000`,
      [p.site, p.pagina, p.tipo, String(p.dias), p.dispositivo]
    );
    const resumo = await consultar(
      `SELECT count(*) FILTER (WHERE tipo = 'view')::int AS visitas,
              count(DISTINCT sessao) FILTER (WHERE tipo = 'view')::int AS sessoes,
              count(*) FILTER (WHERE tipo = $3)::int AS total,
              percentile_cont(0.5) WITHIN GROUP (ORDER BY doc_h)::int AS doc_h,
              round(avg(prof) FILTER (WHERE tipo = 'scroll'))::int AS profundidade_media
         FROM eventos
        WHERE site = $1 AND pagina = $2
          AND criado_em > now() - ($4::text || ' days')::interval
          AND ($5 = 'todos' OR dispositivo = $5)`,
      [p.site, p.pagina, p.tipo, String(p.dias), p.dispositivo]
    );
    const r = resumo.rows[0] || {};
    return json(res, 200, {
      ok: true,
      site: p.site, pagina: p.pagina, tipo: p.tipo, dias: p.dias, dispositivo: p.dispositivo,
      pontos: pontos.rows.map((x) => [x.xr, x.y, x.n]),
      total: r.total || 0,
      visitas: r.visitas || 0,
      sessoes: r.sessoes || 0,
      docH: r.doc_h || null,
      profundidadeMedia: r.profundidade_media || null
    });
  } catch (e) {
    console.error('[dados] falha na consulta', e && e.message);
    return json(res, 500, { ok: false, motivo: 'consulta' });
  }
}
