// DOM layer for the drive display: HUD readouts, turn list, ETA, floating cards, parked callouts.
import { h } from '../util.js';
import { icon } from '../icons.js';
import { fmtDist, fmtDur } from './trip.js';
import { FakeMap } from './fakemap.js';

const ARW = {
  straight: 'M16 28V6 M8 14l8-8 8 8',
  right: 'M9 28V19a6 6 0 0 1 6-6h9 M19 7l6 6-6 6',
  left: 'M23 28V19a6 6 0 0 0-6-6H8 M13 7l-6 6 6 6',
  slightR: 'M11 28V19l10-10 M13 9h8v8',
  slightL: 'M21 28V19L11 9 M19 9h-8v8',
  exit: 'M10 28V13 M10 22c0-6 5-9 12-11 M17 7l6 4-4 7',
  merge: 'M8 28c0-8 8-8 8-16 M16 12V6 M10 11l6-6 6 6',
  arrive: 'M16 4a7 7 0 0 1 7 7c0 6-7 14-7 14S9 17 9 11a7 7 0 0 1 7-7z M16 8.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5z',
};
export function arrow(type, size = 28) {
  const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  s.setAttribute('viewBox', '0 0 32 32'); s.setAttribute('width', size); s.setAttribute('height', size);
  s.setAttribute('fill', 'none'); s.setAttribute('stroke', 'currentColor'); s.setAttribute('stroke-width', '3'); s.setAttribute('stroke-linecap', 'round'); s.setAttribute('stroke-linejoin', 'round');
  s.innerHTML = `<path d="${ARW[type] || ARW.straight}"/>`;
  return s;
}
const laneSvg = (on) => { const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); s.setAttribute('viewBox', '0 0 18 26'); s.setAttribute('class', on ? 'on' : ''); s.setAttribute('fill', 'none'); s.setAttribute('stroke', 'currentColor'); s.setAttribute('stroke-width', '2.6'); s.setAttribute('stroke-linecap', 'round'); s.setAttribute('stroke-linejoin', 'round'); s.innerHTML = '<path d="M9 24V5 M3 11l6-6 6 6"/>'; return s; };
const shieldSvg = (label) => { const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); s.setAttribute('viewBox', '0 0 40 40'); s.setAttribute('class', 'shield'); s.innerHTML = `<path d="M20 2c5 3 11 4 17 4v14c0 9-7 15-17 18C10 35 3 29 3 20V6c6 0 12-1 17-4z" fill="#223a8c" stroke="#fff" stroke-width="2"/><path d="M3 6c6 0 12-1 17-4 5 3 11 4 17 4v6H3z" fill="#c8262e"/><text x="20" y="28" text-anchor="middle" font-size="12" font-weight="700" fill="#fff" font-family="Inter,Segoe UI,sans-serif">${label.replace('I-', '')}</text>`; return s; };

