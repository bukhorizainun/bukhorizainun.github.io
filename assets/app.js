(function () {
  const SW = 1200, SH = 750, GX = 140, GY = 300;
  const CHAPTER_NOTES = {
    1: 'Where I come from, how I work',
    2: 'One thesis, five models from scratch',
    3: 'SukaLoop, SantriLab, TEDI and more',
    4: 'Experience, education, toolbox'
  };
  const $ = s => document.querySelector(s);
  const viewport = $('#viewport'), world = $('#world');
  const slides = [...document.querySelectorAll('.slide')];
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const flowQuery = matchMedia('(max-width: 860px), ((pointer: coarse) and (max-width: 1100px))');
  let flow = flowQuery.matches;

  // ---------- layout ----------
  const rows = [];
  slides.forEach((el, i) => {
    const r = +el.dataset.row;
    (rows[r] = rows[r] || []).push(el);
    el.dataset.i = i;
  });
  const pos = new Map();
  const labels = [];
  rows.forEach((list, r) => {
    const chapter = list[0].dataset.chapter || '';
    const lab = document.createElement('div');
    lab.className = 'row-label';
    lab.innerHTML = `<b>${String(r + 1).padStart(2, '0')}</b>${chapter}`;
    world.insertBefore(lab, list[0]);
    labels.push(lab);
    list.forEach((el, c) => {
      const x = c * (SW + GX), y = r * (SH + GY);
      pos.set(el, { x, y, cx: x + SW / 2, cy: y + SH / 2, r, c });
    });
    lab.dataset.x = 0; lab.dataset.y = r * (SH + GY) - 64;
  });
  const bounds = { w: Math.max(...rows.map(l => l.length)) * (SW + GX) - GX, h: rows.length * (SH + GY) - GY };

  document.querySelectorAll('.orbs i').forEach((o, k) => {
    const f = [[-0.08, -0.15], [0.55, 0.05], [0.12, 0.45], [0.78, 0.55], [0.35, 0.85]][k] || [0.5, 0.5];
    o.style.left = (f[0] * bounds.w - 950) + 'px'; o.style.top = (f[1] * bounds.h - 950) + 'px';
  });
  function applyLayout() {
    slides.forEach(el => {
      const p = pos.get(el);
      el.style.left = flow ? '' : p.x + 'px';
      el.style.top = flow ? '' : p.y + 'px';
    });
    labels.forEach(l => { l.style.left = flow ? '' : l.dataset.x + 'px'; l.style.top = flow ? '' : l.dataset.y + 'px'; });
    document.body.classList.toggle('flow', flow);
  }

  // ---------- camera ----------
  const cam = { x: 0, y: 0, s: 1 }, tgt = { x: 0, y: 0, s: 1 };
  let vw = innerWidth, vh = innerHeight;
  const focusScale = () => Math.min((vw - 160) / SW, (vh - 236) / SH, 1.35);
  const fitScale = () => Math.min((vw - 120) / bounds.w, (vh - 200) / bounds.h);
  const minS = () => fitScale() * 0.7, maxS = 2.4;

  function render() {
    world.style.transform = `translate3d(${(vw / 2 - cam.x * cam.s).toFixed(2)}px, ${(vh / 2 - 6 - cam.y * cam.s).toFixed(2)}px, 0) scale(${cam.s.toFixed(5)})`;
  }
  let lastT = 0;
  function tick(now) {
    const dt = Math.min(64, now - (lastT || now)); lastT = now;
    if (!flow) {
      const a = reduce ? 1 : 1 - Math.pow(1 - 0.14, dt / 16.67);
      const dx = tgt.x - cam.x, dy = tgt.y - cam.y, ds = Math.log(tgt.s) - Math.log(cam.s);
      if (Math.abs(dx) > 0.05 || Math.abs(dy) > 0.05 || Math.abs(ds) > 0.0005) {
        cam.x += dx * a; cam.y += dy * a; cam.s = Math.exp(Math.log(cam.s) + ds * a);
        render(); onCameraMove();
      }
    }
    requestAnimationFrame(tick);
  }

  function screenToWorld(sx, sy) { return { x: cam.x + (sx - vw / 2) / cam.s, y: cam.y + (sy - vh / 2 + 6) / cam.s }; }

  // ---------- current slide ----------
  let current = 0;
  function nearest() {
    let best = 0, bd = Infinity;
    slides.forEach((el, i) => {
      const p = pos.get(el), d = (p.cx - cam.x) ** 2 + ((p.cy - cam.y) * 1.3) ** 2;
      if (d < bd) { bd = d; best = i; }
    });
    return best;
  }
  let moveRaf = 0;
  function onCameraMove() {
    if (moveRaf) return;
    moveRaf = requestAnimationFrame(() => {
      moveRaf = 0;
      setCurrent(nearest());
      updateMinimapView();
      updateVisibility();
    });
  }

  function setCurrent(i, force) {
    if (i === current && !force) return;
    slides[current] && slides[current].classList.remove('current');
    current = i;
    const el = slides[i];
    el.classList.add('current');
    reveal(el);
    $('#counter').textContent = `${String(i + 1).padStart(2, '0')} / ${slides.length}`;
    document.querySelectorAll('.minimap i').forEach((m, k) => m.classList.toggle('on', k === i));
    document.querySelectorAll('#drawerList a').forEach(a => a.classList.toggle('on', a.dataset.go === el.id));
    try { history.replaceState(null, '', i === 0 ? location.pathname : '#' + el.id); } catch (e) {}
  }

  function focusSlide(i, instant) {
    i = Math.max(0, Math.min(slides.length - 1, i));
    const el = slides[i];
    if (flow) {
      el.scrollIntoView({ behavior: instant || reduce ? 'auto' : 'smooth', block: 'start' });
      setCurrent(i);
      return;
    }
    const p = pos.get(el);
    tgt.x = p.cx; tgt.y = p.cy; tgt.s = focusScale();
    if (instant) { Object.assign(cam, tgt); render(); onCameraMove(); }
    setCurrent(i);
  }
  const byId = id => slides.findIndex(s => s.id === id);
  function go(id) { const i = byId(id); if (i >= 0) focusSlide(i); }

  function overview() {
    if (tgt.s < focusScale() * 0.55) { focusSlide(nearest()); return; }
    tgt.x = bounds.w / 2; tgt.y = bounds.h / 2; tgt.s = fitScale();
  }

  // ---------- reveal: marks, counters, videos ----------
  function reveal(el) {
    if (el.classList.contains('seen')) return;
    el.classList.add('seen');
    el.querySelectorAll('[data-count]').forEach(b => {
      const end = parseFloat(b.dataset.count), dec = +(b.dataset.dec || 0);
      if (reduce) return;
      const t0 = performance.now(), dur = 1300;
      const f = now => {
        const u = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - u, 4);
        b.textContent = (end * e).toFixed(dec);
        if (u < 1) requestAnimationFrame(f);
      };
      requestAnimationFrame(f);
    });
  }

  const videos = [...document.querySelectorAll('video[data-src]')];
  function setVideo(v, on) {
    if (on) {
      if (!v.src) v.src = v.dataset.src;
      const p = v.play(); if (p && p.catch) p.catch(() => {});
    } else if (!v.paused) v.pause();
  }
  function updateVisibility() {
    if (flow) return;
    videos.forEach(v => {
      const p = pos.get(v.closest('.slide'));
      const sx = (p.x - cam.x) * cam.s + vw / 2, sy = (p.y - cam.y) * cam.s + vh / 2;
      const on = cam.s > 0.25 && sx < vw && sx + SW * cam.s > 0 && sy < vh && sy + SH * cam.s > 0;
      setVideo(v, on);
    });
  }
  const flowIO = new IntersectionObserver(es => {
    if (!flow) return;
    es.forEach(e => {
      const el = e.target;
      el.querySelectorAll('video[data-src]').forEach(v => setVideo(v, e.isIntersecting));
      if (e.isIntersecting && e.intersectionRatio > 0.45) setCurrent(+el.dataset.i);
    });
  }, { threshold: [0, 0.5] });
  slides.forEach(s => flowIO.observe(s));

  // ---------- minimap ----------
  const mm = $('#minimap');
  let mmK = 1, mmOX = 0, mmOY = 0;
  function buildMinimap() {
    mm.innerHTML = '';
    const W = mm.clientWidth || 190, H = mm.clientHeight || 120;
    mmK = Math.min(W / bounds.w, H / bounds.h);
    mmOX = (W - bounds.w * mmK) / 2; mmOY = (H - bounds.h * mmK) / 2;
    slides.forEach((el, i) => {
      const p = pos.get(el), d = document.createElement('i');
      d.style.cssText = `left:${mmOX + p.x * mmK}px;top:${mmOY + p.y * mmK}px;width:${SW * mmK}px;height:${SH * mmK}px`;
      if (!el.classList.contains('pale')) d.classList.add('dark');
      if (i === current) d.classList.add('on');
      d.title = el.dataset.title;
      d.addEventListener('click', () => { stopTour(); focusSlide(i); });
      mm.appendChild(d);
    });
    const v = document.createElement('div'); v.className = 'view'; mm.appendChild(v);
    mm.style.pointerEvents = 'auto';
    updateMinimapView();
  }
  function updateMinimapView() {
    const v = mm.querySelector('.view'); if (!v) return;
    const w = vw / cam.s, h = vh / cam.s;
    const W = mm.clientWidth, H = mm.clientHeight;
    let l = mmOX + (cam.x - w / 2) * mmK, t = mmOY + (cam.y - h / 2) * mmK, ww = w * mmK, hh = h * mmK;
    const r = Math.min(W, l + ww), b = Math.min(H, t + hh); l = Math.max(0, l); t = Math.max(0, t);
    v.style.cssText = `left:${l}px;top:${t}px;width:${Math.max(0, r - l)}px;height:${Math.max(0, b - t)}px`;
  }

  // ---------- drawer & explore ----------
  const drawer = $('#drawer'), menuBtn = $('#menuBtn');
  const dl = $('#drawerList');
  rows.forEach((list, r) => {
    const ch = document.createElement('li'); ch.className = 'ch';
    ch.textContent = `${String(r + 1).padStart(2, '0')} · ${list[0].dataset.chapter}`;
    dl.appendChild(ch);
    list.forEach(el => {
      const li = document.createElement('li');
      li.innerHTML = `<a href="#${el.id}" data-go="${el.id}">${el.dataset.title}</a>`;
      dl.appendChild(li);
    });
  });
  function toggleDrawer(open) {
    open = open ?? drawer.hidden;
    drawer.hidden = !open; menuBtn.setAttribute('aria-expanded', open);
  }
  menuBtn.addEventListener('click', () => toggleDrawer());

  const eg = $('#exploreGrid');
  rows.forEach((list, r) => {
    if (r === 0) return;
    eg.insertAdjacentHTML('beforeend', `<a href="#${list[0].id}" data-go="${list[0].id}"><span class="n">${String(r + 1).padStart(2, '0')} · ${list.length} slides</span><span class="t">${list[0].dataset.chapter}</span><span class="c">${CHAPTER_NOTES[r] || ''}</span></a>`);
  });
  eg.insertAdjacentHTML('beforeend', `<a href="#contact" data-go="contact"><span class="n">05 · contact</span><span class="t">Reach out</span><span class="c">Email and GitHub</span></a>`);

  // ---------- tools ----------
  let tool = 'select';
  const toolbar = document.querySelector('.toolbar');
  function setTool(t) {
    tool = t;
    toolbar.querySelectorAll('[data-tool]').forEach(b => b.classList.toggle('on', b.dataset.tool === t));
    viewport.classList.toggle('tool-ink', t === 'ink');
    viewport.classList.toggle('tool-note', t === 'note');
  }
  toolbar.addEventListener('click', e => {
    const b = e.target.closest('[data-tool]'); if (!b) return;
    const t = b.dataset.tool;
    if (t === 'search') return openPalette();
    if (t === 'overview') { stopTour(); return overview(); }
    if (t === 'clear') return clearMarks();
    setTool(tool === t && t !== 'select' ? 'select' : t);
  });

  // storage
  const KEY = 'bz-canvas-v1';
  let store = { ink: [], notes: [] };
  try { const s = JSON.parse(localStorage.getItem(KEY)); if (s && s.ink && s.notes) store = s; } catch (e) {}
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(store)); } catch (e) {}
    toolbar.querySelector('[data-tool="clear"]').classList.toggle('hide', !store.ink.length && !store.notes.length);
  }

  // ink
  const ink = $('#ink');
  const pathD = pts => pts.length ? 'M' + pts.map(p => p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join('L') : '';
  function drawInk() {
    ink.innerHTML = store.ink.map(s => `<path d="${pathD(s)}"/>`).join('');
  }

  // notes
  const notesEl = $('#notes');
  const NOTE_COLORS = ['', 'c1', 'c2', 'c3'];
  const noteEls = new WeakMap();
  function renderNotes() {
    notesEl.innerHTML = '';
    store.notes.forEach(n => {
      const d = document.createElement('div');
      d.className = 'note ' + (NOTE_COLORS[n.c] || '');
      d.style.cssText = `left:${n.x}px;top:${n.y}px;transform:rotate(${n.r}deg);--r:${n.r}deg`;
      d.innerHTML = `<div class="grip" title="Drag"></div><button class="x" aria-label="Delete note">×</button><textarea aria-label="Note" placeholder="Write something…"></textarea>`;
      const ta = d.querySelector('textarea');
      ta.value = n.text || '';
      ta.addEventListener('input', () => { n.text = ta.value; save(); });
      d.querySelector('.x').addEventListener('click', () => { store.notes = store.notes.filter(m => m !== n); save(); renderNotes(); });
      const grip = d.querySelector('.grip');
      grip.addEventListener('pointerdown', e => {
        e.stopPropagation(); grip.setPointerCapture(e.pointerId);
        const sx = e.clientX, sy = e.clientY, ox = n.x, oy = n.y;
        const mv = ev => { n.x = ox + (ev.clientX - sx) / cam.s; n.y = oy + (ev.clientY - sy) / cam.s; d.style.left = n.x + 'px'; d.style.top = n.y + 'px'; };
        const up = () => { grip.removeEventListener('pointermove', mv); grip.removeEventListener('pointerup', up); save(); };
        grip.addEventListener('pointermove', mv); grip.addEventListener('pointerup', up);
      });
      noteEls.set(n, d);
      notesEl.appendChild(d);
    });
  }
  function addNote(wx, wy) {
    const n = { x: wx - 115, y: wy - 20, text: '', c: store.notes.length % 4, r: +(Math.random() * 6 - 3).toFixed(1) };
    store.notes.push(n); save(); renderNotes();
    const d = noteEls.get(n); if (d) d.querySelector('textarea').focus({ preventScroll: true });
    setTool('select');
  }
  function clearMarks() {
    if (!confirm('Remove your highlights and sticky notes from this browser?')) return;
    store = { ink: [], notes: [] }; save(); drawInk(); renderNotes();
  }

  // ---------- pointer: pan, pinch, ink, note ----------
  const ptrs = new Map();
  let drag = null, pinch = null, stroke = null, suppressClick = false, vel = { x: 0, y: 0 }, lastMove = 0;
  const interactive = t => t.closest('textarea, input, .note, .palette, .drawer');

  viewport.addEventListener('pointerdown', e => {
    if (flow || interactive(e.target) || e.button > 0) return;
    ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
    suppressClick = false;
    if (ptrs.size === 2) {
      const [a, b] = [...ptrs.values()];
      pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), s: tgt.s };
      drag = null; return;
    }
    if (tool === 'ink') {
      const w = screenToWorld(e.clientX, e.clientY);
      stroke = [[w.x, w.y]]; store.ink.push(stroke);
      viewport.setPointerCapture(e.pointerId); e.preventDefault();
      return;
    }
    if (tool === 'note') return;
    drag = { sx: e.clientX, sy: e.clientY, cx: tgt.x, cy: tgt.y, moved: false, id: e.pointerId };
    vel = { x: 0, y: 0 }; lastMove = performance.now();
  });

  viewport.addEventListener('pointermove', e => {
    if (flow) return;
    if (ptrs.has(e.pointerId)) ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pinch && ptrs.size === 2) {
      const [a, b] = [...ptrs.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      zoomAt((a.x + b.x) / 2, (a.y + b.y) / 2, pinch.s * d / pinch.d / tgt.s, true);
      suppressClick = true; return;
    }
    if (stroke) {
      const w = screenToWorld(e.clientX, e.clientY), l = stroke[stroke.length - 1];
      if (Math.hypot(w.x - l[0], w.y - l[1]) > 3 / cam.s) { stroke.push([w.x, w.y]); drawInk(); }
      return;
    }
    if (!drag) return;
    const dx = e.clientX - drag.sx, dy = e.clientY - drag.sy;
    if (!drag.moved && Math.hypot(dx, dy) < 5) return;
    if (!drag.moved) { drag.moved = true; stopTour(); viewport.classList.add('panning'); try { viewport.setPointerCapture(drag.id); } catch (er) {} }
    const now = performance.now(), nx = drag.cx - dx / cam.s, ny = drag.cy - dy / cam.s;
    const dtm = Math.max(1, now - lastMove);
    vel = { x: (nx - tgt.x) / dtm, y: (ny - tgt.y) / dtm }; lastMove = now;
    tgt.x = cam.x = nx; tgt.y = cam.y = ny; render(); onCameraMove();
  });

  function endPointer(e) {
    ptrs.delete(e.pointerId);
    if (ptrs.size < 2) pinch = null;
    if (stroke) { if (stroke.length < 2) store.ink.pop(); stroke = null; save(); drawInk(); return; }
    if (drag && drag.moved) {
      suppressClick = true;
      if (performance.now() - lastMove < 80 && !reduce) { tgt.x += vel.x * 160; tgt.y += vel.y * 160; }
    }
    drag = null; viewport.classList.remove('panning');
  }
  viewport.addEventListener('pointerup', endPointer);
  viewport.addEventListener('pointercancel', endPointer);

  viewport.addEventListener('click', e => {
    if (flow) return;
    if (suppressClick) { e.preventDefault(); e.stopPropagation(); suppressClick = false; return; }
    if (tool === 'note' && !interactive(e.target)) {
      const w = screenToWorld(e.clientX, e.clientY); addNote(w.x, w.y);
      e.preventDefault(); e.stopPropagation(); return;
    }
    const sl = e.target.closest('.slide');
    if (sl && cam.s < focusScale() * 0.7) { e.preventDefault(); e.stopPropagation(); stopTour(); focusSlide(+sl.dataset.i); }
  }, true);

  function zoomAt(sx, sy, factor, direct) {
    const ns = Math.min(maxS, Math.max(minS(), tgt.s * factor));
    const before = { x: tgt.x + (sx - vw / 2) / tgt.s, y: tgt.y + (sy - vh / 2 + 6) / tgt.s };
    tgt.s = ns;
    tgt.x = before.x - (sx - vw / 2) / ns; tgt.y = before.y - (sy - vh / 2 + 6) / ns;
    if (direct) { Object.assign(cam, tgt); render(); onCameraMove(); }
  }

  viewport.addEventListener('wheel', e => {
    if (flow || e.target.closest('.drawer, .palette')) return;
    e.preventDefault(); stopTour();
    const m = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? vh : 1;
    if (e.ctrlKey || e.metaKey) {
      zoomAt(e.clientX, e.clientY, Math.exp(-e.deltaY * m * 0.0024), true);
    } else {
      let dx = e.deltaX * m, dy = e.deltaY * m;
      if (e.shiftKey && !dx) { dx = dy; dy = 0; }
      tgt.x = cam.x = cam.x + dx / cam.s; tgt.y = cam.y = cam.y + dy / cam.s;
      tgt.s = cam.s; render(); onCameraMove();
    }
  }, { passive: false });

  // in-page links
  document.addEventListener('click', e => {
    const a = e.target.closest('[data-go]'); if (!a) return;
    e.preventDefault(); stopTour(); toggleDrawer(false); go(a.dataset.go);
  });

  // ---------- keyboard ----------
  function move(dir) {
    const el = slides[current], p = pos.get(el);
    if (dir === 'next') return focusSlide(current + 1);
    if (dir === 'prev') return focusSlide(current - 1);
    const r = p.r + (dir === 'down' ? 1 : -1);
    if (!rows[r]) return;
    const t = rows[r][Math.min(p.c, rows[r].length - 1)];
    focusSlide(+t.dataset.i);
  }
  $('#prevBtn').addEventListener('click', () => { stopTour(); move('prev'); });
  $('#nextBtn').addEventListener('click', () => { stopTour(); move('next'); });

  document.addEventListener('keydown', e => {
    const typing = e.target.closest('input, textarea');
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); return openPalette(); }
    if (e.key === 'Escape') {
      if (!palette.hidden) return closePalette();
      if (!drawer.hidden) return toggleDrawer(false);
      if (touring) return stopTour();
      if (tool !== 'select') return setTool('select');
      return;
    }
    if (typing || !palette.hidden) return;
    const k = e.key;
    const map = { ArrowRight: 'next', ArrowLeft: 'prev', ArrowDown: 'down', ArrowUp: 'up', PageDown: 'next', PageUp: 'prev', ' ': 'next' };
    if (map[k] && !flow) { e.preventDefault(); stopTour(); move(e.shiftKey && k === ' ' ? 'prev' : map[k]); return; }
    if (flow) return;
    if (k === 'Home') { stopTour(); focusSlide(0); }
    else if (k === 'End') { stopTour(); focusSlide(slides.length - 1); }
    else if (k === 'o' || k === 'O') { stopTour(); overview(); }
    else if (k === 'v' || k === 'V') setTool('select');
    else if (k === 'h' || k === 'H') setTool('ink');
    else if (k === 'n' || k === 'N') setTool('note');
    else if (k === '/') { e.preventDefault(); openPalette(); }
    else if (k === '+' || k === '=') zoomAt(vw / 2, vh / 2, 1.2);
    else if (k === '-') zoomAt(vw / 2, vh / 2, 1 / 1.2);
  });

  // ---------- search palette ----------
  const palette = $('#palette'), pin = $('#paletteInput'), plist = $('#paletteList');
  const index = slides.map((el, i) => ({ i, title: el.dataset.title, chapter: rows[+el.dataset.row][0].dataset.chapter, text: (el.dataset.title + ' ' + el.textContent).toLowerCase().replace(/\s+/g, ' ') }));
  let hits = [], sel = 0;
  function renderPalette() {
    const q = pin.value.trim().toLowerCase().split(/\s+/).filter(Boolean);
    hits = index.filter(it => q.every(w => it.text.includes(w))).slice(0, 14);
    sel = Math.min(sel, Math.max(0, hits.length - 1));
    plist.innerHTML = hits.length ? hits.map((h, k) => `<li role="option" data-k="${k}" class="${k === sel ? 'on' : ''}">${h.title}<span>${h.chapter}</span></li>`).join('') : '<li>No slide matches that.</li>';
  }
  function openPalette() { stopTour(); palette.hidden = false; pin.value = ''; sel = 0; renderPalette(); pin.focus(); }
  function closePalette() { palette.hidden = true; }
  function choose(k) { const h = hits[k]; if (!h) return; closePalette(); focusSlide(h.i); }
  pin.addEventListener('input', () => { sel = 0; renderPalette(); });
  pin.addEventListener('keydown', e => {
    if (e.key === 'ArrowDown') { e.preventDefault(); sel = Math.min(hits.length - 1, sel + 1); renderPalette(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); sel = Math.max(0, sel - 1); renderPalette(); }
    else if (e.key === 'Enter') { e.preventDefault(); choose(sel); }
  });
  plist.addEventListener('click', e => { const li = e.target.closest('li[data-k]'); if (li) choose(+li.dataset.k); });
  palette.addEventListener('click', e => { if (e.target === palette) closePalette(); });

  // ---------- narrated tour ----------
  const tourBtn = $('#tourBtn'), caption = $('#caption');
  const synth = window.speechSynthesis;
  let touring = false, tourTimer = 0, voice = null, tourStep = 0;
  function pickVoice() {
    if (!synth) return null;
    const vs = synth.getVoices();
    const pref = [/en-GB.*(Natural|Online)/i, /en-US.*(Natural|Online)/i, /Google UK English/i, /en-GB/i, /en-US/i, /^en/i];
    for (const re of pref) { const v = vs.find(v => re.test(v.lang + ' ' + v.name) || re.test(v.name)); if (v) return v; }
    return vs[0] || null;
  }
  if (synth) synth.onvoiceschanged = () => { voice = pickVoice(); };
  function say(i) {
    if (!touring) return;
    if (i >= slides.length) return stopTour(true);
    const my = ++tourStep;
    focusSlide(i);
    const text = slides[i].dataset.say || slides[i].dataset.title;
    caption.textContent = text; caption.classList.add('show');
    const next = () => { if (touring && my === tourStep) tourTimer = setTimeout(() => say(i + 1), 650); };
    if (synth && window.SpeechSynthesisUtterance) {
      synth.cancel();
      const u = new SpeechSynthesisUtterance(text);
      voice = voice || pickVoice(); if (voice) { u.voice = voice; u.lang = voice.lang; } else u.lang = 'en-GB';
      u.rate = 1; u.pitch = 1;
      u.onend = next; u.onerror = () => { tourTimer = setTimeout(() => say(i + 1), 2500); };
      setTimeout(() => { if (touring && my === tourStep) synth.speak(u); }, 450);
    } else {
      tourTimer = setTimeout(next, 900 + text.split(' ').length * 380);
    }
  }
  function startTour() {
    touring = true; tourBtn.setAttribute('aria-pressed', 'true'); tourBtn.querySelector('span').textContent = 'Pause tour';
    say(current);
  }
  function stopTour(done) {
    if (!touring) return;
    touring = false; tourStep++; clearTimeout(tourTimer);
    if (synth) synth.cancel();
    caption.classList.remove('show');
    tourBtn.setAttribute('aria-pressed', 'false');
    tourBtn.querySelector('span').textContent = done ? 'Replay tour' : 'Narrated tour';
  }
  tourBtn.addEventListener('click', () => touring ? stopTour() : startTour());

  // ---------- resize / mode ----------
  let plumes = [];
  function onResize() {
    vw = innerWidth; vh = innerHeight;
    const was = flow; flow = flowQuery.matches;
    if (was !== flow) { applyLayout(); window.ArtRepaint && window.ArtRepaint(); }
    if (!flow) {
      if (tgt.s >= focusScale() * 0.55 || was !== flow) focusSlide(current, true);
      buildMinimap();
    }
    plumes.forEach(p => p && p.resize());
  }
  addEventListener('resize', onResize);
  addEventListener('hashchange', () => { const i = byId(decodeURIComponent(location.hash.slice(1))); if (i >= 0 && i !== current) { stopTour(); focusSlide(i); } });
  flowQuery.addEventListener && flowQuery.addEventListener('change', onResize);

  // the browser scrolls hidden-overflow containers to #anchors; the camera owns position
  const unscroll = () => { if (flow) return; if (viewport.scrollTop || viewport.scrollLeft) { viewport.scrollTop = 0; viewport.scrollLeft = 0; } if (scrollX || scrollY) scrollTo(0, 0); };
  viewport.addEventListener('scroll', unscroll);
  addEventListener('scroll', unscroll);

  // ---------- boot ----------
  applyLayout();
  drawInk(); renderNotes(); save();
  buildMinimap();
  const start = Math.max(0, byId(decodeURIComponent(location.hash.slice(1))));
  if (flow) {
    setCurrent(start, true);
    if (start) setTimeout(() => focusSlide(start, true), 60);
  } else {
    const p = pos.get(slides[start]);
    tgt.x = cam.x = p.cx; tgt.y = cam.y = p.cy; tgt.s = focusScale();
    cam.s = reduce ? tgt.s : tgt.s * 0.82;
    render(); setCurrent(start, true); updateVisibility(); unscroll(); setTimeout(unscroll, 50);
  }
  requestAnimationFrame(tick);
  requestAnimationFrame(() => document.body.classList.add('ready'));
  const clock = document.getElementById('simClock'), t0 = performance.now();
  if (clock && !reduce) setInterval(() => { clock.textContent = `t = ${((performance.now() - t0) / 1000 % 100).toFixed(2).padStart(5, '0')} s`; }, 90);
  if (window.Plume) {
    plumes.push(Plume($('#plume'), { mode: 'name' }));
    plumes.push(Plume($('#plume2'), { mode: 'ambient' }));
  }
})();
