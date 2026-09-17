// 中式古建 3D 构件库
import * as THREE from 'three';

// ---------- 材质 ----------
const mats = {
  wall: new THREE.MeshStandardMaterial({ color: 0xf2e6cf, roughness: 0.85 }),
  wallWarm: new THREE.MeshStandardMaterial({ color: 0xddccb0, roughness: 0.9 }),
  red: new THREE.MeshStandardMaterial({ color: 0x8c2f24, roughness: 0.7 }),
  redDark: new THREE.MeshStandardMaterial({ color: 0x61241d, roughness: 0.75 }),
  wood: new THREE.MeshStandardMaterial({ color: 0x4a3527, roughness: 0.8 }),
  stone: new THREE.MeshStandardMaterial({ color: 0x9a938a, roughness: 0.95 }),
  stoneDark: new THREE.MeshStandardMaterial({ color: 0x6f6a63, roughness: 0.95 }),
  gold: new THREE.MeshStandardMaterial({ color: 0xd8b15a, roughness: 0.35, metalness: 0.5 }),
  brick: new THREE.MeshStandardMaterial({ color: 0x8a7f70, roughness: 0.9 }),
  brickGrey: new THREE.MeshStandardMaterial({ color: 0xb7b2a8, roughness: 0.9 }),
  green: new THREE.MeshStandardMaterial({ color: 0x4a6b3f, roughness: 0.9 }),
  trunk: new THREE.MeshStandardMaterial({ color: 0x5b4632, roughness: 0.9 }),
  flagstone: new THREE.MeshStandardMaterial({ color: 0x8f887d, roughness: 1 })
};

const roofMats = {};
function roofMat(color) {
  if (!roofMats[color]) roofMats[color] = new THREE.MeshStandardMaterial({ color, roughness: 0.65, metalness: 0.05 });
  return roofMats[color];
}
const ROOF_GREY = 0x4b4f55;
const ROOF_GREEN = 0x2f5d50;
const ROOF_RED = 0x7a332b;
const ROOF_GOLD = 0x9c7b33;

// 可复用地物几何
const GEO = {
  cone: new THREE.ConeGeometry(1, 1, 10),
  cyl: new THREE.CylinderGeometry(1, 1, 1, 10),
  sphere: new THREE.SphereGeometry(1, 10, 8),
  box: new THREE.BoxGeometry(1, 1, 1)
};

function shadowify(mesh, cast = true, receive = true) {
  mesh.castShadow = cast;
  mesh.receiveShadow = receive;
  return mesh;
}

// 简单确定性随机
export function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------- 窗棂纹理 ----------
const latticeCache = {};
function latticeTexture(base = '#7c2a20', frame = '#d9b45a') {
  const key = base;
  if (latticeCache[key]) return latticeCache[key];
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = base; g.fillRect(0, 0, 128, 128);
  g.strokeStyle = frame; g.lineWidth = 5;
  g.strokeRect(8, 8, 112, 112);
  g.lineWidth = 3;
  for (let i = 1; i < 4; i++) {
    g.beginPath(); g.moveTo(8 + (112 / 4) * i, 8); g.lineTo(8 + (112 / 4) * i, 120); g.stroke();
    g.beginPath(); g.moveTo(8, 8 + (112 / 4) * i); g.lineTo(120, 8 + (112 / 4) * i); g.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  latticeCache[key] = tex;
  return tex;
}

// ---------- 歇山/庑殿式曲面屋顶 ----------
// w 檐口宽(X), d 檐口深(Z), h 高, curl 飞檐起翘
export function makeHipRoof(w, d, h, color = ROOF_GREY, curl = 0.18) {
  const g = new THREE.Group();
  const mat = roofMat(color);
  const ix = Math.max(0.001, w * 0.5 - w * 0.16);
  const iz = Math.max(0.001, d * 0.5 - d * 0.22);

  const B = [
    new THREE.Vector3(-w / 2, 0, -d / 2),
    new THREE.Vector3(w / 2, 0, -d / 2),
    new THREE.Vector3(w / 2, 0, d / 2),
    new THREE.Vector3(-w / 2, 0, d / 2)
  ];
  const T = [
    new THREE.Vector3(-ix, h, -iz),
    new THREE.Vector3(ix, h, -iz),
    new THREE.Vector3(ix, h, iz),
    new THREE.Vector3(-ix, h, iz)
  ];
  const pos = [];
  const push = (a, b, c) => pos.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
  // 四面坡，每面两个三角形
  push(B[0], B[1], T[1]); push(B[0], T[1], T[0]); // 前
  push(B[1], B[2], T[2]); push(B[1], T[2], T[1]); // 右
  push(B[2], B[3], T[3]); push(B[2], T[3], T[2]); // 后
  push(B[3], B[0], T[0]); push(B[3], T[0], T[3]); // 左
  // 顶部小坡面（歇山）
  push(T[0], T[1], T[2]); push(T[0], T[2], T[3]);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(new Array(pos.length / 3 * 2).fill(0), 2));
  geo.computeVertexNormals();
  g.add(shadowify(new THREE.Mesh(geo, mat)));

  // 檐口厚板
  const eave = shadowify(new THREE.Mesh(new THREE.BoxGeometry(w * 1.02, 1.4, d * 1.02), mat));
  eave.position.y = -0.6;
  g.add(eave);

  // 飞檐翘角
  for (let i = 0; i < 4; i++) {
    const tip = shadowify(new THREE.Mesh(GEO.cone, mat));
    tip.scale.set(w * 0.03, h * curl + 1.2, w * 0.03);
    tip.position.set(B[i].x, h * curl * 0.4, B[i].z);
    g.add(tip);
  }

  // 正脊（沿X向）与鸱吻
  const ridgeLen = ix * 2;
  const ridge = shadowify(new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, ridgeLen, 8), roofMat(color)), true, false);
  ridge.rotation.z = Math.PI / 2;
  ridge.position.set(0, h + 0.4, iz);
  g.add(ridge);
  const ridgeB = ridge.clone(); ridgeB.position.z = -iz; g.add(ridgeB);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const end = shadowify(new THREE.Mesh(GEO.cone, mats.gold), true, false);
    end.scale.set(1.4, 3.4, 1.4);
    end.position.set(sx * ix, h + 1.6, sz * iz);
    g.add(end);
  }
  return g;
}

