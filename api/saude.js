// GET /api/saude: diz se o banco esta configurado e respondendo, e se a senha do painel existe.
// Nunca devolve valores de variaveis.
import { consultar, bancoConfigurado } from '../lib/db.js';
import { preflight, json } from '../lib/http.js';

export default async function handler(req, res) {
  if (preflight(req, res)) return;
  const saida = { ok: true, banco: bancoConfigurado(), bancoResponde: false, senhaDefinida: Boolean(process.env.MAPA_SENHA) };
  if (saida.banco) {
    try { await consultar('SELECT 1'); saida.bancoResponde = true; } catch (e) { saida.erroBanco = String(e && e.message || e).slice(0, 120); }
  }
  return json(res, 200, saida);
}
