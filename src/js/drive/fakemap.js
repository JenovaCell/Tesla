// Offline, procedurally drawn map (dark/light) that follows the active Trip. No network needed.

function rng(seed) {
  let a = seed | 0;
  return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

const PAL = {
  dark: { bg: '#1c1c20', minor: '#2b2b30', major: '#4b4b53', label: '#8a8b94', route: '#2e6bff', routeEdge: '#0d2a77', green: '#1c2520', water: '#182029', alt: '#c9b7bb', altText: '#2a2a2e', pin: '#e5484d' },
  light: { bg: '#e8e8ec', minor: '#fafafc', major: '#ffffff', label: '#6d6e76', route: '#2e6bff', routeEdge: '#1b49c0', green: '#d9e6d6', water: '#cbdbe8', alt: '#c9b7bb', altText: '#2a2a2e', pin: '#e5484d' },
};
const PLACES = ['Athens', 'Greenville', 'Lawrenceville', 'Suwanee', 'Nantahala National Forest', 'Clemson', 'Easley', 'Gainesville', 'Anderson', 'Buford'];

export class FakeMap {
  constructor(canvas) {
    this.c = canvas; this.ctx = canvas.getContext('2d');
    this.net = null; this.seed = 1;
  }
  resize(w, h, ratio = 1) {
    this.w = w; this.h = h;
    this.c.width = Math.round(w * ratio); this.c.height = Math.round(h * ratio);
    this.ratio = ratio;
  }
  _network(seed) {
    if (this.net && this.seed === seed) return this.net;
    const r = rng(seed * 31 + 7);
    const blobs = [];
    for (let i = 0; i < 7; i++) blobs.push({ x: (r() - 0.5) * 4500, y: (r() - 0.5) * 4500, rx: 250 + r() * 600, ry: 200 + r() * 450, g: r() < 0.7 });
    const places = PLACES.map((n) => ({ n, x: (r() - 0.5) * 4200, y: (r() - 0.5) * 4200 }));
    // smooth "highways": long gentle curves
    const hwys = [];
    for (let i = 0; i < 6; i++) {
      let x = (r() - 0.5) * 7000, y = (r() - 0.5) * 7000, a = r() * Math.PI * 2; const pts = [[x, y]];
      for (let k = 0; k < 22; k++) { a += (r() - 0.5) * 0.35; x += Math.cos(a) * 420; y += Math.sin(a) * 420; pts.push([x, y]); }
      hwys.push(pts);
    }
    // block grids (rotated patches) with dropped segments
    const grids = [];
    for (let i = 0; i < 5; i++) grids.push({ cx: (r() - 0.5) * 4200, cy: (r() - 0.5) * 4200, ang: (r() - 0.5) * 0.9, sp: 150 + r() * 130, n: 10 + Math.floor(r() * 8), seed: Math.floor(r() * 1e6) });
    this.net = { blobs, places, hwys, grids }; this.seed = seed;
    return this.net;
  }

  /** Draw map. trip: Trip, f: progress 0..1, mode: 'overview' | 'follow', theme: 'dark'|'light' */
  draw(trip, theme, mode, opts = {}) {
    const { ctx, w, h } = this, P = PAL[theme] || PAL.dark, net = this._network(opts.seed ?? 1);
    ctx.setTransform(this.ratio, 0, 0, this.ratio, 0, 0);
    ctx.clearRect(0, 0, w, h);
    if (!opts.transparent) { ctx.fillStyle = P.bg; ctx.fillRect(0, 0, w, h); }
    const route = trip.route;
    let scale, ox, oy, rot = 0;
    const car = trip.pointAt(trip.progress);
    if (mode === 'overview') {
      let minx = 1e12, miny = 1e12, maxx = -1e12, maxy = -1e12;
      for (const [x, y] of route) { minx = Math.min(minx, x); miny = Math.min(miny, y); maxx = Math.max(maxx, x); maxy = Math.max(maxy, y); }
      const inL = opts.insetLeft || 0, pad = 70, aw = w - inL, sx = (aw - pad * 2) / Math.max(1, maxx - minx), sy = (h - pad * 2) / Math.max(1, maxy - miny);
      scale = Math.min(sx, sy, 0.02);       // px per metre; cap so short routes aren't absurdly zoomed
      ox = inL + aw / 2 - ((minx + maxx) / 2) * scale; oy = h / 2 - ((miny + maxy) / 2) * scale;
    } else {
      scale = opts.scale ?? 0.1;
      ox = (opts.insetLeft || 0) + (w - (opts.insetLeft || 0)) / 2 - car.x * scale; oy = h * 0.62 - car.y * scale;
    }
    const tx = (x, y) => [x * scale + ox, y * scale + oy];
    // landuse
    const world = mode === 'overview' ? 0.02 / Math.max(scale, 1e-6) : 1;
    for (const b of (opts.transparent ? [] : net.blobs)) {
      const [bx, by] = mode === 'overview' ? [w * 0.5 + b.x * 0.18, h * 0.5 + b.y * 0.18] : tx(b.x, b.y);
      ctx.fillStyle = b.g ? P.green : P.water; ctx.beginPath(); ctx.ellipse(bx, by, b.rx * (mode === 'overview' ? 0.18 : 0.1), b.ry * (mode === 'overview' ? 0.18 : 0.1), 0.4, 0, 7); ctx.fill();
    }
    // background roads (fixed detail level, independent of the route scale)
    const bgS = mode === 'overview' ? 0.2 : 0.1;
    const [bx0, by0] = mode === 'overview' ? [w * 0.5, h * 0.5] : [ox, oy];
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.strokeStyle = P.minor; ctx.lineWidth = 1.2;
    for (const g of (opts.transparent ? net.grids.slice(0, 2) : net.grids)) {
      const rr = rng(g.seed), cs = Math.cos(g.ang), sn = Math.sin(g.ang), half = g.n * g.sp / 2;
      ctx.beginPath();
      for (let i = 0; i <= g.n; i++) for (let j = 0; j < g.n; j++) {
        if (rr() < 0.3) continue;
        const u = -half + i * g.sp, v0 = -half + j * g.sp, v1 = v0 + g.sp;
        for (const [ax, ay, bx, by] of [[u, v0, u, v1], [v0, u, v1, u]]) {
          const X0 = g.cx + ax * cs - ay * sn, Y0 = g.cy + ax * sn + ay * cs, X1 = g.cx + bx * cs - by * sn, Y1 = g.cy + bx * sn + by * cs;
          ctx.moveTo(bx0 + X0 * bgS, by0 + Y0 * bgS); ctx.lineTo(bx0 + X1 * bgS, by0 + Y1 * bgS);
        }
      }
      ctx.stroke();
    }
    ctx.strokeStyle = P.major; ctx.lineWidth = 2.6;
    for (const pts of net.hwys) { ctx.beginPath(); pts.forEach(([x, y], i) => { const px = bx0 + x * bgS, py = by0 + y * bgS; i ? ctx.lineTo(px, py) : ctx.moveTo(px, py); }); ctx.stroke(); }
    if (mode === 'follow') {              // city grid under the route
      ctx.strokeStyle = P.minor; ctx.lineWidth = 2;
      const g = 520 * scale * 3.2;
      for (let gx = (ox % g) - g; gx < w + g; gx += g) { ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, h); ctx.stroke(); }
      for (let gy = (oy % g) - g; gy < h + g; gy += g) { ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(w, gy); ctx.stroke(); }
    }
    // labels
    ctx.fillStyle = P.label; ctx.font = '12px Inter, Segoe UI, sans-serif'; ctx.textAlign = 'center';
    for (const p of net.places) {
      const px = mode === 'overview' ? w * 0.5 + p.x * 0.18 : bx0 + p.x * bgS, py = mode === 'overview' ? h * 0.5 + p.y * 0.18 : by0 + p.y * bgS;
      if (px > 20 && px < w - 20 && py > 20 && py < h - 20) ctx.fillText(p.n, px, py);
    }
    // route
    const stroke = (col, wd) => { ctx.strokeStyle = col; ctx.lineWidth = wd; ctx.beginPath(); route.forEach(([x, y], i) => { const [px, py] = tx(x, y); i ? ctx.lineTo(px, py) : ctx.moveTo(px, py); }); ctx.stroke(); };
    // alternates (overview only)
    if (mode === 'overview') {
      ctx.setLineDash([]); ctx.strokeStyle = theme === 'dark' ? '#6d6d76' : '#b0b0ba'; ctx.lineWidth = 5; ctx.globalAlpha = 0.85;
      ctx.beginPath(); route.forEach(([x, y], i) => { const [px, py] = tx(x + (i % 2 ? 40 : -40) * 20, y - (i % 3) * 12 * 20); i ? ctx.lineTo(px, py) : ctx.moveTo(px, py); }); ctx.stroke(); ctx.globalAlpha = 1;
    }
    stroke(P.routeEdge, mode === 'overview' ? 8 : 14);
    stroke(P.route, mode === 'overview' ? 5 : 9);
    // travelled portion dimmed
    ctx.globalAlpha = 0.5; ctx.strokeStyle = theme === 'dark' ? '#222' : '#ccc'; ctx.lineWidth = mode === 'overview' ? 5 : 9;
    ctx.beginPath(); const nTrav = Math.floor(trip.progress * (route.length - 1));
    for (let i = 0; i <= nTrav; i++) { const [px, py] = tx(route[i][0], route[i][1]); i ? ctx.lineTo(px, py) : ctx.moveTo(px, py); }
    const [cx, cy] = tx(car.x, car.y); ctx.lineTo(cx, cy); ctx.stroke(); ctx.globalAlpha = 1;
    // destination pin
    const end = route[route.length - 1], [ex, ey] = tx(end[0], end[1]);
    ctx.fillStyle = '#2e6bff'; ctx.beginPath(); ctx.arc(ex, ey, 11, 0, 7); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.font = 'bold 12px Inter, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('P', ex, ey + 1);
    // time bubbles on overview
    if (mode === 'overview' && opts.labels) {
      opts.labels.forEach(([text, f, hot]) => {
        const q = trip.pointAt(f), [lx, ly] = tx(q.x, q.y);
        ctx.fillStyle = hot ? '#2e6bff' : P.alt; const bw = ctx.measureText(text).width + 22;
        ctx.beginPath(); ctx.roundRect(lx - bw / 2, ly - 14, bw, 28, 6); ctx.fill();
        ctx.fillStyle = hot ? '#fff' : P.altText; ctx.font = '600 13px Inter, sans-serif'; ctx.fillText(text, lx, ly + 1);
      });
    }
    // car marker (red arrow)
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(car.ang + Math.PI / 2);
    ctx.fillStyle = P.pin; ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(0, -13); ctx.lineTo(10, 11); ctx.lineTo(0, 6); ctx.lineTo(-10, 11); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.restore();
  }
}