// 多边形坡檐（塔身用），sides=8/4, r 半径, h 檐高, up 翘起
export function makeEaveRing(radius, h, sides, color, up = 0.5) {
  const g = new THREE.Group();
  const mat = roofMat(color);
  const top = radius * 0.72;
  const geo = new THREE.CylinderGeometry(top, radius, h, sides);
  const m = shadowify(new THREE.Mesh(geo, mat));
  m.position.y = h / 2;
  g.add(m);
  // 檐角悬铃/翘角
  for (let i = 0; i < sides; i++) {
    const a = (i / sides) * Math.PI * 2 + Math.PI / sides;
    const bell = shadowify(new THREE.Mesh(GEO.sphere, mats.gold), true, false);
    bell.scale.setScalar(radius * 0.045 + 0.3);
    bell.position.set(Math.cos(a) * radius * 0.98, -0.2, Math.sin(a) * radius * 0.98);
    g.add(bell);
    const upC = shadowify(new THREE.Mesh(GEO.cone, mat), true, false);
    upC.scale.set(radius * 0.05, up + 0.6, radius * 0.05);
    upC.position.set(Math.cos(a) * radius, up * 0.5, Math.sin(a) * radius);
    g.add(upC);
  }
  return g;
}

// ---------- 基础殿堂（单层） ----------
export function makeHall(w, d, wallH, roofColor = ROOF_GREY, opts = {}) {
  const g = new THREE.Group();
  const baseH = opts.baseH ?? 2.2;
  // 台基
  const base = shadowify(new THREE.Mesh(new THREE.BoxGeometry(w + 8, baseH, d + 8), mats.stone));
  base.position.y = baseH / 2;
  g.add(base);
  // 台阶（前方，-Z）
  const step = shadowify(new THREE.Mesh(new THREE.BoxGeometry(w * 0.5, baseH, 6), mats.stoneDark));
  step.position.set(0, baseH / 2, -d / 2 - 6);
  g.add(step);
  // 屋身
  const body = shadowify(new THREE.Mesh(new THREE.BoxGeometry(w, wallH, d), mats.wall));
  body.position.y = baseH + wallH / 2;
  g.add(body);
  // 红柱（前檐）
  const colN = Math.max(4, Math.round(w / 12));
  for (let i = 0; i <= colN; i++) {
    const col = shadowify(new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.0, wallH + 1.5, 8), mats.red));
    col.position.set(-w / 2 + (w / colN) * i, baseH + wallH / 2, -d / 2 - 0.4);
    g.add(col);
  }
  // 窗棂（前）
  const winMat = new THREE.MeshStandardMaterial({ map: latticeTexture(), roughness: 0.7 });
  const winN = Math.max(2, Math.round(w / 18));
  for (let i = 0; i < winN; i++) {
    const win = new THREE.Mesh(new THREE.BoxGeometry(w / winN * 0.62, wallH * 0.5, 0.6), winMat);
    win.position.set(-w / 2 + (w / winN) * (i + 0.5), baseH + wallH * 0.52, -d / 2 - 0.2);
    g.add(win);
  }
  // 门（前中央，暗）
  const door = new THREE.Mesh(new THREE.BoxGeometry(w * 0.18, wallH * 0.72, 0.8), mats.wood);
  door.position.set(0, baseH + wallH * 0.36, -d / 2 - 0.3);
  g.add(door);
  // 屋顶
  const roof = makeHipRoof(w + 14, d + 14, wallH * 0.55 + 6, roofColor);
  roof.position.y = baseH + wallH;
  g.add(roof);
  return g;
}

