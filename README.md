# mapadpr

Mapa de calor do site da DPR Construtora. Registra, sem identificar ninguem, onde as pessoas clicam, por onde passam o mouse e ate onde rolam cada pagina, e mostra o calor desenhado por cima da pagina real do site.

## Como funciona

- `t.js`: o coletor. Entra em cada pagina do site com uma linha de script. Manda lotes de eventos a cada 5 segundos e ao sair da pagina. Com `?mapadpr=click` (ou `=move`) na URL da pagina, ele vira o proprio mapa: pede a senha uma vez e desenha o calor sobre a pagina, com filtros de tipo, periodo e aparelho.
- `api/coletar.js`: recebe os lotes e grava no Postgres. Aberto, mas so aceita o formato exato, com teto de 200 eventos por lote.
- `api/dados.js` e `api/paginas.js`: leitura, com senha. O primeiro alimenta o mapa; o segundo, o painel.
- `api/saude.js`: diz se o banco e a senha estao configurados.
- `index.html`: o painel. Lista cada pagina com visitas, sessoes, cliques, visitas no celular e profundidade media de rolagem, com os botoes que abrem o mapa.
- `lib/`: regras puras (validacao dos lotes, parametros, senha) e a conexao com o banco. `test/` cobre as regras puras: `npm test`.

## O que fica gravado

Uma linha por evento: pagina, tipo (visita, clique, movimento, rolagem), posicao (horizontal como fracao da largura do documento, vertical em pixels), tamanho da janela, aparelho (celular, tablet, computador), um id de sessao aleatorio da aba e, no clique, o elemento clicado (ex.: `a#whatsapp`). Nao grava IP, nome, e-mail nem qualquer dado pessoal.

## Configuracao na Vercel

1. Importar este repositorio como projeto (framework: Other). Nao ha build.
2. Aba **Storage** do projeto: criar um **Postgres** (Neon, plano gratuito) e conectar ao projeto. Isso cria `POSTGRES_URL`/`DATABASE_URL` sozinho. A tabela e criada na primeira gravacao.
3. **Environment Variables**: `MAPA_SENHA` = a senha do painel e do mapa (escolhida por quem administra; nunca commitar).
4. Opcional: `ORIGENS_PERMITIDAS` = dominios do site separados por virgula (ex.: `dprconstrutora.com.br`). Com ela, o coletor recusa lotes vindos de outras origens.
5. Redeploy depois de criar as variaveis.

Conferencia: `GET /api/saude` responde `{ banco: true, bancoResponde: true, senhaDefinida: true }` quando tudo esta no lugar.

## Instalar no site

Em cada pagina HTML do site da DPR, antes de `</body>`:

```html
<script src="https://SEU-PROJETO.vercel.app/t.js" defer></script>
```

Depois, para ver o mapa de uma pagina: abrir a pagina do site com `?mapadpr=click` (cliques) ou `?mapadpr=move` (movimento) no fim do endereco, ou usar os botoes do painel.

## Limites conhecidos

- Elementos que aparecem em posicoes diferentes conforme a largura da tela: por isso o mapa separa celular, tablet e computador.
- Paginas com conteudo que muda de altura (menus abertos, carrosseis) deslocam os pontos abaixo delas.
- Sem limite de requisicoes por IP no coletor; o teto por lote e a lista de origens sao a protecao.