export class DriveUI {
  constructor(root, deps) {
    this.root = root; this.d = deps;
    this.mode = 'park';
    this.cache = {};
    this._build();
  }
  _build() {
    const d = this.d;
    this.el = h('div', { class: 'drive', 'data-mode': 'park' });
    // ---------------- visualisation panel ----------------
    this.canvas = h('canvas', { class: 'viz-canvas' });
    this.gearEls = {};
    const gearRow = h('div', { class: 'gearrow' }, ['P', 'R', 'N', 'D'].map((g) => (this.gearEls[g] = h('b', { onclick: () => d.shift(g) }, g))));
    this.speedN = h('div', { class: 'speed-n' }, '0'); this.speedU = h('div', { class: 'speed-u' }, 'MPH');
    this.limitNum = h('span', null, '70');
    this.limit = h('div', { class: 'limit' }, h('small', null, 'SPEED'), h('small', null, 'LIMIT'), this.limitNum);
    this.lamps = h('div', { class: 'lamps' }, h('i', { class: 'g' }), h('i', { class: 'd' }), h('i', { class: 'g' }));
    this.battFill2 = h('i'); this.battTxt2 = h('span', null, '74 %');
    this.fsdState2 = h('div', { class: 'fsd-state' }, 'Self-Driving'); this.fsdSub2 = h('div', { class: 'fsd-sub' }, '⌄ Hurry');
    this.streak2 = h('div', { class: 'streak' }, h('b', null, '6,758.5 mi'), 'Streak');
    const fsdFull = h('div', { class: 'fsd-full' }, this.fsdState2, this.fsdSub2, this.streak2);
    const battFull = h('div', { class: 'battrow battfull' }, this.battTxt2, h('div', { class: 'batt-ic' }, this.battFill2));
    const tl = h('div', { class: 'hud hud-tl' }, h('div', { class: 'gearwrap' }, gearRow, battFull), this.speedN, this.speedU, fsdFull, this.limit, this.lamps);

    this.battFill = h('i'); this.battTxt = h('span', null, '74 %');
    this.fsdState = h('div', { class: 'fsd-state' }, 'Self-Driving');
    this.fsdSub = h('div', { class: 'fsd-sub' }, '⌄ Hurry');
    this.streak = h('div', { class: 'streak' }, h('b', null, '6,758.5 mi'), 'Streak');
    const tr = h('div', { class: 'hud hud-tr' }, h('div', { class: 'battrow' }, this.battTxt, h('div', { class: 'batt-ic' }, this.battFill)), this.fsdState, this.fsdSub, this.streak);

    this.st = { odo: h('span'), drive1: h('span'), drive2: h('span'), drive3: h('span'), drive4: h('span'), chg1: h('span'), chg2: h('span'), chg3: h('span'), chg4: h('span') };
    const stats = h('div', { class: 'hud stats' },
      h('div', null, h('b', null, 'Odometer'), this.st.odo),
      h('div', null, h('b', null, 'Current Drive'), this.st.drive1, this.st.drive2, this.st.drive3, this.st.drive4),
      h('div', null, h('b', null, 'Since Charge'), this.st.chg1, this.st.chg2, this.st.chg3, this.st.chg4));

    // full-mode overlays
    this.navChip = h('div', { class: 'navchip' }); this.timeFull = h('span'); this.tempFull = h('span');
    this.miniCanvas = h('canvas');
    this.minimap = h('div', { class: 'minimap', onclick: () => d.setLayout('split') }, this.miniCanvas);
    this.mediaCard = h('div', { class: 'card2 media2' }); this.tripCard = h('div', { class: 'card2 trip2' });
    const fullui = h('div', { class: 'fullui' },
      this.navChip,
      h('div', { class: 'topc' }, icon('lock', 20), icon('phone', 20)),
      h('div', { class: 'topr' }, this.timeFull, this.tempFull, h('span', { class: 'aqi' }, 'AQI 18'), h('span', { class: 'alertchip' }, 'PASSENGER\nAIRBAG OFF')),
      this.minimap,
      h('div', { class: 'cards' }, this.mediaCard, this.tripCard));

    // parked overlays
    this.calFrunk = h('div', { class: 'callout', onclick: () => d.toggle('frunk') }, 'Open', h('small', null, 'Frunk'));
    this.calTrunk = h('div', { class: 'callout', onclick: () => d.toggle('trunk') }, 'Open', h('small', null, 'Trunk'));
    this.lockPin = h('div', { class: 'lockpin', onclick: () => d.toggle('locked') }, icon('lock', 22));
    this.lockLine = h('div', { class: 'lockline' });
    this.startBtn = h('button', { class: 'startfsd', onclick: () => d.startFSD() }, 'Start Self-Driving');
    const parkui = h('div', { class: 'parkui' }, this.calFrunk, this.calTrunk, this.lockLine, this.lockPin, this.startBtn,
      h('div', { class: 'park-hint' }, 'Drag to rotate'),
      h('div', { class: 'assist' }, h('span', null, 'Ask…'), h('span', null, 'Assistant ⌄')));

    this.layoutBtn = h('button', { class: 'iconbtn', style: { position: 'absolute', right: '12px', bottom: '84px', zIndex: 7, width: '40px', height: '40px', opacity: '.7' }, onclick: () => d.setLayout('full') }, icon('full', 20));

    this.viz = h('div', { class: 'viz' }, h('div', { class: 'park-bg' }), this.canvas, tl, tr, stats, fullui, parkui, this.layoutBtn);

    // drag-to-rotate in parked view
    let dragX = null;
    this.viz.addEventListener('pointerdown', (e) => { if (this.mode === 'park' && !e.target.closest('button,.callout,.lockpin')) { dragX = e.clientX; this.viz.setPointerCapture(e.pointerId); } });
    this.viz.addEventListener('pointermove', (e) => { if (dragX != null) { d.scene.dragAng += (e.clientX - dragX) * 0.006 / (d.stageScale?.() || 1); dragX = e.clientX; } });
    const up = () => { dragX = null; }; this.viz.addEventListener('pointerup', up); this.viz.addEventListener('pointercancel', up);

    // ---------------- navigation panel ----------------
    this.mapCanvas = h('canvas', { class: 'map' });
    this.map = new FakeMap(this.mapCanvas);
    this.timeTxt = h('span'); this.tempTxt = h('span');
    const top = h('div', { class: 'navp-top' }, icon('lock', 18), icon('phone', 18), h('span', { class: 'sp' }), this.timeTxt, this.tempTxt, h('span', { class: 'aqi' }, 'AQI 54'), h('span', { class: 'sp' }), h('span', { class: 'alertchip' }, 'PASSENGER\nAIRBAG OFF'));
    this.turnArrow = h('div', { class: 'ar' }); this.turnDist = h('div', { class: 'd' }); this.turnRoad = h('div', { class: 'r' }); this.turnShield = h('div');
    this.laneRow = h('div', { class: 'lanes' }); this.mlist = h('div', { class: 'mlist' });
    this.etaA = h('b'); this.etaB = h('span'); this.etaC = h('span'); this.etaD = h('span'); this.etaProg = h('i');
    const eta = h('div', { class: 'eta' },
      h('div', { class: 't1' }, this.etaA, this.etaB),
      h('div', { class: 't2' }, this.etaC, this.etaD), h('div', { class: 'prog' }, this.etaProg),
      h('div', { class: 'btns' }, icon('nav', 22), h('b', { onclick: () => d.endTrip() }, 'End Trip'), h('span', null, '···')));
    const turns = h('div', { class: 'turns' }, h('div', { class: 'turn-card' }, this.turnArrow, h('div', null, this.turnDist, this.turnRoad), this.turnShield), this.laneRow, this.mlist, eta);
    this.nav = h('div', { class: 'navp' }, h('div', { class: 'mapc' }, this.mapCanvas), top, turns);

    this.fade = h('div', { class: 'fade' });
    this.el.append(this.viz, this.nav, this.fade);
    this.root.append(this.el);
  }
  setMode(m) { this.mode = m; this.el.dataset.mode = m; }
  setFade(on) { this.fade.classList.toggle('on', on); }

