// Dados de demonstracao. Entram no lugar da planilha enquanto APPS_SCRIPT_URL nao existe, para a dona
// ver o painel e o mapa antes de conectar (pedido dela, 21/09): cerca de 3 mil visitas por mes nas
// paginas reais do site da DPR. Tudo inventado e sempre igual (semente fixa); nada vem de visitante.
// Toda resposta de demonstracao carrega `demo: true`, e o painel e o mapa avisam na tela.

export const VISITAS_POR_DIA = 100; // 30 dias = 3 mil visitas
// Endereco atual do site da DPR na Vercel (projeto site-dpr). Troque por DEMO_SITE se mudar.
const SITE_DEMO_PADRAO = 'site-dpr.vercel.app';

// Paginas reais do site (siteDPR): peso nas visitas (soma 100), cliques por visita e profundidade
// media de rolagem tipica.
const PAGINAS = [
  { pagina: '/', peso: 34, cliquesPorVisita: 2.1, prof: 58 },
  { pagina: '/caucaia2.html', peso: 18, cliquesPorVisita: 2.6, prof: 66 },
  { pagina: '/empreendimento.html', peso: 12, cliquesPorVisita: 1.9, prof: 61 },
  { pagina: '/contato.html', peso: 9, cliquesPorVisita: 1.4, prof: 74 },
  { pagina: '/lotes.html', peso: 7, cliquesPorVisita: 1.7, prof: 52 },
  { pagina: '/moradadasroseiras2.html', peso: 6, cliquesPorVisita: 1.8, prof: 57 },
  { pagina: '/caucaia1.html', peso: 5, cliquesPorVisita: 1.5, prof: 49 },
  { pagina: '/moradaddasroseiras1.html', peso: 4, cliquesPorVisita: 1.4, prof: 47 },
  { pagina: '/conceito.html', peso: 3, cliquesPorVisita: 1.1, prof: 63 },
  { pagina: '/trabalhe.html', peso: 2, cliquesPorVisita: 1.6, prof: 71 }
];

// Onde a demonstracao concentra os cliques: fracao da largura (x) e da altura (y) da pagina, o
// espalhamento (rx, ry) e o peso relativo. Menu, botao de contato no topo, chamada do hero, blocos do
// meio, galeria, contato e rodape.
const FOCOS_CLICK = [
  { x: 0.5, y: 0.012, rx: 0.3, ry: 0.004, peso: 6 },
  { x: 0.9, y: 0.012, rx: 0.04, ry: 0.003, peso: 5 },
  { x: 0.5, y: 0.09, rx: 0.1, ry: 0.01, peso: 14 },
  { x: 0.3, y: 0.28, rx: 0.12, ry: 0.018, peso: 8 },
  { x: 0.7, y: 0.45, rx: 0.12, ry: 0.018, peso: 7 },
  { x: 0.5, y: 0.62, rx: 0.16, ry: 0.014, peso: 9 },
  { x: 0.5, y: 0.8, rx: 0.1, ry: 0.012, peso: 10 },
  { x: 0.5, y: 0.96, rx: 0.3, ry: 0.008, peso: 3 }
];

// O movimento do mouse segue a leitura: uma trilha do topo ao rodape, mais os focos de clique, mais
// largos.
const FOCOS_MOVE = [0.05, 0.13, 0.21, 0.29, 0.37, 0.45, 0.53, 0.61, 0.69, 0.77, 0.85, 0.93]
  .map((y, i) => ({ x: i % 2 ? 0.58 : 0.38, y, rx: 0.16, ry: 0.03, peso: 3 }))
  .concat(FOCOS_CLICK.map((f) => ({ x: f.x, y: f.y, rx: f.rx * 1.6, ry: f.ry * 2, peso: f.peso / 2 })));

const FRACAO = { mobile: 0.62, tablet: 0.05, desktop: 0.33 };

function fracaoDe(disp) {
  return disp === 'todos' ? 1 : (FRACAO[disp] || 0);
}

