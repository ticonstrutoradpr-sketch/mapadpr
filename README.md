# mapadpr

Mapa de calor do site da DPR Construtora. Registra, sem identificar ninguem, onde as pessoas clicam, por onde passam o mouse e ate onde rolam cada pagina, e mostra o calor desenhado por cima da pagina real do site.

Os dados ficam numa **planilha Google da DPR**, via Apps Script, igual ao mapa da Zeleno (decisao da dona, 21/09). Planilha separada, so da DPR, nunca a da Zeleno.

## Como funciona

- `t.js`: o coletor. Entra em cada pagina do site com uma linha de script. Manda lotes de eventos a cada 5 segundos e ao sair da pagina. Com `?mapadpr=click` (ou `=move`) na URL da pagina, ele vira o proprio mapa: desenha o calor sobre a pagina, com filtros de tipo, periodo e aparelho.
- `api/coletar.js`: recebe os lotes, valida (formato exato, teto de 200 eventos por lote, dominios permitidos se `ORIGENS_PERMITIDAS` existir) e repassa para a planilha. O navegador do visitante nunca fala com o Google.
- `api/dados.js` e `api/paginas.js`: leitura. O primeiro alimenta o mapa; o segundo, o painel. Consultam a planilha, que ja devolve tudo somado. Sem senha, por decisao da dona (21/09): os dados sao anonimos e agregados, e quem tem o endereco abre direto.
- `api/saude.js`: diz se a planilha esta configurada e respondendo, e se o projeto esta em modo demonstracao.
- `index.html`: o painel. Lista cada pagina com visitas, sessoes, cliques, visitas no celular e profundidade media de rolagem, com os botoes que abrem o mapa.
- `apps-script/Codigo.gs`: o que vai colado na planilha. Grava os lotes na aba `eventos`, responde as consultas ja agregadas (com cache de 2 minutos) e tem a funcao `limparAntigos` (180 dias).
- `lib/`: regras puras (validacao dos lotes, parametros), a ponte com o Apps Script e os dados de demonstracao. `test/` cobre tudo isso, inclusive as agregacoes do `Codigo.gs`, sem Google: `npm test`.

## Modo demonstracao

Enquanto `APPS_SCRIPT_URL` nao existe na Vercel, o painel e o mapa mostram **dados inventados** (cerca de 3 mil visitas por mes, nas paginas reais do site), sempre iguais, com um aviso vermelho na tela e `demo: true` na resposta. Serve para ver como fica antes de conectar. O coletor, nesse modo, aceita e descarta os lotes. Assim que a variavel entrar e o projeto for republicado, os dados reais tomam o lugar.

## O que fica gravado

Uma linha por evento: data, site, pagina, tipo (visita, clique, movimento, rolagem), posicao (horizontal como fracao da largura do documento, vertical em pixels), tamanho da janela, altura da pagina, um id de sessao aleatorio da aba, o elemento clicado (ex.: `a#whatsapp`) e o aparelho (celular, tablet, computador). Nao grava IP, nome, e-mail nem qualquer dado pessoal.

## Configuracao

### Parte 1: planilha e Apps Script (conta Google da DPR)

1. Criar uma planilha nova, so para isto. Extensoes > Apps Script.
2. Apagar o que estiver la, colar o conteudo de `apps-script/Codigo.gs` inteiro e salvar.
3. Implantar > Nova implantacao > tipo **App da Web** > Executar como: **voce** > Quem pode acessar: **qualquer pessoa** > Implantar. Autorizar quando pedir. Copiar a URL que termina em `/exec`.
4. Recomendado: Acionadores (icone do relogio) > Adicionar acionador > funcao `limparAntigos` > baseado em tempo > diario. Apaga o que passou de 180 dias e segura o tamanho da planilha.

Para atualizar o codigo depois: colar o `Codigo.gs` novo, Implantar > Gerenciar implantacoes > editar (lapis) > Versao: nova > Implantar. A URL nao muda.

### Parte 2: Vercel (projeto mapadpr, conta da DPR)

1. Importar este repositorio como projeto (framework: Other). Nao ha build.
2. **Settings**, **Environment Variables**: `APPS_SCRIPT_URL` = a URL `/exec` copiada acima, marcando Production e Preview.
3. Opcional: `ORIGENS_PERMITIDAS` = dominios do site separados por virgula. Com ela, o coletor recusa lotes vindos de outras origens.
4. Opcional, so para a demonstracao: `DEMO_SITE` = dominio do site, para os botoes do painel abrirem a pagina certa.
5. **Deployment Protection**: desligar a Vercel Authentication do projeto. O coletor e chamado pelo navegador de qualquer visitante do site, e o painel abre direto.
6. Redeploy depois de mexer em variavel.

Conferencia: `GET /api/saude` responde `{ planilha: true, planilhaResponde: true, demo: false }` quando tudo esta no lugar. `motivo: "acesso"` significa que o App da Web nao esta publicado para qualquer pessoa.

## Instalar no site

Em cada pagina HTML do site da DPR, antes de `</body>`:

```html
<script src="https://SEU-PROJETO.vercel.app/t.js" defer></script>
```

Depois, para ver o mapa de uma pagina: abrir a pagina do site com `?mapadpr=click` (cliques) ou `?mapadpr=move` (movimento) no fim do endereco, ou usar os botoes do painel.

## Limites conhecidos

- Planilha nao tem indice: cada consulta le todas as linhas. Com a limpeza de 180 dias e o teto de 400 eventos por pagina visitada, aguenta bem o trafego de um site institucional; o cache de 2 minutos segura consultas repetidas.
- Elementos que aparecem em posicoes diferentes conforme a largura da tela: por isso o mapa separa celular, tablet e computador.
- Paginas com conteudo que muda de altura (menus abertos, carrosseis) deslocam os pontos abaixo delas.
- Sem limite de requisicoes por IP no coletor; o teto por lote e a lista de origens sao a protecao.