  /** Size canvases to their CSS boxes (stage px) at the requested pixel ratio. */
  resize(ratio) {
    const sc = this.d.scene, c = this.canvas;
    const w = c.clientWidth, hgt = c.clientHeight;
    if (!w || !hgt) return;
    const key = `${w}x${hgt}@${ratio.toFixed(2)}`;
    if (this.cache.size !== key) { sc.setSize(w, hgt, ratio); this.cache.size = key; }
    const nw = this.mapCanvas.clientWidth, nh = this.mapCanvas.clientHeight;
    const k2 = `${nw}x${nh}`;
    if (nw && this.cache.mapSize !== k2) { this.map.resize(nw, nh, Math.min(2, ratio)); this.cache.mapSize = k2; this.cache.mapDirty = true; }
    const mw = this.miniCanvas.clientWidth, mh = this.miniCanvas.clientHeight;
    const k3 = `${mw}x${mh}`;
    if (mw && this.cache.miniSize !== k3) { this.miniCanvas.width = Math.round(mw * Math.min(2, ratio)); this.miniCanvas.height = Math.round(mh * Math.min(2, ratio)); this.cache.miniSize = k3; }
  }

  _set(el, key, val) { if (this.cache[key] !== val) { this.cache[key] = val; el.textContent = val; } }

