import * as THREE from 'three';
import { Sky } from 'three/addons/objects/Sky.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/* ------------------------------------------------------------------ *
 *  Conversion plan (pixels du plan RDC) -> mètres. Rue à z=0, fond < 0
 * ------------------------------------------------------------------ */
const S = 0.0343;
const X = px => (px - 375) * S;
const Z = py => (py - 985) * S;
const W = parseInt(new URLSearchParams(location.search).get('w') || 1280);
const H = parseInt(new URLSearchParams(location.search).get('h') || 720);

const yB = -2.8, yG = 0.45, yR = 3.75, yTop = 6.85;
const cB = 0.15, cG = 3.45, cR = 6.55;

const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setSize(W, H); renderer.setPixelRatio(1);
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = .62;
document.body.appendChild(renderer.domElement);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(58, W / H, 0.05, 600);

/* ------------------------------ textures --------------------------- */
function rnd(seed) { let s = seed; return () => (s = (s * 16807) % 2147483647) / 2147483647; }
function canvasTex(w, h, fn, sizeM, srgb = true) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  fn(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(1 / sizeM, 1 / sizeM);
  t.anisotropy = 8;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
function noiseFill(g, w, h, base, amp, seed = 1) {
  const r = rnd(seed); g.fillStyle = base; g.fillRect(0, 0, w, h);
  for (let i = 0; i < w * h / 6; i++) {
    const v = (r() - .5) * amp; g.fillStyle = v > 0 ? `rgba(255,255,255,${v / 255})` : `rgba(0,0,0,${-v / 255})`;
    g.fillRect(r() * w, r() * h, 2, 2);
  }
}
const woodTex = (base, plank, size, seed) => canvasTex(512, 512, (g, w, h) => {
  const r = rnd(seed); const n = Math.round(size / plank);
  for (let i = 0; i < n; i++) {
    const x0 = i * w / n; const k = (r() - .5) * 28;
    g.fillStyle = base; g.fillRect(x0, 0, w / n, h);
    g.fillStyle = `rgba(${k > 0 ? 255 : 0},${k > 0 ? 255 : 0},${k > 0 ? 255 : 0},${Math.abs(k) / 255})`; g.fillRect(x0, 0, w / n, h);
    for (let j = 0; j < 26; j++) { g.strokeStyle = `rgba(40,20,5,${.04 + r() * .06})`; g.beginPath(); const xx = x0 + r() * w / n; g.moveTo(xx, 0); g.lineTo(xx + (r() - .5) * 6, h); g.stroke(); }
    g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(x0, 0, 1.5, h);
    const cut = r() * h; g.fillRect(x0, cut, w / n, 1);
  }
}, size);
const tileTex = (base, size, seed, joint = 'rgba(90,85,75,.5)') => canvasTex(512, 512, (g, w, h) => {
  noiseFill(g, w, h, base, 26, seed);
  const r = rnd(seed + 5);
  for (let i = 0; i < 18; i++) { g.strokeStyle = `rgba(120,110,95,${.05 + r() * .06})`; g.lineWidth = 2 + r() * 3; g.beginPath(); g.moveTo(r() * w, r() * h); g.bezierCurveTo(r() * w, r() * h, r() * w, r() * h, r() * w, r() * h); g.stroke(); }
  g.strokeStyle = joint; g.lineWidth = 3; g.strokeRect(0, 0, w, h);
}, size);
const grassTex = canvasTex(512, 512, (g, w, h) => {
  noiseFill(g, w, h, '#5d8a3a', 60, 7); const r = rnd(11);
  for (let i = 0; i < 4000; i++) { g.strokeStyle = `rgba(${40 + r() * 50},${100 + r() * 70},${30 + r() * 30},.5)`; g.beginPath(); const x = r() * w, y = r() * h; g.moveTo(x, y); g.lineTo(x + (r() - .5) * 6, y - 6 - r() * 6); g.stroke(); }
}, 3);
const pavTex = canvasTex(512, 512, (g, w, h) => {
  noiseFill(g, w, h, '#b9b4aa', 40, 4); g.strokeStyle = 'rgba(70,65,60,.6)'; g.lineWidth = 3;
  for (let i = 0; i <= 4; i++) { g.beginPath(); g.moveTo(0, i * h / 4); g.lineTo(w, i * h / 4); g.stroke(); }
  for (let j = 0; j < 4; j++) for (let i = 0; i <= 2; i++) { const o = (j % 2) * w / 4; g.beginPath(); g.moveTo(i * w / 2 + o, j * h / 4); g.lineTo(i * w / 2 + o, (j + 1) * h / 4); g.stroke(); }
}, 2);
const zelligeTex = canvasTex(512, 512, (g, w, h) => {
  g.fillStyle = '#f1e7d2'; g.fillRect(0, 0, w, h);
  const cols = ['#1f6f78', '#b5532f', '#d9a93b', '#1d3f63'];
  for (let a = 0; a < 2; a++) for (let b = 0; b < 2; b++) {
    const cx = w / 4 + a * w / 2, cy = h / 4 + b * h / 2;
    for (let k = 0; k < 8; k++) { g.save(); g.translate(cx, cy); g.rotate(k * Math.PI / 4); g.fillStyle = cols[k % 2 ? 0 : 1]; g.beginPath(); g.moveTo(0, 0); g.lineTo(26, -70); g.lineTo(0, -110); g.lineTo(-26, -70); g.closePath(); g.fill(); g.restore(); }
    g.fillStyle = cols[2]; g.beginPath(); g.arc(cx, cy, 24, 0, 7); g.fill();
  }
  g.strokeStyle = cols[3]; g.lineWidth = 10; g.strokeRect(5, 5, w - 10, h - 10);
}, 3);
const roofTex = canvasTex(256, 256, (g, w, h) => noiseFill(g, w, h, '#8d8f90', 40, 9), 3);
const concTex = canvasTex(512, 512, (g, w, h) => noiseFill(g, w, h, '#8a8884', 36, 21), 3);
const plasterTex = canvasTex(256, 256, (g, w, h) => noiseFill(g, w, h, '#f1eee8', 10, 3), 2);
const asphaltTex = canvasTex(256, 256, (g, w, h) => noiseFill(g, w, h, '#3a3b3d', 40, 33), 4);

/* ------------------------------ matériaux -------------------------- */
const std = (o) => new THREE.MeshStandardMaterial(o);
const M = {
  plaster: std({ map: plasterTex, color: 0xe6e2d9, roughness: .92 }),
  white: std({ color: 0xe8e5de, roughness: .85 }),
  ceil: std({ color: 0xeeebe4, roughness: .9 }),
  frame: std({ color: 0x1b1d20, roughness: .45, metalness: .6 }),
  glass: new THREE.MeshStandardMaterial({ color: 0xcfe6ee, roughness: .04, metalness: 0, transparent: true, opacity: .16, depthWrite: false }),
  glassTint: new THREE.MeshStandardMaterial({ color: 0x9fc4d0, roughness: .05, transparent: true, opacity: .28, depthWrite: false }),
  oak: std({ map: woodTex('#b98d58', .18, 1.2, 5), roughness: .6 }),
  oakDark: std({ map: woodTex('#6f4a2c', .12, 1.2, 8), roughness: .55 }),
  walnut: std({ color: 0x4a3020, roughness: .5 }),
  deck: std({ map: woodTex('#9a6c42', .14, 1.12, 2), roughness: .7 }),
  slats: std({ color: 0xa87a4c, roughness: .6 }),
  stone: std({ map: tileTex('#bdb3a2', .9, 3), roughness: .35 }),
  tileDark: std({ map: tileTex('#5b5d60', .8, 6, 'rgba(30,30,30,.6)'), roughness: .3 }),
  bathTile: std({ map: tileTex('#c9c2b6', .6, 12), roughness: .3 }),
  concrete: std({ map: concTex, roughness: .8 }),
  roof: std({ map: roofTex, roughness: .9 }),
  grass: std({ map: grassTex, roughness: 1 }),
  paver: std({ map: pavTex, roughness: .85 }),
  asphalt: std({ map: asphaltTex, roughness: .95 }),
  water: new THREE.MeshStandardMaterial({ color: 0x28b6d8, roughness: .08, metalness: .1, transparent: true, opacity: .82, emissive: 0x0a5a78, emissiveIntensity: .35 }),
  poolTile: std({ color: 0x7fd3e6, roughness: .3, emissive: 0x1b5d70, emissiveIntensity: .25 }),
  led: std({ color: 0xffe9c4, emissive: 0xffd9a0, emissiveIntensity: 2.4 }),
  ledCool: std({ color: 0xcfe6ff, emissive: 0xbad8ff, emissiveIntensity: 2.0 }),
  sofa: std({ color: 0xd9d3c7, roughness: .95 }),
  sofaDark: std({ color: 0x3b3f44, roughness: .95 }),
  leather: std({ color: 0x6b4430, roughness: .6 }),
  fabricTeal: std({ color: 0x1f6f78, roughness: .95 }),
  fabricTerra: std({ color: 0x9b4a2c, roughness: .95 }),
  fabricOchre: std({ color: 0xc89a34, roughness: .95 }),
  fabricNavy: std({ color: 0x1d3f63, roughness: .95 }),
  linen: std({ color: 0xece6da, roughness: 1 }),
  rugBeige: std({ color: 0xc9bca6, roughness: 1 }),
  rugGrey: std({ color: 0x8c8f92, roughness: 1 }),
  rugZel: std({ map: zelligeTex, roughness: 1 }),
  brass: std({ color: 0xc79a3c, roughness: .3, metalness: .9 }),
  black: std({ color: 0x151515, roughness: .5, metalness: .3 }),
  chrome: std({ color: 0xcfd2d6, roughness: .15, metalness: 1 }),
  marble: std({ color: 0xf1f0ee, roughness: .12 }),
  marbleDark: std({ color: 0x2b2c2e, roughness: .15 }),
  cab: std({ color: 0xeeeae2, roughness: .35 }),
  cabDark: std({ color: 0x2a2c2f, roughness: .4 }),
  felt: std({ color: 0x1d6b43, roughness: 1 }),
  leaf: std({ color: 0x3f7d33, roughness: .8, side: THREE.DoubleSide }),
  leaf2: std({ color: 0x2e6b2a, roughness: .8 }),
  leaf3: std({ color: 0x6fa13a, roughness: .8 }),
  trunk: std({ color: 0x6b5236, roughness: 1 }),
  soil: std({ color: 0x5a4430, roughness: 1 }),
  pot: std({ color: 0xd9d3c7, roughness: .7 }),
  carBody: std({ color: 0x2c3a4a, roughness: .25, metalness: .7 }),
  tire: std({ color: 0x111111, roughness: .9 }),
  screen: std({ color: 0x0b0d10, roughness: .2, metalness: .5 }),
  screenOn: std({ color: 0x1b3550, emissive: 0x3a6a9a, emissiveIntensity: .9 }),
  mirror: std({ color: 0x4a5258, roughness: .25, metalness: .3 }),
  bedding: std({ color: 0xf2efe9, roughness: 1 }),
  bedAccent: std({ color: 0x9aa8a0, roughness: 1 }),
  towel: std({ color: 0xe6e2da, roughness: 1 }),
  porcelain: std({ color: 0xfafafa, roughness: .1 }),
  curtain: std({ color: 0xe9e3d6, roughness: 1, transparent: true, opacity: .85, side: THREE.DoubleSide }),
  sky: std({ color: 0xffffff }),
};

/* ------------------- accumulateur de géométrie fusionnée ------------ */
const buckets = { main: new Map(), roof: new Map() };
let group = 'main';
let CM = new THREE.Matrix4(); const stack = [];
const _m = new THREE.Matrix4();
function pushFrame(x, y, z, rot = 0) { stack.push(CM.clone()); CM = CM.clone().multiply(_m.makeTranslation(x, y, z)).multiply(new THREE.Matrix4().makeRotationY(rot)); }
function popFrame() { CM = stack.pop(); }
function frame(x, y, z, rot, fn) { pushFrame(x, y, z, rot); fn(); popFrame(); }
function addGeo(mat, g) {
  g.applyMatrix4(CM);
  // uv monde (mètres)
  const p = g.attributes.position, n = g.attributes.normal, uv = g.attributes.uv;
  for (let i = 0; i < p.count; i++) {
    const ax = Math.abs(n.getX(i)), ay = Math.abs(n.getY(i)), az = Math.abs(n.getZ(i));
    if (ay >= ax && ay >= az) uv.setXY(i, p.getX(i), p.getZ(i));
    else if (ax >= az) uv.setXY(i, p.getZ(i), p.getY(i));
    else uv.setXY(i, p.getX(i), p.getY(i));
  }
  const b = buckets[group]; if (!b.has(mat)) b.set(mat, []);
  b.get(mat).push(g.index ? g.toNonIndexed() : g);
}
function bx(mat, x0, y0, z0, x1, y1, z1) {
  if (x1 - x0 < 1e-4 || y1 - y0 < 1e-4 || z1 - z0 < 1e-4) return;
  const g = new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0);
  g.translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2); addGeo(mat, g);
}
// boîte centrée (cx,cy,cz) taille (sx,sy,sz)
const bc = (mat, cx, cy, cz, sx, sy, sz) => bx(mat, cx - sx / 2, cy - sy / 2, cz - sz / 2, cx + sx / 2, cy + sy / 2, cz + sz / 2);
function cyl(mat, cx, y0, cz, r, h, seg = 20, r2 = r) { const g = new THREE.CylinderGeometry(r2, r, h, seg); g.translate(cx, y0 + h / 2, cz); addGeo(mat, g); }
function sph(mat, cx, cy, cz, r, sx = 1, sy = 1, sz = 1, seg = 12) { const g = new THREE.SphereGeometry(r, seg, seg - 2); g.scale(sx, sy, sz); g.translate(cx, cy, cz); addGeo(mat, g); }
function ico(mat, cx, cy, cz, r, sy = 1) { const g = new THREE.IcosahedronGeometry(r, 1); g.scale(1, sy, 1); g.translate(cx, cy, cz); addGeo(mat, g); }