// 二层楼阁
export function makeTower(w, d, floors = 2, roofColor = ROOF_GREEN) {
  const g = new THREE.Group();
  let y = 0;
  const baseH = 3;
  const base = shadowify(new THREE.Mesh(new THREE.BoxGeometry(w + 8, baseH, d + 8), mats.stone));
  base.position.y = baseH / 2; g.add(base);
  y = baseH;
  for (let f = 0; f < floors; f++) {
    const wh = 14;
    const body = shadowify(new THREE.Mesh(new THREE.BoxGeometry(w - f * 6, wh, d - f * 6), f % 2 ? mats.red : mats.wall));
    body.position.y = y + wh / 2; g.add(body);
    // 周回栏杆
    const rail = shadowify(new THREE.Mesh(new THREE.BoxGeometry(w - f * 6 + 4, 1.2, d - f * 6 + 4), mats.redDark));
    rail.position.y = y + 1.4; g.add(rail);
    const roof = makeHipRoof(w - f * 6 + 10, d - f * 6 + 10, 7, roofColor, 0.22);
    roof.position.y = y + wh; g.add(roof);
    y += wh + 7;
  }
  // 宝顶
  const finial = shadowify(new THREE.Mesh(GEO.cone, mats.gold), true, false);
  finial.scale.set(2, 8, 2); finial.position.y = y + 4; g.add(finial);
  g.userData.height = y + 8;
  return g;
}

// ---------- 凌霄塔（八角木塔，9层） ----------
export function makeLingxiaoPagoda() {
  const g = new THREE.Group();
  let y = 0;
  const base = shadowify(new THREE.Mesh(new THREE.CylinderGeometry(26, 30, 6, 8), mats.stone));
  base.position.y = 3; g.add(base); y = 6;
  let r = 20;
  for (let i = 0; i < 9; i++) {
    const bodyH = 10 - i * 0.3;
    const body = shadowify(new THREE.Mesh(new THREE.CylinderGeometry(r, r * 1.04, bodyH, 8), i % 2 ? mats.red : mats.brickGrey));
    body.position.y = y + bodyH / 2; g.add(body);
    // 木栏平座
    const deck = shadowify(new THREE.Mesh(new THREE.CylinderGeometry(r + 2.2, r + 2.2, 1.6, 8), mats.wood));
    deck.position.y = y + 1.4; g.add(deck);
    y += bodyH;
    const eave = makeEaveRing(r + 3.4, 3.4, 8, ROOF_GREEN, 1.2);
    eave.position.y = y; g.add(eave);
    y += 3.4;
    r *= 0.94;
  }
  const fin = shadowify(new THREE.Mesh(GEO.cone, mats.gold), true, false);
  fin.scale.set(2.4, 12, 2.4); fin.position.y = y + 6; g.add(fin);
  g.userData.height = y + 12;
  return g;
}

