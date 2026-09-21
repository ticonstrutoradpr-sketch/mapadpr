// GET /api/dados?site=&pagina=&tipo=click|move&dias=30&disp=todos&h=<altura>: pontos agregados de
// uma pagina para o mapa (t.js desenha por cima da pagina real). Vem da planilha (Apps Script) ou,
// sem planilha configurada, dos dados de demonstracao (demo: true). Sem senha, por decisao da dona
// (21/09): dados anonimos e agregados; quem tem o endereco abre direto.
import { parametrosDeConsulta } from '../lib/eventos.js';
import { planilhaConfigurada, consultarPlanilha } from '../lib/planilha.js';
import { dadosDemo } from '../lib/demo.js';
import { preflight, json } from '../lib/http.js';

export default async function handler(req, res) {
  if (preflight(req, res)) return;
  if (req.method !== 'GET') return json(res, 405, { ok: false, motivo: 'metodo' });
  const p = parametrosDeConsulta(req.query);
  if (!p.site) return json(res, 400, { ok: false, motivo: 'site' });

  if (!planilhaConfigurada()) {
    return json(res, 200, dadosDemo({ pagina: p.pagina, tipo: p.tipo, dias: p.dias, dispositivo: p.dispositivo, altura: req.query && req.query.h }));
  }
  try {
    const d = await consultarPlanilha('dados', { site: p.site, pagina: p.pagina, tipo: p.tipo, dias: p.dias, disp: p.dispositivo });
    if (!d.ok) return json(res, 502, { ok: false, motivo: d.motivo || 'planilha' });
    return json(res, 200, d);
  } catch (e) {
    console.error('[dados] falha na consulta', e && e.message);
    return json(res, 500, { ok: false, motivo: 'consulta' });
  }
}
