/* Escritorio para la Surface RT (Internet Explorer 11): solo ES5.
   Sin let/const, flechas, template strings, fetch, Promise ni métodos nuevos de Array/String.
   Los datos del usuario viven en localStorage con el prefijo "rtos.". Nada se borra sin poder deshacerse:
   cada borrado ofrece "Deshacer", hay una copia automática diaria y un respaldo manual. */
(function () {
  'use strict';

  var MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  var DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
  var KEYS = ['tasks', 'notes', 'marks', 'events', 'pomo'];
  var COLORS = ['#4a9eed,#3d73e6', '#55e08a,#1fa15a', '#bf98ff,#7a54e0', '#ffcb62,#e08a1c', '#4fdcec,#1d93b3', '#ff8aa0,#e03a66'];

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
  function stop(e) { if (e.preventDefault) e.preventDefault(); else e.returnValue = false; }
  function keyToDate(k) { var p = k.split('-'); return new Date(parseInt(p[0], 10), parseInt(p[1], 10) - 1, parseInt(p[2], 10)); }
  function longDay(d) { return DIAS[d.getDay()] + ', ' + d.getDate() + ' de ' + MESES[d.getMonth()]; }
  function ago(ms) {
    var m = Math.round((new Date().getTime() - ms) / 60000);
    if (m < 2) return 'hace un momento';
    if (m < 60) return 'hace ' + m + ' min';
    var h = Math.round(m / 60);
    if (m < 1440) return 'hace ' + h + (h === 1 ? ' hora' : ' horas');
    var d = Math.round(m / 1440);
    return 'hace ' + d + (d === 1 ? ' día' : ' días');
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
  if (!marks) {
    marks = [{ id: 'm1', n: 'GitHub', u: 'https://github.com' }, { id: 'm2', n: 'Panel de proyectos', u: 'proyectos/', inner: true }];
    save('marks', marks);
  }
  if (!notes.length) { notes = [{ id: uid(), t: '', u: new Date().getTime() }]; }
  var selNote = notes[0].id;
  var selDay = dkey(new Date());
  var calY = new Date().getFullYear(), calM = new Date().getMonth();
  var editMarks = false;

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

  /* ---------- cabecera ---------- */
  function renderHead() {
    var d = new Date(), h = d.getHours();
    var sal = h < 6 ? 'Buenas noches' : (h < 12 ? 'Buenos días' : (h < 19 ? 'Buenas tardes' : 'Buenas noches'));
    $('hello').innerHTML = sal + ', <b>Oscar</b>';
    $('clock').innerHTML = two(h) + ':' + two(d.getMinutes());
    $('today').innerHTML = cap(DIAS[d.getDay()]) + ', ' + d.getDate() + ' de ' + MESES[d.getMonth()] + ' de ' + d.getFullYear();
    var pend = 0, i;
    for (i = 0; i < tasks.length; i++) { if (!tasks[i].d) pend++; }
    var hoyEv = (events[dkey(d)] || []).length;
    var sub = $('sub');
    clearNode(sub);
    sub.appendChild(mk('span', 'pill', pend + ' ' + plural(pend, 'tarea pendiente', 'tareas pendientes')));
    sub.appendChild(mk('span', 'pill', hoyEv + ' ' + plural(hoyEv, 'evento hoy', 'eventos hoy')));
  }

  /* ---------- proyectos (resumen del panel) ---------- */
  var LAB = { rojo: 'FALLO', ambar: 'PENDIENTE', verde: 'AL DÍA', gris: 'DORMIDO' };
  function renderProy() {
    var R = window.PANEL_RESUMEN, box = $('proy-body'), card = $('proy');
    clearNode(box);
    if (!R) {
      box.appendChild(mk('div', 'empty', 'No hay datos del panel todavía. Abre el panel completo para verlos.'));
      return;
    }
    var worst = R.c.rojo ? 'rojo' : (R.c.ambar ? 'ambar' : 'verde');
    card.className = 'card k-blue w-' + worst;
    var z = mk('div', 'pz clear'), tl = mk('div', 'tiles clear'), al = mk('div', 'alerts');
    var order = ['rojo', 'ambar', 'verde', 'gris'], i, t, items = [];
    for (i = 0; i < order.length; i++) {
      t = mk('div', 'tile t-' + order[i]);
      var inner = mk('div');
      inner.appendChild(mk('b', null, '' + R.c[order[i]]));
      inner.appendChild(mk('span', null, LAB[order[i]]));
      t.appendChild(inner);
      tl.appendChild(t);
    }
    for (i = 0; i < R.items.length; i++) { if (R.items[i].e === 'rojo' || R.items[i].e === 'ambar') items.push(R.items[i]); }
    if (!items.length) {
      al.appendChild(mk('div', 'allok', 'Todo en orden: ningún proyecto con fallo ni trabajo pendiente.'));
    }
    for (i = 0; i < items.length && i < 5; i++) {
      var row = mk('div', 'al clear'), chip = mk('div', 'chip c-' + items[i].e, LAB[items[i].e]), tx = mk('div', 'txt');
      tx.appendChild(mk('div', 'nm', items[i].n));
      tx.appendChild(mk('div', 'ft', items[i].f));
      row.appendChild(chip); row.appendChild(tx);
      al.appendChild(row);
    }
    if (items.length > 5) al.appendChild(mk('div', 'pfoot', '+ ' + (items.length - 5) + ' más en el panel'));
    z.appendChild(tl); z.appendChild(al);
    box.appendChild(z);
    var stale = (new Date().getTime() - R.ts) > 12 * 3600000;
    var f = mk('div', 'pfoot clear' + (stale ? ' stale' : ''), (stale ? 'Datos viejos: el PC no ha actualizado el panel. ' : '') + 'Actualizado ' + ago(R.ts));
    box.appendChild(f);
  }
  function loadResumen() {
    var s = document.createElement('script');
    s.src = 'proyectos/resumen.js?t=' + Math.floor(new Date().getTime() / 300000);
    var done = function () { if (s.parentNode) s.parentNode.removeChild(s); renderProy(); };
    s.onload = done; s.onerror = done;
    document.getElementsByTagName('head')[0].appendChild(s);
  }
  on($('proy'), 'click', function (e) {
    e = e || window.event;
    var t = e.target || e.srcElement;
    if (t && t.tagName === 'A') return;
    window.location.href = 'proyectos/';
  });

  /* ---------- tareas ---------- */
  var CHECK = '<svg class="ic" viewBox="0 0 24 24" style="stroke-width:3.4"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
  function renderTasks() {
    var ul = $('tasks-list'), i, done = 0, list = [];
    clearNode(ul);
    for (i = 0; i < tasks.length; i++) { if (tasks[i].d) done++; }
    for (i = 0; i < tasks.length; i++) { if (!tasks[i].d) list.push(tasks[i]); }
    for (i = 0; i < tasks.length; i++) { if (tasks[i].d) list.push(tasks[i]); }
    if (!list.length) ul.appendChild(mk('li', 'empty', 'Sin tareas. Escribe la primera arriba.'));
    for (i = 0; i < list.length; i++) { ul.appendChild(taskRow(list[i])); }
    var total = tasks.length, pct = total ? Math.round(done * 100 / total) : 0;
    $('t-bar').style.width = pct + '%';
    $('t-count').innerHTML = total ? (done + ' de ' + total + ' hechas · ' + pct + '%') : 'Nada pendiente';
    $('t-ex').innerHTML = (total - done) + ' ' + plural(total - done, 'pendiente', 'pendientes');
    $('t-clear').style.display = done ? '' : 'none';
    renderHead(); renderSys();
  }
  function taskRow(t) {
    var li = mk('li', 'task' + (t.d ? ' done' : '')), chk = mk('button', 'chk'), tx = mk('span', 'tx', t.t), del = mk('button', 'del', '×');
    chk.type = 'button'; del.type = 'button';
    chk.setAttribute('aria-label', t.d ? 'Marcar como pendiente' : 'Marcar como hecha');
    del.setAttribute('aria-label', 'Borrar tarea');
    chk.innerHTML = CHECK;
    on(chk, 'click', function () { t.d = !t.d; save('tasks', tasks); renderTasks(); });
    on(tx, 'click', function () { t.d = !t.d; save('tasks', tasks); renderTasks(); });
    on(del, 'click', function () {
      var snap = JSON.stringify(tasks), i;
      for (i = 0; i < tasks.length; i++) { if (tasks[i].id === t.id) { tasks.splice(i, 1); break; } }
      save('tasks', tasks); renderTasks();
      toast('Tarea eliminada', function () { tasks = JSON.parse(snap); save('tasks', tasks); renderTasks(); });
    });
    li.appendChild(chk); li.appendChild(tx); li.appendChild(del);
    return li;
  }
  on($('t-form'), 'submit', function (e) {
    e = e || window.event; stop(e);
    var v = $('t-in').value.replace(/^\s+|\s+$/g, '');
    if (!v) return;
    tasks.push({ id: uid(), t: v, d: false, c: new Date().getTime() });
    save('tasks', tasks);
    $('t-in').value = '';
    renderTasks();
  });
  on($('t-clear'), 'click', function () {
    var snap = JSON.stringify(tasks), keep = [], i, n = 0;
    for (i = 0; i < tasks.length; i++) { if (tasks[i].d) n++; else keep.push(tasks[i]); }
    if (!n) return;
    tasks = keep; save('tasks', tasks); renderTasks();
    toast(n + ' ' + plural(n, 'tarea hecha quitada', 'tareas hechas quitadas'), function () { tasks = JSON.parse(snap); save('tasks', tasks); renderTasks(); });
  });

  /* ---------- calendario ---------- */
  function renderCal() {
    var t = $('cal'), i, r, c, row, cell, first = new Date(calY, calM, 1), start = (first.getDay() + 6) % 7;
    var days = new Date(calY, calM + 1, 0).getDate(), prevDays = new Date(calY, calM, 0).getDate();
    var todayK = dkey(new Date()), n = 0;
    clearNode(t);
    $('cal-ttl').innerHTML = cap(MESES[calM]) + ' ' + calY;
    var hr = mk('tr'), ds = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
    for (i = 0; i < 7; i++) hr.appendChild(mk('th', null, ds[i]));
    var thead = mk('thead'); thead.appendChild(hr); t.appendChild(thead);
    var tb = mk('tbody');
    for (r = 0; r < 6; r++) {
      row = mk('tr');
      for (c = 0; c < 7; c++) {
        var idx = r * 7 + c - start + 1, d, other = false;
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
            renderCal(); renderDay();
          });
        })(k, d);
        row.appendChild(cell);
        n++;
      }
      tb.appendChild(row);
      if (idx >= days && r >= 3) break;
    }
    t.appendChild(tb);
  }
  function renderDay() {
    var list = $('day-list'), evs = events[selDay] || [], i;
    clearNode(list);
    $('day-ttl').innerHTML = selDay === dkey(new Date()) ? 'Hoy, ' + longDay(keyToDate(selDay)) : cap(longDay(keyToDate(selDay)));
    if (!evs.length) list.appendChild(mk('div', 'empty', 'Sin eventos este día.'));
    for (i = 0; i < evs.length; i++) {
      (function (ev) {
        var row = mk('div', 'ev', ev.t), del = mk('button', 'del', '×');
        del.type = 'button'; del.setAttribute('aria-label', 'Borrar evento');
        on(del, 'click', function () {
          var snap = JSON.stringify(events), j, arr = events[selDay];
          for (j = 0; j < arr.length; j++) { if (arr[j].id === ev.id) { arr.splice(j, 1); break; } }
          if (!arr.length) delete events[selDay];
          save('events', events); renderCal(); renderDay(); renderHead();
          toast('Evento eliminado', function () { events = JSON.parse(snap); save('events', events); renderCal(); renderDay(); renderHead(); });
        });
        row.appendChild(del); list.appendChild(row);
      })(evs[i]);
    }
    renderSys();
  }
  on($('e-form'), 'submit', function (e) {
    e = e || window.event; stop(e);
    var v = $('e-in').value.replace(/^\s+|\s+$/g, '');
    if (!v) return;
    if (!events[selDay]) events[selDay] = [];
    events[selDay].push({ id: uid(), t: v });
    save('events', events);
    $('e-in').value = '';
    renderCal(); renderDay(); renderHead();
  });
  on($('cal-prev'), 'click', function () { calM--; if (calM < 0) { calM = 11; calY--; } renderCal(); });
  on($('cal-next'), 'click', function () { calM++; if (calM > 11) { calM = 0; calY++; } renderCal(); });
  on($('cal-today'), 'click', function () { var d = new Date(); calY = d.getFullYear(); calM = d.getMonth(); selDay = dkey(d); renderCal(); renderDay(); });

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
    on(plus, 'click', function () {
      flushNote();
      var nn = { id: uid(), t: '', u: new Date().getTime() };
      notes.push(nn); selNote = nn.id; save('notes', notes); renderNotes(); $('note-text').focus();
    });
    box.appendChild(plus);
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
    var n = curNote(), v = $('note-text').value;
    if (n.t !== v) { n.t = v; n.u = new Date().getTime(); save('notes', notes); }
  }
  on($('note-text'), 'input', function () {
    if (noteTimer) clearTimeout(noteTimer);
    $('n-info').innerHTML = 'Guardando...';
    noteTimer = setTimeout(function () {
      flushNote();
      $('n-info').innerHTML = 'Guardado ' + ago(curNote().u);
      renderChips();
    }, 500);
  });
  on(window, 'beforeunload', function () { flushNote(); });
  on($('n-del'), 'click', function () {
    flushNote();
    var snap = JSON.stringify(notes), i;
    for (i = 0; i < notes.length; i++) { if (notes[i].id === selNote) { notes.splice(i, 1); break; } }
    if (!notes.length) notes = [{ id: uid(), t: '', u: new Date().getTime() }];
    selNote = notes[0].id;
    save('notes', notes); renderNotes();
    toast('Nota eliminada', function () { notes = JSON.parse(snap); selNote = notes[0].id; save('notes', notes); renderNotes(); });
  });

  /* ---------- marcadores ---------- */
  function normUrl(u) {
    u = u.replace(/^\s+|\s+$/g, '');
    if (!u) return null;
    if (/^https?:\/\//i.test(u)) return u;
    if (/^[a-z][a-z0-9+.\-]*:/i.test(u)) return null;
    return 'https://' + u;
  }
  function renderMarks() {
    var box = $('marks'), i;
    clearNode(box);
    $('m-edit').innerHTML = editMarks ? 'Listo' : 'Editar';
    for (i = 0; i < marks.length; i++) {
      (function (m, idx) {
        var wrap = mk('div', 'mk'), a = mk(editMarks ? 'div' : 'a', editMarks ? 'in' : null);
        var col = COLORS[(m.n.charCodeAt(0) + idx) % COLORS.length].split(',');
        var lt = mk('span', 'lt', m.n.charAt(0).toUpperCase());
        lt.style.backgroundImage = 'linear-gradient(145deg,' + col[0] + ',' + col[1] + ')';
        a.appendChild(lt); a.appendChild(mk('span', 'nm', m.n));
        if (!editMarks) a.setAttribute('href', m.u);
        else {
          var x = mk('button', 'x', '×'); x.type = 'button'; x.setAttribute('aria-label', 'Quitar ' + m.n);
          on(x, 'click', function () {
            var snap = JSON.stringify(marks);
            marks.splice(idx, 1); save('marks', marks); renderMarks();
            toast('Marcador quitado', function () { marks = JSON.parse(snap); save('marks', marks); renderMarks(); });
          });
          a.appendChild(x);
        }
        wrap.appendChild(a); box.appendChild(wrap);
      })(marks[i], i);
    }
    if (!marks.length) box.appendChild(mk('div', 'empty', 'Sin marcadores. Agrega el primero.'));
    renderSys();
  }
  on($('m-add'), 'click', function () {
    var b = $('m-form-box');
    b.style.display = b.style.display === 'none' ? 'block' : 'none';
    if (b.style.display === 'block') $('m-n').focus();
  });
  on($('m-edit'), 'click', function () { editMarks = !editMarks; renderMarks(); });
  on($('m-form'), 'submit', function (e) {
    e = e || window.event; stop(e);
    var n = $('m-n').value.replace(/^\s+|\s+$/g, ''), u = normUrl($('m-u').value);
    if (!n || !u) { toast('Escribe un nombre y una dirección web válida', null); return; }
    marks.push({ id: uid(), n: n, u: u });
    save('marks', marks);
    $('m-n').value = ''; $('m-u').value = ''; $('m-form-box').style.display = 'none';
    renderMarks();
  });

  /* ---------- enfoque (pomodoro) ---------- */
  var MODES = { foco: { t: 25 * 60, l: 'Foco' }, corto: { t: 5 * 60, l: 'Descanso' }, largo: { t: 15 * 60, l: 'Descanso largo' } };
  if (!pomo) pomo = { mode: 'foco', left: MODES.foco.t, end: null, n: {} };
  if (!pomo.n) pomo.n = {};
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
    $('p-state').innerHTML = pomo.end ? MODES[pomo.mode].l : (left === total ? MODES[pomo.mode].l : 'En pausa');
    $('p-arc').setAttribute('stroke-dashoffset', '' + Math.round(465 * (1 - left / total)));
    $('p-go').innerHTML = pomo.end ? 'Pausar' : (left === total ? 'Iniciar' : 'Seguir');
    $('p-go').className = 'btn ' + (pomo.end ? 'warn' : 'ok');
    var today = dkey(new Date()), n = pomo.n[today] || 0;
    $('p-done').innerHTML = n ? (n + ' ' + plural(n, 'sesión de foco hoy', 'sesiones de foco hoy')) : 'Aún sin sesiones hoy';
    renderModes();
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
      setTimeout(function () { f.style.display = 'none'; document.title = 'Escritorio'; }, 20000);
    }
    renderPomo();
  }
  on($('p-go'), 'click', function () {
    if (pomo.end) { pomo.left = Math.max(1, Math.ceil((pomo.end - new Date().getTime()) / 1000)); pomo.end = null; }
    else { pomo.end = new Date().getTime() + pomo.left * 1000; $('p-flash').style.display = 'none'; }
    savePomo(); renderPomo();
  });
  on($('p-reset'), 'click', function () { pomo.left = MODES[pomo.mode].t; pomo.end = null; savePomo(); renderPomo(); });

  /* ---------- sistema y respaldo ---------- */
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

  /* ---------- arranque ---------- */
  dailyBackup();
  renderHead(); renderTasks(); renderCal(); renderDay(); renderNotes(); renderMarks(); renderPomo(); renderProy();
  loadResumen();
  setInterval(function () { renderHead(); }, 15000);
  setInterval(pomoTick, 1000);
  setInterval(loadResumen, 300000);
  setInterval(function () { if (window.PANEL_RESUMEN) renderProy(); }, 60000);
  if (!storeOk) warnStore();
})();