  update(dt, S) {
    const { world, trip, units, clock24, theme, soc, odo, driving, session, mode, stage } = S;
    const mph = world.ego.v / 0.44704;
    const kmh = units === 'km';
    this._set(this.speedN, 'spd', String(Math.round(kmh ? mph * 1.609344 : mph)));
    this._set(this.speedU, 'spu', kmh ? 'KM/H' : 'MPH');
    this._set(this.limitNum, 'lim', String(Math.round(kmh ? world.limit * 1.609344 / 5 : world.limit)));
    for (const g of 'PRND') { const on = S.gear === g; const k = 'g' + g; if (this.cache[k] !== on) { this.cache[k] = on; this.gearEls[g].className = on ? 'on' + (g === 'D' ? ' d' : '') : ''; } }
    this._set(this.battTxt, 'soc', `${Math.round(soc)} %`); this._set(this.battTxt2, 'soc2', `${Math.round(soc)} %`);
    const pct = Math.round(soc); if (this.cache.bf !== pct) { this.cache.bf = pct; for (const bf of [this.battFill, this.battFill2]) { bf.style.width = pct + '%'; bf.style.background = pct < 20 ? '#e5484d' : ''; } }
    const fsdTxt = driving ? 'Self-Driving' : S.gear === 'P' ? '' : 'Ready';
    const subTxt = driving ? `⌄ ${S.profile[0].toUpperCase()}${S.profile.slice(1)}` : '';
    this._set(this.fsdState, 'fsd', fsdTxt); this._set(this.fsdState2, 'fsd2', fsdTxt);
    this._set(this.fsdSub, 'fsdsub', subTxt); this._set(this.fsdSub2, 'fsdsub2', subTxt);
    const now = new Date();
    const hh = now.getHours(), mm = String(now.getMinutes()).padStart(2, '0');
    const tstr = clock24 ? `${String(hh).padStart(2, '0')}:${mm}` : `${((hh + 11) % 12) + 1}:${mm} ${hh < 12 ? 'am' : 'pm'}`;
    const temp = kmh ? '29°C' : '84°F';
    this._set(this.timeTxt, 'tm', tstr); this._set(this.tempTxt, 'tp', temp); this._set(this.timeFull, 'tm2', tstr); this._set(this.tempFull, 'tp2', temp);

    // stats panel
    const f1 = (v) => v.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
    const dist = kmh ? session.miles * 1.609344 : session.miles, du = kmh ? 'km' : 'mi';
    const whmi = session.miles > 0.2 ? Math.round((session.kwh * 1000) / session.miles) : 195;
    this._set(this.st.odo, 'odo', `${f1(kmh ? odo * 1.609344 : odo)} ${kmh ? 'km' : 'miles'}`);
    for (const p of ['drive', 'chg']) {
      this._set(this.st[p + '1'], p + '1', `${f1(whmi)} Wh/${du}`); this._set(this.st[p + '2'], p + '2', `${f1(session.kwh)} kWh`);
      this._set(this.st[p + '3'], p + '3', `${f1(dist)} ${du}`); this._set(this.st[p + '4'], p + '4', `${Math.max(1, Math.round(session.sec / 60))} min`);
    }
    this._set(this.streak.firstChild, 'streak', `${f1(6758.5 + session.miles)} mi`); this._set(this.streak2.firstChild, 'streak2', `${f1(6758.5 + session.miles)} mi`);

    // navigation
    const nx = trip.next;
    const key = `${nx.type}|${nx.road}|${nx.shield}`;
    if (this.cache.nx !== key) {
      this.cache.nx = key;
      this.turnArrow.replaceChildren(arrow(nx.type, 48));
      this.turnRoad.textContent = nx.road;
      this.turnShield.replaceChildren(...(nx.shield ? [shieldSvg(nx.shield)] : []));
      this.navChip.replaceChildren(arrow(nx.type, 28), h('div', null, h('span', { 'data-d': 1 }), h('small', null, nx.road)));
      const ln = nx.type === 'straight' || nx.type === 'exit' ? [0, 1, 1, 1] : [1, 0, 0, 0];
      this.laneRow.replaceChildren(...ln.map((v) => laneSvg(!!v)));
      this.mlist.replaceChildren(...trip.upcoming(6).map((m) => h('div', { class: 'mrow' }, arrow(m.type, 28), h('div', { class: 'n' }, m.road), h('div', { class: 'm', 'data-d': 1 }, fmtDist(m.dist, units)))));
    }
    this._set(this.turnDist, 'td', fmtDist(nx.dist, units));
    const cd = this.navChip.querySelector('span[data-d]'); if (cd) cd.textContent = fmtDist(nx.dist, units);
    // eta
    const etaSec = trip.etaSec, arr = new Date(Date.now() + etaSec * 1000);
    const ah = arr.getHours(), am = String(arr.getMinutes()).padStart(2, '0');
    const astr = clock24 ? `${String(ah).padStart(2, '0')}:${am}` : `${((ah + 11) % 12) + 1}:${am} ${ah < 12 ? 'am' : 'pm'}`;
    const remMi = trip.remaining / 1609.344, remShown = kmh ? remMi * 1.609344 : remMi;
    this._set(this.etaA, 'ea', astr); this._set(this.etaB, 'eb', `${fmtDur(etaSec)}   ${remShown < 10 ? remShown.toFixed(1) : Math.round(remShown)} ${du}`);
    const arrSoc = Math.max(1, Math.round(soc - (remMi / S.rangeMi) * 100));
    this._set(this.etaC, 'ec', trip.dest); this._set(this.etaD, 'ed', `▭ ${arrSoc}%`);
    this.etaProg.style.width = (trip.progress * 100).toFixed(1) + '%';

    // full-mode cards
    this.updateCards(S, astr, remShown, du, arrSoc, etaSec);
  }