/* dalle extrudée depuis un polygone (px) avec trous éventuels (px) */
function slabPoly(mat, pts, holes, y0, y1) {
  const sh = new THREE.Shape(pts.map(([a, b]) => new THREE.Vector2(X(a), Z(b))));
  for (const hp of holes || []) sh.holes.push(new THREE.Path(hp.map(([a, b]) => new THREE.Vector2(X(a), Z(b)))));
  const g = new THREE.ExtrudeGeometry(sh, { depth: y1 - y0, bevelEnabled: false });
  g.rotateX(Math.PI / 2); g.translate(0, y1, 0); addGeo(mat, g);
}
const rect = (a, b, c, d) => [[a, b], [c, b], [c, d], [a, d]];
const slabRect = (mat, a, b, c, d, y0, y1, holes) => slabPoly(mat, rect(a, b, c, d), holes, y0, y1);

/* ------------------------- murs avec ouvertures --------------------- */
// ax='x' : mur le long de x (z fixe) ; ax='z' : mur le long de z (x fixe). Valeurs en mètres.
function wall(ax, c, a0, b0, y0, y1, t, mat, ops = [], ext = true) {
  const h = t / 2; let a = a0, b = b0; if (ext) { a -= h; b += h; }
  ops = ops.map(o => ({ ...o })).sort((p, q) => p.a - q.a);
  const piece = (u0, u1, v0, v1, m = mat) => { if (u1 - u0 < 1e-3 || v1 - v0 < 1e-3) return; ax === 'x' ? bx(m, u0, v0, c - h, u1, v1, c + h) : bx(m, c - h, v0, u0, c + h, v1, u1); };
  let cur = a;
  for (const o of ops) {
    piece(cur, o.a, y0, y1);
    const sill = y0 + (o.s ?? 0), top = y0 + (o.h ?? 2.4);
    piece(o.a, o.b, y0, sill); piece(o.a, o.b, top, y1);
    if (o.k === 'glass' || o.k === 'win') glazing(ax, c, o.a, o.b, sill, top, o.k === 'win');
    else if (o.k === 'door') { piece(o.a, o.b, top - .0, top, M.frame); }
    cur = o.b;
  }
  piece(cur, b, y0, y1);
}
function glazing(ax, c, a, b, y0, y1, win) {
  const w = b - a, n = Math.max(1, Math.ceil(w / (win ? 1.3 : 1.7))), f = .05;
  const P = (u0, u1, v0, v1, m, d = f / 2) => ax === 'x' ? bx(m, u0, v0, c - d, u1, v1, c + d) : bx(m, c - d, v0, u0, c + d, v1, u1);
  P(a, b, y1 - f, y1, M.frame, .06); P(a, b, y0, y0 + f, M.frame, .06);
  for (let i = 0; i <= n; i++) { const u = a + w * i / n; P(u - f / 2, u + f / 2, y0, y1, M.frame, .06); }
  P(a, b, y0 + f, y1 - f, M.glass, .008);
  if (win) P(a, b, y0 - .03, y0 + .0, M.white, .15);
}
const wallH = (pyc, pxa, pxb, y0, y1, t, mat, ops = [], ext = true) => wall('x', Z(pyc), X(pxa), X(pxb), y0, y1, t, mat, ops.map(o => ({ ...o, a: X(o.a), b: X(o.b) })), ext);
const wallV = (pxc, pya, pyb, y0, y1, t, mat, ops = [], ext = true) => wall('z', X(pxc), Z(pya), Z(pyb), y0, y1, t, mat, ops.map(o => ({ ...o, a: Z(o.a), b: Z(o.b) })), ext);

/* ---------------------------- éclairage ---------------------------- */
const roomLights = []; // positions de lumières pour interieurs
const lamp = (x, y, z, c = 0xffd9a8, i = 1) => roomLights.push({ p: new THREE.Vector3(x, y, z), c, i });

/* downlights au plafond (grille) sur rectangle px à hauteur y */
function downlights(a, b, c, d, y, step = 2.2, mat = M.led) {
  const x0 = X(a), x1 = X(c), z0 = Z(b), z1 = Z(d);
  const nx = Math.max(1, Math.round((x1 - x0) / step)), nz = Math.max(1, Math.round((z1 - z0) / step));
  for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) cyl(mat, x0 + (i + .5) * (x1 - x0) / nx, y - .02, z0 + (j + .5) * (z1 - z0) / nz, .07, .02, 12);
}
/* LED en gorge le long des murs d'un rectangle */
function coveLED(a, b, c, d, y, mat = M.led) {
  const x0 = X(a) + .25, x1 = X(c) - .25, z0 = Z(b) + .25, z1 = Z(d) - .25, t = .05;
  bx(mat, x0, y - .08, z0, x1, y - .03, z0 + t); bx(mat, x0, y - .08, z1 - t, x1, y - .03, z1);
  bx(mat, x0, y - .08, z0, x0 + t, y - .03, z1); bx(mat, x1 - t, y - .08, z0, x1, y - .03, z1);
}

/* ===================================================================
 *                        MOBILIER (repère local, mètres)
 * ================================================================= */
