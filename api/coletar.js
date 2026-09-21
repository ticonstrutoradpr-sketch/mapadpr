// POST /api/coletar: recebe um lote de eventos do t.js e grava. Aberto (o site chama sem senha), mas
// so aceita o formato exato, no maximo 200 eventos por lote, e, se ORIGENS_PERMITIDAS estiver
// definida, so de paginas desses dominios. Nao grava IP nem dado pessoal.
import { sanitizarLote } from '../lib/eventos.js';
import { consultar, bancoConfigurado } from '../lib/db.js';
import { cors, preflight, json, corpoDoRequest } from '../lib/http.js';

function origemPermitida(req) {
  const permitidas = String(process.env.ORIGENS_PERMITIDAS || '')
    .split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
  if (!permitidas.length) return true;
  let host = '';
  try { host = new URL(String(req.headers.origin || '')).host.toLowerCase(); } catch { host = ''; }
  return Boolean(host) && permitidas.some((d) => host === d || host.endsWith('.' + d));
}

export default async function handler(req, res) {
  if (preflight(req, res)) return;
  if (req.method !== 'POST') return json(res, 405, { ok: false, motivo: 'metodo' });
  if (!origemPermitida(req)) return json(res, 403, { ok: false, motivo: 'origem' });

  const r = sanitizarLote(corpoDoRequest(req));
  if (!r.ok) return json(res, 400, { ok: false, motivo: r.motivo });
  if (!bancoConfigurado()) return json(res, 503, { ok: false, motivo: 'banco' });

  const l = r.lote;
  if (!l.eventos.length) { cors(res); res.status(204).end(); return; }

  const linhas = [];
  const valores = [];
  let i = 1;
  for (const e of l.eventos) {
    linhas.push(`($${i++},$${i++},$${i++},$${i++},$${i++},$${i++},$${i++},$${i++},$${i++},$${i++},$${i++},$${i++})`);
    valores.push(l.site, l.pagina, e.tipo, e.xr, e.y, l.vw, l.vh, l.docH, e.prof, l.sessao, e.alvo, l.dispositivo);
  }
  try {
    await consultar(
      `INSERT INTO eventos (site, pagina, tipo, xr, y, vw, vh, doc_h, prof, sessao, alvo, dispositivo) VALUES ${linhas.join(',')}`,
      valores
    );
  } catch (e) {
    console.error('[coletar] falha ao gravar', e && e.message);
    return json(res, 500, { ok: false, motivo: 'gravacao' });
  }
  cors(res);
  res.status(204).end();
}