  updateCards(S, astr, remShown, du, arrSoc, etaSec) {
    const np = S.nowPlaying;
    const mk = np ? `${np.title}|${np.source}|${S.playing}` : 'none';
    if (this.cache.media !== mk) {
      this.cache.media = mk;
      const dd = this.d;
      this.mediaCard.replaceChildren(
        h('div', { class: 'top' }, h('div', { class: 'art' }, icon('music', 22)), h('div', { class: 'ti' }, h('b', null, np ? np.title : 'Choose Media Source'), h('span', null, np ? np.source : '')) ),
        h('div', { class: 'ctl' },
          h('button', { onclick: () => dd.media('prev') }, icon('prev', 22)),
          h('button', { onclick: () => dd.media('toggle') }, icon(S.playing ? 'pause' : 'play', 22)),
          h('button', { onclick: () => dd.media('next') }, icon('next', 22)),
          h('button', { onclick: () => dd.openApp('music') }, icon('music', 22)),
          h('button', { onclick: () => dd.openApp('music') }, icon('search', 22))));
    }
    const arrive = this.tripCard;
    const tk = `${S.trip.dest}`;
    if (this.cache.tripKey !== tk) {
      this.cache.tripKey = tk; for (const k of ['ta', 'tb', 'tc', 'td2']) delete this.cache[k];
      this.tripA = h('b'); this.tripB = h('span'); this.tripC = h('span'); this.tripD = h('span'); this.tripP = h('i');
      arrive.replaceChildren(h('div', { class: 't1' }, this.tripA, this.tripB), h('div', { class: 't2' }, this.tripC, this.tripD), h('div', { class: 'prog' }, this.tripP),
        h('div', { class: 'btns' }, icon('nav', 20), h('b', { onclick: () => this.d.endTrip() }, 'End Trip'), h('span', null, '···')));
    }
    this._set(this.tripA, 'ta', astr); this._set(this.tripB, 'tb', `${fmtDur(etaSec)}   ${remShown < 10 ? remShown.toFixed(1) : Math.round(remShown)} ${du}`);
    this._set(this.tripC, 'tc', S.trip.dest); this._set(this.tripD, 'td2', `▭ ${arrSoc}%`);
    this.tripP.style.width = (S.trip.progress * 100).toFixed(1) + '%';
  }

  /** map drawing (called each frame at a lower rate) */
  drawMaps(S) {
    if (S.mode === 'full') {
      if (this.miniCanvas.width) {
        const m = this._mini || (this._mini = new FakeMap(this.miniCanvas));
        m.resize(this.miniCanvas.clientWidth, this.miniCanvas.clientHeight, this.miniCanvas.width / Math.max(1, this.miniCanvas.clientWidth));
        m.draw(S.trip, S.theme, 'follow', { seed: S.seed, scale: 0.05, transparent: true });
      }
    } else if (this.mapCanvas.width) {
      const mode = S.trip.kind === 'highway' ? 'overview' : 'follow';
      this.map.draw(S.trip, S.theme, mode, { seed: S.seed, scale: 0.09, insetLeft: this.mapCanvas.clientWidth * 0.36, labels: S.trip.kind === 'highway' ? [[fmtDur(S.trip.etaSec).replace(' min', ' min').replace(/^(\d+) hr 0 min$/, '$1 hr'), 0.6, true], [fmtDur(S.trip.etaSec * 1.1), 0.78, false]] : null });
    }
  }

  /** place parked callouts from projected points */
  placeCallouts(proj) {
    const set = (el, p, dy = 0) => { el.style.left = p.x + 'px'; el.style.top = p.y - 74 + dy + 'px'; el.style.height = '74px'; };
    set(this.calFrunk, proj.frunk); set(this.calTrunk, proj.trunk);
    this.lockPin.style.left = proj.top.x + 'px'; this.lockPin.style.top = proj.top.y - 78 + 'px';
    this.lockLine.style.left = proj.top.x + 'px'; this.lockLine.style.top = proj.top.y - 78 + 'px'; this.lockLine.style.height = '78px';
  }
}