// ---------- 须弥塔（方形密檐砖塔，9层） ----------
export function makeXumiPagoda() {
  const g = new THREE.Group();
  let y = 0;
  // 高大方形基座
  const plinth = shadowify(new THREE.Mesh(new THREE.BoxGeometry(44, 10, 44), mats.stone));
  plinth.position.y = 5; g.add(plinth); y = 10;
  // 底层塔身
  const first = shadowify(new THREE.Mesh(new THREE.BoxGeometry(28, 26, 28), mats.brickGrey));
  first.position.y = y + 13; g.add(first);
  // 正面券门
  const door = new THREE.Mesh(new THREE.BoxGeometry(9, 14, 1), mats.stoneDark);
  door.position.set(0, y + 8, -14.2); g.add(door);
  y += 26;
  let s = 30;
  for (let i = 0; i < 8; i++) {
    // 密檐
    const slab = shadowify(new THREE.Mesh(new THREE.BoxGeometry(s + 6, 2.6, s + 6), roofMat(ROOF_GREY)));
    slab.position.y = y + 1.3; g.add(slab);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const bell = shadowify(new THREE.Mesh(GEO.sphere, mats.gold), true, false);
      bell.scale.setScalar(0.7); bell.position.set(sx * s / 2, y + 0.4, sz * s / 2); g.add(bell);
    }
    y += 2.6;
    const bodyH = 8;
    const body = shadowify(new THREE.Mesh(new THREE.BoxGeometry(s - 2, bodyH, s - 2), mats.brickGrey));
    body.position.y = y + bodyH / 2; g.add(body);
    y += bodyH;
    s -= 2.4;
  }
  const top = shadowify(new THREE.Mesh(GEO.cone, mats.gold), true, false);
  top.scale.set(2, 8, 2); top.position.y = y + 4; g.add(top);
  g.userData.height = y + 8;
  return g;
}

// ---------- 澄灵塔（八角密檐青塔，9层） ----------
export function makeChenglingPagoda() {
  const g = new THREE.Group();
  let y = 0;
  const base = shadowify(new THREE.Mesh(new THREE.CylinderGeometry(20, 23, 8, 8), mats.stone));
  base.position.y = 4; g.add(base); y = 8;
  // 莲座
  const lotus = shadowify(new THREE.Mesh(new THREE.CylinderGeometry(17, 19, 4, 8), mats.brickGrey));
  lotus.position.y = y + 2; g.add(lotus); y += 4;
  // 首层较高塔身
  const first = shadowify(new THREE.Mesh(new THREE.CylinderGeometry(13, 14, 16, 8), mats.brickGrey));
  first.position.y = y + 8; g.add(first);
  const door = new THREE.Mesh(new THREE.BoxGeometry(5, 8, 1), mats.stoneDark);
  door.position.set(0, y + 7, -13.6); g.add(door);
  y += 16;
  let r = 15;
  for (let i = 0; i < 8; i++) {
    const eave = makeEaveRing(r, 2.4, 8, ROOF_GREY, 0.7);
    eave.position.y = y; g.add(eave);
    y += 2.4;
    const bodyH = 6;
    const rr = r - 2.6;
    const body = shadowify(new THREE.Mesh(new THREE.CylinderGeometry(rr, rr, bodyH, 8), mats.brickGrey));
    body.position.y = y + bodyH / 2; g.add(body);
    y += bodyH;
    r -= 1.4;
  }
  // 刹杆相轮宝珠
  for (let i = 0; i < 5; i++) {
    const ring = shadowify(new THREE.Mesh(new THREE.CylinderGeometry(3.4 - i * 0.4, 3.4 - i * 0.4, 1.6, 8), mats.gold), true, false);
    ring.position.y = y + 1 + i * 2.2; g.add(ring);
  }
  const bead = shadowify(new THREE.Mesh(GEO.sphere, mats.gold), true, false);
  bead.scale.setScalar(2.6); bead.position.y = y + 14; g.add(bead);
  g.userData.height = y + 17;
  return g;
}

