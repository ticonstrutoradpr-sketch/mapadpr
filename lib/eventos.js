// Regras puras do coletor e das consultas: sem rede, sem banco, testaveis (test/eventos.test.js).

export const TIPOS = new Set(['view', 'click', 'move', 'scroll']);
export const LIMITE_POR_LOTE = 200;
export const DIAS_PERMITIDOS = new Set([7, 30, 90, 180]);
export const DISPOSITIVOS = new Set(['todos', 'mobile', 'tablet', 'desktop']);

// Celular, tablet ou computador, pela largura da janela. O layout muda entre eles, entao o mapa de
// um nao pode se misturar com o do outro.
export function dispositivo(vw) {
  const w = Number(vw) || 0;
  if (w > 0 && w < 768) return 'mobile';
  if (w > 0 && w < 1024) return 'tablet';
  return 'desktop';
}

// "/index.html", "/contato.html?x=1#y" -> "/", "/contato.html". Sem query, sem hash, com barra inicial.
export function limparPagina(p) {
  let s = String(p || '/').trim().split('?')[0].split('#')[0];
  if (!s.startsWith('/')) s = '/' + s;
  s = s.replace(/\/index\.html$/i, '/');
  return (s.slice(0, 200) || '/');
}

export function limparSite(h) {
  return String(h || '').trim().toLowerCase().replace(/[^a-z0-9.:-]/g, '').slice(0, 120);
}

function inteiro(v, min, max) {
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  const i = Math.round(n);
  if (i < min || i > max) return null;
  return i;
}

// Valida e limpa um lote vindo do navegador. Nunca lanca: devolve { ok, motivo } ou { ok, lote }.
export function sanitizarLote(corpo) {
  let c = corpo;
  if (typeof c === 'string') {
    try { c = JSON.parse(c); } catch { return { ok: false, motivo: 'json' }; }
  }
  if (!c || typeof c !== 'object') return { ok: false, motivo: 'corpo' };
  const site = limparSite(c.site);
  if (!site) return { ok: false, motivo: 'site' };
  const pagina = limparPagina(c.pagina);
  const vw = inteiro(c.vw, 1, 10000);
  const vh = inteiro(c.vh, 1, 10000);
  const docH = inteiro(c.docH, 1, 200000);
  if (vw === null || vh === null || docH === null) return { ok: false, motivo: 'janela' };
  const sessao = String(c.sessao || '').replace(/[^a-z0-9]/gi, '').slice(0, 40) || null;
  const brutos = Array.isArray(c.eventos) ? c.eventos.slice(0, LIMITE_POR_LOTE) : [];
  const eventos = [];
  for (const e of brutos) {
    if (!e || typeof e !== 'object') continue;
    const tipo = String(e.tipo || '');
    if (!TIPOS.has(tipo)) continue;
    if (tipo === 'click' || tipo === 'move') {
      const xr = Number(e.xr);
      const y = inteiro(e.y, 0, 200000);
      if (!Number.isFinite(xr) || xr < 0 || xr > 1 || y === null) continue;
      const alvo = tipo === 'click' ? String(e.alvo || '').slice(0, 80) || null : null;
      eventos.push({ tipo, xr: Math.round(xr * 10000) / 10000, y, prof: null, alvo });
    } else if (tipo === 'scroll') {
      const prof = inteiro(e.prof, 0, 100);
      if (prof === null) continue;
      eventos.push({ tipo, xr: null, y: null, prof, alvo: null });
    } else {
      eventos.push({ tipo: 'view', xr: null, y: null, prof: null, alvo: null });
    }
  }
  return { ok: true, lote: { site, pagina, vw, vh, docH, sessao, dispositivo: dispositivo(vw), eventos } };
}

// Parametros das consultas do painel e do mapa, com os valores possiveis fechados.
export function parametrosDeConsulta(query = {}) {
  const q = query || {};
  const dias = DIAS_PERMITIDOS.has(Number(q.dias)) ? Number(q.dias) : 30;
  const tipo = String(q.tipo || 'click') === 'move' ? 'move' : 'click';
  const disp = DISPOSITIVOS.has(String(q.disp || '')) ? String(q.disp) : 'todos';
  return { site: limparSite(q.site), pagina: limparPagina(q.pagina), dias, tipo, dispositivo: disp };
}