function sofa(len = 2.6, depth = .95, mat = M.sofa, seatY = 0, rot = 0, x = 0, z = 0, y0 = 0) {
  frame(x, y0, z, rot, () => {
    bc(M.black, 0, .08, 0, len - .1, .1, depth - .1);
    bc(mat, 0, .3, .05, len, .3, depth - .1);                // assise
    bc(mat, 0, .62, -depth / 2 + .15, len, .5, .26);          // dossier
    bc(mat, -len / 2 + .12, .45, 0, .24, .42, depth);         // accoudoirs
    bc(mat, len / 2 - .12, .45, 0, .24, .42, depth);
    const n = Math.round(len / .85);
    for (let i = 0; i < n; i++) { bc(M.linen, -len / 2 + .12 + (i + .5) * (len - .24) / n, .5, .08, (len - .24) / n - .03, .14, depth - .3); }
    bc(M.fabricTerra, -len / 2 + .38, .62, .0, .42, .38, .12); bc(M.sofaDark, len / 2 - .38, .62, .0, .42, .38, .12);
  });
}
function armchair(x, z, rot, y0 = 0, mat = M.leather) { frame(x, y0, z, rot, () => { bc(M.black, 0, .2, 0, .7, .25, .7); bc(mat, 0, .38, .03, .74, .22, .68); bc(mat, 0, .62, -.3, .74, .5, .15); bc(mat, -.34, .5, 0, .12, .3, .68); bc(mat, .34, .5, 0, .12, .3, .68); }); }
function table(x, z, w, d, h, mat = M.oak, y0 = 0, rot = 0, legs = M.black) {
  frame(x, y0, z, rot, () => { bc(mat, 0, h - .03, 0, w, .06, d); const lx = w / 2 - .1, lz = d / 2 - .1; for (const sx of [-1, 1]) for (const sz of [-1, 1]) bc(legs, sx * lx, (h - .06) / 2, sz * lz, .06, h - .06, .06); });
}
function coffeeTable(x, z, r = .5, h = .38, y0 = 0, mat = M.marble) { cyl(mat, x, y0 + h - .04, z, r, .04, 28); cyl(M.black, x, y0, z, .05, h - .04, 8); cyl(M.black, x, y0, z, r * .55, .02, 20); }
function chair(x, z, rot, y0 = 0, mat = M.oakDark) {
  frame(x, y0, z, rot, () => { bc(mat, 0, .45, 0, .44, .05, .44); bc(mat, 0, .78, -.2, .44, .6, .04); for (const sx of [-1, 1]) for (const sz of [-1, 1]) bc(M.black, sx * .19, .22, sz * .19, .035, .44, .035); bc(M.linen, 0, .49, 0, .4, .04, .4); });
}
function stool(x, z, y0 = 0, h = .75) { cyl(M.black, x, y0, z, .03, h, 8); cyl(M.leather, x, y0 + h, z, .2, .06, 18); cyl(M.black, x, y0, z, .17, .02, 16); cyl(M.chrome, x, y0 + h * .3, z, .15, .015, 16); }
function pouf(x, z, y0, r = .28, mat = M.fabricOchre) { cyl(mat, x, y0, z, r, r * 1.1, 18); cyl(M.brass, x, y0 + r * 1.1, z, r * .88, .015, 18); }
function plant(x, z, y0 = 0, s = 1) { cyl(M.pot, x, y0, z, .22 * s, .45 * s, 14, .18 * s); for (let i = 0; i < 6; i++) { const a = i * 1.05; ico(M.leaf2, x + Math.cos(a) * .18 * s, y0 + .85 * s + (i % 3) * .18 * s, z + Math.sin(a) * .18 * s, .26 * s, 1.5); } ico(M.leaf3, x, y0 + 1.25 * s, z, .3 * s, 1.2); }
function floorLamp(x, z, y0 = 0, h = 1.6) { cyl(M.black, x, y0, z, .13, .02, 12); cyl(M.black, x, y0, z, .012, h, 6); cyl(M.led, x, y0 + h - .1, z, .17, .24, 16, .1); }
function pendantRound(x, yc, z, r = .3, drop = 1.2) { cyl(M.black, x, yc - drop, z, .004, drop, 4); sph(M.led, x, yc - drop, z, r, 1, .8, 1, 14); }
function pendantLinear(x, yc, z, len = 1.6, rot = 0, drop = 1.0) { frame(x, 0, z, rot, () => { bc(M.black, 0, yc - drop, 0, len, .035, .05); bc(M.led, 0, yc - drop - .02, 0, len - .06, .018, .04); bc(M.black, -len / 2 + .1, yc - drop / 2, 0, .004, drop, .004); bc(M.black, len / 2 - .1, yc - drop / 2, 0, .004, drop, .004); }); }
function rug(x, z, w, d, mat = M.rugBeige, y0 = 0, rot = 0) { frame(x, y0, z, rot, () => bc(mat, 0, .012, 0, w, .024, d)); }
function tv(x, y, z, rot, w = 1.6) { frame(x, y, z, rot, () => { bc(M.screen, 0, 0, 0, w, w * .56, .04); bc(M.screenOn, 0, 0, .021, w - .06, w * .56 - .06, .004); }); }
function bed(x, z, rot, y0, w = 1.9, mat = M.bedding, accent = M.bedAccent) {
  frame(x, y0, z, rot, () => {
    bc(M.oakDark, 0, .15, .05, w + .1, .3, 2.15);
    bc(M.walnut, 0, .65, -1.07, w + .5, 1.3, .12);                     // tête de lit
    bc(mat, 0, .42, .08, w, .24, 2.0);
    bc(accent, 0, .56, .5, w + .02, .04, 1.0);
    for (const sx of [-.5, .5]) { bc(M.linen, sx * (w / 2 - .0), .56, -.78, .75, .17, .45); bc(accent, sx * .5 * 1.0, .63, -.6, .6, .3, .1); }
    bc(M.oakDark, -(w / 2 + .45), .27, -.85, .45, .54, .4); bc(M.oakDark, w / 2 + .45, .27, -.85, .45, .54, .4);
    cyl(M.led, -(w / 2 + .45), .54, -.85, .06, .26, 10); cyl(M.led, w / 2 + .45, .54, -.85, .06, .26, 10);
  });
}
function wardrobe(x, z, w, h, rot, y0, mat = M.cab, d = .6) { frame(x, y0, z, rot, () => { bc(mat, 0, h / 2, 0, w, h, d); const n = Math.round(w / .5); for (let i = 1; i < n; i++) bc(M.black, -w / 2 + i * w / n, h / 2, d / 2 + .003, .006, h - .1, .004); for (let i = 0; i < n; i++) bc(M.brass, -w / 2 + (i + .5) * w / n + .06, h / 2, d / 2 + .01, .015, .5, .015); }); }
function kitchenRun(x, z, len, rot, y0, upper = true) {
  frame(x, y0, z, rot, () => {
    bc(M.cabDark, 0, .43, 0, len, .86, .62);
    bc(M.marble, 0, .9, .02, len + .02, .04, .66);
    const n = Math.round(len / .6); for (let i = 1; i < n; i++) bc(M.black, -len / 2 + i * len / n, .43, .312, .005, .8, .004);
    if (upper) { bc(M.cab, 0, 1.95, -.1, len, .9, .36); bc(M.marble, 0, 1.45, -.14, len, .02, .3); for (let i = 1; i < n; i++) bc(M.cabDark, -len / 2 + i * len / n, 1.95, .082, .005, .86, .004); }
  });
}
function bathtub(x, z, rot, y0) { frame(x, y0, z, rot, () => { bc(M.porcelain, 0, .3, 0, 1.7, .55, .8); bc(M.towel, 0, .5, 0, 1.45, .06, .55); cyl(M.chrome, .6, .55, 0, .02, .45, 8); }); }
function toilet(x, z, rot, y0) { frame(x, y0, z, rot, () => { bc(M.porcelain, 0, .2, .1, .38, .4, .55); bc(M.porcelain, 0, .55, -.2, .4, .5, .18); bc(M.chrome, 0, .78, -.1, .12, .02, .03); }); }
function vanity(x, z, len, rot, y0, dbl = true) {
  frame(x, y0, z, rot, () => {
    bc(M.oakDark, 0, .35, 0, len, .5, .5); bc(M.marble, 0, .62, 0, len + .02, .04, .54);
    const n = dbl ? 2 : 1; for (let i = 0; i < n; i++) { const px = (i - (n - 1) / 2) * len / n; cyl(M.porcelain, px, .64, 0, .2, .1, 20); cyl(M.chrome, px, .64, -.2, .015, .25, 8); bc(M.mirror, px, 1.45, -.24, len / n - .1, 1.1, .02); bc(M.led, px, 1.45, -.25, len / n - .02, 1.14, .005); }
  });
}
function shower(x, z, w, d, rot, y0, h = 2.1) { frame(x, y0, z, rot, () => { bc(M.bathTile, 0, .02, 0, w, .04, d); bc(M.glassTint, w / 2, h / 2, 0, .02, h, d); bc(M.glassTint, 0, h / 2, d / 2, w, h, .02); cyl(M.chrome, -w / 2 + .1, h - .3, -d / 2 + .15, .015, .3, 8); cyl(M.chrome, -w / 2 + .1, h - .3, -d / 2 + .1, .09, .015, 14); }); }
function lounger(x, z, rot, y0) { frame(x, y0, z, rot, () => { bc(M.black, 0, .22, 0, .66, .06, 1.9); bc(M.linen, 0, .28, .2, .62, .1, 1.1); bc(M.linen, 0, .42, -.62, .62, .1, .8); for (const sx of [-.3, .3]) for (const sz of [-.85, .85]) bc(M.black, sx, .1, sz, .04, .2, .04); }); }
function parasol(x, z, y0, r = 1.4) { cyl(M.black, x, y0, z, .025, 2.4, 8); const g = new THREE.ConeGeometry(r, .5, 16); g.translate(x, y0 + 2.4 + .25, z); addGeo(M.linen, g); }
function lantern(x, yc, z, s = 1, drop = .7) { cyl(M.black, x, yc - drop, z, .004, drop, 4); cyl(M.brass, x, yc - drop - .45 * s, z, .16 * s, .5 * s, 8, .08 * s); cyl(M.led, x, yc - drop - .4 * s, z, .1 * s, .36 * s, 8); }
function arch(x, y0, z, rot, w, h, mat = M.sofa) { frame(x, y0, z, rot, () => { bc(mat, -w / 2 - .05, h / 2, 0, .1, h, .08); bc(mat, w / 2 + .05, h / 2, 0, .1, h, .08); bc(mat, 0, h + .05, 0, w + .2, .1, .08); }); }
function lattice(x, y0, z, rot, w, h) { frame(x, y0, z, rot, () => { bc(M.walnut, 0, h - .03, 0, w, .06, .08); bc(M.walnut, 0, .03, 0, w, .06, .08); const nx = Math.round(w / .1), ny = Math.round(h / .1); for (let i = 0; i <= nx; i++) bc(M.walnut, -w / 2 + i * w / nx, h / 2, 0, .02, h, .03); for (let j = 0; j <= ny; j++) bc(M.walnut, 0, j * h / ny, 0, w, .02, .03); }); }
function palm(x, z, h = 6, y0 = 0) {
  const lean = (Math.sin(x * 3.1 + z) * .5);
  for (let i = 0; i < 9; i++) { const t = i / 8; cyl(M.trunk, x + lean * t * t * 1.2, y0 + t * h * .9, z, .22 - .07 * t, h * .125, 8, .24 - .07 * t); }
  const cx = x + lean * 1.2, cy = y0 + h * .92;
  for (let k = 0; k < 12; k++) {
    frame(cx, cy, z, k * Math.PI * 2 / 12 + .3, () => {
      for (let j = 1; j <= 6; j++) { const r = j * .5; sph(M.leaf, 0, .35 - j * j * .045, r, .42, .55, .09, 1.0, 8); }
    });
  }
  ico(M.leaf2, cx, cy + .1, z, .35, .7);
}
function roundTree(x, z, h = 4, r = 1.6, mat = M.leaf2) { cyl(M.trunk, x, 0, z, .12, h * .55, 8, .16); ico(mat, x, h * .72, z, r, .9); ico(M.leaf3, x + r * .4, h * .8, z + r * .2, r * .7, .8); ico(mat, x - r * .5, h * .65, z - r * .2, r * .65, .8); }
function shrub(x, z, r = .6, mat = M.leaf2) { ico(mat, x, r * .6, z, r, .75); ico(M.leaf3, x + r * .5, r * .5, z + r * .2, r * .6, .7); }
function car(x, z, rot) {
  frame(x, 0, z, rot, () => {
    bc(M.carBody, 0, .55, 0, 1.85, .55, 4.6); bc(M.carBody, 0, 1.0, -.15, 1.7, .5, 2.4); bc(M.glassTint, 0, 1.02, -.15, 1.72, .38, 2.2);
    for (const sx of [-.9, .9]) for (const sz of [-1.4, 1.4]) { cyl(M.tire, sx, .0, sz, .34, .22, 16); }
    bc(M.led, -.7, .6, 2.31, .4, .12, .02); bc(M.led, .7, .6, 2.31, .4, .12, .02);
  });
}

/* ===================================================================
 *                 ENVIRONNEMENT: terrain, rue, clôture, jardin
 * ================================================================= */
