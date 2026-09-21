/* mapadpr / Codigo.gs: o lado da planilha (o banco do mapa de calor, por decisao da dona, 21/09).

   COMO INSTALAR
   1. Planilha nova, na conta Google da DPR (nao na da Zeleno). Extensoes > Apps Script.
   2. Apague o que estiver la, cole este arquivo inteiro e salve.
   3. Implantar > Nova implantacao > tipo "App da Web" > Executar como: voce > Quem pode acessar:
      qualquer pessoa > Implantar. Copie a URL que termina em /exec.
   4. Na Vercel (projeto mapadpr), variavel APPS_SCRIPT_URL = essa URL, em Production e Preview.
   5. Opcional, recomendado: Acionadores (icone do relogio) > Adicionar > funcao limparAntigos >
      baseado em tempo > diario. Apaga o que passou de 180 dias e segura o tamanho da planilha.
   Para atualizar o codigo depois: Implantar > Gerenciar implantacoes > editar > versao nova. A URL
   nao muda.

   QUEM CHAMA: so a ponte na Vercel (lib/planilha.js). O navegador do visitante nunca fala com o
   Google; o site manda para /api/coletar, que valida e repassa para ca.

   doPost: recebe um lote ja validado e grava uma linha por evento na aba "eventos".
   doGet:  acao=saude | paginas | dados. Responde JSON ja agregado. A planilha nao tem indice, entao
           cada consulta le tudo; um cache de 2 minutos segura consultas repetidas. */

var ABA = 'eventos';
var COLUNAS = ['criado_em', 'site', 'pagina', 'tipo', 'xr', 'y', 'vw', 'vh', 'doc_h', 'prof', 'sessao', 'alvo', 'dispositivo'];
var DIAS_GUARDADOS = 180;
var LIMITE_POR_LOTE = 200;
var CACHE_SEGUNDOS = 120;

/* ------------------------------------------------------------ planilha */
function aba_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var s = ss.getSheetByName(ABA);
  if (!s) {
    s = ss.insertSheet(ABA);
    s.appendRow(COLUNAS);
    s.setFrozenRows(1);
  }
  return s;
}

function lerLinhas_() {
  var s = aba_();
  var n = s.getLastRow() - 1;
  if (n < 1) return [];
  return s.getRange(2, 1, n, COLUNAS.length).getValues();
}

function resposta_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

/* ---------------------------------------------------------------- web */
function doPost(e) {
  var corpo;
  try { corpo = JSON.parse((e && e.postData && e.postData.contents) || ''); }
  catch (err) { return resposta_({ ok: false, motivo: 'json' }); }
  var linhas = linhasDoLote(corpo, new Date());
  if (!linhas.length) return resposta_({ ok: true, gravados: 0 });
  var lock = LockService.getScriptLock();
  try { lock.waitLock(10000); } catch (err) { return resposta_({ ok: false, motivo: 'ocupado' }); }
  try {
    var s = aba_();
    s.getRange(s.getLastRow() + 1, 1, linhas.length, COLUNAS.length).setValues(linhas);
  } finally {
    lock.releaseLock();
  }
  return resposta_({ ok: true, gravados: linhas.length });
}

function doGet(e) {
  var p = (e && e.parameter) || {};
  var acao = String(p.acao || 'saude');
  if (acao === 'saude') return resposta_({ ok: true, linhas: Math.max(0, aba_().getLastRow() - 1) });
  if (acao !== 'paginas' && acao !== 'dados') return resposta_({ ok: false, motivo: 'acao' });

  var chave = acao + '|' + JSON.stringify(p);
  var cache = CacheService.getScriptCache();
  var pronto = cache.get(chave);
  if (pronto) return ContentService.createTextOutput(pronto).setMimeType(ContentService.MimeType.JSON);

  var linhas = lerLinhas_();
  var saida = acao === 'paginas' ? agregarPaginas(linhas, p, new Date()) : agregarDados(linhas, p, new Date());
  var texto = JSON.stringify(saida);
  try { cache.put(chave, texto, CACHE_SEGUNDOS); } catch (err) { /* resposta grande demais para o cache: segue sem */ }
  return ContentService.createTextOutput(texto).setMimeType(ContentService.MimeType.JSON);
}

/* Apaga as linhas com mais de DIAS_GUARDADOS. As linhas entram em ordem de tempo, entao as velhas
   estao no topo: conta ate achar a primeira recente e apaga o bloco de uma vez. Rode por acionador
   diario ou a mao (Executar > limparAntigos). */
function limparAntigos() {
  var s = aba_();
  var n = s.getLastRow() - 1;
  if (n < 1) return 0;
  var corte = Date.now() - DIAS_GUARDADOS * 86400000;
  var datas = s.getRange(2, 1, n, 1).getValues();
  var velhas = 0;
  for (var i = 0; i < datas.length; i++) {
    var d = dataDe_(datas[i][0]);
    if (d && d.getTime() < corte) velhas++; else break;
  }
  if (velhas > 0) s.deleteRows(2, velhas);
  return velhas;
}

/* ------------------------------------------ regras puras (testadas em test/codigo-gs.test.js) */
function num_(v) {
  if (v === null || v === undefined || v === '') return '';
  var n = Number(v);
  return isFinite(n) ? n : '';
}

function dataDe_(v) {
  var d = v instanceof Date ? v : new Date(v);
  return isNaN(d.getTime()) ? null : d;
}

function diasDe_(p) {
  var d = Number(p && p.dias);
  return (d === 7 || d === 30 || d === 90 || d === 180) ? d : 30;
}