// ---------- 华塔（花塔） ----------
export function makeHuataPagoda() {
  const g = new THREE.Group();
  let y = 0;
  // 方形主塔基座
  const base = shadowify(new THREE.Mesh(new THREE.BoxGeometry(40, 8, 40), mats.stone));
  base.position.y = 4; g.add(base); y = 8;
  const first = shadowify(new THREE.Mesh(new THREE.BoxGeometry(26, 20, 26), mats.brickGrey));
  first.position.y = y + 10; g.add(first);
  const door = new THREE.Mesh(new THREE.BoxGeometry(8, 12, 1), mats.stoneDark);
  door.position.set(0, y + 7, -13.2); g.add(door);
  // 四角小塔
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const st = new THREE.Group();
    const sb = shadowify(new THREE.Mesh(new THREE.CylinderGeometry(4, 4.6, 12, 6), mats.brickGrey));
    sb.position.y = 6; st.add(sb);
    const sr = makeEaveRing(6, 3, 6, ROOF_GREY, 0.6); sr.position.y = 12; st.add(sr);
    const sp = shadowify(new THREE.Mesh(GEO.cone, mats.gold), true, false);
    sp.scale.set(0.8, 5, 0.8); sp.position.y = 18; st.add(sp);
    st.position.set(sx * 15, y, sz * 15);
    g.add(st);
  }
  const eave = makeHipRoof(34, 34, 6, ROOF_GREY, 0.15);
  eave.position.y = y + 20; g.add(eave);
  y += 26;
  // 八角束腰
  const waist = shadowify(new THREE.Mesh(new THREE.CylinderGeometry(12, 14, 8, 8), mats.brickGrey));
  waist.position.y = y + 4; g.add(waist); y += 8;
  // 锥形花束塔身，分层雕塑
  const layers = 9;
  let rb = 15, rt = 6, lh = 7;
  for (let i = 0; i < layers; i++) {
    const t = i / layers;
    const r0 = rb + (rt - rb) * t;
    const r1 = rb + (rt - rb) * ((i + 1) / layers);
    const seg = shadowify(new THREE.Mesh(new THREE.CylinderGeometry(r1, r0, lh, 8), i % 2 ? mats.brick : mats.brickGrey));
    seg.position.y = y + lh / 2 + i * lh; g.add(seg);
    // 雕塑凸点（莲瓣/狮象/佛像）
    const n = 8;
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2;
      const bump = shadowify(new THREE.Mesh(GEO.sphere, i % 3 === 0 ? mats.gold : mats.stoneDark), false, false);
      bump.scale.setScalar(1.6);
      bump.position.set(Math.cos(a) * (r0 - 1), y + lh / 2 + i * lh, Math.sin(a) * (r0 - 1));
      g.add(bump);
    }
  }
  y += layers * lh;
  const top = makeEaveRing(8, 4, 8, ROOF_GREY, 0.8);
  top.position.y = y; g.add(top);
  const fin = shadowify(new THREE.Mesh(GEO.cone, mats.gold), true, false);
  fin.scale.set(1.6, 8, 1.6); fin.position.y = y + 8; g.add(fin);
  g.userData.height = y + 12;
  return g;
}

// ---------- 城门题额牌匾 ----------
export function makePlaque(text) {
  const g = new THREE.Group();
  const c = document.createElement('canvas');
  c.width = 512; c.height = 128;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#241a10';
  roundRect(ctx, 6, 6, 500, 116, 14);
  ctx.fill();
  ctx.strokeStyle = '#d8b15a';
  ctx.lineWidth = 6;
  roundRect(ctx, 6, 6, 500, 116, 14);
  ctx.stroke();
  ctx.fillStyle = '#f0d590';
  ctx.font = 'bold 74px "KaiTi","STKaiti","SimSun",serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 256, 68);
  const tex = new THREE.CanvasTexture(c);
  const mat = new THREE.MeshBasicMaterial({ map: tex });
  const board = new THREE.Mesh(new THREE.PlaneGeometry(34, 8.5), mat);
  board.position.y = 18.5;
  g.add(board);
  return g;
}

// ---------- 城门楼 ----------
export function makeGate(name) {
  const g = new THREE.Group();
  const axis = name === 'south' || name === 'north'; // 门洞沿Z
  const platformW = axis ? 78 : 64;
  const platformD = axis ? 54 : 84;
  const pH = 26;
  const plat = shadowify(new THREE.Mesh(new THREE.BoxGeometry(platformW, pH, platformD), mats.brick));
  plat.position.y = pH / 2; g.add(plat);
  // 门洞（深色）
  const arch = new THREE.Mesh(
    axis ? new THREE.BoxGeometry(16, 18, platformD + 2) : new THREE.BoxGeometry(platformD + 2, 18, 16),
    new THREE.MeshStandardMaterial({ color: 0x1c1814, roughness: 1 })
  );
  arch.position.y = 9; g.add(arch);
  // 城垛
  const merlonMat = mats.stoneDark;
  const count = axis ? 8 : 10;
  for (let i = 0; i < count; i++) {
    const m1 = shadowify(new THREE.Mesh(GEO.box, merlonMat));
    if (axis) { m1.scale.set(5, 4, 4); m1.position.set(-platformW / 2 + 8 + i * ((platformW - 16) / (count - 1)), pH + 2, platformD / 2 - 2); }
    else { m1.scale.set(4, 4, 5); m1.position.set(platformW / 2 - 2, pH + 2, -platformD / 2 + 8 + i * ((platformD - 16) / (count - 1))); }
    g.add(m1);
  }
  // 城楼（重檐）
  const tower = makeTower(axis ? 40 : 30, axis ? 26 : 40, 2, ROOF_GREEN);
  tower.position.y = pH;
  g.add(tower);
  return g;
}

