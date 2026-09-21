/* mapadpr / t.js: o coletor que entra em cada pagina do site da DPR e, com ?mapadpr=click (ou =move)
   na URL, vira o proprio mapa de calor desenhado por cima da pagina real.

   COLETA (anonima): cliques (posicao e o elemento clicado), movimento do mouse (amostrado), a
   profundidade maxima de rolagem e uma marca de visita por pagina. A posicao horizontal vai como
   fracao da largura do documento e a vertical em pixels, para o mapa acompanhar larguras diferentes.
   Nada de nome, e-mail ou IP. Os lotes saem a cada 5 s e ao sair da pagina, por sendBeacon.

   MAPA: busca os pontos agregados e desenha em canvas sobre o documento, com um painel para trocar
   tipo, periodo e aparelho. Sem senha (decisao da dona, 21/09) e sem biblioteca. Enquanto a planilha
   nao esta conectada, a resposta vem com demo: true (dados inventados) e o painel avisa. */
(function () {
  'use strict';
  var script = document.currentScript;
  var BASE = '';
  try { BASE = script && script.src ? new URL(script.src).origin : ''; } catch (e) { BASE = ''; }
  if (!BASE) return;

  var SITE = location.host;
  var PAGINA = (location.pathname || '/').replace(/\/index\.html$/i, '/') || '/';
  var params = new URLSearchParams(location.search);

  function docW() { return Math.max(document.documentElement.scrollWidth, document.body ? document.body.scrollWidth : 0, 1); }
  function docH() { return Math.max(document.documentElement.scrollHeight, document.body ? document.body.scrollHeight : 0, 1); }

  if (params.has('mapadpr')) { mapa(); return; }
  coletar();

  /* ---------------------------------------------------------------- coleta */
  function coletar() {
    var sessao = '';
    try { sessao = sessionStorage.getItem('mapadpr_s') || ''; } catch (e) { sessao = ''; }
    if (!sessao) {
      sessao = Math.random().toString(36).slice(2, 12) + Date.now().toString(36);
      try { sessionStorage.setItem('mapadpr_s', sessao); } catch (e) { /* sem storage, segue sem sessao fixa */ }
    }
    var fila = [];
    var enviados = 0;
    var MAX_POR_PAGINA = 400;

    function add(ev) { if (fila.length + enviados >= MAX_POR_PAGINA) return; fila.push(ev); }

    function alvoDe(el) {
      try {
        var e = el && el.nodeType === 3 ? el.parentElement : el;
        for (var i = 0; e && i < 3; i++) {
          if (e.id) return (e.tagName || '').toLowerCase() + '#' + e.id;
          if (e.tagName === 'A' || e.tagName === 'BUTTON') break;
          e = e.parentElement;
        }
        if (!e) return '';
        var cls = (typeof e.className === 'string' ? e.className : '').trim().split(/\s+/).filter(Boolean).slice(0, 2).join('.');
        return (e.tagName || '').toLowerCase() + (cls ? '.' + cls : '');
      } catch (err) { return ''; }
    }

    document.addEventListener('click', function (e) {
      add({ tipo: 'click', xr: e.pageX / docW(), y: Math.round(e.pageY), alvo: alvoDe(e.target) });
    }, true);

    var ultimoMove = 0, lx = -100, ly = -100;
    document.addEventListener('mousemove', function (e) {
      var t = Date.now();
      if (t - ultimoMove < 200) return;
      if (Math.abs(e.pageX - lx) < 12 && Math.abs(e.pageY - ly) < 12) return;
      ultimoMove = t; lx = e.pageX; ly = e.pageY;
      add({ tipo: 'move', xr: e.pageX / docW(), y: Math.round(e.pageY) });
    }, { passive: true });

    var profMax = 0;
    function medirProf() {
      var p = Math.round(((window.scrollY || window.pageYOffset || 0) + window.innerHeight) / docH() * 100);
      if (p > profMax) profMax = Math.min(100, p);
    }
    window.addEventListener('scroll', medirProf, { passive: true });
    medirProf();
    add({ tipo: 'view' });

    var profEnviada = -1;
    function enviar(final) {
      var lote = fila.splice(0, fila.length);
      if (final && profMax !== profEnviada) { lote.push({ tipo: 'scroll', prof: profMax }); profEnviada = profMax; }
      if (!lote.length) return;
      enviados += lote.length;
      var corpo = JSON.stringify({ site: SITE, pagina: PAGINA, vw: window.innerWidth, vh: window.innerHeight, docH: docH(), sessao: sessao, eventos: lote });
      try {
        if (navigator.sendBeacon) {
          navigator.sendBeacon(BASE + '/api/coletar', new Blob([corpo], { type: 'text/plain' }));
        } else {
          fetch(BASE + '/api/coletar', { method: 'POST', body: corpo, keepalive: true, headers: { 'Content-Type': 'text/plain' } }).catch(function () {});
        }
      } catch (e) { /* coleta nunca pode quebrar a pagina */ }
    }
    setInterval(function () { enviar(false); }, 5000);
    document.addEventListener('visibilitychange', function () { if (document.hidden) enviar(true); });
    window.addEventListener('pagehide', function () { enviar(true); });
  }

  /* ------------------------------------------------------------------ mapa */
  function mapa() {
    var tipo = params.get('mapadpr') === 'move' ? 'move' : 'click';
    var dias = params.get('dias') || '30';
    var disp = params.get('disp') || 'todos';

    var canvas = document.createElement('canvas');
    canvas.setAttribute('aria-hidden', 'true');
    canvas.style.cssText = 'position:absolute;top:0;left:0;pointer-events:none;z-index:2147483000;';
    document.body.appendChild(canvas);

    var painel = document.createElement('div');
    painel.style.cssText = 'position:fixed;right:16px;bottom:16px;z-index:2147483001;background:#050505;color:#fff;font:13px/1.4 Arial,sans-serif;padding:12px 14px;border:1px solid #ff0000;box-shadow:0 10px 30px rgba(0,0,0,.6);display:grid;gap:8px;min-width:230px;';
    painel.innerHTML =
      '<strong style="font-size:11px;letter-spacing:2px;color:#ff0000">MAPA DE CALOR</strong>' +
      '<label>Tipo <select data-k="mapadpr"><option value="click">Cliques</option><option value="move">Movimento</option></select></label>' +
      '<label>Período <select data-k="dias"><option value="7">7 dias</option><option value="30">30 dias</option><option value="90">90 dias</option><option value="180">180 dias</option></select></label>' +
      '<label>Aparelho <select data-k="disp"><option value="todos">Todos</option><option value="desktop">Computador</option><option value="mobile">Celular</option><option value="tablet">Tablet</option></select></label>' +
      '<div data-info style="color:#a0a0a0">Carregando...</div>' +
      '<button type="button" data-fechar style="background:#ff0000;color:#fff;border:0;padding:8px;cursor:pointer;letter-spacing:1px">FECHAR MAPA</button>';
    document.body.appendChild(painel);
    painel.querySelectorAll('select').forEach(function (s) { s.style.cssText = 'width:100%;margin-top:2px;background:#111;color:#fff;border:1px solid #333;padding:4px;'; });
    painel.querySelector('[data-k="mapadpr"]').value = tipo;
    painel.querySelector('[data-k="dias"]').value = dias;
    painel.querySelector('[data-k="disp"]').value = disp;
    painel.querySelectorAll('select').forEach(function (s) {
      s.addEventListener('change', function () {
        var p = new URLSearchParams(location.search);
        p.set(this.getAttribute('data-k'), this.value);
        location.search = p.toString();
      });
    });
    painel.querySelector('[data-fechar]').addEventListener('click', function () {
      var p = new URLSearchParams(location.search);
      p.delete('mapadpr'); p.delete('dias'); p.delete('disp');
      location.search = p.toString();
    });
    var info = painel.querySelector('[data-info]');

    var pontos = [];
    function desenhar() {
      var W = docW(), H = docH();
      canvas.width = W; canvas.height = H;
      canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
      var ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, W, H);
      if (!pontos.length) return;
      var raio = tipo === 'click' ? 22 : 30;
      var max = 1;
      for (var i = 0; i < pontos.length; i++) if (pontos[i][2] > max) max = pontos[i][2];
      // 1) acumula intensidade em preto com alfa
      for (var j = 0; j < pontos.length; j++) {
        var x = pontos[j][0] * W, y = pontos[j][1];
        var a = Math.min(1, 0.12 + 0.88 * (pontos[j][2] / max));
        var g = ctx.createRadialGradient(x, y, 0, x, y, raio);
        g.addColorStop(0, 'rgba(0,0,0,' + a + ')');
        g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g;
        ctx.fillRect(x - raio, y - raio, raio * 2, raio * 2);
      }
      // 2) pinta pela paleta (azul -> ciano -> verde -> amarelo -> vermelho) conforme a intensidade
      var pal = paleta();
      var img = ctx.getImageData(0, 0, W, H);
      var d = img.data;
      for (var k = 0; k < d.length; k += 4) {
        var alpha = d[k + 3];
        if (!alpha) continue;
        var idx = alpha * 4;
        d[k] = pal[idx]; d[k + 1] = pal[idx + 1]; d[k + 2] = pal[idx + 2];
        d[k + 3] = Math.min(255, Math.round(alpha * 0.85) + 30);
      }
      ctx.putImageData(img, 0, 0);
    }
    function paleta() {
      var c = document.createElement('canvas'); c.width = 256; c.height = 1;
      var x = c.getContext('2d');
      var g = x.createLinearGradient(0, 0, 256, 0);
      g.addColorStop(0.15, 'rgb(0,0,255)'); g.addColorStop(0.4, 'rgb(0,255,255)');
      g.addColorStop(0.6, 'rgb(0,255,0)'); g.addColorStop(0.8, 'rgb(255,255,0)'); g.addColorStop(1, 'rgb(255,0,0)');
      x.fillStyle = g; x.fillRect(0, 0, 256, 1);
      return x.getImageData(0, 0, 256, 1).data;
    }

    // `h` e a altura real desta pagina: a demonstracao usa para espalhar os pontos dentro dela.
    var url = BASE + '/api/dados?site=' + encodeURIComponent(SITE) + '&pagina=' + encodeURIComponent(PAGINA) + '&tipo=' + tipo + '&dias=' + encodeURIComponent(dias) + '&disp=' + encodeURIComponent(disp) + '&h=' + docH();
    fetch(url).then(function (r) { return r.json(); }).then(function (d) {
      if (!d) return;
      if (!d.ok) { info.textContent = 'Não foi possível carregar (' + (d.motivo || 'erro') + ').'; return; }
      pontos = d.pontos || [];
      info.innerHTML = (d.demo ? '<b style="color:#ff0000">DEMONSTRAÇÃO</b> (dados inventados)<br>' : '') +
        (tipo === 'click' ? 'Cliques' : 'Pontos de movimento') + ': <b>' + d.total + '</b><br>Visitas: <b>' + d.visitas + '</b> (' + d.sessoes + ' sessões)' + (d.profundidadeMedia ? '<br>Rolagem média: <b>' + d.profundidadeMedia + '%</b>' : '');
      desenhar();
    }).catch(function () { info.textContent = 'Falha de rede ao carregar o mapa.'; });

    var t = null;
    window.addEventListener('resize', function () { clearTimeout(t); t = setTimeout(desenhar, 200); });
    window.addEventListener('load', function () { setTimeout(desenhar, 300); });
  }
})();
