// As regras puras do Codigo.gs (o que roda na planilha) testadas aqui, sem Google: o arquivo e carregado
// num contexto isolado e so as funcoes de agregacao sao chamadas.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const contexto = {};
vm.createContext(contexto);
vm.runInContext(readFileSync(new URL('../apps-script/Codigo.gs', import.meta.url), 'utf8'), contexto);
const { linhasDoLote, agregarPaginas, agregarDados, COLUNAS, LIMITE_POR_LOTE } = contexto;
// Arrays nascidos no contexto isolado tem outro prototipo; comparar pelo valor puro.
const puro = (x) => JSON.parse(JSON.stringify(x));

const AGORA = new Date('2026-09-21T12:00:00Z');
const dia = (n) => new Date(AGORA.getTime() - n * 86400000);
// [criado_em, site, pagina, tipo, xr, y, vw, vh, doc_h, prof, sessao, alvo, dispositivo]
const linha = (d, pagina, tipo, extra = {}) => [
  d, 'dpr.com', pagina, tipo, extra.xr ?? '', extra.y ?? '', 390, 800, extra.docH ?? 4000, extra.prof ?? '',
  extra.sessao ?? 's1', extra.alvo ?? '', extra.disp ?? 'mobile'
];

test('linhasDoLote: uma linha por evento, na ordem das colunas, com teto e sem lixo', () => {
  const lote = {
    site: 'dpr.com', pagina: '/contato.html', vw: 390, vh: 800, docH: 3000, sessao: 'abc', dispositivo: 'mobile',
    eventos: [
      { tipo: 'view' },
      { tipo: 'click', xr: 0.5, y: 1200, alvo: 'a#whatsapp' },
      { tipo: 'scroll', prof: 80 },
      { tipo: 'hack', xr: 0.1, y: 1 },
      'lixo'
    ]
  };
  const linhas = linhasDoLote(lote, AGORA);
  assert.equal(linhas.length, 3);
  assert.equal(linhas[0].length, COLUNAS.length);
  assert.deepEqual(puro(linhas[1]), [AGORA.toISOString(), 'dpr.com', '/contato.html', 'click', 0.5, 1200, 390, 800, 3000, '', 'abc', 'a#whatsapp', 'mobile']);
  assert.deepEqual(puro(linhas[2].slice(3, 10)), ['scroll', '', '', 390, 800, 3000, 80]);

  const grande = { site: 'x', eventos: Array.from({ length: LIMITE_POR_LOTE + 30 }, () => ({ tipo: 'view' })) };
  assert.equal(linhasDoLote(grande, AGORA).length, LIMITE_POR_LOTE);
  assert.equal(linhasDoLote(null, AGORA).length, 0);
  assert.equal(linhasDoLote({ eventos: [] }, AGORA).length, 0);
});

test('agregarPaginas: conta por pagina so dentro do periodo, sessoes distintas e media de rolagem', () => {
  const linhas = [
    linha(dia(1), '/', 'view', { sessao: 'a' }),
    linha(dia(1), '/', 'click', { xr: 0.5, y: 100 }),
    linha(dia(2), '/', 'view', { sessao: 'a', disp: 'desktop' }),
    linha(dia(2), '/', 'scroll', { prof: 40 }),
    linha(dia(3), '/', 'scroll', { prof: 80 }),
    linha(dia(3), '/', 'move', { xr: 0.2, y: 50 }),
    linha(dia(5), '/contato.html', 'view', { sessao: 'b' }),
    linha(dia(40), '/', 'view', { sessao: 'c' }) // fora dos 30 dias
  ];
  const r = agregarPaginas(linhas, { dias: '30' }, AGORA);
  assert.equal(r.ok, true);
  assert.equal(r.dias, 30);
  assert.equal(r.paginas.length, 2);
  const home = r.paginas[0];
  assert.equal(home.pagina, '/');
  assert.equal(home.visitas, 2);
  assert.equal(home.sessoes, 1);
  assert.equal(home.cliques, 1);
  assert.equal(home.movimentos, 1);
  assert.equal(home.profundidade_media, 60);
  assert.equal(home.visitas_mobile, 1);
  assert.equal(home.ultimo, dia(1).toISOString());
  assert.equal(r.paginas[1].pagina, '/contato.html');
  assert.equal(agregarPaginas(linhas, { dias: '999' }, AGORA).dias, 30);
  assert.equal(agregarPaginas(linhas, { dias: '7' }, AGORA).paginas[0].visitas, 2);
});

test('agregarDados: soma em celulas, filtra aparelho e tipo, mediana da altura', () => {
  const linhas = [
    linha(dia(1), '/', 'view', { sessao: 'a', docH: 4000 }),
    linha(dia(1), '/', 'click', { xr: 0.5001, y: 101 }),
    linha(dia(1), '/', 'click', { xr: 0.5004, y: 103 }),  // mesma celula (0.5 | 96)
    linha(dia(1), '/', 'click', { xr: 0.9, y: 2000, disp: 'desktop', docH: 5000 }),
    linha(dia(1), '/', 'move', { xr: 0.1, y: 10 }),
    linha(dia(1), '/', 'scroll', { prof: 70 }),
    linha(dia(1), '/contato.html', 'click', { xr: 0.5, y: 100 }),
    linha(dia(60), '/', 'click', { xr: 0.5, y: 100 }) // fora do periodo
  ];
  const r = agregarDados(linhas, { site: 'dpr.com', pagina: '/', tipo: 'click', dias: '30', disp: 'todos' }, AGORA);
  assert.equal(r.total, 3);
  assert.deepEqual(puro(r.pontos[0]), [0.5, 96, 2]);
  assert.deepEqual(puro(r.pontos[1]), [0.9, 2000, 1]);
  assert.equal(r.visitas, 1);
  assert.equal(r.sessoes, 1);
  assert.equal(r.docH, 4000);
  assert.equal(r.profundidadeMedia, 70);

  const so = agregarDados(linhas, { site: 'dpr.com', pagina: '/', tipo: 'click', dias: '30', disp: 'desktop' }, AGORA);
  assert.equal(so.total, 1);
  assert.equal(so.visitas, 0);

  const move = agregarDados(linhas, { site: 'dpr.com', pagina: '/', tipo: 'move', dias: '30' }, AGORA);
  assert.equal(move.total, 1);
  assert.deepEqual(puro(move.pontos), [[0.1, 8, 1]]);

  const nada = agregarDados(linhas, { site: 'outro.com', pagina: '/', tipo: 'click', dias: '30' }, AGORA);
  assert.equal(nada.total, 0);
  assert.equal(nada.docH, null);
});
