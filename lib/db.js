// Conexao com o Postgres (Neon, criado na aba Storage do projeto na Vercel). Um pool por instancia,
// reaproveitado entre chamadas. O schema e criado na primeira consulta (CREATE ... IF NOT EXISTS),
// entao nao ha migracao a rodar na mao.
import pg from 'pg';

const { Pool } = pg;

let pool = null;
let schemaPronto = null;

export function urlDoBanco() {
  return process.env.POSTGRES_URL || process.env.DATABASE_URL || process.env.POSTGRES_PRISMA_URL || '';
}

export function bancoConfigurado() {
  return Boolean(urlDoBanco());
}

export function getPool() {
  if (!pool) {
    const url = urlDoBanco();
    if (!url) throw new Error('Banco nao configurado: falta POSTGRES_URL (ou DATABASE_URL). Crie o Postgres na aba Storage do projeto na Vercel.');
    pool = new Pool({
      connectionString: url,
      max: 3,
      idleTimeoutMillis: 10000,
      ssl: /localhost|127\.0\.0\.1/.test(url) ? false : { rejectUnauthorized: false }
    });
  }
  return pool;
}

// Uma linha por evento. `xr` e a posicao horizontal como fracao da largura do documento (0 a 1), para o
// mapa acompanhar telas de larguras diferentes; `y` e em pixels do topo do documento. `dispositivo`
// vem da largura da janela (celular, tablet, computador), porque o layout muda e os mapas nao se
// misturam. Nada de IP, nome ou e-mail.
const SCHEMA = `
CREATE TABLE IF NOT EXISTS eventos (
  id BIGSERIAL PRIMARY KEY,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  site TEXT NOT NULL,
  pagina TEXT NOT NULL,
  tipo TEXT NOT NULL,
  xr REAL,
  y INTEGER,
  vw INTEGER,
  vh INTEGER,
  doc_h INTEGER,
  prof SMALLINT,
  sessao TEXT,
  alvo TEXT,
  dispositivo TEXT
);
CREATE INDEX IF NOT EXISTS eventos_pagina_idx ON eventos (site, pagina, criado_em);
CREATE INDEX IF NOT EXISTS eventos_criado_idx ON eventos (criado_em);
`;

export async function garantirSchema() {
  if (!schemaPronto) {
    schemaPronto = getPool().query(SCHEMA).catch((e) => {
      schemaPronto = null;
      throw e;
    });
  }
  return schemaPronto;
}

export async function consultar(sql, params = []) {
  await garantirSchema();
  return getPool().query(sql, params);
}
