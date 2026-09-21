// Ajudantes das funcoes da Vercel: CORS aberto (o coletor e chamado pelo site da DPR, em outro
// dominio), preflight, resposta JSON e leitura do corpo (texto ou JSON).

export function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'content-type');
  res.setHeader('Access-Control-Max-Age', '86400');
}

export function preflight(req, res) {
  if (req.method !== 'OPTIONS') return false;
  cors(res);
  res.status(204).end();
  return true;
}

export function json(res, status, corpo) {
  cors(res);
  res.setHeader('Cache-Control', 'no-store');
  res.status(status).json(corpo);
}

// O coletor manda `text/plain` de proposito (sendBeacon sem preflight); o painel manda JSON.
export function corpoDoRequest(req) {
  const b = req.body;
  if (typeof b === 'string') {
    try { return JSON.parse(b); } catch { return null; }
  }
  if (Buffer.isBuffer(b)) {
    try { return JSON.parse(b.toString('utf8')); } catch { return null; }
  }
  if (b && typeof b === 'object') return b;
  return null;
}
