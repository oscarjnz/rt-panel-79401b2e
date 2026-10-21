/* Escritorio para la Surface RT (Internet Explorer 11): solo ES5.
   Sin let/const, flechas, template strings, fetch, Promise ni métodos nuevos de Array/String.
   Los datos del usuario viven en localStorage con el prefijo "rtos.". Nada se borra sin poder deshacerse:
   cada borrado ofrece "Deshacer", hay una copia automática diaria y un respaldo manual.
   La personalización (tema, acento, escala, orden, tamaños, widgets ocultos) se guarda en "rtos.prefs".
   Datos que llegan del PC (se regeneran cada 30 min): proyectos/resumen.js y proyectos/trabajo.js. */
(function () {
  'use strict';

  var MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  var DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
  var KEYS = ['tasks', 'notes', 'marks', 'events', 'pomo', 'prefs', 'unidone'];
  /* Servicio que lee el iCal de Blackboard (Worker de Cloudflare, ver ~/ics-proxy). Desplegado el 2026-10-21. */
  var UNI_API = 'https://ics-proxy.ojimenez6.workers.dev/';
  var MARK_COLORS = ['#3b82f6', '#22a36b', '#8b5cf6', '#d98a1c', '#d6457f', '#12a3bd'];
  var ACCENTS = { azul: '#3b82f6', verde: '#22b36b', violeta: '#8b5cf6', ambar: '#f59e0b', rosa: '#ec4899', cian: '#06b6d4' };
  var ACCENT_NAMES = { azul: 'Azul', verde: 'Verde', violeta: 'Violeta', ambar: 'Ámbar', rosa: 'Rosa', cian: 'Cian' };
  var SIZES = [3, 4, 6, 8, 12];
  var SIZE_LABEL = { 3: '1/4', 4: '1/3', 6: '1/2', 8: '2/3', 12: 'Todo' };
  var CIRC = 415;
  var SLAB = { bloqueado: 'BLOQUEADO', encurso: 'EN CURSO', pendiente: 'PENDIENTE', hecho: 'HECHO' };
  var SCLS = { bloqueado: 'c-rojo', encurso: 'c-azul', pendiente: 'c-ambar', hecho: 'c-verde' };
  var SORD = { bloqueado: 0, encurso: 1, pendiente: 2, hecho: 3 };

  /* ---------- utilidades ---------- */
  function $(id) { return document.getElementById(id); }
  function mk(tag, cls, txt) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (txt !== undefined && txt !== null) e.appendChild(document.createTextNode(txt));
    return e;
  }
  function clearNode(n) { while (n.firstChild) n.removeChild(n.firstChild); }
  function two(n) { return n < 10 ? '0' + n : '' + n; }
  function uid() { return new Date().getTime().toString(36) + Math.random().toString(36).slice(2, 6); }
  function dkey(d) { return d.getFullYear() + '-' + two(d.getMonth() + 1) + '-' + two(d.getDate()); }
  function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
  function plural(n, a, b) { return n === 1 ? a : b; }
  function on(node, ev, fn) { if (node.addEventListener) node.addEventListener(ev, fn, false); else node.attachEvent('on' + ev, fn); }
  function off(node, ev, fn) { if (node.removeEventListener) node.removeEventListener(ev, fn, false); else node.detachEvent('on' + ev, fn); }
  function stop(e) { if (e.preventDefault) e.preventDefault(); else e.returnValue = false; }
  function hasCls(n, c) { return (' ' + n.className + ' ').indexOf(' ' + c + ' ') > -1; }
  function addCls(n, c) { if (!hasCls(n, c)) n.className = (n.className + ' ' + c).replace(/^\s+/, ''); }
  function delCls(n, c) { n.className = (' ' + n.className + ' ').replace(' ' + c + ' ', ' ').replace(/^\s+|\s+$/g, ''); }
  function trim(s) { return String(s).replace(/^\s+|\s+$/g, ''); }
  function keyToDate(k) { var p = k.split('-'); return new Date(parseInt(p[0], 10), parseInt(p[1], 10) - 1, parseInt(p[2], 10)); }
  function longDay(d) { return DIAS[d.getDay()] + ', ' + d.getDate() + ' de ' + MESES[d.getMonth()]; }
  function shortDay(k) { var d = keyToDate(k); return d.getDate() + ' ' + MESES[d.getMonth()].slice(0, 3); }
  function ago(ms) {
    var m = Math.round((new Date().getTime() - ms) / 60000);
    if (m < 2) return 'hace un momento';
    if (m < 60) return 'hace ' + m + ' min';
    var h = Math.round(m / 60);
    if (m < 1440) return 'hace ' + h + (h === 1 ? ' hora' : ' horas');
    var d = Math.round(m / 1440);
    return 'hace ' + d + (d === 1 ? ' día' : ' días');
  }
  function hexRgb(h) { return [parseInt(h.substr(1, 2), 16), parseInt(h.substr(3, 2), 16), parseInt(h.substr(5, 2), 16)]; }
  function rgba(h, a) { var c = hexRgb(h); return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + a + ')'; }
  function mix(h, to, t) {
    var a = hexRgb(h), b = hexRgb(to), i, out = '#', v;
    for (i = 0; i < 3; i++) { v = Math.round(a[i] + (b[i] - a[i]) * t); out += (v < 16 ? '0' : '') + v.toString(16); }
    return out;
  }
  function loadScript(src, done) {
    var s = document.createElement('script');
    s.src = src + '?t=' + Math.floor(new Date().getTime() / 300000);
    var fin = function () { if (s.parentNode) s.parentNode.removeChild(s); if (done) done(); };
    s.onload = fin; s.onerror = fin;
    document.getElementsByTagName('head')[0].appendChild(s);
  }

  /* ---------- almacenamiento ---------- */
  var mem = {};
  var storeOk = true;
  function warnStore() {
    var w = $('warn');
    w.innerHTML = 'Este navegador no deja guardar datos. Lo que escribas se perderá al cerrar la página.';
    w.style.display = 'block';
  }
  function load(k, def) {
    var raw = null;
    try { raw = window.localStorage.getItem('rtos.' + k); } catch (e) { storeOk = false; raw = mem[k] === undefined ? null : mem[k]; }
    if (raw === null || raw === undefined) return def;
    try { return JSON.parse(raw); } catch (e2) { return def; }
  }
  function save(k, v) {
    var s = JSON.stringify(v);
    mem[k] = s;
    try { window.localStorage.setItem('rtos.' + k, s); } catch (e) { storeOk = false; warnStore(); }
  }
  function removeKey(k) { try { window.localStorage.removeItem('rtos.' + k); } catch (e) { } delete mem[k]; }
  function localKeys() {
    var out = [], i, k;
    try { for (i = 0; i < window.localStorage.length; i++) { k = window.localStorage.key(i); if (k && k.indexOf('rtos.') === 0) out.push(k.slice(5)); } } catch (e) { }
    return out;
  }

  var tasks = load('tasks', []);
  var notes = load('notes', []);
  var marks = load('marks', null);
  var events = load('events', {});
  var pomo = load('pomo', null);
  var prefs = load('prefs', null) || {};
  if (!prefs.theme) prefs.theme = 'dark';
  if (!ACCENTS[prefs.accent]) prefs.accent = 'azul';
  if (!prefs.scale) prefs.scale = 1;
  if (!prefs.size) prefs.size = {};
  if (!prefs.hidden) prefs.hidden = {};
  var VIZ = [['barra', 'Barra'], ['anillo', 'Anillo'], ['medidor', 'Medidor'], ['segmentos', 'Segmentos'], ['senal', 'Señal'], ['puntos', 'Puntos'], ['nivel', 'Nivel']];
  function vizLabel(id) { var i; for (i = 0; i < VIZ.length; i++) { if (VIZ[i][0] === id) return VIZ[i][1]; } return null; }
  if (!vizLabel(prefs.viz)) prefs.viz = 'barra';
  if (!marks) {
    marks = [{ id: 'm1', n: 'GitHub', u: 'https://github.com' }, { id: 'm2', n: 'Panel de proyectos', u: 'proyectos/' }];
    save('marks', marks);
  }
  if (!notes.length) { notes = [{ id: uid(), t: '', u: new Date().getTime() }]; }
  var selNote = notes[0].id;
  var selDay = dkey(new Date());
  var calY = new Date().getFullYear(), calM = new Date().getMonth();
  var editMarks = false;
  var editing = false;
  var taskFilter = 'todas';
  var noteArea = $('note-text');
  var noteQuery = '';
  /* Universidad: el enlace del iCal se pega UNA vez y queda en esta tablet (clave rtos.uni). NO forma parte de KEYS,
     así que nunca sale en el respaldo exportado, y nunca se escribe en la página, la URL ni el repositorio. */
  var uniLink = load('uni', null);
  var uniData = load('unidata', null);
  var uniDone = load('unidone', {});
  var uniMsg = '';
  var uniLoading = false;
  var uniFilter = 'proximas';
  var uniChange = false;

  /* ---------- copia de seguridad automática y manual ---------- */
  function allData() { var o = {}, i; for (i = 0; i < KEYS.length; i++) { o[KEYS[i]] = load(KEYS[i], null); } return o; }
  function hasData(o) { var i; for (i = 0; i < KEYS.length; i++) { if (o[KEYS[i]] !== null && o[KEYS[i]] !== undefined) return true; } return false; }
  function dailyBackup() {
    var today = dkey(new Date());
    if (load('bakday', null) === today) return;
    var data = allData();
    if (hasData(data)) {
      save('bak.' + today, data);
      var ks = localKeys(), bks = [], i;
      for (i = 0; i < ks.length; i++) { if (/^bak\.\d{4}-\d{2}-\d{2}$/.test(ks[i])) bks.push(ks[i]); }
      bks.sort();
      while (bks.length > 7) removeKey(bks.shift());
    }
    save('bakday', today);
  }
  function applyData(o) {
    var i;
    for (i = 0; i < KEYS.length; i++) { if (o[KEYS[i]] !== null && o[KEYS[i]] !== undefined) save(KEYS[i], o[KEYS[i]]); else removeKey(KEYS[i]); }
    window.location.reload();
  }

  /* ---------- aviso con "Deshacer" ---------- */
  var toastTimer = null, toastFn = null;
  function toast(msg, undoFn) {
    $('toast-t').innerHTML = '';
    $('toast-t').appendChild(document.createTextNode(msg));
    toastFn = undoFn;
    $('toast-b').style.display = undoFn ? '' : 'none';
    $('toast').style.display = 'block';
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { $('toast').style.display = 'none'; toastFn = null; }, 7000);
  }
  on($('toast-b'), 'click', function () {
    var f = toastFn;
    $('toast').style.display = 'none'; toastFn = null;
    if (f) f();
  });

  /* ---------- tema, acento y escala ---------- */
  function themeCss() {
    var A = ACCENTS[prefs.accent], light = prefs.theme === 'light';
    var AT = light ? mix(A, '#000000', 0.18) : mix(A, '#ffffff', 0.38);
    var AX = light ? mix(A, '#000000', 0.38) : mix(A, '#ffffff', 0.7);
    var ON = prefs.accent === 'ambar' ? '#1a1200' : '#ffffff';
    var s = '';
    s += '.brand .logo, table.cal td.sel, .addrow .go, .day .addrow .go, .bars i.on { background-color: ' + A + '; }';
    s += '.btn.pri { background-color: ' + A + '; border-color: ' + A + '; color: ' + ON + '; }';
    s += '.addrow .go, table.cal td.sel { color: ' + ON + '; }';
    s += '.field:focus { border-color: ' + A + '; }';
    s += '.ch a.ex, .nchip.plus, .vback { color: ' + AT + '; }';
    s += 'table.cal td.hoy { border-color: ' + A + '; }';
    s += 'table.cal td.has:after { background-color: ' + AT + '; }';
    s += 'table.cal td.sel:after { background-color: ' + ON + '; }';
    s += '.ev, .agi { border-left-color: ' + A + '; }';
    s += '.nchip.on { border-bottom-color: ' + A + '; }';
    s += '.nlist li.on { border-left-color: ' + A + '; }';
    s += '.modes .m.on, .seg .sg.on { border-color: ' + A + '; background-color: ' + rgba(A, 0.16) + '; color: ' + AX + '; }';
    s += '.flash { border-color: ' + A + '; background-color: ' + rgba(A, 0.16) + '; color: ' + AX + '; }';
    s += '.k-blue .kn { color: ' + AT + '; } .k-blue .kbar i { background-color: ' + A + '; }';
    s += '.k-blue .vf { stroke: ' + A + '; } .k-blue .kv i.lit { background-color: ' + A + '; } .k-blue .vniv { background-color: ' + rgba(A, 0.2) + '; }';
    s += '.vtile.on { border-color: ' + A + '; }';
    s += '.c-azul { color: ' + AT + '; border-color: ' + rgba(A, 0.45) + '; background-color: ' + rgba(A, 0.14) + '; }';
    s += '.tg .t.on i { border-color: ' + A + '; background-color: ' + A + '; }';
    s += '#editbar { border-color: ' + A + '; background-color: ' + rgba(A, 0.08) + '; }';
    s += '.edt { border-bottom-color: ' + A + '; background-color: ' + rgba(A, 0.1) + '; }';
    s += 'body.editing .card { border-color: ' + A + '; }';
    s += 'body.editing .card.target { border-color: #f0b43c; }';
    return s;
  }
  function applyTheme() {
    var A = ACCENTS[prefs.accent], light = prefs.theme === 'light', b = document.body;
    var st = $('theme-css');
    var css = themeCss();
    if (st.styleSheet) st.styleSheet.cssText = css; else { clearNode(st); st.appendChild(document.createTextNode(css)); }
    b.className = (light ? 'light' : '') + (editing ? ' editing' : '') + ' viz-' + prefs.viz;
    b.style.zoom = prefs.scale;
    $('btn-viz').innerHTML = 'Estilo: ' + vizLabel(prefs.viz);
    $('p-arc').setAttribute('stroke', A);
    $('p-track').setAttribute('stroke', light ? '#e8eaee' : '#0f1115');
    $('btn-edit').innerHTML = editing ? 'Listo' : 'Editar diseño';
  }
  function savePrefs() { save('prefs', prefs); }

  /* ---------- rejilla de tarjetas: orden, tamaño y visibilidad ---------- */
  var grid = $('grid');
  var cards = {}, defOrder = [], defSize = {}, titles = {};
  (function () {
    var els = grid.children, i, id, m;
    for (i = 0; i < els.length; i++) {
      if (!hasCls(els[i], 'card')) continue;
      id = els[i].getAttribute('data-w');
      cards[id] = els[i]; defOrder.push(id); titles[id] = els[i].getAttribute('data-title') || id;
      m = /(^| )s(\d+)( |$)/.exec(els[i].className);
      defSize[id] = m ? parseInt(m[2], 10) : 4;
    }
  })();
  function curOrder() {
    var out = [], seen = {}, i, src = prefs.order || [];
    for (i = 0; i < src.length; i++) { if (cards[src[i]] && !seen[src[i]]) { out.push(src[i]); seen[src[i]] = true; } }
    for (i = 0; i < defOrder.length; i++) { if (!seen[defOrder[i]]) out.push(defOrder[i]); }
    return out;
  }
  function curSize(id) { return prefs.size[id] || defSize[id]; }
  function applyLayout() {
    var ord = curOrder(), i, c, k, j, lab;
    for (i = 0; i < ord.length; i++) {
      c = cards[ord[i]];
      grid.appendChild(c);
      for (k = 0; k < SIZES.length; k++) delCls(c, 's' + SIZES[k]);
      addCls(c, 's' + curSize(ord[i]));
      if (prefs.hidden[ord[i]]) addCls(c, 'hid'); else delCls(c, 'hid');
      lab = c.getElementsByTagName('span');
      for (j = 0; j < lab.length; j++) { if (hasCls(lab[j], 'zs')) lab[j].innerHTML = SIZE_LABEL[curSize(ord[i])]; }
    }
    renderHiddenList();
  }
  function snapPrefs() { return JSON.stringify(prefs); }
  function restorePrefs(snap) { prefs = JSON.parse(snap); savePrefs(); applyTheme(); applyLayout(); renderCustom(); }
  function moveCard(id, dir) {
    var ord = curOrder(), i = ord.indexOf(id), j = i + dir;
    while (j >= 0 && j < ord.length && prefs.hidden[ord[j]]) j += dir;
    if (j < 0 || j >= ord.length) return;
    ord.splice(i, 1); ord.splice(j, 0, id);
    prefs.order = ord; savePrefs(); applyLayout();
  }
  function resizeCard(id, dir) {
    var i = SIZES.indexOf(curSize(id)) + dir;
    if (i < 0 || i >= SIZES.length) return;
    prefs.size[id] = SIZES[i]; savePrefs(); applyLayout();
  }
  function hideCard(id) {
    var snap = snapPrefs();
    prefs.hidden[id] = true; savePrefs(); applyLayout(); renderCustom();
    toast(titles[id] + ' oculto', function () { restorePrefs(snap); });
  }
  function resetLayout() {
    var snap = snapPrefs();
    prefs.order = null; prefs.size = {}; prefs.hidden = {}; savePrefs(); applyLayout(); renderCustom();
    toast('Diseño restablecido', function () { restorePrefs(snap); });
  }
  function renderHiddenList() {
    var box = $('hidden-list'), ord = curOrder(), i;
    clearNode(box);
    for (i = 0; i < ord.length; i++) {
      if (prefs.hidden[ord[i]]) {
        (function (id) {
          var b = mk('button', 'btn sm', '+ ' + titles[id]); b.type = 'button';
          on(b, 'click', function () { delete prefs.hidden[id]; savePrefs(); applyLayout(); renderCustom(); });
          box.appendChild(b);
        })(ord[i]);
      }
    }
  }

  /* barra de edición dentro de cada tarjeta */
  (function () {
    var id;
    for (id in cards) {
      if (cards.hasOwnProperty(id)) {
        (function (cid, card) {
          var bar = mk('div', 'edt clear'), tl = mk('div', 'tl');
          bar.appendChild(mk('span', 'nm', titles[cid] + ' · arrastrar'));
          function btn(txt, act, cls) {
            var b = mk('span', 'eb' + (cls ? ' ' + cls : ''), txt);
            b.setAttribute('data-act', act);
            return b;
          }
          tl.appendChild(btn('‹', 'prev')); tl.appendChild(btn('›', 'next'));
          tl.appendChild(btn('−', 'smaller')); tl.appendChild(mk('span', 'zs', SIZE_LABEL[defSize[cid]])); tl.appendChild(btn('+', 'bigger'));
          tl.appendChild(btn('Ocultar', 'hide', 'x'));
          bar.appendChild(tl);
          card.insertBefore(bar, card.firstChild);
          on(bar, 'click', function (e) {
            e = e || window.event;
            var t = e.target || e.srcElement, act = t && t.getAttribute ? t.getAttribute('data-act') : null;
            if (!act) return;
            if (act === 'prev') moveCard(cid, -1);
            else if (act === 'next') moveCard(cid, 1);
            else if (act === 'smaller') resizeCard(cid, -1);
            else if (act === 'bigger') resizeCard(cid, 1);
            else if (act === 'hide') hideCard(cid);
          });
          on(bar, 'pointerdown', function (e) { startDrag(e, cid, card); });
        })(id, cards[id]);
      }
    }
  })();

  /* arrastrar y soltar con eventos de puntero (funciona con el dedo en IE 11) */
  var drag = null;
  function cardAt(x, y) {
    var el = document.elementFromPoint(x, y);
    while (el && el !== document.body) {
      if (el.parentNode === grid && hasCls(el, 'card')) return el;
      el = el.parentNode;
    }
    return null;
  }
  function startDrag(e, id, card) {
    e = e || window.event;
    var t = e.target || e.srcElement;
    if (t && t.getAttribute && t.getAttribute('data-act')) return;
    if (e.button !== undefined && e.button > 0) return;
    drag = { id: id, card: card, target: null, side: 'before' };
    addCls(card, 'dragging');
    on(document, 'pointermove', moveDrag);
    on(document, 'pointerup', endDrag);
    on(document, 'pointercancel', endDrag);
    stop(e);
  }
  function moveDrag(e) {
    if (!drag) return;
    e = e || window.event;
    var y = e.clientY, x = e.clientX, h = window.innerHeight || document.documentElement.clientHeight;
    if (y < 70) window.scrollBy(0, -18); else if (y > h - 70) window.scrollBy(0, 18);
    var t = cardAt(x, y);
    if (drag.target) delCls(drag.target, 'target');
    if (!t || t === drag.card) { drag.target = null; return; }
    var r = t.getBoundingClientRect(), gw = grid.getBoundingClientRect().width;
    drag.side = (r.width > gw * 0.6) ? (y < r.top + r.height / 2 ? 'before' : 'after') : (x < r.left + r.width / 2 ? 'before' : 'after');
    drag.target = t; addCls(t, 'target');
    stop(e);
  }
  function endDrag() {
    if (!drag) return;
    off(document, 'pointermove', moveDrag); off(document, 'pointerup', endDrag); off(document, 'pointercancel', endDrag);
    delCls(drag.card, 'dragging');
    if (drag.target) {
      delCls(drag.target, 'target');
      var ord = curOrder(), tid = drag.target.getAttribute('data-w'), i = ord.indexOf(drag.id), j;
      ord.splice(i, 1);
      j = ord.indexOf(tid);
      ord.splice(drag.side === 'before' ? j : j + 1, 0, drag.id);
      prefs.order = ord; savePrefs(); applyLayout();
    }
    drag = null;
  }

  function setEditing(v) {
    editing = v;
    if (v && curView) { window.location.hash = '#/'; }
    applyTheme();
    if (v) { $('modal-custom').style.display = 'none'; }
  }
  on($('btn-edit'), 'click', function () { setEditing(!editing); });
  on($('btn-done'), 'click', function () { setEditing(false); });
  on($('btn-reset'), 'click', resetLayout);

  /* ---------- panel de personalización ---------- */
  function renderCustom() {
    var th = $('seg-theme'), sc = $('seg-scale'), sw = $('sw-accent'), tg = $('tg-widgets'), i, k, ord;
    clearNode(th); clearNode(sc); clearNode(sw); clearNode(tg);
    var themes = [['dark', 'Oscuro'], ['light', 'Claro']];
    for (i = 0; i < themes.length; i++) {
      (function (v) {
        var b = mk('span', 'sg' + (prefs.theme === v[0] ? ' on' : ''), v[1]);
        on(b, 'click', function () { prefs.theme = v[0]; savePrefs(); applyTheme(); renderCustom(); });
        th.appendChild(b);
      })(themes[i]);
    }
    var scales = [[0.9, 'Pequeño'], [1, 'Normal'], [1.12, 'Grande']];
    for (i = 0; i < scales.length; i++) {
      (function (v) {
        var b = mk('span', 'sg' + (prefs.scale === v[0] ? ' on' : ''), v[1]);
        on(b, 'click', function () { prefs.scale = v[0]; savePrefs(); applyTheme(); renderCustom(); });
        sc.appendChild(b);
      })(scales[i]);
    }
    for (k in ACCENTS) {
      if (ACCENTS.hasOwnProperty(k)) {
        (function (key) {
          var d = mk('span', 'dot' + (prefs.accent === key ? ' on' : ''));
          d.style.backgroundColor = ACCENTS[key]; d.setAttribute('title', ACCENT_NAMES[key]);
          on(d, 'click', function () { prefs.accent = key; savePrefs(); applyTheme(); renderCustom(); });
          sw.appendChild(d);
        })(k);
      }
    }
    var vg = $('vz-grid'); clearNode(vg);
    for (i = 0; i < VIZ.length; i++) {
      (function (v) {
        var t = mk('div', 'vtile k-blue' + (prefs.viz === v[0] ? ' on' : '')), pre = mk('div', 'vpre'), kv = mk('div', 'kv');
        kv.innerHTML = vizHtml(v[0], 65); pre.appendChild(kv);
        t.appendChild(pre); t.appendChild(mk('div', 'vlab', v[1]));
        on(t, 'click', function () { setViz(v[0]); });
        vg.appendChild(t);
      })(VIZ[i]);
    }
    ord = curOrder();
    for (i = 0; i < ord.length; i++) {
      (function (id) {
        var t = mk('span', 't' + (prefs.hidden[id] ? '' : ' on')), ic = mk('i');
        t.appendChild(ic); t.appendChild(document.createTextNode(titles[id]));
        on(t, 'click', function () {
          if (prefs.hidden[id]) delete prefs.hidden[id]; else prefs.hidden[id] = true;
          savePrefs(); applyLayout(); renderCustom();
        });
        tg.appendChild(t);
      })(ord[i]);
    }
  }
  on($('btn-custom'), 'click', function () { renderCustom(); $('modal-custom').style.display = 'block'; });
  on($('c-close'), 'click', function () { $('modal-custom').style.display = 'none'; });
  on($('c-edit'), 'click', function () { setEditing(true); });
  on($('c-reset'), 'click', resetLayout);

  /* ---------- cabecera ---------- */
  function renderHead() {
    var d = new Date(), h = d.getHours();
    var sal = h < 6 ? 'Buenas noches' : (h < 12 ? 'Buenos días' : (h < 19 ? 'Buenas tardes' : 'Buenas noches'));
    $('hello').innerHTML = sal + ', Oscar';
    $('clock').innerHTML = two(h) + ':' + two(d.getMinutes());
    $('today').innerHTML = DIAS[d.getDay()] + ', ' + d.getDate() + ' de ' + MESES[d.getMonth()];
  }

  /* ---------- tarjetas que llevan al detalle ---------- */
  function goTo(dest) {
    if (editing) return;
    if (dest.charAt(0) === '#') window.location.hash = dest; else window.location.href = dest;
  }
  on(grid, 'click', function (e) {
    e = e || window.event;
    var t = e.target || e.srcElement, n = t, go = null;
    while (n && n !== grid) {
      if (n.tagName === 'BUTTON' || n.tagName === 'INPUT' || n.tagName === 'TEXTAREA' || n.tagName === 'A' || n.tagName === 'TD' || hasCls(n, 'al') || hasCls(n, 'wk')) { return; }
      if (n.getAttribute && n.getAttribute('data-go')) { go = n.getAttribute('data-go'); break; }
      n = n.parentNode;
    }
    if (go) goTo(go);
  });

  /* ---------- indicadores ---------- */
  /* Dibuja el indicador en la forma elegida. pct va de 0 a 100. Los colores los pone el CSS según k-red, k-amber, k-green o k-blue. */
  function vizHtml(st, pct) {
    pct = Math.max(0, Math.min(100, pct || 0));
    var r = Math.round(pct), s = '', i, lit, C;
    if (st === 'anillo') {
      C = 2 * Math.PI * 26;
      s = '<svg width="68" height="68" viewBox="0 0 68 68"><circle class="vt" cx="34" cy="34" r="26" fill="none" stroke-width="7"/>' +
        (pct > 0 ? '<circle class="vf" cx="34" cy="34" r="26" fill="none" stroke-width="7" stroke-linecap="round" stroke-dasharray="' + (C * pct / 100).toFixed(1) + ' ' + C.toFixed(1) + '" transform="rotate(-90 34 34)"/>' : '') +
        '<text class="vx" x="34" y="39" text-anchor="middle">' + r + '%</text></svg>';
    } else if (st === 'medidor') {
      C = Math.PI * 38;
      s = '<svg width="96" height="58" viewBox="0 0 96 58"><path class="vt" d="M10 50 A38 38 0 0 1 86 50" fill="none" stroke-width="8" stroke-linecap="round"/>' +
        (pct > 0 ? '<path class="vf" d="M10 50 A38 38 0 0 1 86 50" fill="none" stroke-width="8" stroke-linecap="round" stroke-dasharray="' + (C * pct / 100).toFixed(1) + ' ' + C.toFixed(1) + '"/>' : '') +
        '<text class="vx vx2" x="48" y="48" text-anchor="middle">' + r + '%</text></svg>';
    } else if (st === 'segmentos') {
      lit = Math.ceil(pct / 10);
      s = '<div class="vseg">'; for (i = 0; i < 10; i++) { s += '<i' + (i < lit ? ' class="lit"' : '') + '></i>'; } s += '</div>';
    } else if (st === 'senal') {
      lit = Math.ceil(pct / 12.5);
      s = '<div class="vsig">'; for (i = 0; i < 8; i++) { s += '<i' + (i < lit ? ' class="lit"' : '') + ' style="height:' + (8 + i * 4) + 'px"></i>'; } s += '</div>';
    } else if (st === 'puntos') {
      lit = Math.ceil(pct / 5);
      s = '<div class="vdot">'; for (i = 0; i < 20; i++) { s += '<i' + (i < lit ? ' class="lit"' : '') + '></i>' + (i === 9 ? '<br>' : ''); } s += '</div>';
    } else if (st === 'nivel') {
      s = '<div class="vniv" style="height:' + r + '%"></div>';
    } else {
      s = '<div class="kbar"><i style="width:' + r + '%"></i></div>';
    }
    return s;
  }
  function setViz(id) {
    prefs.viz = id; savePrefs(); applyTheme(); renderKpis();
    if (curView) rerenderView();
    renderCustom();
  }
  on($('btn-viz'), 'click', function () {
    var i, nx = 0;
    for (i = 0; i < VIZ.length; i++) { if (VIZ[i][0] === prefs.viz) nx = (i + 1) % VIZ.length; }
    setViz(VIZ[nx][0]);
  });
  function setKpi(n, cls, num, cap_, pct) {
    var card = cards[n.card];
    $(n.n).innerHTML = num;
    $(n.c).innerHTML = cap_;
    $(n.b).innerHTML = vizHtml(prefs.viz, pct);
    if (cls) card.className = card.className.replace(/ k-(red|amber|green|blue)/g, '') + ' ' + cls;
  }
  function renderKpis() {
    var R = window.PANEL_RESUMEN, total = R ? R.c.rojo + R.c.ambar + R.c.verde + R.c.gris : 0;
    if (R) {
      setKpi({ card: 'kfail', n: 'k1n', c: 'k1c', b: 'k1b' }, R.c.rojo ? 'k-red' : 'k-green', R.c.rojo, 'de ' + total + ' proyectos', total ? R.c.rojo * 100 / total : 0);
      setKpi({ card: 'kpend', n: 'k2n', c: 'k2c', b: 'k2b' }, R.c.ambar ? 'k-amber' : 'k-green', R.c.ambar, 'trabajo sin subir o desfasado', total ? R.c.ambar * 100 / total : 0);
    } else {
      setKpi({ card: 'kfail', n: 'k1n', c: 'k1c', b: 'k1b' }, null, '-', 'sin datos del panel', 0);
      setKpi({ card: 'kpend', n: 'k2n', c: 'k2c', b: 'k2b' }, null, '-', 'sin datos del panel', 0);
    }
    var i, pend = 0, done = 0;
    for (i = 0; i < tasks.length; i++) { if (tasks[i].d) done++; else pend++; }
    setKpi({ card: 'ktask', n: 'k3n', c: 'k3c', b: 'k3b' }, null, pend, tasks.length ? (done + ' de ' + tasks.length + ' hechas') : 'sin tareas todavía', tasks.length ? done * 100 / tasks.length : 0);
    var nf = pomo && pomo.n ? (pomo.n[dkey(new Date())] || 0) : 0;
    setKpi({ card: 'kfoc', n: 'k4n', c: 'k4c', b: 'k4b' }, null, nf, plural(nf, 'sesión de foco', 'sesiones de foco') + ' · meta 4', nf * 25);
  }

  /* ---------- proyectos (resumen del panel) ---------- */
  var LAB = { rojo: 'FALLO', ambar: 'PENDIENTE' };
  var MAXP = 7;
  function renderProy() {
    var R = window.PANEL_RESUMEN, box = $('proy-body'), foot = $('proy-foot'), i, items = [];
    clearNode(box);
    renderKpis();
    if (!R) {
      box.appendChild(mk('div', 'empty', 'No hay datos del panel todavía. Abre el panel completo para verlos.'));
      foot.innerHTML = '';
      return;
    }
    for (i = 0; i < R.items.length; i++) { if (R.items[i].e === 'rojo' || R.items[i].e === 'ambar') items.push(R.items[i]); }
    if (!items.length) box.appendChild(mk('div', 'allok', 'Todo en orden: ningún proyecto con fallo ni trabajo pendiente.'));
    for (i = 0; i < items.length && i < MAXP; i++) {
      var row = mk('div', 'al clear'), chip = mk('div', 'chip c-' + items[i].e, LAB[items[i].e]), tx = mk('div', 'txt');
      tx.appendChild(mk('div', 'nm', items[i].n));
      tx.appendChild(mk('div', 'ft', items[i].f));
      row.appendChild(chip); row.appendChild(tx);
      on(row, 'click', function () { goTo('proyectos/'); });
      box.appendChild(row);
    }
    if (items.length > MAXP) box.appendChild(mk('div', 'more', '+ ' + (items.length - MAXP) + ' más en el panel completo'));
    var stale = (new Date().getTime() - R.ts) > 12 * 3600000;
    foot.className = 'cf' + (stale ? ' stale' : '');
    foot.innerHTML = '';
    foot.appendChild(document.createTextNode((stale ? 'Datos viejos: el PC no ha actualizado el panel. ' : '') + 'Actualizado ' + ago(R.ts)));
  }

  /* ---------- trabajo (lo que llevamos y lo que falta, lo actualiza Claude desde el PC) ---------- */
  function workItems() {
    var W = window.OS_TRABAJO, out = [], i, j, p;
    if (!W || !W.proyectos) return out;
    for (i = 0; i < W.proyectos.length; i++) {
      p = W.proyectos[i];
      for (j = 0; j < (p.faltan || []).length; j++) { out.push({ p: p.n, e: p.e, t: p.faltan[j].t, s: p.faltan[j].s || 'pendiente', n: p.faltan[j].n }); }
    }
    out.sort(function (a, b) { return SORD[a.s] - SORD[b.s]; });
    return out;
  }
  function renderWork() {
    var W = window.OS_TRABAJO, box = $('work-body'), foot = $('work-foot'), items = workItems(), i;
    clearNode(box);
    if (!W) { box.appendChild(mk('div', 'empty', 'Todavía no hay datos de trabajo.')); foot.innerHTML = ''; return; }
    if (!items.length) box.appendChild(mk('div', 'allok', 'Sin pendientes registrados en los proyectos.'));
    for (i = 0; i < items.length && i < 6; i++) {
      var row = mk('div', 'al wk clear'), chip = mk('div', 'chip ' + SCLS[items[i].s], SLAB[items[i].s]), tx = mk('div', 'txt');
      tx.appendChild(mk('div', 'nm', items[i].t));
      tx.appendChild(mk('div', 'ft', items[i].p));
      row.appendChild(chip); row.appendChild(tx);
      on(row, 'click', function () { goTo('#/trabajo'); });
      box.appendChild(row);
    }
    if (items.length > 6) box.appendChild(mk('div', 'more', '+ ' + (items.length - 6) + ' más'));
    foot.innerHTML = '';
    foot.appendChild(document.createTextNode(items.length + ' ' + plural(items.length, 'pendiente', 'pendientes') + ' · actualizado ' + ago(W.ts)));
  }

  /* ---------- tareas ---------- */
  var CHECK = '<svg class="ic" viewBox="0 0 24 24" style="stroke-width:4"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
  function sortedTasks(filter) {
    var i, list = [];
    for (i = 0; i < tasks.length; i++) { if (!tasks[i].d && filter !== 'hechas') list.push(tasks[i]); }
    for (i = 0; i < tasks.length; i++) { if (tasks[i].d && filter !== 'pendientes') list.push(tasks[i]); }
    return list;
  }
  function renderTasks() {
    var ul = $('tasks-list'), i, done = 0, list = sortedTasks('todas');
    clearNode(ul);
    for (i = 0; i < tasks.length; i++) { if (tasks[i].d) done++; }
    if (!list.length) ul.appendChild(mk('li', 'empty', 'Sin tareas. Escribe la primera arriba.'));
    for (i = 0; i < list.length; i++) { ul.appendChild(taskRow(list[i])); }
    var total = tasks.length, pct = total ? Math.round(done * 100 / total) : 0;
    $('t-bar').style.width = pct + '%';
    $('t-count').innerHTML = total ? (done + ' de ' + total + ' hechas · ' + pct + '%') : 'Nada pendiente';
    $('t-clear').style.display = done ? '' : 'none';
    renderKpis(); renderSys();
  }
  function taskChanged() { save('tasks', tasks); if (curView) rerenderView(); else renderTasks(); }
  function taskRow(t) {
    var li = mk('li', 'task' + (t.d ? ' done' : '')), chk = mk('button', 'chk'), tx = mk('span', 'tx', t.t), del = mk('button', 'del', '×');
    chk.type = 'button'; del.type = 'button';
    chk.setAttribute('aria-label', t.d ? 'Marcar como pendiente' : 'Marcar como hecha');
    del.setAttribute('aria-label', 'Borrar tarea');
    chk.innerHTML = CHECK;
    on(chk, 'click', function () { t.d = !t.d; if (t.d) t.f = new Date().getTime(); taskChanged(); });
    on(tx, 'click', function () { t.d = !t.d; if (t.d) t.f = new Date().getTime(); taskChanged(); });
    on(del, 'click', function () {
      var snap = JSON.stringify(tasks), i;
      for (i = 0; i < tasks.length; i++) { if (tasks[i].id === t.id) { tasks.splice(i, 1); break; } }
      taskChanged();
      toast('Tarea eliminada', function () { tasks = JSON.parse(snap); taskChanged(); });
    });
    li.appendChild(chk); li.appendChild(tx); li.appendChild(del);
    return li;
  }
  function addTask(v) {
    v = trim(v);
    if (!v) return false;
    tasks.push({ id: uid(), t: v, d: false, c: new Date().getTime() });
    taskChanged();
    return true;
  }
  function clearDone() {
    var snap = JSON.stringify(tasks), keep = [], i, n = 0;
    for (i = 0; i < tasks.length; i++) { if (tasks[i].d) n++; else keep.push(tasks[i]); }
    if (!n) return;
    tasks = keep; taskChanged();
    toast(n + ' ' + plural(n, 'tarea hecha quitada', 'tareas hechas quitadas'), function () { tasks = JSON.parse(snap); taskChanged(); });
  }
  on($('t-form'), 'submit', function (e) {
    e = e || window.event; stop(e);
    if (addTask($('t-in').value)) $('t-in').value = '';
  });
  on($('t-clear'), 'click', clearDone);

  /* ---------- calendario ---------- */
  function renderCalInto(t, ttl, picked) {
    var i, r, c, row, cell, first = new Date(calY, calM, 1), start = (first.getDay() + 6) % 7;
    var days = new Date(calY, calM + 1, 0).getDate(), prevDays = new Date(calY, calM, 0).getDate();
    var todayK = dkey(new Date()), idx = 0;
    clearNode(t);
    ttl.innerHTML = cap(MESES[calM]) + ' ' + calY;
    var hr = mk('tr'), ds = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
    for (i = 0; i < 7; i++) hr.appendChild(mk('th', null, ds[i]));
    var thead = mk('thead'); thead.appendChild(hr); t.appendChild(thead);
    var tb = mk('tbody');
    for (r = 0; r < 6; r++) {
      row = mk('tr');
      for (c = 0; c < 7; c++) {
        var d, other = false;
        idx = r * 7 + c - start + 1;
        if (idx < 1) { d = new Date(calY, calM - 1, prevDays + idx); other = true; }
        else if (idx > days) { d = new Date(calY, calM + 1, idx - days); other = true; }
        else d = new Date(calY, calM, idx);
        var k = dkey(d);
        cell = mk('td', null, '' + d.getDate());
        var cls = [];
        if (other) cls.push('o');
        if (events[k] && events[k].length) cls.push('has');
        if (k === todayK) cls.push('hoy');
        if (k === selDay) cls.push('sel');
        cell.className = cls.join(' ');
        (function (kk, dd) {
          on(cell, 'click', function () {
            selDay = kk;
            if (dd.getMonth() !== calM) { calY = dd.getFullYear(); calM = dd.getMonth(); }
            picked();
          });
        })(k, d);
        row.appendChild(cell);
      }
      tb.appendChild(row);
      if (idx >= days && r >= 3) break;
    }
    t.appendChild(tb);
  }
  function renderCal() { renderCalInto($('cal'), $('cal-ttl'), function () { renderCal(); renderDay(); }); }
  function eventsOn(k) { return events[k] || []; }
  function delEvent(k, id) {
    var snap = JSON.stringify(events), j, arr = events[k];
    for (j = 0; j < arr.length; j++) { if (arr[j].id === id) { arr.splice(j, 1); break; } }
    if (!arr.length) delete events[k];
    save('events', events); eventsChanged();
    toast('Evento eliminado', function () { events = JSON.parse(snap); save('events', events); eventsChanged(); });
  }
  function addEvent(k, v) {
    v = trim(v);
    if (!v) return false;
    if (!events[k]) events[k] = [];
    events[k].push({ id: uid(), t: v });
    save('events', events); eventsChanged();
    return true;
  }
  function eventsChanged() { if (curView) rerenderView(); else { renderCal(); renderDay(); } }
  function renderDay() {
    var list = $('day-list'), evs = eventsOn(selDay), i;
    clearNode(list);
    $('day-ttl').innerHTML = selDay === dkey(new Date()) ? 'Hoy, ' + longDay(keyToDate(selDay)) : cap(longDay(keyToDate(selDay)));
    if (!evs.length) list.appendChild(mk('div', 'empty', 'Sin eventos este día.'));
    for (i = 0; i < evs.length; i++) {
      (function (ev) {
        var row = mk('div', 'ev', ev.t), del = mk('button', 'del', '×');
        del.type = 'button'; del.setAttribute('aria-label', 'Borrar evento');
        on(del, 'click', function () { delEvent(selDay, ev.id); });
        row.appendChild(del); list.appendChild(row);
      })(evs[i]);
    }
    renderSys();
  }
  on($('e-form'), 'submit', function (e) {
    e = e || window.event; stop(e);
    if (addEvent(selDay, $('e-in').value)) $('e-in').value = '';
  });
  on($('cal-prev'), 'click', function () { calM--; if (calM < 0) { calM = 11; calY--; } renderCal(); });
  on($('cal-next'), 'click', function () { calM++; if (calM > 11) { calM = 0; calY++; } renderCal(); });

  /* ---------- notas ---------- */
  function curNote() { var i; for (i = 0; i < notes.length; i++) { if (notes[i].id === selNote) return notes[i]; } return notes[0]; }
  function noteTitle(n) { var l = (n.t || '').replace(/^\s+/, '').split(/\r?\n/)[0]; return l ? l.slice(0, 22) : 'Nota vacía'; }
  function renderChips() {
    var box = $('n-chips'), i;
    clearNode(box);
    for (i = 0; i < notes.length; i++) {
      (function (nt) {
        var c = mk('button', 'nchip' + (nt.id === selNote ? ' on' : ''), noteTitle(nt));
        c.type = 'button';
        on(c, 'click', function () { flushNote(); selNote = nt.id; renderNotes(); });
        box.appendChild(c);
      })(notes[i]);
    }
    var plus = mk('button', 'nchip plus', '+'); plus.type = 'button'; plus.setAttribute('aria-label', 'Nueva nota');
    on(plus, 'click', function () { newNote(); $('note-text').focus(); });
    box.appendChild(plus);
  }
  function newNote() {
    flushNote();
    var nn = { id: uid(), t: '', u: new Date().getTime() };
    notes.push(nn); selNote = nn.id; save('notes', notes);
    if (curView) rerenderView(); else renderNotes();
  }
  function renderNotes() {
    var n = curNote();
    selNote = n.id;
    renderChips();
    $('note-text').value = n.t || '';
    $('n-info').innerHTML = n.t ? (n.t.length + ' caracteres') : '';
    renderSys();
  }
  var noteTimer = null;
  function flushNote() {
    if (noteTimer) { clearTimeout(noteTimer); noteTimer = null; }
    var n = curNote(), v = noteArea.value;
    if (n.t !== v) { n.t = v; n.u = new Date().getTime(); save('notes', notes); }
  }
  function bindNoteArea(ta, infoEl, afterSave) {
    on(ta, 'input', function () {
      if (noteTimer) clearTimeout(noteTimer);
      infoEl.innerHTML = 'Guardando...';
      noteTimer = setTimeout(function () {
        flushNote();
        infoEl.innerHTML = 'Guardado ' + ago(curNote().u);
        afterSave();
      }, 500);
    });
  }
  bindNoteArea($('note-text'), $('n-info'), renderChips);
  on(window, 'beforeunload', function () { flushNote(); });
  function deleteNote() {
    flushNote();
    var snap = JSON.stringify(notes), i;
    for (i = 0; i < notes.length; i++) { if (notes[i].id === selNote) { notes.splice(i, 1); break; } }
    if (!notes.length) notes = [{ id: uid(), t: '', u: new Date().getTime() }];
    selNote = notes[0].id;
    save('notes', notes); if (curView) rerenderView(); else renderNotes();
    toast('Nota eliminada', function () { notes = JSON.parse(snap); selNote = notes[0].id; save('notes', notes); if (curView) rerenderView(); else renderNotes(); });
  }
  on($('n-del'), 'click', deleteNote);

  /* ---------- marcadores ---------- */
  function normUrl(u) {
    u = trim(u);
    if (!u) return null;
    if (/^https?:\/\//i.test(u)) return u;
    if (/^[a-z][a-z0-9+.\-]*:/i.test(u)) return null;
    return 'https://' + u;
  }
  function markColor(m, idx) { return MARK_COLORS[(m.n.charCodeAt(0) + idx) % MARK_COLORS.length]; }
  function renderMarks() {
    var box = $('marks'), i;
    clearNode(box);
    for (i = 0; i < marks.length; i++) {
      (function (m, idx) {
        var wrap = mk('div', 'mk'), a = mk('a');
        var lt = mk('span', 'lt', m.n.charAt(0).toUpperCase());
        lt.style.backgroundColor = markColor(m, idx);
        a.appendChild(lt); a.appendChild(mk('span', 'nm', m.n));
        a.setAttribute('href', m.u);
        wrap.appendChild(a); box.appendChild(wrap);
      })(marks[i], i);
    }
    if (!marks.length) box.appendChild(mk('div', 'empty', 'Sin marcadores. Agrega el primero en "Ver todo".'));
    renderSys();
  }
  function addMark(n, u) {
    n = trim(n); u = normUrl(u);
    if (!n || !u) { toast('Escribe un nombre y una dirección web válida', null); return false; }
    marks.push({ id: uid(), n: n, u: u });
    save('marks', marks); if (curView) rerenderView(); else renderMarks();
    return true;
  }
  function delMark(idx) {
    var snap = JSON.stringify(marks);
    marks.splice(idx, 1); save('marks', marks); if (curView) rerenderView(); else renderMarks();
    toast('Marcador quitado', function () { marks = JSON.parse(snap); save('marks', marks); if (curView) rerenderView(); else renderMarks(); });
  }

  /* ---------- enfoque (pomodoro) ---------- */
  var MODES = { foco: { t: 25 * 60, l: 'Foco' }, corto: { t: 5 * 60, l: 'Descanso' }, largo: { t: 15 * 60, l: 'Descanso largo' } };
  if (!pomo) pomo = { mode: 'foco', left: MODES.foco.t, end: null, n: {} };
  if (!pomo.n) pomo.n = {};
  if (!pomo.dur) pomo.dur = { foco: 25, corto: 5, largo: 15 };
  function applyDur() { var k; for (k in MODES) { if (MODES.hasOwnProperty(k)) MODES[k].t = pomo.dur[k] * 60; } }
  applyDur();
  if (!pomo.end && (pomo.left > MODES[pomo.mode].t || pomo.left < 1)) pomo.left = MODES[pomo.mode].t;
  function renderModes() {
    var box = $('p-modes'), k;
    clearNode(box);
    for (k in MODES) {
      if (MODES.hasOwnProperty(k)) {
        (function (key) {
          var b = mk('button', 'm' + (pomo.mode === key ? ' on' : ''), MODES[key].l);
          b.type = 'button';
          on(b, 'click', function () { pomo.mode = key; pomo.left = MODES[key].t; pomo.end = null; savePomo(); renderPomo(); });
          box.appendChild(b);
        })(k);
      }
    }
  }
  function savePomo() { save('pomo', pomo); }
  function renderPomo() {
    var total = MODES[pomo.mode].t, left = pomo.left;
    if (pomo.end) left = Math.max(0, Math.ceil((pomo.end - new Date().getTime()) / 1000));
    $('p-time').innerHTML = two(Math.floor(left / 60)) + ':' + two(left % 60);
    $('p-state').innerHTML = (pomo.end ? MODES[pomo.mode].l : (left === total ? MODES[pomo.mode].l : 'En pausa')).toUpperCase();
    $('p-arc').setAttribute('stroke-dashoffset', '' + Math.round(CIRC * (1 - left / total)));
    $('p-go').innerHTML = pomo.end ? 'Pausar' : (left === total ? 'Iniciar' : 'Seguir');
    $('p-go').className = 'btn ' + (pomo.end ? 'warn' : 'ok');
    var today = dkey(new Date()), n = pomo.n[today] || 0;
    $('p-done').innerHTML = n ? (n + ' ' + plural(n, 'sesión de foco hoy', 'sesiones de foco hoy')) : 'Aún sin sesiones hoy';
    renderModes();
    renderKpis();
  }
  function pomoTick() {
    if (!pomo.end) return;
    var left = Math.ceil((pomo.end - new Date().getTime()) / 1000);
    if (left <= 0) {
      var wasFoco = pomo.mode === 'foco', today = dkey(new Date());
      if (wasFoco) pomo.n[today] = (pomo.n[today] || 0) + 1;
      pomo.mode = wasFoco ? 'corto' : 'foco'; pomo.left = MODES[pomo.mode].t; pomo.end = null;
      savePomo();
      var f = $('p-flash');
      f.innerHTML = wasFoco ? 'Sesión terminada. Toca descansar.' : 'Descanso terminado. A trabajar.';
      f.style.display = 'block';
      try { document.title = '¡Listo! · Escritorio'; } catch (e) { }
      setTimeout(function () { f.style.display = 'none'; document.title = curView ? VIEWS[curView].title + ' · Escritorio' : 'Escritorio'; }, 20000);
      if (curView === 'enfoque') rerenderView();
    }
    renderPomo();
  }
  on($('p-go'), 'click', function () {
    if (pomo.end) { pomo.left = Math.max(1, Math.ceil((pomo.end - new Date().getTime()) / 1000)); pomo.end = null; }
    else { pomo.end = new Date().getTime() + pomo.left * 1000; $('p-flash').style.display = 'none'; }
    savePomo(); renderPomo();
  });
  on($('p-reset'), 'click', function () { pomo.left = MODES[pomo.mode].t; pomo.end = null; savePomo(); renderPomo(); });

  /* ---------- universidad (tareas de Blackboard) ---------- */
  function fmtDue(d) {
    var h = d.getHours(), m = d.getMinutes(), ap = h >= 12 ? 'p. m.' : 'a. m.';
    h = h % 12; if (h === 0) h = 12;
    return DIAS[d.getDay()].slice(0, 3) + ' ' + d.getDate() + ' ' + MESES[d.getMonth()].slice(0, 3) + ', ' + h + ':' + two(m) + ' ' + ap;
  }
  function dueInfo(iso) {
    var d = new Date(iso), now = new Date();
    var a = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime(), b = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    var diff = Math.round((a - b) / 864e5);
    if (d.getTime() < now.getTime()) return { txt: 'VENCIDA', cls: 'c-rojo', diff: diff, late: true };
    if (diff === 0) return { txt: 'HOY', cls: 'c-rojo', diff: 0 };
    if (diff === 1) return { txt: 'MAÑANA', cls: 'c-ambar', diff: 1 };
    if (diff <= 3) return { txt: diff + ' DÍAS', cls: 'c-ambar', diff: diff };
    return { txt: diff + ' DÍAS', cls: 'c-azul', diff: diff };
  }
  function uniItems(filter) {
    var out = [], i, it, all = uniData && uniData.items ? uniData.items : [], now = new Date().getTime();
    for (i = 0; i < all.length; i++) {
      it = all[i];
      var done = !!uniDone[it.id], late = new Date(it.d).getTime() < now;
      if (filter === 'hechas') { if (done) out.push(it); }
      else if (filter === 'proximas') { if (!done && !late) out.push(it); }
      else if (filter === 'vencidas') { if (!done && late) out.push(it); }
      else out.push(it);
    }
    return out;
  }
  function uniHost() {
    try { var m = /^https?:\/\/([^\/?#]+)/i.exec(uniLink || ''); return m ? m[1] : ''; } catch (e) { return ''; }
  }
  function uniChanged() { renderUni(); if (curView === 'universidad') rerenderView(); }
  function fetchUni() {
    if (!uniLink || uniLoading) return;
    if (!UNI_API) { uniMsg = 'El enlace ya quedó guardado. El servicio que lee Blackboard todavía no está activo.'; uniChanged(); return; }
    uniLoading = true; uniMsg = '';
    var x = new XMLHttpRequest();
    x.open('POST', UNI_API, true);
    x.timeout = 25000;
    x.setRequestHeader('Content-Type', 'text/plain');
    function end(msg) { uniLoading = false; if (msg !== null) uniMsg = msg; uniChanged(); }
    x.onload = function () {
      var j2 = null;
      try { j2 = JSON.parse(x.responseText); } catch (e) { }
      if (x.status === 200 && j2 && j2.items) { uniData = { ts: j2.ts, items: j2.items }; save('unidata', uniData); end(''); }
      else end((j2 && j2.error) ? j2.error : 'El servicio respondió con un error (' + x.status + ').');
    };
    x.onerror = function () { end('No se pudo conectar con el servicio. Se muestra lo último guardado.'); };
    x.ontimeout = function () { end('El servicio tardó demasiado. Se muestra lo último guardado.'); };
    try { x.send(uniLink); } catch (e) { end('No se pudo conectar con el servicio.'); }
  }
  function refreshUni(force) {
    if (!uniLink) return;
    var old = uniData && uniData.ts ? new Date().getTime() - uniData.ts : 1e12;
    if (force || old > 20 * 60000) fetchUni();
  }
  function saveUniLink(v) {
    v = trim(v);
    if (!/^https:\/\/[^\s\/]+\/\S*$/i.test(v)) { toast('Pega el enlace completo del calendario, que empieza con https://', null); return false; }
    uniLink = v; save('uni', v); uniData = null; removeKey('unidata'); uniChange = false; uniMsg = '';
    uniChanged(); fetchUni();
    return true;
  }
  function removeUniLink() {
    uniLink = null; removeKey('uni'); uniData = null; removeKey('unidata'); uniMsg = ''; uniChange = false;
    uniChanged();
    toast('Enlace de Blackboard quitado de esta tablet', null);
  }
  function uniForm(onSave) {
    var f = mk('form', 'unif'), inp = mk('input', 'field'), b = mk('button', 'btn pri', 'Guardar enlace');
    inp.type = 'text'; inp.setAttribute('placeholder', 'Pega aquí el enlace iCal de Blackboard'); inp.setAttribute('autocomplete', 'off'); inp.setAttribute('spellcheck', 'false'); inp.setAttribute('maxlength', '2000');
    b.type = 'submit';
    on(f, 'submit', function (e) { e = e || window.event; stop(e); var v = inp.value; if (saveUniLink(v)) { inp.value = ''; if (onSave) onSave(); } });
    f.appendChild(inp); f.appendChild(b);
    return f;
  }
  function uniNote() {
    var n = mk('div', 'note');
    n.appendChild(mk('b', null, 'Se guarda solo en esta tablet. '));
    n.appendChild(document.createTextNode('No se publica en ningún sitio ni aparece en el respaldo. Solo se envía a tu propio servicio para leer las tareas y no se almacena allí.'));
    return n;
  }
  function renderUni() {
    var box = $('uni-body'), foot = $('uni-foot'), items, i, row, chip, tx, di;
    if (!box) return;
    clearNode(box); foot.innerHTML = '';
    if (!uniLink) {
      box.appendChild(mk('div', 'hint', 'Conecta tu calendario de Blackboard para ver aquí las entregas. Se pega una sola vez.'));
      box.appendChild(uniForm(null)); box.appendChild(uniNote());
      return;
    }
    if (uniMsg) box.appendChild(mk('div', 'stat', uniMsg));
    items = uniItems('proximas');
    if (!uniData) box.appendChild(mk('div', 'empty', uniLoading ? 'Leyendo Blackboard...' : 'Todavía no hay datos.'));
    else if (!items.length) box.appendChild(mk('div', 'allok', 'Sin entregas próximas.'));
    for (i = 0; i < items.length && i < 5; i++) {
      di = dueInfo(items[i].d);
      row = mk('div', 'al wk clear'); chip = mk('div', 'chip ' + di.cls, di.txt); tx = mk('div', 'txt');
      tx.appendChild(mk('div', 'nm', items[i].t));
      tx.appendChild(mk('div', 'ft', (items[i].c ? items[i].c + ' · ' : '') + fmtDue(new Date(items[i].d))));
      row.appendChild(chip); row.appendChild(tx);
      on(row, 'click', function () { goTo('#/universidad'); });
      box.appendChild(row);
    }
    if (items.length > 5) box.appendChild(mk('div', 'more', '+ ' + (items.length - 5) + ' más'));
    foot.appendChild(document.createTextNode(uniData && uniData.ts ? 'Actualizado ' + ago(uniData.ts) : (uniLoading ? 'Actualizando...' : '')));
  }

  /* ---------- vistas de detalle (cada widget por dentro) ---------- */
  var viewEl = $('view'), mainEl = $('main'), curView = null;
  var VIEWS = {};

  function vHead(title, kick, sub) {
    var h = mk('div', 'vh clear'), back = mk('a', 'vback', '‹ Escritorio'), t = mk('div', 'vt');
    back.setAttribute('href', '#/');
    t.appendChild(mk('div', 'kick', kick || 'DETALLE'));
    t.appendChild(mk('h1', null, title));
    if (sub) t.appendChild(mk('div', 'vs', sub));
    h.appendChild(back); h.appendChild(t);
    return h;
  }
  function vCard(size, title, right) {
    var c = mk('div', 'card ' + size), h = mk('div', 'ch'), b = mk('div', 'cb');
    h.appendChild(mk('h2', null, title));
    if (right) h.appendChild(mk('span', 'ex', right));
    c.appendChild(h); c.appendChild(b);
    return { card: c, body: b };
  }
  function vStat(label, num, capTxt, cls, pct) {
    var c = mk('div', 'card kpi s3 ' + (cls || 'k-blue')), b = mk('div', 'cb');
    b.appendChild(mk('div', 'kl', label)); b.appendChild(mk('div', 'kn', '' + num)); b.appendChild(mk('div', 'kc', capTxt));
    var kv = mk('div', 'kv'); kv.innerHTML = vizHtml(prefs.viz, pct); b.appendChild(kv);
    c.appendChild(b);
    return c;
  }
  function seg(box, options, current, onPick) {
    var i;
    for (i = 0; i < options.length; i++) {
      (function (o) {
        var b = mk('span', 'sg' + (current === o[0] ? ' on' : ''), o[1]);
        on(b, 'click', function () { onPick(o[0]); });
        box.appendChild(b);
      })(options[i]);
    }
  }
  function addForm(placeholder, onAdd, withButtonText) {
    var f = mk('form', 'addrow'), inp = mk('input', 'field'), go = mk('button', 'go', '+');
    inp.type = 'text'; inp.setAttribute('placeholder', placeholder); inp.setAttribute('maxlength', '200'); f.setAttribute('autocomplete', 'off');
    go.type = 'submit'; go.setAttribute('aria-label', withButtonText || 'Agregar');
    f.appendChild(inp); f.appendChild(go);
    on(f, 'submit', function (e) { e = e || window.event; stop(e); if (onAdd(inp.value)) inp.value = ''; });
    return f;
  }
  function statusChip(s) { return mk('div', 'chip ' + SCLS[s], SLAB[s]); }

  /* tareas */
  VIEWS.tareas = {
    title: 'Tareas',
    render: function (root) {
      var pend = 0, done = 0, i, list, row, ul, wi, W = window.OS_TRABAJO;
      for (i = 0; i < tasks.length; i++) { if (tasks[i].d) done++; else pend++; }
      root.appendChild(vHead('Tareas', 'DETALLE', 'Tus tareas personales, y abajo a la derecha lo que falta en los proyectos.'));
      row = mk('div', 'row');
      row.appendChild(vStat('PENDIENTES', pend, 'por hacer', 'k-amber', tasks.length ? pend * 100 / tasks.length : 0));
      row.appendChild(vStat('HECHAS', done, 'completadas', 'k-green', tasks.length ? done * 100 / tasks.length : 0));
      row.appendChild(vStat('PROGRESO', tasks.length ? Math.round(done * 100 / tasks.length) + '%' : '0%', 'del total', 'k-blue', tasks.length ? done * 100 / tasks.length : 0));
      wi = workItems();
      row.appendChild(vStat('DE PROYECTOS', wi.length, 'pendientes en proyectos', 'k-red', wi.length ? 100 : 0));
      root.appendChild(row);
      row = mk('div', 'row');
      var c1 = vCard('s8', 'Mis tareas', null), fb = mk('div', 'seg');
      seg(fb, [['todas', 'Todas'], ['pendientes', 'Pendientes'], ['hechas', 'Hechas']], taskFilter, function (v) { taskFilter = v; rerenderView(); });
      c1.body.appendChild(addForm('Nueva tarea', addTask, 'Agregar tarea'));
      c1.body.appendChild(fb);
      list = sortedTasks(taskFilter); ul = mk('ul', 'vlist');
      if (!list.length) ul.appendChild(mk('li', 'empty', 'No hay tareas en esta vista.'));
      for (i = 0; i < list.length; i++) {
        (function (t) {
          var li = taskRow(t), meta = mk('span', 'meta', t.d && t.f ? 'hecha ' + ago(t.f) : (t.c ? 'creada ' + ago(t.c) : ''));
          li.insertBefore(meta, li.lastChild); ul.appendChild(li);
        })(list[i]);
      }
      c1.body.appendChild(ul);
      if (done) { var cl = mk('div', 'tfoot'), b = mk('button', 'btn sm', 'Limpiar hechas'); b.type = 'button'; on(b, 'click', clearDone); cl.appendChild(b); c1.body.appendChild(cl); }
      row.appendChild(c1.card);
      var c2 = vCard('s4', 'Pendientes de los proyectos', null);
      if (!wi.length) c2.body.appendChild(mk('div', 'empty', W ? 'Sin pendientes registrados.' : 'Todavía no hay datos de trabajo.'));
      for (i = 0; i < wi.length; i++) {
        var al = mk('div', 'al wk clear'), tx = mk('div', 'txt');
        tx.appendChild(mk('div', 'nm wrapnm', wi[i].t)); tx.appendChild(mk('div', 'ft', wi[i].p));
        al.appendChild(statusChip(wi[i].s)); al.appendChild(tx);
        c2.body.appendChild(al);
      }
      var more = mk('a', 'btn sm', 'Ver el detalle de trabajo'); more.setAttribute('href', '#/trabajo'); c2.body.appendChild(mk('div', 'tfoot')).appendChild(more);
      row.appendChild(c2.card);
      root.appendChild(row);
    }
  };

  /* calendario */
  VIEWS.calendario = {
    title: 'Calendario',
    render: function (root) {
      var row = mk('div', 'row'), i, k, keys = [], today = dkey(new Date()), past = [], fut = [], total = 0;
      for (k in events) { if (events.hasOwnProperty(k)) { keys.push(k); total += events[k].length; } }
      keys.sort();
      for (i = 0; i < keys.length; i++) { if (keys[i] >= today) fut.push(keys[i]); else past.push(keys[i]); }
      root.appendChild(vHead('Calendario', 'DETALLE', total + ' ' + plural(total, 'evento', 'eventos') + ' guardados en esta tablet'));
      var c1 = vCard('s6', 'Mes', null), nav = mk('div', 'cal-nav clear'), prev = mk('button', 'nv', '‹'), next = mk('button', 'nv n', '›'), ttl = mk('div', 'ttl'), tbl = mk('table', 'cal');
      prev.type = 'button'; next.type = 'button';
      on(prev, 'click', function () { calM--; if (calM < 0) { calM = 11; calY--; } rerenderView(); });
      on(next, 'click', function () { calM++; if (calM > 11) { calM = 0; calY++; } rerenderView(); });
      nav.appendChild(prev); nav.appendChild(next); nav.appendChild(ttl);
      c1.body.appendChild(nav); c1.body.appendChild(tbl);
      renderCalInto(tbl, ttl, rerenderView);
      var day = mk('div', 'day'), evs = eventsOn(selDay);
      day.appendChild(mk('h3', null, selDay === today ? 'Hoy, ' + longDay(keyToDate(selDay)) : cap(longDay(keyToDate(selDay)))));
      if (!evs.length) day.appendChild(mk('div', 'empty', 'Sin eventos este día.'));
      for (i = 0; i < evs.length; i++) {
        (function (ev) {
          var r = mk('div', 'ev', ev.t), del = mk('button', 'del', '×'); del.type = 'button';
          on(del, 'click', function () { delEvent(selDay, ev.id); });
          r.appendChild(del); day.appendChild(r);
        })(evs[i]);
      }
      day.appendChild(addForm('Nuevo evento este día', function (v) { return addEvent(selDay, v); }, 'Agregar evento'));
      c1.body.appendChild(day);
      row.appendChild(c1.card);
      var c2 = vCard('s6', 'Agenda', 'próximos eventos');
      if (!fut.length) c2.body.appendChild(mk('div', 'empty', 'No hay eventos próximos.'));
      function group(keysArr, limit) {
        var j, n;
        for (j = 0; j < keysArr.length && j < limit; j++) {
          (function (kk) {
            var g = mk('div', 'ag'), hd = mk('div', 'agh', (kk === today ? 'Hoy' : cap(longDay(keyToDate(kk)))));
            g.appendChild(hd);
            for (n = 0; n < events[kk].length; n++) g.appendChild(mk('div', 'agi', events[kk][n].t));
            on(g, 'click', function () { selDay = kk; var d = keyToDate(kk); calY = d.getFullYear(); calM = d.getMonth(); rerenderView(); });
            c2.body.appendChild(g);
          })(keysArr[j]);
        }
      }
      group(fut, 30);
      if (past.length) { c2.body.appendChild(mk('div', 'sub2', 'Recientes')); past.reverse(); group(past, 8); }
      row.appendChild(c2.card);
      root.appendChild(row);
    }
  };

  /* notas */
  VIEWS.notas = {
    title: 'Notas',
    render: function (root) {
      var row = mk('div', 'row'), i, q = noteQuery.toLowerCase(), shown = 0;
      root.appendChild(vHead('Notas', 'DETALLE', notes.length + ' ' + plural(notes.length, 'nota', 'notas') + ', se guardan solas'));
      var c1 = vCard('s4', 'Mis notas', null), sb = mk('input', 'field'), nl = mk('ul', 'nlist');
      sb.type = 'text'; sb.setAttribute('placeholder', 'Buscar en las notas'); sb.value = noteQuery;
      on(sb, 'input', function () { noteQuery = sb.value; renderNoteList(); });
      var nb = mk('button', 'btn sm pri', '+ Nueva nota'); nb.type = 'button'; on(nb, 'click', newNote);
      c1.body.appendChild(sb); c1.body.appendChild(mk('div', 'gap8')); c1.body.appendChild(nb); c1.body.appendChild(mk('div', 'gap8')); c1.body.appendChild(nl);
      function renderNoteList() {
        clearNode(nl);
        var qn = noteQuery.toLowerCase(), cnt = 0;
        for (var j = notes.length - 1; j >= 0; j--) {
          (function (nt) {
            if (qn && (nt.t || '').toLowerCase().indexOf(qn) < 0) return;
            var li = mk('li', nt.id === selNote ? 'on' : ''), lines = (nt.t || '').replace(/^\s+/, '').split(/\r?\n/);
            li.appendChild(mk('div', 'nt', lines[0] ? lines[0].slice(0, 40) : 'Nota vacía'));
            li.appendChild(mk('div', 'ns', (lines[1] || '').slice(0, 50)));
            li.appendChild(mk('div', 'nd', ago(nt.u)));
            on(li, 'click', function () { flushNote(); selNote = nt.id; rerenderView(); });
            nl.appendChild(li); cnt++;
          })(notes[j]);
        }
        if (!cnt) nl.appendChild(mk('li', 'empty', 'No hay notas que coincidan.'));
      }
      renderNoteList();
      row.appendChild(c1.card);
      var c2 = vCard('s8', 'Editor', null), ta = mk('textarea', 'field big'), info = mk('div', 'nfoot clear'), sp = mk('span', null, curNote().t ? curNote().t.length + ' caracteres' : ''), del = mk('button', 'btn sm warn', 'Borrar nota');
      ta.setAttribute('placeholder', 'Escribe aquí. Se guarda solo.'); ta.value = curNote().t || '';
      del.type = 'button'; on(del, 'click', deleteNote);
      info.appendChild(sp); info.appendChild(del);
      c2.body.appendChild(ta); c2.body.appendChild(info);
      noteArea = ta;
      bindNoteArea(ta, sp, renderNoteList);
      row.appendChild(c2.card);
      root.appendChild(row);
    }
  };

  /* enfoque */
  function lastDays(n) {
    var out = [], i, d, k;
    for (i = n - 1; i >= 0; i--) { d = new Date(); d.setDate(d.getDate() - i); k = dkey(d); out.push({ k: k, d: d, n: pomo.n[k] || 0 }); }
    return out;
  }
  VIEWS.enfoque = {
    title: 'Enfoque',
    render: function (root) {
      var days = lastDays(14), i, max = 1, week = 0, total = 0, streak = 0, k, row, best = 0;
      for (i = 0; i < days.length; i++) { if (days[i].n > max) max = days[i].n; if (i >= 7) week += days[i].n; if (days[i].n > best) best = days[i].n; }
      for (k in pomo.n) { if (pomo.n.hasOwnProperty(k)) total += pomo.n[k]; }
      for (i = days.length - 1; i >= 0; i--) { if (days[i].n > 0) streak++; else if (i !== days.length - 1) break; }
      root.appendChild(vHead('Enfoque', 'DETALLE', 'Sesiones de foco completadas y duración de cada modo'));
      row = mk('div', 'row');
      row.appendChild(vStat('HOY', days[days.length - 1].n, plural(days[days.length - 1].n, 'sesión', 'sesiones') + ' · meta 4', 'k-blue', days[days.length - 1].n * 25));
      row.appendChild(vStat('ÚLTIMOS 7 DÍAS', week, plural(week, 'sesión', 'sesiones'), 'k-green', Math.min(100, week * 100 / 28)));
      row.appendChild(vStat('RACHA', streak, plural(streak, 'día seguido', 'días seguidos'), 'k-amber', Math.min(100, streak * 100 / 7)));
      row.appendChild(vStat('TOTAL', total, 'sesiones registradas', 'k-blue', 0));
      root.appendChild(row);
      row = mk('div', 'row');
      var c1 = vCard('s8', 'Últimos 14 días', 'sesiones por día'), bars = mk('div', 'bars clear');
      for (i = 0; i < days.length; i++) {
        var col = mk('div', 'bc'), bi = mk('i', days[i].n ? 'on' : ''), lab = mk('span', 'bl', '' + days[i].d.getDate()), num = mk('span', 'bn', days[i].n ? '' + days[i].n : '');
        bi.style.height = Math.max(3, Math.round(days[i].n * 120 / max)) + 'px';
        col.appendChild(num); col.appendChild(bi); col.appendChild(lab); bars.appendChild(col);
      }
      c1.body.appendChild(bars);
      row.appendChild(c1.card);
      var c2 = vCard('s4', 'Duración de cada modo', 'minutos'), names = { foco: 'Foco', corto: 'Descanso', largo: 'Descanso largo' }, ks = ['foco', 'corto', 'largo'];
      for (i = 0; i < ks.length; i++) {
        (function (key) {
          var r = mk('div', 'dur clear'), minus = mk('button', 'btn sm', '−'), plus = mk('button', 'btn sm', '+'), v = mk('span', 'dv', pomo.dur[key] + ' min');
          minus.type = 'button'; plus.type = 'button';
          function change(delta) {
            var nv = pomo.dur[key] + delta;
            if (nv < 1 || nv > 120) return;
            var idle = !pomo.end && pomo.mode === key && pomo.left === MODES[key].t;
            pomo.dur[key] = nv; applyDur();
            if (idle || (!pomo.end && pomo.mode === key && pomo.left > MODES[key].t)) pomo.left = MODES[key].t;
            savePomo(); renderPomo(); rerenderView();
          }
          on(minus, 'click', function () { change(-1); }); on(plus, 'click', function () { change(1); });
          r.appendChild(mk('span', 'dn', names[key])); r.appendChild(plus); r.appendChild(v); r.appendChild(minus);
          c2.body.appendChild(r);
        })(ks[i]);
      }
      c2.body.appendChild(mk('div', 'hint', 'El temporizador está en el escritorio. Aquí solo se ajusta cuánto dura cada modo.'));
      row.appendChild(c2.card);
      root.appendChild(row);
    }
  };

  /* marcadores */
  VIEWS.marcadores = {
    title: 'Marcadores',
    render: function (root) {
      var row = mk('div', 'row'), i;
      root.appendChild(vHead('Marcadores', 'DETALLE', marks.length + ' ' + plural(marks.length, 'enlace', 'enlaces') + ' guardados'));
      var c1 = vCard('s8', 'Mis enlaces', null), ul = mk('ul', 'vlist');
      if (!marks.length) ul.appendChild(mk('li', 'empty', 'Sin marcadores todavía.'));
      for (i = 0; i < marks.length; i++) {
        (function (m, idx) {
          var li = mk('li', 'mrowl clear'), lt = mk('span', 'lt', m.n.charAt(0).toUpperCase()), a = mk('a', 'mlink'), up = mk('button', 'btn sm', '↑'), dn = mk('button', 'btn sm', '↓'), del = mk('button', 'btn sm warn', 'Quitar');
          lt.style.backgroundColor = markColor(m, idx);
          a.setAttribute('href', m.u); a.appendChild(mk('b', null, m.n)); a.appendChild(mk('span', 'mu', m.u));
          up.type = 'button'; dn.type = 'button'; del.type = 'button';
          on(up, 'click', function () { if (idx > 0) { var t = marks[idx]; marks[idx] = marks[idx - 1]; marks[idx - 1] = t; save('marks', marks); rerenderView(); } });
          on(dn, 'click', function () { if (idx < marks.length - 1) { var t = marks[idx]; marks[idx] = marks[idx + 1]; marks[idx + 1] = t; save('marks', marks); rerenderView(); } });
          on(del, 'click', function () { delMark(idx); });
          li.appendChild(lt); li.appendChild(a); li.appendChild(mk('span', 'mt', '')); li.lastChild.appendChild(up); li.lastChild.appendChild(dn); li.lastChild.appendChild(del);
          ul.appendChild(li);
        })(marks[i], i);
      }
      c1.body.appendChild(ul);
      row.appendChild(c1.card);
      var c2 = vCard('s4', 'Agregar un marcador', null), nm = mk('input', 'field'), ur = mk('input', 'field'), sv = mk('button', 'btn pri', 'Guardar marcador');
      nm.type = 'text'; nm.setAttribute('placeholder', 'Nombre'); nm.setAttribute('maxlength', '40');
      ur.type = 'text'; ur.setAttribute('placeholder', 'Dirección, por ejemplo github.com'); ur.setAttribute('maxlength', '300');
      sv.type = 'button';
      on(sv, 'click', function () { addMark(nm.value, ur.value); });
      c2.body.appendChild(nm); c2.body.appendChild(mk('div', 'gap8')); c2.body.appendChild(ur); c2.body.appendChild(mk('div', 'gap8')); c2.body.appendChild(sv);
      c2.body.appendChild(mk('div', 'hint', 'Si no escribes http o https, se agrega https automáticamente.'));
      row.appendChild(c2.card);
      root.appendChild(row);
    }
  };

  /* universidad */
  VIEWS.universidad = {
    title: 'Universidad',
    render: function (root) {
      var row, i, all = uniData && uniData.items ? uniData.items : [], now = new Date().getTime();
      var prox = uniItems('proximas'), late = uniItems('vencidas'), done = uniItems('hechas'), week = 0;
      for (i = 0; i < prox.length; i++) { if (new Date(prox[i].d).getTime() - now < 7 * 864e5) week++; }
      root.appendChild(vHead('Universidad', 'DETALLE', uniLink ? (uniData && uniData.ts ? 'Entregas de Blackboard, actualizadas ' + ago(uniData.ts) : 'Entregas de Blackboard') : 'Conecta tu calendario de Blackboard'));
      if (!uniLink) {
        row = mk('div', 'row');
        var c0 = vCard('s6', 'Conectar Blackboard', null);
        c0.body.appendChild(mk('div', 'hint', 'En Blackboard abre el calendario y copia el enlace iCal de tu cuenta, el mismo que usas en Active Calendar. Pégalo aquí una sola vez.'));
        c0.body.appendChild(uniForm(null)); c0.body.appendChild(uniNote());
        row.appendChild(c0.card); root.appendChild(row);
        return;
      }
      row = mk('div', 'row');
      row.appendChild(vStat('PRÓXIMAS', prox.length, 'entregas pendientes', 'k-blue', all.length ? prox.length * 100 / all.length : 0));
      row.appendChild(vStat('ESTA SEMANA', week, 'vencen en 7 días', week ? 'k-amber' : 'k-green', prox.length ? week * 100 / prox.length : 0));
      row.appendChild(vStat('VENCIDAS', late.length, 'sin marcar como hechas', late.length ? 'k-red' : 'k-green', all.length ? late.length * 100 / all.length : 0));
      row.appendChild(vStat('HECHAS', done.length, 'marcadas aquí', 'k-green', all.length ? done.length * 100 / all.length : 0));
      root.appendChild(row);
      row = mk('div', 'row');
      var c1 = vCard('s8', 'Entregas', null), fb = mk('div', 'seg'), list = uniItems(uniFilter), it, ur, chk, di, tx;
      seg(fb, [['proximas', 'Próximas'], ['vencidas', 'Vencidas'], ['hechas', 'Hechas'], ['todas', 'Todas']], uniFilter, function (v) { uniFilter = v; rerenderView(); });
      c1.body.appendChild(fb); c1.body.appendChild(mk('div', 'gap8'));
      if (uniMsg) c1.body.appendChild(mk('div', 'stat', uniMsg));
      if (!list.length) c1.body.appendChild(mk('div', 'empty', uniData ? 'No hay entregas en esta lista.' : (uniLoading ? 'Leyendo Blackboard...' : 'Todavía no hay datos.')));
      for (i = 0; i < list.length; i++) {
        (function (t) {
          di = dueInfo(t.d);
          ur = mk('div', 'ur clear' + (uniDone[t.id] ? ' done' : '')); chk = mk('button', 'chk'); chk.type = 'button'; chk.innerHTML = CHECK;
          chk.setAttribute('aria-label', uniDone[t.id] ? 'Marcar como pendiente' : 'Marcar como hecha');
          on(chk, 'click', function () { if (uniDone[t.id]) delete uniDone[t.id]; else uniDone[t.id] = true; save('unidone', uniDone); rerenderView(); });
          ur.appendChild(chk); ur.appendChild(mk('div', 'chip ' + di.cls, uniDone[t.id] ? 'HECHA' : di.txt));
          tx = mk('div', 'txt'); tx.appendChild(mk('div', 'nm', t.t)); tx.appendChild(mk('div', 'ft', (t.c ? t.c + ' · ' : '') + fmtDue(new Date(t.d))));
          ur.appendChild(tx); c1.body.appendChild(ur);
        })(list[i]);
      }
      row.appendChild(c1.card);
      var c2 = vCard('s4', 'Enlace de Blackboard', null), bar = mk('div', 'tfoot'), b1 = mk('button', 'btn sm', uniLoading ? 'Actualizando...' : 'Actualizar ahora'), b2 = mk('button', 'btn sm', 'Cambiar enlace'), b3 = mk('button', 'btn sm warn', 'Quitar enlace');
      c2.body.appendChild(mk('div', 'hint', 'Guardado en esta tablet' + (uniHost() ? ' (' + uniHost() + ')' : '') + '. No se pega de nuevo al abrir la página.'));
      b1.type = 'button'; b2.type = 'button'; b3.type = 'button';
      on(b1, 'click', function () { fetchUni(); });
      on(b2, 'click', function () { uniChange = !uniChange; rerenderView(); });
      var armed = false;
      on(b3, 'click', function () { if (!armed) { armed = true; b3.innerHTML = '¿Seguro? Se quita de esta tablet'; return; } removeUniLink(); });
      c2.body.appendChild(mk('div', 'gap8')); c2.body.appendChild(b1); c2.body.appendChild(document.createTextNode(' ')); c2.body.appendChild(b2); c2.body.appendChild(document.createTextNode(' ')); c2.body.appendChild(b3);
      if (uniChange) { c2.body.appendChild(mk('div', 'gap8')); c2.body.appendChild(uniForm(function () { uniChange = false; })); }
      c2.body.appendChild(uniNote());
      row.appendChild(c2.card);
      root.appendChild(row);
    }
  };

  /* trabajo */
  VIEWS.trabajo = {
    title: 'Trabajo',
    render: function (root) {
      var W = window.OS_TRABAJO, row, i, j;
      root.appendChild(vHead('Trabajo', 'DETALLE', W ? 'Lo que llevamos y lo que falta, actualizado ' + ago(W.ts) : 'Lo que llevamos y lo que falta'));
      if (!W) { root.appendChild(mk('div', 'empty', 'Todavía no hay datos de trabajo. Se publican desde el PC cada 30 minutos.')); return; }
      row = mk('div', 'row');
      var c1 = vCard('s4', 'Lo último que hicimos', 'bitácora');
      var bit = W.bitacora || [];
      if (!bit.length) c1.body.appendChild(mk('div', 'empty', 'Sin entradas todavía.'));
      for (i = 0; i < bit.length && i < 20; i++) {
        var li = mk('div', 'tl2'); li.appendChild(mk('div', 'tld', shortDay(bit[i].d))); li.appendChild(mk('div', 'tlt', bit[i].t));
        c1.body.appendChild(li);
      }
      row.appendChild(c1.card);
      var c2 = vCard('s8', 'Lo que falta por proyecto', null), any = false, p, g, hd, it;
      for (i = 0; i < W.proyectos.length; i++) {
        p = W.proyectos[i];
        if (!(p.faltan && p.faltan.length) && !(p.hecho && p.hecho.length)) continue;
        any = true;
        g = mk('div', 'pg'); hd = mk('div', 'pgh clear');
        hd.appendChild(mk('b', null, p.n));
        if (p.e && LAB[p.e]) hd.appendChild(mk('span', 'chip c-' + p.e + ' pg-chip', LAB[p.e]));
        else if (p.e === 'verde') hd.appendChild(mk('span', 'chip c-verde pg-chip', 'AL DÍA'));
        g.appendChild(hd);
        var fl = (p.faltan || []).slice(0).sort(function (a, b) { return SORD[a.s || 'pendiente'] - SORD[b.s || 'pendiente']; });
        for (j = 0; j < fl.length; j++) {
          it = mk('div', 'pgi clear'); it.appendChild(statusChip(fl[j].s || 'pendiente'));
          var tx = mk('div', 'txt'); tx.appendChild(mk('div', 'nm wrapnm', fl[j].t)); if (fl[j].n) tx.appendChild(mk('div', 'ft wrapft', fl[j].n));
          it.appendChild(tx); g.appendChild(it);
        }
        var hc = (p.hecho || []);
        for (j = 0; j < hc.length && j < 3; j++) {
          it = mk('div', 'pgi done clear'); it.appendChild(statusChip('hecho'));
          var tx2 = mk('div', 'txt'); tx2.appendChild(mk('div', 'nm wrapnm', hc[j].t)); tx2.appendChild(mk('div', 'ft', shortDay(hc[j].d)));
          it.appendChild(tx2); g.appendChild(it);
        }
        c2.body.appendChild(g);
      }
      if (!any) c2.body.appendChild(mk('div', 'empty', 'Sin pendientes registrados.'));
      row.appendChild(c2.card);
      root.appendChild(row);
    }
  };

  function rerenderView() {
    if (!curView) return;
    var y = window.pageYOffset || document.documentElement.scrollTop || 0;
    clearNode(viewEl);
    noteArea = $('note-text');
    VIEWS[curView].render(viewEl);
    window.scrollTo(0, y);
  }
  function showMain() {
    flushNote();
    noteArea = $('note-text');
    curView = null;
    viewEl.style.display = 'none'; mainEl.style.display = 'block'; clearNode(viewEl);
    document.title = 'Escritorio';
    renderTasks(); renderCal(); renderDay(); renderNotes(); renderMarks(); renderPomo(); renderProy(); renderWork(); renderUni();
  }
  function showView(name) {
    flushNote();
    mainEl.style.display = 'none'; viewEl.style.display = 'block';
    curView = name; clearNode(viewEl); noteArea = $('note-text');
    VIEWS[name].render(viewEl);
    document.title = VIEWS[name].title + ' · Escritorio';
    window.scrollTo(0, 0);
  }
  function route() {
    var h = (window.location.hash || '').replace(/^#\/?/, ''), name = h.split('/')[0];
    if (name && VIEWS[name] && !editing) showView(name); else showMain();
  }
  on(window, 'hashchange', route);

  /* ---------- pie y respaldo ---------- */
  function renderSys() {
    var ev = 0, k;
    for (k in events) { if (events.hasOwnProperty(k)) ev += events[k].length; }
    var s = $('sys-info');
    s.innerHTML = '';
    s.appendChild(document.createTextNode(tasks.length + ' ' + plural(tasks.length, 'tarea', 'tareas') + ' · ' + notes.length + ' ' + plural(notes.length, 'nota', 'notas') + ' · ' + ev + ' ' + plural(ev, 'evento', 'eventos') + ' · ' + marks.length + ' ' + plural(marks.length, 'marcador', 'marcadores') + '. Guardado solo en esta tablet.'));
  }
  var confirmRestore = null;
  function renderBackups() {
    var box = $('bk-list'), ks = localKeys(), bks = [], i;
    clearNode(box);
    for (i = 0; i < ks.length; i++) { if (/^bak\.\d{4}-\d{2}-\d{2}$/.test(ks[i])) bks.push(ks[i]); }
    bks.sort().reverse();
    if (!bks.length) box.appendChild(mk('div', 'empty', 'Todavía no hay copias automáticas.'));
    for (i = 0; i < bks.length; i++) {
      (function (key) {
        var d = keyToDate(key.slice(4)), row = mk('div', 'bk clear', cap(longDay(d))), b = mk('button', 'btn sm', 'Restaurar');
        b.type = 'button';
        on(b, 'click', function () {
          if (confirmRestore !== key) { confirmRestore = key; b.innerHTML = '¿Seguro? Reemplaza lo actual'; b.className = 'btn sm warn'; return; }
          save('prev', allData());
          applyData(load(key, {}));
        });
        row.appendChild(b); box.appendChild(row);
      })(bks[i]);
    }
  }
  on($('open-backup'), 'click', function () {
    flushNote();
    confirmRestore = null;
    renderBackups();
    $('bk-out').value = JSON.stringify(allData());
    $('bk-in').value = '';
    $('bk-import').innerHTML = 'Importar y reemplazar';
    $('modal').style.display = 'block';
  });
  on($('bk-close'), 'click', function () { $('modal').style.display = 'none'; });
  on($('bk-copy'), 'click', function () {
    var t = $('bk-out');
    t.focus(); t.select();
    var ok = false;
    try { if (window.clipboardData) { window.clipboardData.setData('Text', t.value); ok = true; } else ok = document.execCommand('copy'); } catch (e) { }
    toast(ok ? 'Copiado. Pégalo en un lugar seguro.' : 'Selecciona el texto y cópialo a mano.', null);
  });
  on($('bk-import'), 'click', function () {
    var o;
    try { o = JSON.parse($('bk-in').value); } catch (e) { toast('El texto no es un respaldo válido', null); return; }
    if (!o || typeof o !== 'object' || !hasData(o)) { toast('El texto no es un respaldo válido', null); return; }
    var b = $('bk-import');
    if (confirmRestore !== 'import') { confirmRestore = 'import'; b.innerHTML = '¿Seguro? Reemplaza lo actual'; return; }
    save('prev', allData());
    applyData(o);
  });

  /* ---------- datos que llegan del PC ---------- */
  function refreshFeeds() {
    loadScript('proyectos/resumen.js', function () { renderProy(); if (curView === 'tareas' || curView === 'trabajo') rerenderView(); });
    loadScript('proyectos/trabajo.js', function () { renderWork(); if (curView === 'tareas' || curView === 'trabajo') rerenderView(); });
  }

  /* ---------- arranque ---------- */
  dailyBackup();
  applyTheme();
  applyLayout();
  renderHead();
  route();
  refreshFeeds();
  renderUni(); refreshUni(false);
  setInterval(function () { renderHead(); }, 15000);
  setInterval(pomoTick, 1000);
  setInterval(refreshFeeds, 300000);
  setInterval(function () { refreshUni(false); }, 1800000);
  setInterval(function () { if (!curView) { renderProy(); renderWork(); } }, 60000);
  if (!storeOk) warnStore();
})();