function buildSite() {
  // terrain avec trous (cour anglaise + piscine)
  const outer = new THREE.Shape([[-60, 60], [90, 60], [90, -90], [-60, -90]].map(([x, z]) => new THREE.Vector2(x, z)));
  const hole = (a, b, c, d) => new THREE.Path([[a, b], [c, b], [c, d], [a, d]].map(([p, q]) => new THREE.Vector2(X(p), Z(q))));
  outer.holes.push(hole(450, 515, 540, 816)); outer.holes.push(hole(537, 235, 788, 327));
  const g = new THREE.ShapeGeometry(outer); g.rotateX(Math.PI / 2); // (x, z) -> y=0 plan ; normal vers le haut après flip
  // ShapeGeometry normal +z; rotateX(+90) -> normal -y ; on inverse l'enroulement
  const idx = g.index.array; for (let i = 0; i < idx.length; i += 3) { const t = idx[i + 1]; idx[i + 1] = idx[i + 2]; idx[i + 2] = t; }
  g.computeVertexNormals();
  const pos = g.attributes.position, uv = g.attributes.uv; for (let i = 0; i < pos.count; i++) uv.setXY(i, pos.getX(i), pos.getZ(i));
  const grass = new THREE.Mesh(g, M.grass); grass.receiveShadow = true; scene.add(grass);
  // rue (voie de 18 m) + trottoir
  const street = new THREE.Mesh(new THREE.PlaneGeometry(400, 18), M.asphalt); street.rotation.x = -Math.PI / 2; street.position.set(10, .01, 9.5 + 5); street.receiveShadow = true; scene.add(street);
  bx(M.paver, -60, 0, 1.0, 90, .09, 3.0);
  // dalles de stationnement
  bx(M.paver, X(960), 0, Z(985) - 0, X(1118), .04, Z(668));
  // clôture / murets
  const hh = 1.9, t = .25;
  wall('z', X(375), Z(108), Z(985), 0, hh, t, M.plaster);
  wall('z', X(1118), Z(108), Z(985), 0, hh, t, M.plaster);
  wall('x', Z(108), X(375), X(1118), 0, hh, t, M.plaster);
  // façade rue avec portillon et portail
  wall('x', Z(985), X(375), X(740), 0, hh, t, M.plaster);
  wall('x', Z(985), X(800), X(960), 0, hh, t, M.plaster);
  wall('x', Z(985), X(1100), X(1118), 0, hh, t, M.plaster);
  // portail véhicule en lames de bois
  for (let i = 0; i < 24; i++) bx(M.slats, X(960) + i * (X(1100) - X(960)) / 24, 0, Z(985) - .06, X(960) + (i + .8) * (X(1100) - X(960)) / 24, 1.8, Z(985) + .06);
  bx(M.frame, X(960), 1.8, Z(985) - .08, X(1100), 1.9, Z(985) + .08);
  bx(M.slats, X(740), 0, Z(985) - .05, X(800), 1.9, Z(985) + .05); // portillon
  for (let i = 0; i < 12; i++) bx(M.led, X(745) + i * .17, 1.7, Z(985) - .07, X(745) + i * .17 + .02, 1.88, Z(985) - .06);
  // enseigne numéro
  bx(M.frame, X(805), 1.2, Z(985) - .14, X(830), 1.5, Z(985) - .12);
  // pelouse: allée dallée vers le hall
  // marches d'entrée en bois (plan) : 4 grandes marches
  const steps = [[728, 935, 800, 965, .1], [735, 900, 802, 935, .2], [738, 870, 805, 900, .3], [727, 838, 797, 870, .4]];
  steps.forEach(([a, b, c, d, h]) => bx(M.deck, X(a), 0, Z(b), X(c), h + .01, Z(d)));
  bx(M.deck, X(720), 0, Z(808), X(800), .45, Z(838));
  // pas japonais bois vers côté
  for (let i = 0; i < 4; i++) bx(M.deck, X(820 + i * 32), 0, Z(930), X(840 + i * 32), .04, Z(880));
  // pelouse extérieure: haies & arbres
  palm(X(425), Z(150), 7.5); palm(X(430), Z(215), 6.2);
  for (let i = 0; i < 9; i++) shrub(X(565 + i * 62), Z(135 + (i % 3) * 14), .8 + (i % 4) * .15, i % 2 ? M.leaf2 : M.leaf3);
  roundTree(X(1065), Z(250), 5.5, 2.0, M.leaf2); roundTree(X(1075), Z(180), 4.5, 1.6, M.leaf3);
  palm(X(1090), Z(120), 7);
  for (let i = 0; i < 6; i++) shrub(X(400 + i * 55), Z(950), .55);
  roundTree(X(412), Z(900), 3.4, 1.2); roundTree(X(940), Z(930), 3.0, 1.0, M.leaf3); roundTree(X(1000), Z(40 + 690), 3.2, 1.1);
  for (let i = 0; i < 5; i++) shrub(X(870 + i * 40), Z(955), .5, M.leaf3);
  car(X(1030), Z(790), 0);
  // arbres de rue
  for (let i = -3; i < 6; i++) roundTree(-6 + i * 14, 3.6, 5, 2.0, i % 2 ? M.leaf2 : M.leaf3);
  // villas voisines (volumes simples)
  const nb = (x0, z0, w, d, h, c) => { bx(M.plaster, x0, 0, z0, x0 + w, h, z0 + d); bx(M.roof, x0 - .2, h, z0 - .2, x0 + w + .2, h + .3, z0 + d + .2); for (let i = 0; i < 4; i++) bx(M.glassTint, x0 + 1 + i * (w - 2) / 4, 1, z0 + d - .01, x0 + 1 + i * (w - 2) / 4 + 1.4, 2.4, z0 + d + .01); };
  nb(-24, -22, 11, 12, 6.8); nb(-24, -52, 11, 14, 5.2); nb(X(1118) + 6, -20, 12, 12, 7); nb(X(1118) + 6, -48, 12, 12, 6);
  // piscine: bassin
  const px0 = X(537), px1 = X(788), pz0 = Z(235), pz1 = Z(327);
  bx(M.poolTile, px0, -1.6, pz0, px1, -1.55, pz1);
  bx(M.poolTile, px0 - .1, -1.6, pz0 - .1, px0, 0, pz1 + .1); bx(M.poolTile, px1, -1.6, pz0 - .1, px1 + .1, 0, pz1 + .1);
  bx(M.poolTile, px0, -1.6, pz0 - .1, px1, 0, pz0); bx(M.poolTile, px0, -1.6, pz1, px1, 0, pz1 + .1);
  bx(M.stone, px0 - .35, .0, pz0 - .35, px1 + .35, .06, pz0 - .0 + .0); // margelles
  bx(M.stone, px0 - .35, .0, pz1, px1 + .35, .06, pz1 + .35);
  bx(M.stone, px0 - .35, .0, pz0, px0, .06, pz1); bx(M.stone, px1, .0, pz0, px1 + .35, .06, pz1);
  bx(M.led, px0 + 1, -.8, pz1 - .01, px1 - 1, -.7, pz1 + .0);
  // deck bois sur le coté sud de la piscine (6 plateaux)
  for (let i = 0; i < 6; i++) bx(M.deck, X(537 + i * 42), 0, Z(342), X(537 + i * 42 + 38), .05, Z(330));
  // eau (mesh séparé plus bas)
  // terrasse en bois (RDC)
  bx(M.deck, X(535), 0, Z(515), X(795), yG, Z(373));
  // lames de la terrasse : rainures
  for (let i = 1; i < 40; i++) bx(M.black, X(535) + i * (X(795) - X(535)) / 40, yG, Z(515), X(535) + i * (X(795) - X(535)) / 40 + .012, yG + .005, Z(373));
  // cour anglaise : sol, murs de soutènement, escalier
  const cx0 = X(450), cx1 = X(540), cz0 = Z(515), cz1 = Z(816);
  bx(M.stone, cx0, yB - .3, cz0, cx1, yB, cz1);
  bx(M.concrete, cx0 - .3, yB - .3, cz0, cx0, 0, cz1 + .3); bx(M.concrete, cx0 - .3, yB - .3, cz1, cx1 + .3, 0, cz1 + .3);
  bx(M.concrete, cx0 - .3, yB - .3, cz0 - .3, cx1, 0, cz0);
  // escalier extérieur descendant vers la cour (bord ouest, du nord vers le sud)
  const nSt = 15, sx0 = X(455), sx1 = X(487), run = .28, rise = (0 - yB) / nSt;
  // (hauteur marche i : de yB à  -i*rise) -> corrigé ci-dessous
  // jardin dans la cour
  for (let i = 0; i < 3; i++) { bx(M.soil, X(497), yB, Z(640 + i * 60), X(535), yB + .25, Z(640 + i * 60 - 40)); }
  palm(X(515), Z(690), 4.2, yB); plant(X(500), Z(790), yB, 1.2); plant(X(520), Z(560), yB, 1.0); shrub(X(508), Z(745), .45); shrub(X(505), Z(600), .4);
  bx(M.led, cx0 + .02, yB + .3, cz0 + 1, cx0 + .05, yB + .38, cz1 - .2);
  // mobilier terrasse
  table(X(655), Z(430), 2.6, 1.0, .75, M.oakDark, yG);
  for (let i = 0; i < 4; i++) { chair(X(655) + (-.9 + i * .6), Z(430) - .8, 0, yG); chair(X(655) + (-.9 + i * .6), Z(430) + .8, Math.PI, yG); }
  chair(X(655) - 1.5, Z(430), Math.PI / 2, yG); chair(X(655) + 1.5, Z(430), -Math.PI / 2, yG);
    sofa(2.4, .9, M.sofaDark, 0, Math.PI, X(645), Z(482), yG); sofa(2.0, .9, M.sofaDark, 0, Math.PI / 2, X(560), Z(450), yG);
  coffeeTable(X(645), Z(465), .42, .35, yG);
  rug(X(645), Z(470), 3.0, 2.2, M.rugGrey, yG);
  plant(X(545), Z(380), yG, 1.4);
  // transats autour de la piscine
  for (let i = 0; i < 3; i++) lounger(X(600 + i * 60), Z(352), 0, 0.05);
  parasol(X(690), Z(352), 0.05, 1.7);
  lounger(X(820), Z(280), Math.PI / 2, 0); lounger(X(820), Z(250), Math.PI / 2, 0);
  // éclairage extérieur / bornes
  for (let i = 0; i < 6; i++) { cyl(M.frame, X(420 + i * 8), 0, Z(960 - i * 0), .05, .5, 8); }
}

/* ===================================================================
 *                         SOUS-SOL
 * ================================================================= */
function buildBasement() {
  const t = .3;
  // sol
  slabPoly(M.tileDark, [[543, 515], [795, 515], [795, 378], [958, 378], [958, 825], [795, 825], [795, 808], [543, 808]], null, yB - .3, yB);
  // dalle haute (plancher RDC) 0.15 -> 0.45
  slabPoly(M.ceil, [[543, 515], [795, 515], [795, 378], [958, 378], [958, 825], [795, 825], [795, 808], [543, 808]], null, cB, yG);
  // enveloppe
  const a = yB, b = cB;
  wallV(543, 515, 808, a, b, t, M.concrete, [{ a: 522, b: 598, s: 0, h: 2.92, k: 'glass' }, { a: 598, b: 645, s: 0, h: 2.3, k: 'door' }, { a: 645, b: 802, s: 0, h: 2.92, k: 'glass' }]);
  wallH(515, 543, 795, a, b, t, M.plaster);
  wallV(795, 378, 515, a, b, t, M.plaster);
  wallH(378, 795, 958, a, b, t, M.plaster);
  wallV(958, 378, 825, a, b, t, M.plaster);
  wallH(825, 795, 958, a, b, t, M.plaster);
  wallV(795, 808, 825, a, b, t, M.plaster);
  wallH(808, 543, 795, a, b, t, M.plaster);
  // cloisons
  wallV(830, 517, 817, a, b, .15, M.white, [{ a: 530, b: 565, s: 0, h: 2.2, k: 'door' }, { a: 690, b: 722, s: 0, h: 2.2, k: 'door' }]);
  wallH(517, 830, 958, a, b, .15, M.white, []);
  wallH(577, 830, 958, a, b, .15, M.white, [{ a: 840, b: 870, s: 0, h: 2.2, k: 'door' }]);
  wallH(678, 830, 958, a, b, .15, M.white, []);
  wallV(782, 695, 792, a, b, .15, M.white, [{ a: 705, b: 735, s: 0, h: 2.2, k: 'door' }]);
  wallH(695, 720, 782, a, b, .15, M.white, []);
  wallH(792, 720, 782, a, b, .15, M.white, []);
  wallV(720, 695, 792, a, b, .15, M.white, [{ a: 705, b: 735, s: 0, h: 2.2, k: 'door' }]);
  // plafond rainuré : LED
  // éclairage
  downlights(548, 520, 790, 685, cB, 2.0); downlights(548, 690, 690, 805, cB, 1.8); downlights(795, 395, 930, 512, cB, 2.0);
  downlights(832, 585, 955, 675, cB, 2.0); downlights(832, 682, 955, 820, cB, 2.0); downlights(795, 520, 828, 810, cB, 2.0);
  coveLED(548, 520, 790, 685, cB); coveLED(795, 395, 930, 512, cB);
  [[650, 600], [740, 600], [620, 745], [880, 450], [900, 750], [900, 550], [810, 650]].forEach(([p, q]) => lamp(X(p), 2.0 + yB + .5, Z(q), 0xffdcae, 1));

  /* --- Salon sous-sol --- */
  rug(X(640), Z(595), 4.4, 3.2, M.rugGrey, yB);
  sofa(3.4, 1.0, M.sofaDark, 0, Math.PI, X(640), Z(640), yB);
  sofa(2.2, .95, M.sofa, 0, Math.PI / 2, X(562), Z(540), yB);
  coffeeTable(X(640), Z(610), .55, .38, yB);
  // mur TV (nord du salon)
  bx(M.walnut, X(600), yB, Z(517), X(720), yB + 2.6, Z(517) + .1);
  tv(X(660), yB + 1.55, Z(517) + .14, 0, 2.0);
  bx(M.oakDark, X(600), yB + .2, Z(517) + .1, X(720), yB + .5, Z(517) + .5);
  bx(M.led, X(600), yB + .5, Z(517) + .1, X(720), yB + .52, Z(517) + .45);
  armchair(X(720), Z(600), -Math.PI / 2 - .4, yB); armchair(X(740), Z(570), -Math.PI / 2 + .4, yB, M.leather);
  floorLamp(X(570), Z(535), yB); plant(X(775), Z(535), yB, 1.2);
  /* --- Cuisine ouverte + bar --- */
  kitchenRun(X(620), Z(805) - .45, 5.6, 0, yB);
  bx(M.marble, X(545), yB, Z(805) - 1.2, X(552), yB + .9, Z(805));
  // îlot / bar
  frame(X(597), yB, Z(667), 0, () => {
    bc(M.cabDark, 0, .45, 0, 3.6, .9, 1.0); bc(M.marble, 0, .93, .1, 3.7, .06, 1.35); bc(M.led, 0, .06, .52, 3.4, .03, .02);
    bc(M.cabDark, 0, 1.03, -.3, 3.6, .15, .02);
  });
  for (let i = 0; i < 5; i++) stool(X(597) - 1.4 + i * .7, Z(667) + .95, yB, .78);
  for (let i = 0; i < 3; i++) pendantRound(X(597) - 1.1 + i * 1.1, cB, Z(667), .2, 0.8);
  // hotte, électroménagers
  bx(M.chrome, X(560), yB + 1.9, Z(808) - .35, X(620), yB + 2.4, Z(808) - .05);
  bx(M.chrome, X(680), yB, Z(808) - .65, X(712), yB + 2.05, Z(808) - .05); // frigo US
  // table à manger
  table(X(690), Z(745), 2.0, .95, .75, M.oakDark, yB);
  for (let i = 0; i < 3; i++) { chair(X(690) - .6 + i * .6, Z(745) - .7, 0, yB); chair(X(690) - .6 + i * .6, Z(745) + .7, Math.PI, yB); }
  pendantLinear(X(690), cB, Z(745), 1.6, 0, 1.0);
  /* --- Salle de jeux --- */
  rug(X(885), Z(455), 4.6, 3.6, M.rugZel, yB);
  frame(X(885), yB, Z(458), 0, () => { bc(M.walnut, 0, .8, 0, 2.7, .12, 1.4); bc(M.felt, 0, .875, 0, 2.4, .05, 1.1); bc(M.walnut, 0, .38, 0, 2.4, .7, 1.1); for (const sx of [-1.15, 1.15]) for (const sz of [-.55, .55]) cyl(M.black, sx, 0, sz, .06, .76, 8); for (let i = 0; i < 6; i++) sph([M.fabricTerra, M.fabricOchre, M.white, M.fabricNavy][i % 4], -.5 + i * .25, .93, .1 - (i % 2) * .2, .035); });
  // écran cinéma + canapé
  tv(X(885), yB + 1.7, Z(398) + .08, 0, 2.6);
  sofa(2.8, 1.0, M.sofaDark, 0, Math.PI, X(900), Z(505), yB);
  armchair(X(930), Z(480), Math.PI / 2 + .4, yB, M.leather);
  // baby-foot
  frame(X(920), yB, Z(440), 0, () => { bc(M.fabricNavy, 0, .6, 0, .75, .15, 1.3); bc(M.felt, 0, .7, 0, .65, .02, 1.2); cyl(M.black, .4, 0, .5, .03, .6, 6); cyl(M.black, -.4, 0, -.5, .03, .6, 6); cyl(M.black, -.4, 0, .5, .03, .6, 6); cyl(M.black, .4, 0, -.5, .03, .6, 6); });
  // bar à whisky mural
  bx(M.walnut, X(800), yB, Z(395), X(930), yB + 2.4, Z(395) + .35);
  for (let i = 0; i < 4; i++) bx(M.led, X(803) + i * .9, yB + 1.0 + i * 0, Z(395) + .35, X(803) + i * .9 + .7, yB + 1.03, Z(395) + .36);
  plant(X(925), Z(500), yB, 1.2);
  /* --- Chambre invités --- */
  bed(X(880), Z(755), Math.PI / 2 * 0, yB, 1.6);
  wardrobe(X(940), Z(750), 2.4, 2.3, -Math.PI / 2, yB);
  rug(X(880), Z(755), 2.8, 2.6, M.rugBeige, yB);
  /* --- SDB --- */
  vanity(X(880), Z(520), 1.2, 0, yB, false); toilet(X(940), Z(560), Math.PI, yB); shower(X(845), Z(540), 1.1, 1.1, 0, yB);
  bx(M.bathTile, X(832), yB, Z(517), X(958), yB + 2.6, Z(517) + .02);
  // stockage / débarras
  for (let i = 0; i < 3; i++) bx(M.oakDark, X(725), yB + .4 + i * .6, Z(700), X(780), yB + .45 + i * .6, Z(712));
  // cour anglaise : miroir d'eau + lanterne
  for (let i = 0; i < 6; i++) bx(M.led, X(497), yB + .02, Z(540 + i * 45), X(500), yB + .06, Z(540 + i * 45 + 3));
}