// ---------- 角楼 ----------
export function makeCornerTower() {
  const g = new THREE.Group();
  const plat = shadowify(new THREE.Mesh(new THREE.BoxGeometry(46, 24, 46), mats.brick));
  plat.position.y = 12; g.add(plat);
  const t = makeTower(24, 24, 2, ROOF_GREEN);
  t.position.y = 24; g.add(t);
  return g;
}

// ---------- 阳和楼（跨街高台楼阁） ----------
export function makeYangheLou() {
  const g = new THREE.Group();
  const pH = 20;
  const plat = shadowify(new THREE.Mesh(new THREE.BoxGeometry(92, pH, 40), mats.brick));
  plat.position.y = pH / 2; g.add(plat);
  const arch = new THREE.Mesh(new THREE.BoxGeometry(18, 16, 42), new THREE.MeshStandardMaterial({ color: 0x1c1814 }));
  arch.position.y = 8; g.add(arch);
  const hall = makeHall(48, 26, 14, ROOF_GREEN, { baseH: 1.5 });
  hall.position.y = pH; g.add(hall);
  // 两侧碑亭小阁
  for (const sx of [-1, 1]) {
    const p = makeTower(14, 14, 1, ROOF_GREEN);
    p.position.set(sx * 34, pH, 0); g.add(p);
  }
  return g;
}

// ---------- 普通寺院（中轴院落） ----------
export function makeTempleComplex(scale = 1) {
  const g = new THREE.Group();
  // 院墙
  const wall = shadowify(new THREE.Mesh(new THREE.BoxGeometry(120 * scale, 6, 150 * scale), new THREE.MeshStandardMaterial({ color: 0x8c2f24, roughness: 0.9 })));
  wall.position.y = -12; wall.material.transparent = true; wall.material.opacity = 0.18; wall.material.depthWrite = false;
  g.add(wall);
  const gate = makeHall(34 * scale, 18 * scale, 9, ROOF_GREY, { baseH: 1.5 });
  gate.position.set(0, 0, -62 * scale); g.add(gate);
  const main = makeHall(52 * scale, 30 * scale, 14, ROOF_GREEN);
  main.position.set(0, 0, 6 * scale); g.add(main);
  const back = makeHall(40 * scale, 24 * scale, 12, ROOF_GREEN, { baseH: 2 });
  back.position.set(0, 0, 56 * scale); g.add(back);
  for (const sx of [-1, 1]) {
    const wing = makeHall(18 * scale, 40 * scale, 10, ROOF_GREY, { baseH: 1.5 });
    wing.rotation.y = Math.PI / 2;
    wing.position.set(sx * 44 * scale, 0, 2 * scale); g.add(wing);
  }
  // 香炉
  const urn = shadowify(new THREE.Mesh(new THREE.CylinderGeometry(3, 2, 5, 10), mats.stoneDark));
  urn.position.set(0, 2.5, -24 * scale); g.add(urn);
  return g;
}

