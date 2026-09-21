// A ponte com o Apps Script, sem rede: como interpreta o que o Google devolve e quando se considera
// configurada.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { interpretar, planilhaConfigurada } from '../lib/planilha.js';

test('interpretar: JSON passa, pagina de login vira "acesso", resto vira "resposta"', () => {
  assert.deepEqual(interpretar('{"ok":true,"linhas":3}'), { ok: true, linhas: 3 });
  assert.equal(interpretar('<html><a href="https://accounts.google.com/ServiceLogin">Fazer login</a></html>').motivo, 'acesso');
  assert.equal(interpretar('<html>Erro do script</html>').motivo, 'resposta');
  assert.equal(interpretar('42').motivo, 'resposta');
  assert.equal(interpretar('').motivo, 'resposta');
});

test('planilhaConfigurada: so com a URL /exec do Apps Script', () => {
  const antes = process.env.APPS_SCRIPT_URL;
  try {
    delete process.env.APPS_SCRIPT_URL;
    assert.equal(planilhaConfigurada(), false);
    process.env.APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxYZ_123-abc/exec';
    assert.equal(planilhaConfigurada(), true);
    process.env.APPS_SCRIPT_URL = 'https://docs.google.com/spreadsheets/d/abc/edit';
    assert.equal(planilhaConfigurada(), false);
    process.env.APPS_SCRIPT_URL = '   ';
    assert.equal(planilhaConfigurada(), false);
  } finally {
    if (antes === undefined) delete process.env.APPS_SCRIPT_URL; else process.env.APPS_SCRIPT_URL = antes;
  }
});
