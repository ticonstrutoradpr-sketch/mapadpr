// Ponte com o Apps Script da planilha, o banco do mapa por decisao da dona (21/09). Mesmo padrao do
// painel de TI da Zeleno (api/gs.js): o navegador do visitante nunca fala com o Google. O site manda
// para /api/coletar, que valida e repassa para a URL do App da Web (APPS_SCRIPT_URL); o painel e o
// mapa leem por /api/paginas e /api/dados, que consultam a mesma URL.
const TEMPO_LIMITE_MS = 8000;

export function urlDaPlanilha() {
  return String(process.env.APPS_SCRIPT_URL || '').trim();
}

export function planilhaConfigurada() {
  return /^https:\/\/script\.google\.com\/macros\/s\/[^/]+\/exec$/.test(urlDaPlanilha());
}

// O Apps Script responde JSON puro. Se a implantacao estiver com acesso restrito, o Google devolve a
// pagina de login em HTML; se o codigo quebrar, uma pagina de erro. Nunca lanca.
export function interpretar(texto) {
  try {
    const j = JSON.parse(String(texto));
    return (j && typeof j === 'object') ? j : { ok: false, motivo: 'resposta' };
  } catch {
    const acesso = /accounts\.google\.com|Fazer login|Sign in/i.test(String(texto));
    return { ok: false, motivo: acesso ? 'acesso' : 'resposta' };
  }
}

async function chamar(url, opcoes) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), TEMPO_LIMITE_MS);
  try {
    // O Apps Script responde com um redirect para script.googleusercontent.com, que entrega o JSON.
    const r = await fetch(url, { ...opcoes, redirect: 'follow', signal: ctl.signal });
    return interpretar(await r.text());
  } finally {
    clearTimeout(t);
  }
}

// text/plain de proposito: o Apps Script le e.postData.contents e nao ha preflight.
export function enviarLote(lote) {
  return chamar(urlDaPlanilha(), {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(lote)
  });
}

export function consultarPlanilha(acao, params = {}) {
  const u = new URL(urlDaPlanilha());
  u.searchParams.set('acao', acao);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null) u.searchParams.set(k, String(v));
  }
  return chamar(u.toString(), { method: 'GET' });
}