// Gerador determinista (mulberry32): mesma semente, mesmos numeros, em qualquer maquina.
function gerador(semente) {
  let a = semente >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function sementeDe(texto) {
  let h = 2166136261;
  for (const ch of String(texto)) {
    h ^= ch.charCodeAt(0);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function gauss(r) {
  const u = 1 - r();
  const v = r();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

export function siteDemo() {
  return String(process.env.DEMO_SITE || SITE_DEMO_PADRAO).trim().toLowerCase();
}

// Mesmo formato do /api/paginas real.
export function paginasDemo(dias, agora = new Date()) {
  const r = gerador(sementeDe('paginas' + dias));
  const site = siteDemo();
  const paginas = PAGINAS.map((p) => {
    const visitas = Math.round(VISITAS_POR_DIA * dias * p.peso / 100 * (0.92 + r() * 0.16));
    const cliques = Math.round(visitas * p.cliquesPorVisita * (0.9 + r() * 0.2));
    return {
      site,
      pagina: p.pagina,
      visitas,
      sessoes: Math.round(visitas * (0.86 + r() * 0.06)),
      cliques,
      // so quem tem mouse (computador) gera movimento
      movimentos: Math.round(visitas * FRACAO.desktop * 38 * (0.9 + r() * 0.2)),
      profundidade_media: Math.round(p.prof + (r() - 0.5) * 8),
      visitas_mobile: Math.round(visitas * (FRACAO.mobile - 0.03 + r() * 0.06)),
      ultimo: new Date(agora.getTime() - Math.round(r() * 3600000)).toISOString()
    };
  });
  paginas.sort((a, b) => (b.visitas - a.visitas) || (b.cliques - a.cliques));
  return paginas;
}

function pontosDemo(r, focos, total, H) {
  const soma = focos.reduce((s, f) => s + f.peso, 0);
  const celulas = new Map();
  for (const f of focos) {
    const n = Math.round(total * f.peso / soma);
    for (let i = 0; i < n; i++) {
      let xr = f.x + gauss(r) * f.rx;
      let y = (f.y + gauss(r) * f.ry) * H;
      if (xr < 0.02) xr = 0.02;
      if (xr > 0.98) xr = 0.98;
      if (y < 0) y = 0;
      if (y > H - 1) y = H - 1;
      const k = (Math.round(xr * 1000) / 1000) + '|' + (Math.floor(y / 8) * 8);
      celulas.set(k, (celulas.get(k) || 0) + 1);
    }
  }
  const pontos = [];
  for (const [k, n] of celulas) {
    const [x, y] = k.split('|');
    pontos.push([Number(x), Number(y), n]);
  }
  pontos.sort((a, b) => b[2] - a[2]);
  return pontos.slice(0, 20000);
}

// Mesmo formato do /api/dados real. `altura` e a altura real da pagina aberta (o t.js manda), para os
// pontos cairem dentro dela.
export function dadosDemo({ pagina, tipo, dias, dispositivo, altura }, agora = new Date()) {
  const H = Math.max(600, Math.min(200000, Math.round(Number(altura)) || 4200));
  const t = tipo === 'move' ? 'move' : 'click';
  const disp = dispositivo || 'todos';
  const vazio = { ok: true, demo: true, site: siteDemo(), pagina, tipo: t, dias, dispositivo: disp, pontos: [], total: 0, visitas: 0, sessoes: 0, docH: H, profundidadeMedia: null };
  const base = paginasDemo(dias, agora).find((x) => x.pagina === pagina);
  if (!base) return vazio;
  const fr = fracaoDe(disp);
  const semMouse = t === 'move' && (disp === 'mobile' || disp === 'tablet');
  const total = semMouse ? 0 : (t === 'click' ? Math.round(base.cliques * fr) : base.movimentos);
  const r = gerador(sementeDe('dados' + pagina + t + dias + disp));
  return {
    ...vazio,
    pontos: pontosDemo(r, t === 'click' ? FOCOS_CLICK : FOCOS_MOVE, total, H),
    total,
    visitas: Math.round(base.visitas * fr),
    sessoes: Math.round(base.sessoes * fr),
    profundidadeMedia: base.profundidade_media
  };
}