/* ===================================================================
 *                         REZ-DE-CHAUSSÉE
 * ================================================================= */
function buildGround() {
  const t = .26;
  const a = yG, b = cG;
  // sol (la dalle sup. du sous-sol = yG). Revêtement pierre
  slabPoly(M.stone, [[543, 515], [795, 515], [795, 378], [958, 378], [958, 825], [795, 825], [795, 808], [543, 808]], null, yG, yG + .02);
  // plafond/plancher étage : 3.45 -> 3.75 avec trous (hall, escalier)
  slabPoly(M.ceil, [[543, 515], [795, 515], [795, 378], [958, 378], [958, 825], [795, 825], [795, 808], [543, 808]],
    [rect(712, 685, 795, 808), rect(852, 583, 968, 692)].map(r => r.slice().reverse()), cG, yR);
  // débords/ balcons au niveau étage (extensions de dalle)
  slabRect(M.concrete, 555, 808, 720, 836, cG, yR); slabRect(M.concrete, 820, 825, 962, 868, cG, yR);
  slabRect(M.concrete, 575, 460, 715, 515, cG, yR); slabRect(M.concrete, 810, 372, 975, 420, cG, yR); slabRect(M.concrete, 958, 420, 972, 525, cG, yR); slabRect(M.concrete, 713, 500, 800, 517, cG, yR);
  // murs extérieurs
  wallV(543, 515, 808, a, b, t, M.plaster, [{ a: 525, b: 800, s: 0, h: 2.95, k: 'glass' }]);
  wallH(515, 543, 795, a, b, t, M.plaster, [{ a: 572, b: 700, s: 0, h: 2.95, k: 'glass' }, { a: 700, b: 745, s: 0, h: 2.95, k: 'door' }, { a: 745, b: 790, s: 0, h: 2.95, k: 'glass' }]);
  wallV(795, 378, 515, a, b, t, M.plaster, [{ a: 395, b: 440, s: 0, h: 2.95, k: 'glass' }, { a: 440, b: 482, s: 0, h: 2.95, k: 'door' }, { a: 482, b: 505, s: 0, h: 2.95, k: 'glass' }]);
  wallH(378, 795, 958, a, b, t, M.plaster, [{ a: 830, b: 940, s: .5, h: 2.7, k: 'win' }]);
  wallV(958, 378, 825, a, b, t, M.plaster, [{ a: 395, b: 510, s: .5, h: 2.7, k: 'win' }, { a: 540, b: 560, s: 1.6, h: 2.4, k: 'win' }, { a: 710, b: 805, s: .6, h: 2.6, k: 'win' }]);
  wallH(825, 795, 958, a, b, t, M.plaster, [{ a: 830, b: 945, s: .6, h: 2.6, k: 'win' }]);
  wallV(795, 808, 825, a, b, t, M.plaster);
  wallH(808, 543, 712, a, b, t, M.plaster, [{ a: 575, b: 672, s: 0, h: 2.95, k: 'glass' }]);
  // façade hall double hauteur (vitrage + porte)
  glazingHall();
  // cloisons intérieures RDC
  wallV(712, 685, 808, a, b, .15, M.walnut, [{ a: 700, b: 740, s: 0, h: 2.6, k: 'door' }, { a: 745, b: 800, s: 0, h: 2.6, k: 'door' }]);
  wallV(795, 688, 808, a, b, .15, M.walnut, [{ a: 702, b: 800, s: 0, h: 2.6, k: 'door' }]);
  wallH(688, 795, 852, a, b, .15, M.white, []);
  // bloc WC invités
  wallH(530, 850, 958, a, b, .12, M.white, []);
  wallH(580, 850, 958, a, b, .15, M.white, [{ a: 860, b: 895, s: 0, h: 2.2, k: 'door' }]);
  wallV(850, 530, 585, a, b, .15, M.white, []);
  wallV(852, 585, 692, a, b, .12, M.white, [{ a: 650, b: 688, s: 0, h: 2.3, k: 'door' }]);
  // faux plafond / LED
  downlights(548, 520, 790, 685, cG, 2.0); downlights(548, 690, 705, 805, cG, 1.9); downlights(800, 385, 955, 525, cG, 2.0);
  downlights(800, 695, 950, 820, cG, 1.9); downlights(572, 372, 790, 512, cG, 2.0, M.led);
  coveLED(548, 520, 850, 685, cG); coveLED(800, 385, 955, 525, cG); coveLED(548, 690, 705, 805, cG);
  [[640, 600], [740, 580], [620, 740], [740, 740], [880, 450], [880, 760], [700, 440], [700, 700]].forEach(([p, q], i) => lamp(X(p), yG + 2.6, Z(q), 0xffdcae, 1));

  /* --- Hall d'entrée double hauteur --- */
  bx(M.oakDark, X(712), yG + 2.65, Z(690), X(716), cR - .2, Z(806)); // bandeau bois (côté)
  for (let i = 0; i < 28; i++) bx(M.slats, X(795) - .08, yG + 2.65, Z(808) - i * .12, X(795), cR - .3, Z(808) - i * .12 - .05);
  table(X(752), Z(790), 1.4, .38, .85, M.walnut, yG);
  bx(M.walnut, X(738), yG + 1.1, Z(690) + .04, X(768), yG + 2.5, Z(690) + .06); bx(M.mirror, X(740), yG + 1.15, Z(690) + .07, X(766), yG + 2.45, Z(690) + .08);
  pendantRound(X(755), cR - .1, Z(745), .5, 1.2); pendantRound(X(755), cR - .1, Z(745), .35, 2.2); pendantRound(X(755), cR - .1, Z(745), .25, 3.1);
  lamp(X(755), yG + 4.0, Z(745), 0xffe5bf, 1.5);
  // tapis d'entrée, sol bois du hall
  bx(M.oak, X(716), yG + .02, Z(806), X(795), yG + .03, Z(692));

  /* --- Grand salon --- */
  rug(X(675), Z(606), 5.0, 3.7, M.rugBeige, yG);
  sofa(3.2, 1.0, M.sofa, 0, Math.PI, X(690), Z(648), yG);
  sofa(2.4, .95, M.sofa, 0, Math.PI / 2, X(585), Z(575), yG);
  armchair(X(718), Z(575), -Math.PI / 2 - .35, yG, M.leather); armchair(X(718), Z(612), -Math.PI / 2 + .35, yG, M.leather);
  coffeeTable(X(670), Z(600), .6, .38, yG); coffeeTable(X(700), Z(595), .3, .5, yG, M.brass);
  floorLamp(X(570), Z(650), yG, 1.8); floorLamp(X(790), Z(560), yG, 1.7); plant(X(560), Z(530), yG, 1.5); plant(X(780), Z(530), yG, 1.5);
  // cheminée éthanol mur est
  bx(M.walnut, X(838), yG, Z(588), X(850), yG + 2.6, Z(650)); // habillage
  bx(M.black, X(830), yG + .55, Z(600), X(838), yG + 1.0, Z(638));
  bx(M.led, X(831), yG + .8, Z(603), X(837), yG + .86, Z(635));
  tv(X(840), yG + 1.7, Z(619), Math.PI / 2 * -1 + Math.PI, 1.5);
  // rideaux fins
  pendantRound(X(670), cG, Z(580), .35, 0.8); pendantRound(X(700), cG, Z(625), .3, .8);

  /* --- Salon marocain 1 --- */
  rug(X(615), Z(745), 3.4, 3.0, M.rugZel, yG);
  frame(X(558), yG, Z(752), 0, () => { bc(M.fabricTerra, 0, .22, 0, .75, .44, 3.6); bc(M.fabricOchre, 0, .55, -1.3, .35, .22, .55); bc(M.fabricTeal, 0, .55, 0, .35, .22, .55); bc(M.fabricNavy, 0, .55, 1.3, .35, .22, .55); bc(M.walnut, -.35, .7, 0, .06, 1.4, 3.6); });
  frame(X(612), yG, Z(797), 0, () => { bc(M.fabricTerra, 0, .22, 0, 3.3, .44, .75); bc(M.fabricTeal, -1.2, .55, 0, .55, .22, .35); bc(M.fabricOchre, 0, .55, 0, .55, .22, .35); bc(M.fabricNavy, 1.2, .55, 0, .55, .22, .35); });
  frame(X(686), yG, Z(752), 0, () => { bc(M.fabricTerra, 0, .22, 0, .75, .44, 2.2); });
  cyl(M.brass, X(615), yG, Z(745), .55, .02, 30); cyl(M.brass, X(615), yG + .02, Z(745), .06, .38, 8); cyl(M.brass, X(615), yG + .4, Z(745), .5, .03, 30, .45);
  pouf(X(640), Z(718), yG, .28, M.fabricOchre); pouf(X(585), Z(722), yG, .26, M.fabricTeal); pouf(X(645), Z(775), yG, .25, M.fabricTerra);
  lantern(X(615), cG, Z(745), 1.6); lantern(X(575), cG, Z(790), 1.1); lantern(X(670), cG, Z(720), 1.1);
  arch(X(545) + .1, yG, Z(715), Math.PI / 2, 1.2, 2.2, M.walnut);

  /* --- Salle à manger (salon droit) --- */
  table(X(878), Z(455), 2.8, 1.05, .76, M.oakDark, yG);
  for (let i = 0; i < 4; i++) { chair(X(878) - 1.0 + i * .66, Z(455) - .8, 0, yG); chair(X(878) - 1.0 + i * .66, Z(455) + .8, Math.PI, yG); }
  chair(X(878) - 1.6, Z(455), Math.PI / 2, yG); chair(X(878) + 1.6, Z(455), -Math.PI / 2, yG);
  pendantLinear(X(878), cG, Z(455), 2.4, 0, 1.0);
  bx(M.walnut, X(940), yG, Z(405), X(956), yG + .9, Z(505)); bx(M.marble, X(938), yG + .9, Z(405), X(956), yG + .94, Z(505));
  bx(M.oakDark, X(940), yG + 1.2, Z(430), X(956), yG + 1.25, Z(480)); bx(M.led, X(939), yG + 1.25, Z(430), X(940), yG + 1.28, Z(480));
  rug(X(878), Z(455), 4.2, 2.8, M.rugGrey, yG); plant(X(815), Z(395), yG, 1.5);

  /* --- Salon marocain 2 (bardage bois) --- */
  bx(M.slats, X(800), yG, Z(822), X(955), cG, Z(822) - .05);
  for (let i = 0; i < 40; i++) bx(M.oakDark, X(800) + i * 0.13, yG, Z(822) - .06, X(800) + i * .13 + .03, cG, Z(822) - .09);
  sofa(2.6, .95, M.sofa, 0, 0, X(878), Z(795), yG); armchair(X(930), Z(745), Math.PI / 2 + .3, yG, M.leather); armchair(X(930), Z(785), Math.PI / 2 - .2, yG, M.leather);
  coffeeTable(X(878), Z(760), .5, .38, yG); rug(X(878), Z(765), 3.6, 2.6, M.rugZel, yG);
  lantern(X(878), cG, Z(765), 1.4);

  /* --- WC invités --- */
  vanity(X(878), Z(534), 1.6, 0, yG, true); toilet(X(930), Z(562), Math.PI, yG);
  bx(M.bathTile, X(850), yG, Z(531), X(958), yG + 2.8, Z(531) + .02);

  /* --- Escalier (2 volées en U), RDC -> étage --- */
  stair();
  // main courante : verre
  // salon: rideau lumineux
}
function glazingHall() {
  const t = .26, c = Z(808), x0 = X(712), x1 = X(795), a = yG, b = cR;
  // porte d'entrée pivotante bois + vitrage haut
  const dw = 1.6, dx0 = (x0 + x1) / 2 - dw / 2, dx1 = dx0 + dw;
  bx(M.frame, x0, a, c - .1, x1, a + .1, c + .1);
  bx(M.frame, x0, b - .06, c - .1, x1, b, c + .1);
  bx(M.frame, x0, a, c - .1, x0 + .1, b, c + .1); bx(M.frame, x1 - .1, a, c - .1, x1, b, c + .1);
  bx(M.frame, dx0 - .05, a, c - .1, dx0, a + 2.6, c + .1); bx(M.frame, dx1, a, c - .1, dx1 + .05, a + 2.6, c + .1);
  bx(M.frame, dx0, a + 2.55, c - .1, dx1, a + 2.65, c + .1);
  bx(M.oakDark, dx0, a + .02, c - 1.6, dx0 + .05, a + 2.5, c - .02); // porte ouverte vers l'intérieur
  bx(M.brass, dx0 - .02, a + 1.0, c - 1.4, dx0, a + 1.8, c - 1.35);
  bx(M.glass, x0 + .1, a + .02, c - .01, dx0 - .05, b - .06, c + .01); bx(M.glass, dx1 + .05, a + .02, c - .01, x1 - .1, b - .06, c + .01); bx(M.glass, dx0, a + 2.65, c - .01, dx1, b - .06, c + .01);
  for (let i = 1; i < 6; i++) bx(M.frame, x0, a + 2.65 + i * .6, c - .08, x1, a + 2.67 + i * .6, c + .08);
}

