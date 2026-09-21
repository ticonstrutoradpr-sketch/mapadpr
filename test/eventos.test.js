// Regras puras do coletor e das consultas. Roda com `npm test` (node --test), sem banco nem rede.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dispositivo, limparPagina, limparSite, sanitizarLote, parametrosDeConsulta, LIMITE_POR_LOTE } from '../lib/eventos.js';
import { corpoDoRequest } from '../lib/http.js';

test('dispositivo pela largura da janela', () => {
  assert.equal(dispositivo(390), 'mobile');
  assert.equal(dispositivo(767), 'mobile');
  assert.equal(dispositivo(768), 'tablet');
  assert.equal(dispositivo(1023), 'tablet');
  assert.equal(dispositivo(1024), 'desktop');
  assert.equal(dispositivo(0), 'desktop');
  assert.equal(dispositivo('x'), 'desktop');
});

test('pagina e site limpos', () => {
  assert.equal(limparPagina('/index.html'), '/');
  assert.equal(limparPagina('/contato.html?utm=1#form'), '/contato.html');
  assert.equal(limparPagina('caucaia2.html'), '/caucaia2.html');
  assert.equal(limparPagina(''), '/');
  assert.equal(limparSite('WWW.DPR.COM.BR'), 'www.dpr.com.br');
  assert.equal(limparSite('evil<script>'), 'evilscript');
});

test('lote valido: limpa, classifica e mantem so o que presta', () => {
  const r = sanitizarLote(JSON.stringify({
    site: 'www.dprconstrutora.com', pagina: '/index.html', vw: 390, vh: 800, docH: 4000, sessao: 'abc-123',
    eventos: [
      { tipo: 'view' },
      { tipo: 'click', xr: 0.5, y: 1200.4, alvo: 'a#whatsapp' },
      { tipo: 'move', xr: 1.2, y: 10 },           // fora da largura: descartado
      { tipo: 'move', xr: 0.25, y: -5 },          // y negativo: descartado
      { tipo: 'scroll', prof: 87 },
      { tipo: 'scroll', prof: 140 },              // acima de 100: descartado
      { tipo: 'hack', xr: 0.1, y: 1 },            // tipo desconhecido: descartado
      'lixo'
    ]
  }));
  assert.equal(r.ok, true);
  assert.equal(r.lote.site, 'www.dprconstrutora.com');
  assert.equal(r.lote.pagina, '/');
  assert.equal(r.lote.dispositivo, 'mobile');
  assert.equal(r.lote.sessao, 'abc123');
  assert.deepEqual(r.lote.eventos, [
    { tipo: 'view', xr: null, y: null, prof: null, alvo: null },
    { tipo: 'click', xr: 0.5, y: 1200, prof: null, alvo: 'a#whatsapp' },
    { tipo: 'scroll', xr: null, y: null, prof: 87, alvo: null }
  ]);
});

test('lote invalido: motivos claros, nunca lanca', () => {
  assert.deepEqual(sanitizarLote('{nao e json'), { ok: false, motivo: 'json' });
  assert.deepEqual(sanitizarLote(null), { ok: false, motivo: 'corpo' });
  assert.deepEqual(sanitizarLote({ pagina: '/' }), { ok: false, motivo: 'site' });
  assert.deepEqual(sanitizarLote({ site: 'x.com', vw: 0, vh: 1, docH: 1 }), { ok: false, motivo: 'janela' });
});

test('lote grande demais e cortado no limite', () => {
  const eventos = Array.from({ length: LIMITE_POR_LOTE + 50 }, () => ({ tipo: 'move', xr: 0.5, y: 100 }));
  const r = sanitizarLote({ site: 'x.com', pagina: '/', vw: 1200, vh: 800, docH: 3000, eventos });
  assert.equal(r.lote.eventos.length, LIMITE_POR_LOTE);
});

test('parametros de consulta fechados nos valores permitidos', () => {
  assert.deepEqual(parametrosDeConsulta({ site: 'X.com', pagina: 'lotes.html', dias: '90', tipo: 'move', disp: 'mobile' }),
    { site: 'x.com', pagina: '/lotes.html', dias: 90, tipo: 'move', dispositivo: 'mobile' });
  assert.deepEqual(parametrosDeConsulta({ dias: '999', tipo: 'hack', disp: 'tv' }),
    { site: '', pagina: '/', dias: 30, tipo: 'click', dispositivo: 'todos' });
  assert.equal(parametrosDeConsulta().dias, 30);
});

test('corpo do request: texto, buffer e objeto', () => {
  assert.deepEqual(corpoDoRequest({ body: '{"a":1}' }), { a: 1 });
  assert.deepEqual(corpoDoRequest({ body: Buffer.from('{"a":2}') }), { a: 2 });
  assert.deepEqual(corpoDoRequest({ body: { a: 3 } }), { a: 3 });
  assert.equal(corpoDoRequest({ body: '{' }), null);
  assert.equal(corpoDoRequest({}), null);
});