// Lote validado pela Vercel -> linhas da planilha, uma por evento, na ordem de COLUNAS. Reconfere o
// basico porque a URL do App da Web e publica.
function linhasDoLote(c, agora) {
  if (!c || typeof c !== 'object' || !c.site || !Array.isArray(c.eventos)) return [];
  var site = String(c.site).slice(0, 120);
  var pagina = String(c.pagina || '/').slice(0, 200);
  var vw = num_(c.vw), vh = num_(c.vh), docH = num_(c.docH);
  var sessao = String(c.sessao || '').slice(0, 40);
  var disp = String(c.dispositivo || '').slice(0, 10);
  var saida = [];
  var evs = c.eventos.slice(0, LIMITE_POR_LOTE);
  for (var i = 0; i < evs.length; i++) {
    var ev = evs[i];
    if (!ev || typeof ev !== 'object') continue;
    var tipo = String(ev.tipo || '');
    if (tipo !== 'view' && tipo !== 'click' && tipo !== 'move' && tipo !== 'scroll') continue;
    saida.push([agora, site, pagina, tipo, num_(ev.xr), num_(ev.y), vw, vh, docH, num_(ev.prof), sessao, String(ev.alvo || '').slice(0, 80), disp]);
  }
  return saida;
}

// Uma linha por pagina: visitas, sessoes distintas, cliques, movimentos, profundidade media de
// rolagem, visitas no celular e ultimo evento. So o periodo pedido (dias).
function agregarPaginas(linhas, p, agora) {
  var dias = diasDe_(p);
  var corte = agora.getTime() - dias * 86400000;
  var mapa = {};
  for (var i = 0; i < linhas.length; i++) {
    var l = linhas[i];
    var d = dataDe_(l[0]);
    if (!d || d.getTime() <= corte) continue;
    var k = l[1] + '\n' + l[2];
    var a = mapa[k];
    if (!a) a = mapa[k] = { site: l[1], pagina: l[2], visitas: 0, cliques: 0, movimentos: 0, somaProf: 0, nProf: 0, visitas_mobile: 0, ultimo: 0, sessoes: {} };
    var tipo = l[3];
    if (tipo === 'view') {
      a.visitas++;
      if (l[12] === 'mobile') a.visitas_mobile++;
      if (l[10]) a.sessoes[l[10]] = 1;
    } else if (tipo === 'click') {
      a.cliques++;
    } else if (tipo === 'move') {
      a.movimentos++;
    } else if (tipo === 'scroll' && l[9] !== '' && l[9] !== null) {
      a.somaProf += Number(l[9]); a.nProf++;
    }
    if (d.getTime() > a.ultimo) a.ultimo = d.getTime();
  }
  var lista = [];
  for (var k2 in mapa) {
    var x = mapa[k2];
    lista.push({
      site: x.site, pagina: x.pagina, visitas: x.visitas, sessoes: Object.keys(x.sessoes).length,
      cliques: x.cliques, movimentos: x.movimentos,
      profundidade_media: x.nProf ? Math.round(x.somaProf / x.nProf) : null,
      visitas_mobile: x.visitas_mobile, ultimo: new Date(x.ultimo).toISOString()
    });
  }
  lista.sort(function (a, b) { return (b.visitas - a.visitas) || (b.cliques - a.cliques); });
  return { ok: true, dias: dias, paginas: lista.slice(0, 500) };
}

// Pontos de uma pagina para o mapa, somados em celulas de 0,1% da largura por 8 px, mais o resumo
// (visitas, sessoes, altura mediana do documento, profundidade media). Filtra site, pagina, tipo,
// periodo e aparelho.
function agregarDados(linhas, p, agora) {
  p = p || {};
  var dias = diasDe_(p);
  var corte = agora.getTime() - dias * 86400000;
  var site = String(p.site || '');
  var pagina = String(p.pagina || '/');
  var tipo = p.tipo === 'move' ? 'move' : 'click';
  var disp = String(p.disp || 'todos');
  var celulas = {}, sessoes = {}, alturas = [];
  var visitas = 0, total = 0, somaProf = 0, nProf = 0;
  for (var i = 0; i < linhas.length; i++) {
    var l = linhas[i];
    if (l[1] !== site || l[2] !== pagina) continue;
    if (disp !== 'todos' && l[12] !== disp) continue;
    var d = dataDe_(l[0]);
    if (!d || d.getTime() <= corte) continue;
    var t = l[3];
    if (t === 'view') {
      visitas++;
      if (l[10]) sessoes[l[10]] = 1;
    } else if (t === 'scroll' && l[9] !== '' && l[9] !== null) {
      somaProf += Number(l[9]); nProf++;
    }
    if (t === tipo) {
      total++;
      var xr = Math.round(Number(l[4]) * 1000) / 1000;
      var y = Math.floor(Number(l[5]) / 8) * 8;
      var k = xr + '|' + y;
      celulas[k] = (celulas[k] || 0) + 1;
    }
    if (l[8] !== '' && l[8] !== null) alturas.push(Number(l[8]));
  }
  var pontos = [];
  for (var k2 in celulas) {
    var pa = k2.split('|');
    pontos.push([Number(pa[0]), Number(pa[1]), celulas[k2]]);
  }
  pontos.sort(function (a, b) { return b[2] - a[2]; });
  alturas.sort(function (a, b) { return a - b; });
  return {
    ok: true, site: site, pagina: pagina, tipo: tipo, dias: dias, dispositivo: disp,
    pontos: pontos.slice(0, 20000), total: total, visitas: visitas, sessoes: Object.keys(sessoes).length,
    docH: alturas.length ? alturas[Math.floor(alturas.length / 2)] : null,
    profundidadeMedia: nProf ? Math.round(somaProf / nProf) : null
  };
}