// ---------- 隆兴寺（大型多进院落） ----------
export function makeLongxingTemple() {
  const g = new THREE.Group();
  const s = 1.35;
  // 照壁与山门
  const screen = shadowify(new THREE.Mesh(new THREE.BoxGeometry(70, 12, 4), mats.red));
  screen.position.set(0, 6, -150 * s); g.add(screen);
  const gate = makeHall(46, 22, 11, ROOF_GREEN);
  gate.position.set(0, 0, -128 * s); g.add(gate);
  // 天王殿
  const tianwang = makeHall(52, 26, 13, ROOF_GREEN);
  tianwang.position.set(0, 0, -80 * s); g.add(tianwang);
  // 大觉六师殿遗址（台基）
  const ruin = shadowify(new THREE.Mesh(new THREE.BoxGeometry(64, 4, 44), mats.stone));
  ruin.position.set(0, 2, -34 * s); g.add(ruin);
  for (let i = 0; i < 6; i++) {
    const col = shadowify(new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.6, 10, 10), mats.stoneDark));
    col.position.set(-25 + i * 10, 9, -34 * s); g.add(col);
  }
  // 摩尼殿（十字抱厦）
  const moni = new THREE.Group();
  const core = makeHall(50, 44, 15, ROOF_GREEN);
  moni.add(core);
  for (const [rx, rz] of [[0, -1], [0, 1], [1, 0], [-1, 0]]) {
    const bao = makeHall(20, 18, 10, ROOF_GREEN, { baseH: 2.2 });
    bao.position.set(rx * 26, 0, rz * 26);
    if (rx !== 0) bao.rotation.y = Math.PI / 2;
    moni.add(bao);
  }
  moni.position.set(0, 0, 16 * s); g.add(moni);
  // 戒坛
  const altar = shadowify(new THREE.Mesh(new THREE.CylinderGeometry(18, 20, 8, 8), mats.stone));
  altar.position.set(-34, 4, 56 * s); g.add(altar);
  // 大悲阁（主体高阁，千手千眼观音所在）
  const dbei = makeTower(62, 46, 3, ROOF_GREEN);
  dbei.position.set(0, 0, 78 * s); g.add(dbei);
  // 两侧配阁
  for (const sx of [-1, 1]) {
    const ge = makeTower(26, 22, 2, ROOF_GREEN);
    ge.position.set(sx * 52, 0, 78 * s); g.add(ge);
  }
  // 弥陀殿 / 毗卢殿（最后）
  const pilu = makeHall(48, 28, 14, ROOF_GREEN);
  pilu.position.set(0, 0, 126 * s); g.add(pilu);
  // 长廊
  for (const sx of [-1, 1]) {
    const corr = shadowify(new THREE.Mesh(new THREE.BoxGeometry(8, 10, 240), mats.redDark));
    corr.position.set(sx * 60, 7, -10 * s); g.add(corr);
    const corrRoof = makeHipRoof(14, 248, 7, ROOF_GREY, 0.1);
    corrRoof.position.set(sx * 60, 12, -10 * s); g.add(corrRoof);
  }
  return g;
}

// ---------- 荣国府（多路四合院） ----------
export function makeMansion(big = true) {
  const g = new THREE.Group();
  const s = big ? 1 : 0.7;
  // 大门
  const gate = makeHall(26 * s, 14 * s, 8, ROOF_GREY, { baseH: 1.2 });
  gate.position.set(0, 0, -48 * s); g.add(gate);
  // 三进正房
  const rows = [-12, 24];
  for (const z of rows) {
    const hall = makeHall(34 * s, 18 * s, 10, ROOF_GREY, { baseH: 1.5 });
    hall.position.set(0, 0, z * s); g.add(hall);
  }
  const main = makeHall(42 * s, 22 * s, 12, ROOF_RED, { baseH: 2 });
  main.position.set(0, 0, 54 * s); g.add(main);
  // 东西厢
  for (const sx of [-1, 1]) for (const z of [-12, 24]) {
    const wing = makeHall(14 * s, 24 * s, 8, ROOF_GREY, { baseH: 1.2 });
    wing.rotation.y = Math.PI / 2;
    wing.position.set(sx * 30 * s, 0, z * s); g.add(wing);
  }
  // 东西跨院
  for (const sx of [-1, 1]) {
    const side = makeHall(24 * s, 16 * s, 9, ROOF_GREY, { baseH: 1.2 });
    side.position.set(sx * 48 * s, 0, 20 * s); g.add(side);
  }
  return g;
}

// ---------- 民居四合院 ----------
export function makeCourtyard(seed = 1) {
  const g = new THREE.Group();
  const s = 0.55 + (seed % 5) * 0.05;
  const colors = [ROOF_GREY, 0x55423a, ROOF_GREY];
  const north = makeHall(26 * s, 14 * s, 8, colors[seed % 3], { baseH: 1 });
  north.position.set(0, 0, 16 * s); g.add(north);
  const south = makeHall(20 * s, 10 * s, 6, ROOF_GREY, { baseH: 1 });
  south.position.set(0, 0, -16 * s); g.add(south);
  for (const sx of [-1, 1]) {
    const wing = makeHall(10 * s, 20 * s, 6, ROOF_GREY, { baseH: 1 });
    wing.rotation.y = Math.PI / 2;
    wing.position.set(sx * 16 * s, 0, 0); g.add(wing);
  }
  return g;
}

// ---------- 清真寺 ----------
export function makeMosque() {
  const g = makeTempleComplex(0.9);
  const domeBase = shadowify(new THREE.Mesh(new THREE.BoxGeometry(30, 16, 30), mats.wall));
  domeBase.position.set(0, 20, 50); g.add(domeBase);
  const dome = shadowify(new THREE.Mesh(new THREE.SphereGeometry(16, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), roofMat(0x3f6b63)));
  dome.position.set(0, 28, 50); g.add(dome);
  const spire = shadowify(new THREE.Mesh(GEO.cone, mats.gold), true, false);
  spire.scale.set(1.2, 6, 1.2); spire.position.set(0, 47, 50); g.add(spire);
  return g;
}

