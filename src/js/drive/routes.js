// Destinations and real driving routes. Routes come from the public OSRM service (OpenStreetMap data) and are cached in
// localStorage, so a desk display only needs the internet the first time it drives a given pair. Offline, trips fall back
// to a generated route of the right approximate length.
import { haversine, parseOSRM } from './routeparse.js';

export const PLACES = [
  { id: 'winterhaven', name: 'Winter Haven', lat: 28.0222, lon: -81.7329 },
  { id: 'magickingdom', name: 'Magic Kingdom', lat: 28.4161, lon: -81.5812 },
  { id: 'epcot', name: 'Epcot', lat: 28.3694, lon: -81.5494 },
  { id: 'disneysprings', name: 'Disney Springs', lat: 28.3704, lon: -81.5190 },
  { id: 'hollywood', name: "Disney's Hollywood Studios", lat: 28.3575, lon: -81.5583 },
  { id: 'animalkingdom', name: "Disney's Animal Kingdom", lat: 28.3553, lon: -81.5901 },
  { id: 'universal', name: 'Universal Orlando Resort', lat: 28.4747, lon: -81.4685 },
  { id: 'mco', name: 'Orlando International Airport', lat: 28.4312, lon: -81.3081 },
  { id: 'lakeland', name: 'Downtown Lakeland', lat: 28.0395, lon: -81.9498 },
  { id: 'clermont', name: 'Clermont', lat: 28.5494, lon: -81.7729 },
];
export const placeById = (id) => PLACES.find((p) => p.id === id) || PLACES[0];

const MI = 1609.344;
/** pick a destination for a 30-45 minute drive from `fromId` (straight line 22-40 miles) */
export function pickDestination(fromId, rnd = Math.random) {
  const a = placeById(fromId);
  const ok = PLACES.filter((p) => { if (p.id === a.id) return false; const d = haversine([a.lat, a.lon], [p.lat, p.lon]) / MI; return d >= 22 && d <= 40; });
  const pool = ok.length ? ok : PLACES.filter((p) => p.id !== a.id);
  return pool[Math.floor(rnd() * pool.length)];
}

const KEY = (a, b) => `teslaSim.route.v2.${a}.${b}`;
const mem = new Map();

export async function planRoute(fromId, toId, { timeout = 9000 } = {}) {
  const key = KEY(fromId, toId);
  if (mem.has(key)) return mem.get(key);
  try { const c = localStorage.getItem(key); if (c) { const r = JSON.parse(c); mem.set(key, r); return r; } } catch { /* storage unavailable */ }
  const a = placeById(fromId), b = placeById(toId);
  const url = `https://router.project-osrm.org/route/v1/driving/${a.lon},${a.lat};${b.lon},${b.lat}?overview=full&geometries=geojson&steps=true`;
  const ctl = new AbortController(); const to = setTimeout(() => ctl.abort(), timeout);
  try {
    const res = await fetch(url, { signal: ctl.signal });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const route = parseOSRM(await res.json(), { name: b.name, from: a.name });
    if (!route) throw new Error('no route');
    mem.set(key, route);
    try { localStorage.setItem(key, JSON.stringify(route)); } catch { /* quota */ }
    return route;
  } catch (e) {
    console.warn('[routes] using an estimated route (', e.message, ')');
    return null;
  } finally { clearTimeout(to); }
}
