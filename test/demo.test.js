// Dados de demonstracao: volume pedido pela dona (cerca de 3 mil visitas no mes), sempre iguais e
// dentro da pagina.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { paginasDemo, dadosDemo, VISITAS_POR_DIA } from '../lib/demo.js';

test('painel de demonstracao: cerca de 3 mil visitas em 30 dias, nas 10 paginas do site', () => {
  const lista = paginasDemo(30);
  const visitas = lista.reduce((s, p) => s + p.visitas, 0);
  assert.equal(lista.length, 10);
  assert.ok(visitas >= 2600 && visitas <= 3400, 'visitas em 30 dias: ' + visitas);
  assert.equal(VISITAS_POR_DIA * 30, 3000);
  assert.equal(lista[0].pagina, '/', 'a home e a mais visitada');
  for (const p of lista) {
    assert.ok(p.sessoes <= p.visitas);
    assert.ok(p.visitas_mobile <= p.visitas);
    assert.ok(p.profundidade_media > 0 && p.profundidade_media <= 100);
    assert.ok(p.cliques > 0);
  }
  const em7 = paginasDemo(7).reduce((s, p) => s + p.visitas, 0);
  assert.ok(em7 >= 600 && em7 <= 800, 'visitas em 7 dias: ' + em7);
});

test('demonstracao e sempre igual (semente fixa) e traz demo: true', () => {
  assert.deepEqual(paginasDemo(30, new Date(0)), paginasDemo(30, new Date(0)));
  const a = dadosDemo({ pagina: '/', tipo: 'click', dias: 30, dispositivo: 'todos', altura: 4000 });
  const b = dadosDemo({ pagina: '/', tipo: 'click', dias: 30, dispositivo: 'todos', altura: 4000 });
  assert.deepEqual(a, b);
  assert.equal(a.demo, true);
});

test('mapa de demonstracao: pontos dentro da pagina, filtros de aparelho, sem mouse no celular', () => {
  const d = dadosDemo({ pagina: '/caucaia2.html', tipo: 'click', dias: 30, dispositivo: 'todos', altura: 3200 });
  assert.equal(d.docH, 3200);
  assert.ok(d.total > 0 && d.pontos.length > 0);
  for (const [xr, y, n] of d.pontos) {
    assert.ok(xr >= 0 && xr <= 1, 'xr fora: ' + xr);
    assert.ok(y >= 0 && y < 3200, 'y fora: ' + y);
    assert.ok(n >= 1);
  }
  const soma = d.pontos.reduce((s, p) => s + p[2], 0);
  assert.ok(Math.abs(soma - d.total) <= 8, 'celulas somam o total (' + soma + ' x ' + d.total + ')');

  const mobile = dadosDemo({ pagina: '/caucaia2.html', tipo: 'click', dias: 30, dispositivo: 'mobile', altura: 3200 });
  assert.ok(mobile.visitas < d.visitas && mobile.total < d.total);

  const semMouse = dadosDemo({ pagina: '/caucaia2.html', tipo: 'move', dias: 30, dispositivo: 'mobile', altura: 3200 });
  assert.equal(semMouse.total, 0);
  assert.deepEqual(semMouse.pontos, []);

  const move = dadosDemo({ pagina: '/caucaia2.html', tipo: 'move', dias: 30, dispositivo: 'desktop', altura: 3200 });
  assert.ok(move.total > d.total, 'movimento tem mais pontos que clique');

  const desconhecida = dadosDemo({ pagina: '/nao-existe.html', tipo: 'click', dias: 30, dispositivo: 'todos', altura: 1000 });
  assert.equal(desconhecida.total, 0);
  assert.equal(desconhecida.demo, true);
});