// ---------- 遗址碑 ----------
export function makeStele() {
  const g = new THREE.Group();
  const base = shadowify(new THREE.Mesh(new THREE.BoxGeometry(8, 3, 6), mats.stone));
  base.position.y = 1.5; g.add(base);
  const st = shadowify(new THREE.Mesh(new THREE.BoxGeometry(4, 11, 1.4), mats.stoneDark));
  st.position.y = 8.5; g.add(st);
  const cap = makeHipRoof(7, 5, 2.5, ROOF_GREY, 0.05);
  cap.position.y = 14; g.add(cap);
  return g;
}

// ---------- 普通民居小屋（填充城市） ----------
export function makeHouse(rand) {
  const g = new THREE.Group();
  const w = 14 + rand() * 12;
  const d = 14 + rand() * 12;
  const h = 7 + rand() * 5;
  const body = shadowify(new THREE.Mesh(new THREE.BoxGeometry(w, h, d), rand() > 0.5 ? mats.wall : mats.wallWarm));
  body.position.y = h / 2; g.add(body);
  const roof = makeHipRoof(w + 3, d + 3, 4 + rand() * 3, ROOF_GREY, 0.08);
  roof.position.y = h; g.add(roof);
  return g;
}

// ---------- 城外现代/普通建筑 ----------
const MODERN_MATS = [
  0xb8b2a4, 0xc9c2b0, 0xa9a89e, 0xd2cab8, 0xb0a894
].map(c => new THREE.MeshStandardMaterial({ color: c, roughness: 0.85 }));
export function makeModernBuilding(rand) {
  const g = new THREE.Group();
  const w = 18 + rand() * 26;
  const d = 18 + rand() * 26;
  const h = 12 + rand() * 46;
  const body = shadowify(new THREE.Mesh(new THREE.BoxGeometry(w, h, d), MODERN_MATS[Math.floor(rand() * MODERN_MATS.length)]));
  body.position.y = h / 2; g.add(body);
  return g;
}

// ---------- 树 ----------
const treeTrunkGeo = new THREE.CylinderGeometry(0.8, 1.1, 7, 6);
const treeCrownGeo = new THREE.SphereGeometry(5, 8, 6);
export function makeTree(rand) {
  const g = new THREE.Group();
  const trunk = shadowify(new THREE.Mesh(treeTrunkGeo, mats.trunk));
  trunk.position.y = 3.5; g.add(trunk);
  const crown = shadowify(new THREE.Mesh(treeCrownGeo, mats.green));
  crown.scale.setScalar(0.8 + rand() * 0.6);
  crown.position.y = 9; g.add(crown);
  return g;
}

// ---------- 标签 Sprite ----------
export function makeLabel(text, color = '#ffe9b0') {
  const c = document.createElement('canvas');
  const ctx = c.getContext('2d');
  const fontSize = 44;
  ctx.font = `bold ${fontSize}px "Microsoft YaHei","PingFang SC",sans-serif`;
  const tw = ctx.measureText(text).width;
  c.width = Math.ceil(tw + 44);
  c.height = 76;
  const ctx2 = c.getContext('2d');
  ctx2.font = `bold ${fontSize}px "Microsoft YaHei","PingFang SC",sans-serif`;
  ctx2.fillStyle = 'rgba(20,14,8,0.62)';
  const r = 16;
  roundRect(ctx2, 2, 2, c.width - 4, c.height - 4, r);
  ctx2.fill();
  ctx2.strokeStyle = color;
  ctx2.lineWidth = 3;
  roundRect(ctx2, 2, 2, c.width - 4, c.height - 4, r);
  ctx2.stroke();
  ctx2.fillStyle = color;
  ctx2.textBaseline = 'middle';
  ctx2.fillText(text, 22, c.height / 2 + 2);
  const tex = new THREE.CanvasTexture(c);
  tex.anisotropy = 4;
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false, depthWrite: false });
  const sp = new THREE.Sprite(mat);
  const scale = 0.16;
  sp.scale.set(c.width * scale, c.height * scale, 1);
  sp.renderOrder = 999;
  return sp;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export const MATERIALS = mats;
