// Senha unica do painel e do mapa: MAPA_SENHA nas variaveis do projeto na Vercel. Comparacao em tempo
// constante sobre o hash, para nao vazar por tempo de resposta. Sem a variavel, nada e lido.
import { createHash, timingSafeEqual } from 'node:crypto';

export function chaveConfere(informada, esperada) {
  if (!esperada) return false;
  const a = createHash('sha256').update(String(informada || '')).digest();
  const b = createHash('sha256').update(String(esperada)).digest();
  return timingSafeEqual(a, b);
}

export function chaveDoRequest(req) {
  const h = req && req.headers ? req.headers['x-mapa-chave'] : '';
  const q = req && req.query ? req.query.chave : '';
  return String(h || q || '');
}

export function exigirChave(req) {
  return chaveConfere(chaveDoRequest(req), process.env.MAPA_SENHA || '');
}
