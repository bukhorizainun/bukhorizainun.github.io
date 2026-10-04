/* Buoyant-jet particle field.
   A warm jet enters from the left wall, buoyancy bends it upward, and
   (in "name" mode) the particles settle into the owner's name. */
(function () {
  const PALETTE = ['#2a1b6e', '#3b22a0', '#5530c0', '#7a3bd0', '#a03fc0', '#c443a6', '#e0508e', '#f06a7a', '#fb8f7e', '#ffbf94'];
  const NB = PALETTE.length;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  function noise(x, y, t) {
    return Math.sin(x * 1.7 + t * 0.6) + Math.sin(y * 2.3 - t * 0.45) + Math.sin((x + y) * 1.1 + t * 0.9) * 0.8;
  }

  function Plume(canvas, opts) {
    const mode = opts.mode || 'name';
    const ctx = canvas.getContext('2d');
    let W = 0, H = 0, dpr = 1, k = 1, lastW = 0, lastH = 0;
    let parts = [], targets = [], nText = 0;
    let phase = 'plume', phaseT = 0, t = 0, running = false, visible = false, raf = 0, last = 0;
    const mouse = { x: -1e4, y: -1e4 };

    function size() {
      const w = canvas.clientWidth || 1200, h = canvas.clientHeight || 750;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = lastW = w; H = lastH = h; k = Math.min(W / 1200, H / 750) || 1;
      canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = mode === 'name' ? '#07060c' : '#110f1a'; ctx.fillRect(0, 0, W, H);
    }

    function nozzleY() { return H * (W < H ? 0.8 : 0.7); }

    function spawn(p, fresh) {
      p.x = -4 - Math.random() * (fresh ? 40 : 4);
      p.y = nozzleY() + (Math.random() - 0.5) * 16 * k;
      p.vx = (5.2 + Math.random() * 2.6) * Math.max(k, 0.55);
      p.vy = (Math.random() - 0.5) * 0.5;
      p.age = fresh ? -Math.random() * 90 : 0;
      p.life = 150 + Math.random() * 170;
      p.free = true;
    }

    async function buildTargets() {
      targets = [];
      if (mode !== 'name') return;
      const off = document.createElement('canvas');
      off.width = Math.round(W); off.height = Math.round(H);
      const o = off.getContext('2d');
      const portrait = W < H * 1.05;
      const fs = portrait ? Math.min(W * 0.27, H * 0.17) : Math.min(W * 0.15, H * 0.26);
      const font = `700 ${fs}px "Bricolage Grotesque", sans-serif`;
      try { await Promise.race([document.fonts.load(font), new Promise(r => setTimeout(r, 1500))]); } catch (e) {}
      o.font = font;
      const widest = Math.max(...(portrait ? ['Bukhori', 'Zainun'] : ['Bukhori Zainun']).map(t => o.measureText(t).width));
      if (widest > W * 0.84) {
        const f2 = fs * W * 0.84 / widest;
        o.font = font.replace(`${fs}px`, `${f2}px`);
      }
      o.fillStyle = '#fff'; o.textAlign = 'center'; o.textBaseline = 'middle';
      if (portrait) {
        o.fillText('Bukhori', W / 2, H * 0.36);
        o.fillText('Zainun', W / 2, H * 0.36 + fs * 0.92);
      } else {
        o.fillText('Bukhori Zainun', W / 2, H * 0.45);
      }
      const img = o.getImageData(0, 0, off.width, off.height).data;
      const step = Math.max(2, Math.round(3 * k));
      for (let y = 0; y < off.height; y += step) {
        for (let x = 0; x < off.width; x += step) {
          if (img[(y * off.width + x) * 4 + 3] > 140) targets.push([x + (Math.random() - .5) * step * .6, y + (Math.random() - .5) * step * .6]);
        }
      }
      for (let i = targets.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [targets[i], targets[j]] = [targets[j], targets[i]]; }
      const cap = Math.round(4200 * Math.max(k, 0.45));
      if (targets.length > cap) targets.length = cap;
    }

    function init() {
      size();
      return buildTargets().then(() => {
        nText = targets.length;
        const nFree = Math.round((mode === 'name' ? 700 : 1100) * Math.max(k, 0.5));
        parts = [];
        for (let i = 0; i < nText + nFree; i++) {
          const p = { tx: 0, ty: 0, hasT: i < nText, c: 0 };
          if (p.hasT) {
            p.tx = targets[i][0]; p.ty = targets[i][1];
            const u = p.tx / W;
            p.c = Math.min(NB - 1, Math.max(3, Math.round(2 + u * (NB - 1))));
          }
          spawn(p, true);
          parts.push(p);
        }
        phase = 'plume'; phaseT = 0;
        if (reduce) { settle(); draw(); }
      });
    }

    function settle() {
      for (const p of parts) if (p.hasT) { p.x = p.tx; p.y = p.ty; p.vx = p.vy = 0; p.free = false; }
      phase = 'form';
    }

    function release() {
      if (mode !== 'name') return;
      for (const p of parts) if (p.hasT) {
        p.free = true; p.age = 0; p.life = 140 + Math.random() * 140;
        p.vx += (Math.random() - 0.5) * 3; p.vy -= Math.random() * 3;
      }
      phase = 'plume'; phaseT = 0;
    }

    function step(dt) {
      t += dt * 0.016; phaseT += dt;
      if (mode === 'name' && phase === 'plume' && phaseT > 2100) {
        phase = 'form';
        for (const p of parts) if (p.hasT) p.free = false;
      }
      const g = 0.075 * Math.max(k, 0.6), s = dt / 16.67, R = 110 * k, R2 = R * R;
      for (const p of parts) {
        if (p.free) {
          p.age += s;
          if (p.age < 0) continue;
          const T = 1 - p.age / p.life;
          p.vy -= g * (0.35 + T) * s;
          p.vx *= Math.pow(0.986, s); p.vy *= Math.pow(0.992, s);
          const sx = p.x / (W || 1) * 6, sy = p.y / (H || 1) * 6;
          const a = noise(sx, sy, t) * 1.4;
          const turb = Math.min(1, p.age / 40) * 0.32 * Math.max(k, 0.6);
          p.vx += Math.cos(a) * turb * s; p.vy += Math.sin(a) * turb * s;
          p.x += p.vx * s; p.y += p.vy * s;
          if (p.age > p.life || p.y < -30 || p.x > W + 30 || p.x < -60) spawn(p, false);
        } else {
          const dx = p.tx - p.x, dy = p.ty - p.y;
          p.vx = (p.vx + dx * 0.022 * s) * Math.pow(0.85, s);
          p.vy = (p.vy + dy * 0.022 * s) * Math.pow(0.85, s);
          const mx = p.x - mouse.x, my = p.y - mouse.y, d2 = mx * mx + my * my;
          if (d2 < R2) { const f = (1 - d2 / R2) * 2.6; const d = Math.sqrt(d2) || 1; p.vx += mx / d * f; p.vy += my / d * f; }
          p.x += p.vx * s + Math.sin(t * 2 + p.ty * 0.05) * 0.06;
          p.y += p.vy * s + Math.cos(t * 2 + p.tx * 0.05) * 0.06;
        }
      }
    }

    const buckets = Array.from({ length: NB }, () => []);
    function draw() {
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = mode === 'name' ? 'rgba(7,6,12,0.24)' : 'rgba(17,15,26,0.2)';
      ctx.fillRect(0, 0, W, H);
      for (const b of buckets) b.length = 0;
      for (const p of parts) {
        if (p.free && p.age < 0) continue;
        let c;
        if (p.free) { const T = Math.max(0, 1 - p.age / p.life); c = Math.min(NB - 1, Math.round(T * (NB - 1))); }
        else c = p.c;
        buckets[c].push(p);
      }
      ctx.globalCompositeOperation = 'lighter';
      const sz = Math.max(1.3, 1.7 * k);
      for (let i = 0; i < NB; i++) {
        const b = buckets[i]; if (!b.length) continue;
        ctx.fillStyle = PALETTE[i]; ctx.globalAlpha = i < 2 ? 0.6 : 0.9;
        ctx.beginPath();
        for (const p of b) ctx.rect(p.x, p.y, sz, sz);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }

    function loop(now) {
      if (!running) return;
      const dt = Math.min(48, now - (last || now)); last = now;
      step(dt); draw();
      raf = requestAnimationFrame(loop);
    }
    function start() { if (running || reduce || !visible || document.hidden) return; running = true; last = 0; raf = requestAnimationFrame(loop); }
    function stop() { running = false; cancelAnimationFrame(raf); }

    canvas.addEventListener('pointermove', e => {
      const r = canvas.getBoundingClientRect();
      mouse.x = (e.clientX - r.left) * W / r.width; mouse.y = (e.clientY - r.top) * H / r.height;
    });
    canvas.addEventListener('pointerleave', () => { mouse.x = mouse.y = -1e4; });
    canvas.addEventListener('click', () => { if (phase === 'form') release(); });

    new IntersectionObserver(es => { visible = es[0].isIntersecting; visible ? start() : stop(); }, { threshold: 0.05 }).observe(canvas);
    document.addEventListener('visibilitychange', () => document.hidden ? stop() : start());

    const ready = init();
    ready.then(start);
    return {
      resize() {
        const w = canvas.clientWidth, h = canvas.clientHeight;
        if (Math.abs(w - lastW) < 2 && Math.abs(h - lastH) < 2) return;
        lastW = w; lastH = h; stop(); init().then(start);
      },
      release
    };
  }
  window.Plume = Plume;
})();
