// GET /api/paginas?dias=30: uma linha por pagina do site, com visitas, sessoes, cliques, movimentos,
// profundidade media de rolagem e quanto veio de celular. Alimenta o painel. Vem da planilha (Apps
// Script) ou, sem planilha configurada, dos dados de demonstracao (demo: true). Sem senha, por
// decisao da dona (21/09): dados anonimos e agregados, abre direto.
import { parametrosDeConsulta } from '../lib/eventos.js';
import { planilhaConfigurada, consultarPlanilha } from '../lib/planilha.js';
import { paginasDemo } from '../lib/demo.js';
import { preflight, json } from '../lib/http.js';

export default async function handler(req, res) {
  if (preflight(req, res)) return;
  if (req.method !== 'GET') return json(res, 405, { ok: false, motivo: 'metodo' });
  const p = parametrosDeConsulta(req.query);

  if (!planilhaConfigurada()) {
    return json(res, 200, { ok: true, demo: true, dias: p.dias, paginas: paginasDemo(p.dias) });
  }
  try {
    const d = await consultarPlanilha('paginas', { dias: p.dias });
    if (!d.ok) return json(res, 502, { ok: false, motivo: d.motivo || 'planilha' });
    return json(res, 200, d);
  } catch (e) {
    console.error('[paginas] falha na consulta', e && e.message);
    return json(res, 500, { ok: false, motivo: 'consulta' });
  }
}