function stair() {
  const w = 1.25, rise = 0.1833, run = .28, nSt = 9;
  const baseZ = Z(692), landZ1 = baseZ - nSt * run, landZ0 = Z(583);
  const fa1 = X(953), fa0 = fa1 - w, fb0 = X(857), fb1 = fb0 + w;
  for (let i = 0; i < nSt; i++) {
    const zs = baseZ - i * run, ze = zs - run, top = yG + (i + 1) * rise;
    bx(M.concrete, fa0, yG, ze, fa1, top - .04, zs); bx(M.oakDark, fa0, top - .04, ze, fa1, top, zs + .02);
  }
  const landTop = yG + nSt * rise;
  bx(M.concrete, X(857), yG, landZ0, X(953), landTop - .04, landZ1); bx(M.oakDark, X(857), landTop - .04, landZ0, X(953), landTop, landZ1);
  for (let j = 0; j < nSt; j++) {
    const zs = landZ1 + j * run, ze = zs + run, top = landTop + (j + 1) * rise;
    bx(M.concrete, fb0, yG, zs, fb1, top - .04, ze); bx(M.oakDark, fb0, top - .04, zs, fb1, top, ze + .02);
  }
  // garde-corps verre côté vide + lames de bois sur les murs de la cage
  bx(M.glassTint, fa0 - .03, yG + .9, landZ1, fa0 - .01, yG + 2.0, baseZ);
  bx(M.black, fa0 - .035, yG + 2.0, landZ1, fa0 - .005, yG + 2.05, baseZ);
  bx(M.glassTint, fb1 + .01, landTop + 1.0, landZ1, fb1 + .03, landTop + 2.0, baseZ);
  bx(M.led, fa0 - .01, yG + .12, landZ1, fa0 + .0, yG + .16, baseZ);
  bx(M.oakDark, X(954) - .06, yG, landZ0, X(954) - .02, cG, baseZ - 0);
  bx(M.oakDark, X(857) - .02, yG, landZ0, X(857) + .02, cG, landZ0 + (baseZ - landZ0));
}

/* ===================================================================
 *                           ÉTAGE
 * ================================================================= */
