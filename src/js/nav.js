// Navigation: Leaflet map (OSM tiles), Nominatim search, OSRM routing, simulated drive along the route.
import { h, toast } from './util.js';
import { icon } from './icons.js';
import { store, mi2, distUnit, setting } from './state.js';

const L = window.L;
let map, carMarker, routeLine, destMarker, followCar = true;
let cum = [];     // cumulative metres along route
let coords = [];  // [lat,lng]

const carIcon = () => L.divIcon({ className: '', iconSize: [44, 44], iconAnchor: [22, 22],
  html: '<div style="width:44px;height:44px;border-radius:50%;background:#3e6ae1;border:4px solid #fff;box-shadow:0 0 0 8px rgba(62,106,225,.28),0 4px 14px rgba(0,0,0,.5);display:grid;place-items:center"><svg width="20" height="20" viewBox="0 0 24 24" fill="#fff"><path d="M12 2l7 18-7-4-7 4z"/></svg></div>' });

export function mountMap(el) {
  if (!L) { el.append(h('div', { style: { padding: '40px' } }, 'Map library missing (run npm install).')); return; }
  const p = store.get('pos');
  map = L.map(el, { zoomControl: false, attributionControl: true, zoomSnap: 0.25, tap: true, inertia: true }).setView([p.lat, p.lng], 14);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap' }).addTo(map);
  carMarker = L.marker([p.lat, p.lng], { icon: carIcon(), interactive: false, zIndexOffset: 1000 }).addTo(map);
  map.on('dragstart', () => { followCar = false; });
  el._map = map;
  setTimeout(() => map.invalidateSize(), 50);
  new ResizeObserver(() => map.invalidateSize()).observe(el);
}
export const zoom = (d) => map?.zoomIn && (d > 0 ? map.zoomIn() : map.zoomOut());
export const recenter = () => { followCar = true; const p = store.get('pos'); map?.setView([p.lat, p.lng], Math.max(map.getZoom(), 15), { animate: true }); };

export async function search(q) {
  const p = store.get('pos');
  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=6&q=${encodeURIComponent(q)}&viewbox=${p.lng - 0.8},${p.lat + 0.8},${p.lng + 0.8},${p.lat - 0.8}`;
  const r = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!r.ok) throw new Error('Search failed');
  return (await r.json()).map((x) => ({ name: x.name || x.display_name.split(',')[0], addr: x.display_name, lat: +x.lat, lng: +x.lon }));
}

export async function routeTo(dest) {
  const p = store.get('pos');
  const url = `https://router.project-osrm.org/route/v1/driving/${p.lng},${p.lat};${dest.lng},${dest.lat}?overview=full&geometries=geojson`;
  const r = await fetch(url);
  const j = await r.json();
  if (!j.routes?.length) throw new Error('No route found');
  const rt = j.routes[0];
  coords = rt.geometry.coordinates.map(([lng, lat]) => [lat, lng]);
  cum = [0];
  for (let i = 1; i < coords.length; i++) cum.push(cum[i - 1] + L.latLng(coords[i - 1]).distanceTo(coords[i]));
  routeLine?.remove(); destMarker?.remove();
  routeLine = L.polyline(coords, { color: '#3e6ae1', weight: 9, opacity: .9 }).addTo(map);
  destMarker = L.marker([dest.lat, dest.lng]).addTo(map);
  map.fitBounds(routeLine.getBounds(), { padding: [90, 90] });
  followCar = false;
  store.set({ _route: { dest, meters: rt.distance, seconds: rt.duration }, _routeProgress: 0 });
  return rt;
}
export function cancelRoute() {
  routeLine?.remove(); destMarker?.remove(); routeLine = destMarker = null; coords = []; cum = [];
  store.set({ _route: null, _routeProgress: 0 }); recenter();
}

// Called by the sim loop with metres travelled while in Drive.
export function advance(meters) {
  const st = store.state;
  if (!coords.length || !st._route) { // free roam: head north-east slowly so the map visibly moves
    const p = st.pos; const d = meters / 111000;
    const np = { ...p, lat: p.lat + d * 0.7, lng: p.lng + d * 0.7 };
    store.set({ pos: np }); moveCar(np.lat, np.lng, 0.7); return;
  }
  const prog = Math.min(cum[cum.length - 1], st._routeProgress + meters);
  let i = cum.findIndex((c) => c >= prog); if (i < 1) i = 1;
  const t = (prog - cum[i - 1]) / Math.max(1, cum[i] - cum[i - 1]);
  const a = coords[i - 1], b = coords[i];
  const lat = a[0] + (b[0] - a[0]) * t, lng = a[1] + (b[1] - a[1]) * t;
  const heading = Math.atan2(b[1] - a[1], b[0] - a[0]);
  store.set({ _routeProgress: prog, pos: { ...st.pos, lat, lng } });
  moveCar(lat, lng, heading);
  if (prog >= cum[cum.length - 1] - 5) { toast('You have arrived'); cancelRoute(); store.set({ _target: 0 }); }
}
function moveCar(lat, lng) {
  carMarker?.setLatLng([lat, lng]);
  if (followCar) map?.setView([lat, lng], map.getZoom(), { animate: false });
}
export function setCarPos(lat, lng, name) {
  store.set({ pos: { lat, lng, name } });
  carMarker?.setLatLng([lat, lng]); map?.setView([lat, lng], 14);
}
export function remaining() {
  const r = store.get('_route'); if (!r) return null;
  const left = Math.max(0, r.meters - store.get('_routeProgress'));
  const frac = r.meters ? left / r.meters : 0;
  return { miles: mi2(left / 1609.344), mins: Math.round((r.seconds * frac) / 60), unit: distUnit() };
}
