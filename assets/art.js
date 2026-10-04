/* Generative covers in one palette: flow field, contour rings, dot field, ridge lines.
   Each canvas is drawn once, when it first comes near the viewport. */
(function () {
  const STOPS = ['#2a1b6e', '#4b2aa8', '#7a3bd0', '#a93fbf', '#d2479c', '#ee5f80', '#fb8a7c', '#ffb98f'];
  const hex = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  const RGB = STOPS.map(hex);
  function col(u, a = 1) {
    u = Math.min(1, Math.max(0, u)) * (RGB.length - 1);
    const i = Math.min(RGB.length - 2, Math.floor(u)), f = u - i, A = RGB[i], B = RGB[i + 1];
    return `rgba(${A[0] + (B[0] - A[0]) * f | 0},${A[1] + (B[1] - A[1]) * f | 0},${A[2] + (B[2] - A[2]) * f | 0},${a})`;
  }
  function rng(seed) { let s = seed >>> 0 || 1; return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296; }
  function noise2(seed) {
    const r = rng(seed), P = new Uint8Array(512), G = [];
    for (let i = 0; i < 256; i++) { P[i] = i; const a = r() * Math.PI * 2; G.push([Math.cos(a), Math.sin(a)]); }
    for (let i = 255; i > 0; i--) { const j = (r() * (i + 1)) | 0; [P[i], P[j]] = [P[j], P[i]]; }
    for (let i = 0; i < 256; i++) P[i + 256] = P[i];
    const fade = t => t * t * t * (t * (t * 6 - 15) + 10);
    const dot = (h, x, y) => { const g = G[h & 255]; return g[0] * x + g[1] * y; };
    return (x, y) => {
      const X = Math.floor(x) & 255, Y = Math.floor(y) & 255, xf = x - Math.floor(x), yf = y - Math.floor(y);
      const u = fade(xf), v = fade(yf);
      const a = dot(P[P[X] + Y], xf, yf), b = dot(P[P[X + 1] + Y], xf - 1, yf);
      const c = dot(P[P[X] + Y + 1], xf, yf - 1), d = dot(P[P[X + 1] + Y + 1], xf - 1, yf - 1);
      return (a + (b - a) * u) + ((c + (d - c) * u) - (a + (b - a) * u)) * v;
    };
  }

  const painters = {
    flow(ctx, W, H, seed) {
      const n = noise2(seed), r = rng(seed + 7);
      ctx.lineWidth = 1.1;
      for (let k = 0; k < 1400; k++) {
        let x = r() * W, y = r() * H;
        ctx.strokeStyle = col(0.15 + 0.85 * (x / W) * 0.6 + 0.4 * (1 - y / H) * 0.6, 0.55);
        ctx.beginPath(); ctx.moveTo(x, y);
        for (let s = 0; s < 60; s++) {
          const a = n(x * 0.0022, y * 0.0022) * Math.PI * 2.4;
          x += Math.cos(a) * 3.2; y += Math.sin(a) * 3.2;
          ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
    },
    rings(ctx, W, H, seed) {
      const n = noise2(seed), r = rng(seed + 3);
      const centers = [[W * (0.3 + r() * 0.2), H * (0.35 + r() * 0.3)], [W * (0.7 + r() * 0.15), H * (0.55 + r() * 0.25)]];
      ctx.lineWidth = 1.3;
      centers.forEach(([cx, cy], ci) => {
        for (let k = 1; k < 46; k++) {
          const R = k * 14;
          ctx.strokeStyle = col((k / 46) * 0.9 + ci * 0.08, 0.75 - k / 90);
          ctx.beginPath();
          for (let t = 0; t <= 200; t++) {
            const th = t / 200 * Math.PI * 2;
            const rr = R * (1 + 0.28 * n(Math.cos(th) * 1.3 + ci * 9, Math.sin(th) * 1.3 + k * 0.045));
            const x = cx + Math.cos(th) * rr, y = cy + Math.sin(th) * rr;
            t ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
          }
          ctx.stroke();
        }
      });
    },
    dots(ctx, W, H, seed) {
      const n = noise2(seed), step = 18;
      for (let y = step / 2; y < H; y += step) for (let x = step / 2; x < W; x += step) {
        const v = (n(x * 0.004, y * 0.004) + n(x * 0.011 + 40, y * 0.011) * 0.4 + 0.7) / 1.4;
        const rad = Math.max(0, v) * step * 0.48;
        if (rad < 0.6) continue;
        ctx.fillStyle = col(v * 0.85 + (x / W) * 0.2, 0.9);
        ctx.beginPath(); ctx.arc(x, y, rad, 0, Math.PI * 2); ctx.fill();
      }
    },
    waves(ctx, W, H, seed) {
      const n = noise2(seed), rows = 46;
      for (let i = 0; i < rows; i++) {
        const y0 = H * 0.12 + i * (H * 0.82 / rows);
        ctx.beginPath();
        for (let x = 0; x <= W; x += 6) {
          const env = Math.exp(-Math.pow((x - W * 0.55) / (W * 0.24), 2));
          const y = y0 - Math.max(0, n(x * 0.006, i * 0.22) + 0.25) * 70 * env - env * 18;
          x ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
        }
        ctx.lineTo(W, H); ctx.lineTo(0, H); ctx.closePath();
        ctx.fillStyle = '#0d0b14'; ctx.fill();
        ctx.strokeStyle = col(i / rows, 0.95); ctx.lineWidth = 1.4; ctx.stroke();
      }
    },
    orbs(ctx, W, H, seed) {
      const r = rng(seed);
      ctx.globalCompositeOperation = 'lighter';
      for (let k = 0; k < 7; k++) {
        const x = r() * W, y = r() * H, R = (0.25 + r() * 0.4) * Math.max(W, H);
        const g = ctx.createRadialGradient(x, y, 0, x, y, R);
        g.addColorStop(0, col(r(), 0.55)); g.addColorStop(1, col(r(), 0));
        ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      }
      ctx.globalCompositeOperation = 'source-over';
    }
  };

  function paint(cv) {
    if (cv.dataset.done) return;
    const W = cv.clientWidth, H = cv.clientHeight;
    if (!W || !H) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    const ctx = cv.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const seed = [...(cv.dataset.seed || cv.dataset.art)].reduce((a, c) => a * 31 + c.charCodeAt(0), 7);
    (painters[cv.dataset.art] || painters.orbs)(ctx, W, H, seed);
    cv.dataset.done = '1';
  }
  const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { paint(e.target); io.unobserve(e.target); } }), { rootMargin: '600px' });
  document.querySelectorAll('canvas[data-art]').forEach(c => io.observe(c));
  window.ArtPalette = { col, STOPS };
  window.ArtRepaint = () => document.querySelectorAll('canvas[data-art]').forEach(c => { delete c.dataset.done; requestAnimationFrame(() => paint(c)); });
})();