function buildUpper() {
  const t = .26, a = yR, b = cR;
  group = 'main';
  const floorMat = M.oak;
  // sols par pièce
  const floors = [
    [555, 715, 712, 833, M.oak], [555, 573, 645, 655, M.oak], [555, 655, 645, 715, M.bathTile], [575, 460, 710, 570, M.oak],
    [650, 570, 712, 660, M.oak], [713, 505, 812, 625, M.oak], [820, 420, 970, 525, M.oak], [855, 525, 925, 570, M.bathTile],
    [820, 745, 962, 868, M.oak], [855, 695, 925, 745, M.bathTile], [650, 660, 712, 715, M.oak], [712, 660, 795, 685, M.oak], [795, 660, 852, 715, M.oak], [812, 505, 852, 660, M.oak], [813, 715, 852, 745, M.oak]
  ];
  floors.forEach(([p, q, r, s, m]) => slabRect(m, p, q, r, s, yR, yR + .02));
  // vide sur entrée : garde-corps verre (bords du trou 712-795 x 685-808)
  bx(M.glassTint, X(712), yR, Z(685), X(795), yR + 1.05, Z(685) + .02); bx(M.black, X(712), yR + 1.05, Z(685), X(795), yR + 1.09, Z(685) + .04);
  bx(M.glassTint, X(795) - .02, yR, Z(685), X(795), yR + 1.05, Z(808)); bx(M.black, X(795) - .04, yR + 1.05, Z(685), X(795), yR + 1.09, Z(808));
  // === Suite parentale ===
  wallH(833, 555, 712, a, b, t, M.plaster, [{ a: 572, b: 620, s: 0, h: 2.6, k: 'glass' }, { a: 620, b: 660, s: 0, h: 2.6, k: 'door' }, { a: 660, b: 705, s: 0, h: 2.6, k: 'glass' }]);
  wallV(555, 715, 833, a, b, t, M.plaster, [{ a: 735, b: 825, s: 0, h: 2.6, k: 'glass' }]);
  wallV(712, 715, 833, a, b, t, M.plaster, []);
  wallH(715, 555, 650, a, b, .15, M.white, [{ a: 590, b: 625, s: 0, h: 2.2, k: 'door' }]);
  wallH(715, 650, 712, a, b, .15, M.white, [{ a: 665, b: 705, s: 0, h: 2.3, k: 'door' }]);
  // Terrasse suite
  bx(M.deck, X(555), yR - .3, Z(836), X(720), yR, Z(833)); // seuil
  // garde-corps du porte-à-faux sud
  bx(M.glassTint, X(555), yR, Z(836), X(720), yR + 1.05, Z(836) + .02); bx(M.black, X(555), yR + 1.05, Z(836), X(720), yR + 1.09, Z(836) + .04);
  bx(M.deck, X(555), yR, Z(836), X(720), yR + .03, Z(833));
  // === Dressing & SDB ===
  wallV(555, 573, 715, a, b, t, M.plaster, [{ a: 590, b: 650, s: 1.0, h: 2.4, k: 'win' }]);
  wallH(573, 555, 650, a, b, t, M.plaster);
  wallV(650, 573, 715, a, b, .15, M.white, [{ a: 665, b: 700, s: 0, h: 2.2, k: 'door' }]);
  wallH(655, 555, 645, a, b, .12, M.white, [{ a: 585, b: 620, s: 0, h: 2.2, k: 'door' }]);
  // === Chambre 3 ===
  wallH(460, 575, 710, a, b, t, M.plaster, [{ a: 590, b: 700, s: 0, h: 2.6, k: 'glass' }]);
  wallV(575, 460, 573, a, b, t, M.plaster, [{ a: 480, b: 560, s: .6, h: 2.5, k: 'win' }]);
  wallV(712, 460, 570, a, b, t, M.plaster);
  wallH(570, 575, 712, a, b, .15, M.white, [{ a: 668, b: 703, s: 0, h: 2.2, k: 'door' }]);
  // === Corridor ouest (650-712 x 570-660) fermé à l'ouest/est
  wallV(650, 573, 660, a, b, .12, M.white, []);
  wallV(712, 570, 660, a, b, .12, M.white, []);
  // === Chambre 2 ===
  wallH(505, 713, 812, a, b, t, M.plaster, [{ a: 730, b: 795, s: 0, h: 2.6, k: 'glass' }]);
  wallV(713, 505, 625, a, b, t, M.plaster);
  wallV(812, 505, 625, a, b, .15, M.white, [{ a: 560, b: 595, s: 0, h: 2.2, k: 'door' }]);
  wallH(625, 713, 812, a, b, .15, M.white, [{ a: 735, b: 770, s: 0, h: 2.2, k: 'door' }]);
  // === Chambre 4 ===
  wallH(420, 820, 970, a, b, t, M.plaster, [{ a: 835, b: 955, s: 0, h: 2.6, k: 'glass' }]);
  wallV(970, 420, 525, a, b, t, M.plaster, [{ a: 440, b: 505, s: .5, h: 2.5, k: 'win' }]);
  wallV(820, 420, 525, a, b, .15, M.white, []);
  wallH(525, 820, 970, a, b, .15, M.white, [{ a: 828, b: 850, s: 0, h: 2.2, k: 'door' }]);
  // terrasse nord chambre 4 (garde-corps)
  bx(M.glassTint, X(810), yR, Z(372), X(975), yR + 1.05, Z(372) + .02); bx(M.black, X(810), yR + 1.05, Z(372), X(975), yR + 1.09, Z(372) + .04);
  bx(M.deck, X(810), yR, Z(420), X(975), yR + .03, Z(372));
  bx(M.glassTint, X(810), yR, Z(372), X(810) + .02, yR + 1.05, Z(420)); bx(M.glassTint, X(975) - .02, yR, Z(372), X(975), yR + 1.05, Z(420));
  // === SDB2 ===
  wallH(570, 855, 925, a, b, .15, M.white, []);
  wallV(855, 525, 570, a, b, .12, M.white, [{ a: 535, b: 565, s: 0, h: 2.2, k: 'door' }]);
  wallV(925, 525, 570, a, b, .12, M.white, []);
  // === Cage d'escalier ===
  wallV(968, 575, 697, a, b, t, M.plaster, [{ a: 600, b: 690, s: .6, h: 2.6, k: 'win' }]);
  wallH(575, 852, 968, a, b, .15, M.white, []);
  wallV(852, 575, 660, a, b, .15, M.white, []);
  wallV(852, 695, 745, a, b, .15, M.white, []);
  wallH(697, 852, 968, a, b, .15, M.white, []);
  // === SDB1 ===
  wallH(745, 855, 925, a, b, .15, M.white, []);
  wallV(925, 697, 745, a, b, .12, M.white, []);
  wallV(855, 697, 745, a, b, .12, M.white, [{ a: 705, b: 735, s: 0, h: 2.2, k: 'door' }]);
  // === Chambre 1 ===
  wallH(868, 820, 962, a, b, t, M.plaster, [{ a: 835, b: 945, s: 0, h: 2.6, k: 'glass' }]);
  wallV(962, 745, 868, a, b, t, M.plaster, [{ a: 765, b: 850, s: .5, h: 2.5, k: 'win' }]);
  wallV(820, 745, 868, a, b, t, M.plaster);
  wallH(745, 820, 855, a, b, .15, M.white, [{ a: 826, b: 850, s: 0, h: 2.2, k: 'door' }]);
  // bardage bois extérieur porte-à-faux chambre 1
  for (let i = 0; i < 24; i++) bx(M.slats, X(820) + i * (X(962) - X(820)) / 24, yR - .2, Z(868) + .13, X(820) + (i + .75) * (X(962) - X(820)) / 24, b, Z(868) + .14);
  // === Hall étage ===
  wallH(660, 650, 852, a, b, .15, M.white, [{ a: 650, b: 712, s: 0, h: 2.2, k: 'door' }]);
  wallH(715, 650, 723, a, b, .15, M.white, []);
  wallV(852, 715, 745, a, b, .15, M.white, []);
  // plafonds LED étage
  downlights(560, 720, 715, 830, cR, 2.0); downlights(580, 465, 705, 565, cR, 2.0); downlights(715, 510, 810, 620, cR, 2.0);
  downlights(825, 425, 965, 520, cR, 2.0); downlights(825, 750, 958, 865, cR, 2.0); downlights(655, 662, 850, 712, cR, 1.6);
  coveLED(560, 720, 715, 830, cR); coveLED(580, 465, 705, 565, cR); coveLED(825, 425, 965, 520, cR); coveLED(825, 750, 958, 865, cR);
  [[640, 770], [640, 515], [760, 560], [895, 470], [890, 800], [750, 685], [610, 620], [900, 640]].forEach(([p, q]) => lamp(X(p), yR + 2.5, Z(q), 0xffdcae, 1));

  /* --- Suite parentale --- */
  bed(X(672), Z(776), -Math.PI / 2, yR, 2.0); rug(X(655), Z(776), 3.4, 3.4, M.rugBeige, yR);
  // bed head toward wall (south): flip -> tête contre sud ; on retourne
  armchair(X(585), Z(800), Math.PI / 2 + .6, yR, M.leather); coffeeTable(X(608), Z(805), .3, .5, yR, M.brass);
  // rideaux
  bx(M.walnut, X(558), yR + .4, Z(790), X(566), yR + 1.2, Z(812));
  plant(X(565), Z(820), yR, 1.2);
  /* --- Dressing --- */
  bx(M.walnut, X(555), yR, Z(573), X(560), yR + 2.6, Z(655)); bx(M.walnut, X(555), yR, Z(573), X(645), yR + 2.6, Z(578));
  for (let i = 0; i < 4; i++) bx(M.oakDark, X(560), yR + .5 + i * .55, Z(580), X(600), yR + .53 + i * .55, Z(650));
  bx(M.led, X(561), yR + 2.4, Z(580), X(563), yR + 2.42, Z(650)); bc(M.leather, X(610), yR + .25, Z(615), .9, .5, .9);
  /* --- SDB suite --- */
  bathtub(X(600), Z(676), 0, yR); vanity(X(625), Z(660) + 1.4, 1.8, Math.PI, yR, true); toilet(X(560), Z(700), Math.PI / 2, yR);
  shower(X(630), Z(700), 1.1, 1.1, Math.PI, yR);
  bx(M.bathTile, X(555), yR, Z(715), X(645), yR + 2.5, Z(715) - .02);
  /* --- Chambre 3 --- */
  bed(X(645), Z(500), Math.PI, yR, 1.6); wardrobe(X(590), Z(545), 2.0, 2.3, Math.PI, yR); rug(X(645), Z(510), 3.0, 2.8, M.rugGrey, yR);
  /* --- Chambre 2 --- */
  bed(X(760), Z(580), Math.PI, yR, 1.6); wardrobe(X(795), Z(530), 1.8, 2.3, Math.PI, yR); rug(X(762), Z(560), 2.8, 2.6, M.rugBeige, yR);
  bx(M.oakDark, X(716), yR + .75, Z(540), X(718), yR + .76, Z(600)); table(X(740), Z(525), 1.2, .5, .75, M.oakDark, yR); chair(X(740), Z(540), 0, yR);
  /* --- Chambre 4 --- */
  bed(X(895), Z(470), Math.PI, yR, 1.9); wardrobe(X(950), Z(505), 1.8, 2.3, 0, yR); rug(X(895), Z(480), 3.2, 3.0, M.rugBeige, yR);
  armchair(X(965), Z(440), -Math.PI / 2, yR, M.leather);
  /* --- Chambre 1 --- */
  bed(X(890), Z(810), Math.PI, yR, 1.8); wardrobe(X(830), Z(800), 2.2, 2.3, Math.PI / 2, yR); rug(X(890), Z(805), 3.2, 3.0, M.rugGrey, yR);
  tv(X(958), yR + 1.4, Z(810), -Math.PI / 2, 1.4);
  /* --- SDB 1 & 2 --- */
  vanity(X(890), Z(745) - 0.3, 1.4, Math.PI, yR, false); toilet(X(915), Z(715), 0, yR); shower(X(865), Z(715), 1.0, 1.0, 0, yR);
  vanity(X(890), Z(528), 1.4, 0, yR, false); toilet(X(915), Z(560), Math.PI, yR); shower(X(865), Z(557), 1.0, 1.0, 0, yR);
  /* --- Hall --- */
  table(X(790), Z(663), 1.2, .4, .85, M.walnut, yR); plant(X(655), Z(675), yR, 1.4); pendantRound(X(700), cR, Z(690), .3, .8);
  // balcon suite : fauteuils
  armchair(X(572), Z(853), Math.PI, yR, M.sofaDark); armchair(X(606), Z(853), Math.PI, yR, M.sofaDark); coffeeTable(X(589), Z(853), .22, .4, yR);
  // balcon chambre 4
  armchair(X(870), Z(395), 0, yR, M.sofaDark); armchair(X(920), Z(395), 0, yR, M.sofaDark); coffeeTable(X(895), Z(400), .28, .4, yR);

  /* ----------------- TOIT (groupe séparé) ------------------- */
  group = 'roof';
  const roofs = [[555, 715, 720, 833], [555, 573, 645, 715], [575, 460, 710, 570], [650, 570, 712, 715], [713, 505, 812, 625], [650, 660, 852, 715], [820, 420, 970, 525], [852, 525, 925, 745], [852, 575, 968, 697], [820, 745, 962, 868]];
  roofs.forEach(([p, q, r, s]) => {
    slabRect(M.white, p - 12, q - 8, r + 12, s + 8, cR, yTop - .05);
    slabRect(M.roof, p - 12, q - 8, r + 12, s + 8, yTop - .05, yTop);
  });
  group = 'main';
}

/* =========================  SKY / LIGHTS ========================== */
const sky = new Sky(); sky.scale.setScalar(450000); scene.add(sky);
const sunDir = new THREE.Vector3();
{
  const u = sky.material.uniforms; u.turbidity.value = 2.2; u.rayleigh.value = 2.4; u.mieCoefficient.value = .004; u.mieDirectionalG.value = .85;
  sunDir.setFromSphericalCoords(1, THREE.MathUtils.degToRad(52), THREE.MathUtils.degToRad(215)); // sud-ouest
  sunDir.set(-.55, .62, .6).normalize();
  u.sunPosition.value.copy(sunDir);
}
const pm = new THREE.PMREMGenerator(renderer);
{ const es = new THREE.Scene(), sk = new Sky(); sk.scale.setScalar(450000); for (const kk of ['turbidity','rayleigh','mieCoefficient','mieDirectionalG']) sk.material.uniforms[kk].value = sky.material.uniforms[kk].value; sk.material.uniforms.sunPosition.value.copy(sunDir); es.add(sk); scene.environment = pm.fromScene(es, 0.02).texture; }
scene.environmentIntensity = .55;
scene.fog = new THREE.Fog(0xcfe0ee, 80, 400);

const sun = new THREE.DirectionalLight(0xfff0dc, 2.6);
const target = new THREE.Object3D(); target.position.set(X(700), 0, Z(560)); scene.add(target); sun.target = target;
sun.position.copy(target.position).addScaledVector(sunDir, 60);
sun.castShadow = true; sun.shadow.mapSize.set(4096, 4096);
const sc = sun.shadow.camera; sc.left = -26; sc.right = 26; sc.top = 26; sc.bottom = -26; sc.near = 5; sc.far = 140;
sun.shadow.bias = -0.0004; sun.shadow.normalBias = .04; scene.add(sun);
const hemi = new THREE.HemisphereLight(0xcfe3ff, 0x6a6258, .55); scene.add(hemi);

// lumières de pièces (pool) + lumière suivie à la caméra
const POOL = 5, pool = [];
for (let i = 0; i < POOL; i++) { const l = new THREE.PointLight(0xffdcae, 0, 12, 1.6); scene.add(l); pool.push(l); }
const camLight = new THREE.PointLight(0xfff1dc, 0, 9, 1.8); scene.add(camLight);

/* ============================ construction ======================== */
buildSite(); buildBasement(); buildGround(); buildUpper();

// correctif des marches de l'escalier de la cour (hauteurs correctes)
{
  group = 'main'; const nSt = 15, cz0 = Z(515), sx0 = X(455), sx1 = X(487), run = .28, rise = (0 - yB) / nSt;
  for (let i = 0; i < nSt; i++) { const zs = cz0 + i * run; const top = -(i) * rise - rise; bx(M.concrete, sx0, top - .05, zs, sx1, top, zs + run); }
}

const meshes = { main: new THREE.Group(), roof: new THREE.Group() };
for (const gname of ['main', 'roof']) {
  for (const [mat, geoms] of buckets[gname]) {
    geoms.forEach(g => { for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k); });
    const g = mergeGeometries(geoms, false); const m = new THREE.Mesh(g, mat);
    const glassy = mat === M.glass || mat === M.glassTint || mat === M.curtain;
    m.castShadow = !glassy; m.receiveShadow = true; if (glassy) m.renderOrder = 5;
    meshes[gname].add(m);
  }
  scene.add(meshes[gname]);
}
// eau
const water = new THREE.Mesh(new THREE.PlaneGeometry(X(788) - X(537), Z(327) - Z(235)), M.water); water.rotation.x = -Math.PI / 2;
water.position.set((X(537) + X(788)) / 2, -.12, (Z(235) + Z(327)) / 2); water.renderOrder = 3; scene.add(water);
// ciel/eau fixes
for (const o of scene.children) if (o.isMesh && o.material === M.water) o.castShadow = false;

/* =============================== CAMÉRA ============================ */
const P = (px, py, h) => new THREE.Vector3(X(px), h, Z(py));
// [t, position, regard]
const K = [];
const k = (t, px, py, h, tx, ty, th, fov = 58, cut = false) => K.push({ t, p: P(px, py, h), l: P(tx, ty, th), fov, cut });
const T = {};


