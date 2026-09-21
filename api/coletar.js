// POST /api/coletar: recebe um lote de eventos do t.js, valida e repassa para a planilha (Apps Script).
// Aberto (o site chama sem senha), mas so aceita o formato exato, no maximo 200 eventos por lote, e,
// se ORIGENS_PERMITIDAS estiver definida, so de paginas desses dominios. Nao grava IP nem dado pessoal.
// Sem planilha configurada (modo demonstracao), aceita e descarta: o site nunca ve erro.
import { sanitizarLote } from '../lib/eventos.js';
import { planilhaConfigurada, enviarLote } from '../lib/planilha.js';
import { cors, preflight, json, corpoDoRequest } from '../lib/http.js';

function origemPermitida(req) {
  const permitidas = String(process.env.ORIGENS_PERMITIDAS || '')
    .split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
  if (!permitidas.length) return true;
  let host = '';
  try { host = new URL(String(req.headers.origin || '')).host.toLowerCase(); } catch { host = ''; }
  return Boolean(host) && permitidas.some((d) => host === d || host.endsWith('.' + d));
}

function aceito(res) {
  cors(res);
  res.status(204).end();
}

export default async function handler(req, res) {
  if (preflight(req, res)) return;
  if (req.method !== 'POST') return json(res, 405, { ok: false, motivo: 'metodo' });
  if (!origemPermitida(req)) return json(res, 403, { ok: false, motivo: 'origem' });

  const r = sanitizarLote(corpoDoRequest(req));
  if (!r.ok) return json(res, 400, { ok: false, motivo: r.motivo });

  const l = r.lote;
  if (!l.eventos.length || !planilhaConfigurada()) return aceito(res);

  try {
    const resposta = await enviarLote(l);
    if (!resposta.ok) {
      console.error('[coletar] planilha recusou o lote', resposta.motivo);
      return json(res, 500, { ok: false, motivo: 'gravacao' });
    }
  } catch (e) {
    console.error('[coletar] falha ao enviar para a planilha', e && e.message);
    return json(res, 500, { ok: false, motivo: 'gravacao' });
  }
  return aceito(res);
}