const A = (t,px,py,h,tx,ty,th,fov=66,cut=false)=>k(t,px,py,h,tx,ty,th,fov,cut);
// --- extérieur ---
A(0,1180,1180,38,760,620,3,58); A(4,1020,1120,20,750,640,3,58); A(8,880,1060,9,750,700,3.5,60); A(11,760,1040,3.4,755,800,2.3,62);
// --- entrée & hall ---
A(14,758,940,1.7,757,820,2.3,62); A(16.5,757,850,1.7,757,760,2.4,62); A(18.5,757,812,1.7,757,730,3.2,66);
A(21,757,775,1.7,757,700,3.9,68); A(23.5,757,745,1.7,745,690,2.8,68); A(25.5,748,718,1.65,770,650,1.5,68);
// --- grand salon ---
A(27.5,772,670,1.65,740,590,1.5,70); A(29.5,765,600,1.65,660,590,1.4,70); A(32,710,585,1.65,580,600,1.3,72);
A(34,640,590,1.65,560,650,1.2,72); A(35.5,612,625,1.65,590,720,1.0,72);
// --- salon marocain ---
A(37.5,610,705,1.6,570,775,0.9,72); A(39.5,640,720,1.6,560,750,0.9,72); A(41,650,740,1.6,580,790,0.8,70);
A(43,655,715,1.6,740,735,1.7,66); A(45,730,722,1.65,790,700,1.7,66);
// --- salle à manger ---
A(46.5,752,700,1.65,790,610,1.6,66); A(48.5,775,640,1.65,820,560,1.6,66); A(50.5,805,575,1.65,840,500,1.5,66);
A(52.5,820,525,1.65,878,455,1.2,64); A(54.5,835,500,1.65,878,445,1.1,62); A(56.5,830,480,1.65,900,430,1.2,62);
A(58.5,815,470,1.65,740,455,1.4,66); A(60.5,780,462,1.65,700,440,1.3,66);
// --- terrasse & piscine ---
A(62.5,745,450,1.65,670,380,1.2,66); A(64.5,735,405,1.7,700,330,1.0,66); A(66.5,730,375,1.7,680,290,0.6,66);
A(69,750,355,1.8,650,285,0.2,66); A(71.5,770,335,2.0,650,280,0.0,66); A(74,800,290,2.2,680,275,-0.3,66);
A(77,790,240,2.4,670,285,-0.3,66); A(80,740,212,2.4,640,290,-0.3,66); A(83,620,215,2.4,700,420,2.0,66);
A(86,570,300,2.2,680,440,2.0,66); A(88,640,330,2.0,720,420,1.8,66);
// retour dans le salon par la porte-fenêtre
A(90,790,360,1.8,740,450,1.6,66); A(92,775,430,1.7,730,500,1.6,66); A(94,737,475,1.65,724,540,1.6,66);
A(96,722,512,1.65,740,610,1.5,66); A(98,735,560,1.65,770,650,1.5,66); A(100,765,620,1.65,790,700,1.5,66);
A(101.5,775,690,1.65,830,730,1.6,66); A(103,815,725,1.65,900,720,1.8,66); A(104.5,860,725,1.65,937,695,2.3,66);
// --- escalier (volée est, montée vers le nord) ---
A(106.5,937,705,2.1,937,665,2.5,66); A(108.5,937,675,2.55,937,625,3.3,66); A(110,937,640,3.27,900,606,3.4,66);
A(111.5,925,610,3.75,880,628,3.7,66);
A(113.5,880,622,3.8,874,665,4.4,66); A(115.5,874,655,4.6,860,700,5.05,66); A(117,872,688,5.4,822,682,5.4,66);
// --- étage ---
A(119,835,682,5.4,760,690,5.0,68); A(121,800,672,5.4,740,740,5.2,68); A(123,770,672,5.4,690,690,5.2,68);
A(125,725,672,5.4,670,720,5.0,68); A(126.5,690,688,5.4,672,725,5.0,68); A(128,686,714,5.4,640,762,5.0,70); A(130,660,735,5.4,600,770,4.9,70);
A(132,610,742,5.4,690,785,4.8,70); A(134,600,765,5.4,690,780,4.8,70); A(136,610,790,5.4,640,832,5.0,70);
A(137.5,622,812,5.4,625,870,4.8,70); A(139.5,632,845,5.4,640,900,4.5,68); A(141.5,640,855,5.4,700,880,4.8,68);
// chambre 4
A(143.5,792,688,5.4,832,640,5.0,64,true); A(145,812,684,5.4,832,600,5.0,64); A(146.8,832,640,5.4,838,540,5.0,64);
A(148.6,834,575,5.4,840,515,5.1,64); A(150.2,836,535,5.4,870,480,5.0,64); A(152,843,498,5.4,895,445,5.1,64);
A(154,843,470,5.4,900,455,5.0,64); A(156,845,440,5.4,900,410,5.0,64);
// --- cour anglaise & sous-sol ---
A(158,500,470,1.8,470,540,-0.5,66,true); A(160,480,470,1.8,470,540,-0.5,66); A(162,472,505,1.7,471,600,-2.0,66);
A(164,471,530,1.2,470,640,-2.4,66); A(166,471,565,0.35,475,660,-1.8,66); A(168,471,610,-0.6,500,670,-2.0,66);
A(170,470,635,-1.15,520,620,-1.7,66); A(172,500,622,-1.15,580,615,-1.7,68); A(174,550,620,-1.15,640,590,-1.7,70);
A(176,590,605,-1.15,680,520,-1.3,70); A(178,640,575,-1.15,662,518,-1.0,66); A(180,700,560,-1.15,740,640,-1.6,68);
A(182,740,610,-1.15,700,690,-1.6,68); A(184,700,650,-1.15,620,730,-1.4,70); A(186,690,695,-1.15,600,770,-1.2,70);
A(188,660,698,-1.15,570,740,-1.3,70); A(190,630,698,-1.15,560,790,-1.2,70); A(192,600,698,-1.15,700,700,-1.3,70);
A(194,690,700,-1.15,790,600,-1.5,68); A(196,745,640,-1.15,800,560,-1.5,68); A(198,780,590,-1.15,810,520,-1.5,68);
A(200,810,560,-1.15,860,450,-1.6,68); A(202,812,520,-1.15,870,440,-1.8,68); A(204,815,480,-1.15,880,430,-1.9,66);
A(206,818,450,-1.15,900,420,-1.9,66); A(208,818,410,-1.15,900,470,-1.8,66);
// --- final aérien ---
A(210,1050,1060,14,760,620,3,58,true); A(214,880,1000,24,740,620,2,58); A(218,760,920,38,740,620,1,58); A(224,690,800,55,740,610,0,56);
const TOTAL = K[K.length - 1].t;

function catmull(p0, p1, p2, p3, s, out) {
  const s2 = s * s, s3 = s2 * s;
  out.x = .5 * ((2 * p1.x) + (-p0.x + p2.x) * s + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * s2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * s3);
  out.y = .5 * ((2 * p1.y) + (-p0.y + p2.y) * s + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * s2 + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * s3);
  out.z = .5 * ((2 * p1.z) + (-p0.z + p2.z) * s + (2 * p0.z - 5 * p1.z + 4 * p2.z - p3.z) * s2 + (-p0.z + 3 * p1.z - 3 * p2.z + p3.z) * s3);
  return out;
}
const ease = s => s * s * (3 - 2 * s);
const _p = new THREE.Vector3(), _l = new THREE.Vector3();
function poseAt(t) {
  t = Math.max(0, Math.min(TOTAL - 1e-4, t));
  let i = 0; while (i < K.length - 2 && K[i + 1].t <= t) i++;
  const a = K[i], b = K[i + 1], g = (n) => K[Math.max(0, Math.min(K.length - 1, n))];
  if (b.cut) return { p: _p.copy(a.p), l: _l.copy(a.l), fov: a.fov };
  let s = (t - a.t) / (b.t - a.t);
  const c0 = a.cut ? a : g(i - 1), c3 = g(i + 2).cut ? b : g(i + 2);
  catmull(c0.p, a.p, b.p, c3.p, s, _p); catmull(c0.l, a.l, b.l, c3.l, s, _l);
  return { p: _p, l: _l, fov: a.fov + (b.fov - a.fov) * ease(s) };
}

/* ============================ LÉGENDES ============================= */
const CAPS = [
  [11.5, 20, 'Entrée', 'Hall double hauteur'], [26, 35, 'Grand salon', 'Rez-de-chaussée · 185 m²'], [36, 46, 'Salon marocain', 'Zellige · banquettes · lanternes'],
  [47, 61, 'Salle à manger', 'Ouverte sur le jardin'], [62, 69, 'Terrasse en bois', 'Salon d’extérieur'], [70, 87, 'Piscine', '8,60 m × 3,20 m'],
  [106, 117, 'Escalier', 'Vers l’étage'], [118, 128, 'Étage', 'Hall & vide sur entrée'], [128.5, 142, 'Suite parentale', 'Terrasse privative'],
  [144, 157, 'Chambre', 'Salle d’eau privative · balcon'], [159, 169, 'Cour anglaise', 'Lumière naturelle au sous-sol'], [172, 181, 'Salon & cinéma', 'Sous-sol'],
  [183, 193, 'Cuisine ouverte', 'Îlot central & bar'], [200, 209, 'Salle de jeux', 'Billard · baby-foot · home cinéma'], [217, 223, 'Villa Najah', 'Architecture contemporaine']
];
const capEl = document.getElementById('cap'), titleEl = document.getElementById('title'), fadeEl = document.getElementById('fade');
function overlay(t) {
  let c = null; for (const x of CAPS) if (t >= x[0] && t <= x[1]) c = x;
  if (c) { const op = Math.min(1, (t - c[0]) / .8, (c[1] - t) / .8); capEl.innerHTML = c[2] + (c[3] ? `<small>${c[3]}</small>` : ''); capEl.style.opacity = Math.max(0, op); } else capEl.style.opacity = 0;
  const tt = t < 1 ? t : t < 6.5 ? 1 : Math.max(0, 1 - (t - 6.5) / 1.5); titleEl.style.opacity = Math.min(1, tt);
  // fondu au noir : transitions de coupe + début / fin
  let f = 0;
  if (t < .6) f = 1 - t / .6; if (t > TOTAL - 1.5) f = Math.max(f, (t - (TOTAL - 1.5)) / 1.5);
  for (const kk of K) if (kk.cut) { const d = Math.abs(t - kk.t); if (d < .7) f = Math.max(f, 1 - d / .7); }
  fadeEl.style.opacity = f;
}

/* ============================ RENDU / API ========================== */
const roofGrp = meshes.roof;
function setT(t) {
  const { p, l, fov } = poseAt(t);
  camera.position.copy(p); camera.lookAt(l); if (camera.fov !== fov) { camera.fov = fov; camera.updateProjectionMatrix(); }
  // toit : s'envole à partir de 129.5 s
  const lift = Math.max(0, Math.min(1, (t - 213) / 5)); roofGrp.position.y = ease(lift) * 22; roofGrp.visible = lift < .999;
  // éclairage intérieur selon position (intérieur = y bas ou dans l'emprise)
  const inside = isInside(p);
  const hemiI = inside ? .2 : .45; hemi.intensity = hemiI;
  scene.environmentIntensity = inside ? .14 : .45;
  camLight.position.copy(p).add(new THREE.Vector3(0, .3, 0)); camLight.intensity = inside ? 9 : 0; camLight.distance = 10;
  const near = roomLights.map(r => ({ r, d: r.p.distanceToSquared(p) })).sort((a, b) => a.d - b.d).slice(0, POOL);
  pool.forEach((pl, i) => { if (inside && near[i]) { pl.position.copy(near[i].r.p); pl.intensity = 9; pl.color.set(near[i].r.c); pl.distance = 9; } else pl.intensity = 0; });
  overlay(t);
  renderer.render(scene, camera);
}
function isInside(p) {
  if (p.y < -.2) return true;
  const px = p.x / S + 375, py = p.z / S + 985;
  const inFoot = (px > 543 && px < 958 && py > 378 && py < 830 && !(px < 795 && py < 515)) || (px > 555 && px < 975 && py > 420 && py < 870 && p.y > 3.6);
  return inFoot && p.y < 7;
}
window.setCam = (px, py, h, tx, ty, th, fov = 40, lift = 1) => {
  camera.position.copy(P(px, py, h)); camera.up.set(0, 1, 0); camera.lookAt(P(tx, ty, th)); camera.fov = fov; camera.updateProjectionMatrix();
  roofGrp.position.y = lift * 22; roofGrp.visible = !lift; overlay(50); capEl.style.opacity = 0; fadeEl.style.opacity = 0; titleEl.style.opacity = 0;
  const inside = false; hemi.intensity = .55; camLight.intensity = 0; pool.forEach(p => p.intensity = 0); renderer.render(scene, camera);
};
window.setT = setT; window.TOTAL = TOTAL; window.ready = true;
setT(0);
