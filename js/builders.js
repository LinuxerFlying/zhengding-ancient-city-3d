// 中式古建 3D 构件库
import * as THREE from 'three';

// ---------- 材质 ----------
const mats = {
  wall: new THREE.MeshStandardMaterial({ color: 0xf2e6cf, roughness: 0.85 }),
  wallWarm: new THREE.MeshStandardMaterial({ color: 0xddccb0, roughness: 0.9 }),
  red: new THREE.MeshStandardMaterial({ color: 0x8c2f24, roughness: 0.7 }),
  redBright: new THREE.MeshStandardMaterial({ color: 0xa33627, roughness: 0.65 }),
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

// ---------- 凌霄塔（八角楼阁式木塔，9层） ----------
const winDarkMat = new THREE.MeshStandardMaterial({ color: 0x241a12, roughness: 0.6 });
const lingWinMat = new THREE.MeshStandardMaterial({ map: latticeTexture('#241a12', '#a33627'), roughness: 0.7 });
const LING_GREEN = 0x2e6b4f;

function addLingEave(g, r, yEave, h, up) {
  const eave = makeEaveRing(r, h, 8, LING_GREEN, up);
  eave.position.y = yEave; g.add(eave);
  const faceHalf = r * Math.tan(Math.PI / 8) * 0.72;
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2;
    const nx = Math.sin(a), nz = Math.cos(a);
    const tx = Math.cos(a), tz = -Math.sin(a);
    for (const u of [-faceHalf, 0, faceHalf]) {
      const raft = shadowify(new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.9, 3), mats.wood), true, false);
      raft.position.set(nx * (r - 1.4) + tx * u, yEave - 1.1, nz * (r - 1.4) + tz * u);
      raft.rotation.y = a;
      g.add(raft);
    }
  }
  const tileRing = shadowify(new THREE.Mesh(new THREE.CylinderGeometry(r + 0.25, r + 0.25, 0.8, 8), roofMat(LING_GREEN)), true, false);
  tileRing.position.y = yEave - 0.5; g.add(tileRing);
}

export function makeLingxiaoPagoda() {
  const g = new THREE.Group();
  let y = 0;
  const base1 = shadowify(new THREE.Mesh(new THREE.CylinderGeometry(30, 34, 5, 8), mats.stone));
  base1.position.y = 2.5; g.add(base1);
  const base2 = shadowify(new THREE.Mesh(new THREE.CylinderGeometry(26, 29, 5, 8), mats.stoneDark));
  base2.position.y = 7.5; g.add(base2);
  y = 10;
  let r = 21;

  const addWall = (yBase, bodyH, rr, first) => {
    const faceR = rr * Math.cos(Math.PI / 8);
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2;
      const nx = Math.sin(a), nz = Math.cos(a);
      const col = shadowify(new THREE.Mesh(new THREE.CylinderGeometry(0.95, 1.05, bodyH + 0.8, 8), mats.redBright));
      col.position.set(nx * rr, yBase + bodyH / 2, nz * rr);
      g.add(col);
      const panelW = rr * 0.62;
      const panel = shadowify(new THREE.Mesh(new THREE.BoxGeometry(panelW, bodyH * 0.78, 0.7), mats.red));
      panel.position.set(nx * (faceR - 0.15), yBase + bodyH * 0.5, nz * (faceR - 0.15));
      panel.rotation.y = a;
      g.add(panel);
      if (first && k === 4) {
        const doorFrame = shadowify(new THREE.Mesh(new THREE.BoxGeometry(8, bodyH * 0.8, 0.5), mats.redBright));
        doorFrame.position.set(nx * (faceR + 0.1), yBase + bodyH * 0.42, nz * (faceR + 0.1));
        doorFrame.rotation.y = a;
        g.add(doorFrame);
        const door = new THREE.Mesh(new THREE.BoxGeometry(6.4, bodyH * 0.72, 0.8), winDarkMat);
        door.position.set(nx * (faceR + 0.35), yBase + bodyH * 0.38, nz * (faceR + 0.35));
        door.rotation.y = a;
        g.add(door);
      } else {
        const winW = rr * (first ? 0.3 : 0.32);
        const winH = bodyH * 0.4;
        const frame = shadowify(new THREE.Mesh(new THREE.BoxGeometry(winW + 1.5, winH + 1.5, 0.5), mats.redBright));
        frame.position.set(nx * (faceR + 0.1), yBase + bodyH * 0.56, nz * (faceR + 0.1));
        frame.rotation.y = a;
        g.add(frame);
        const win = new THREE.Mesh(new THREE.BoxGeometry(winW, winH, 0.7), lingWinMat);
        win.position.set(nx * (faceR + 0.35), yBase + bodyH * 0.56, nz * (faceR + 0.35));
        win.rotation.y = a;
        g.add(win);
      }
    }
    for (const fy of [yBase + 0.5, yBase + bodyH - 0.5]) {
      const beam = shadowify(new THREE.Mesh(new THREE.CylinderGeometry(rr * 1.03, rr * 1.03, 1.4, 8, 1, true), mats.redDark));
      beam.position.y = fy; g.add(beam);
    }
  };

  const addBalustrade = (yBase, rr) => {
    const railR = rr + 3;
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2 + Math.PI / 8;
      const post = shadowify(new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 2.8, 6), mats.redDark));
      post.position.set(Math.sin(a) * railR, yBase + 1.4, Math.cos(a) * railR);
      g.add(post);
    }
    for (const hy of [yBase + 1.2, yBase + 2.5]) {
      const rail = shadowify(new THREE.Mesh(new THREE.CylinderGeometry(railR, railR, 0.45, 8, 1, true), mats.redDark), false, true);
      rail.position.y = hy; g.add(rail);
    }
  };

  // 首层：高台基 + 副阶周匝 + 重檐
  const deck0 = shadowify(new THREE.Mesh(new THREE.CylinderGeometry(r + 3.4, r + 3.4, 1.6, 8), mats.wood));
  deck0.position.y = y + 1.2; g.add(deck0);
  const firstH = 11;
  const wallBase = y + 1.6;
  const porchR = r + 2.8;
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2;
    const nx = Math.sin(a), nz = Math.cos(a);
    const tx = Math.cos(a), tz = -Math.sin(a);
    for (const s of [-1, 1]) {
      const pc = shadowify(new THREE.Mesh(new THREE.CylinderGeometry(1, 1.1, 12, 8), mats.redBright));
      pc.position.set(nx * porchR + tx * s * porchR * 0.24, y + 6, nz * porchR + tz * s * porchR * 0.24);
      g.add(pc);
    }
  }
  addWall(wallBase, firstH, r, true);
  const firstTop = wallBase + firstH;
  addLingEave(g, r + 6.2, y + 10.5, 3.2, 1.4);
  addLingEave(g, r + 4.8, firstTop + 0.6, 5, 1.8);
  y = firstTop + 5.6;
  r *= 0.93;

  for (let i = 1; i < 9; i++) {
    const bodyH = 7.2 - i * 0.2;
    const deck = shadowify(new THREE.Mesh(new THREE.CylinderGeometry(r + 3.2, r + 3.2, 1.6, 8), mats.wood));
    deck.position.y = y + 0.8; g.add(deck);
    addBalustrade(y + 1.4, r);
    const yBase = y + 2.2;
    addWall(yBase, bodyH, r, false);
    const yTop = yBase + bodyH;
    addLingEave(g, r + 4.8, yTop, i === 8 ? 5 : 4.4, 1.6);
    y = yTop + (i === 8 ? 5 : 4.4);
    r *= 0.93;
  }

  const pole = shadowify(new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.9, 17, 8), mats.gold), true, false);
  pole.position.y = y + 7.5; g.add(pole);
  for (let i = 0; i < 4; i++) {
    const disc = shadowify(new THREE.Mesh(new THREE.CylinderGeometry(3.4 - i * 0.4, 3.4 - i * 0.4, 1.3, 8), mats.gold), true, false);
    disc.position.y = y + 1.4 + i * 1.8; g.add(disc);
  }
  const bead = shadowify(new THREE.Mesh(GEO.sphere, mats.gold), true, false);
  bead.scale.setScalar(2.4); bead.position.y = y + 9.4; g.add(bead);
  const fin = shadowify(new THREE.Mesh(GEO.cone, mats.gold), true, false);
  fin.scale.set(1.6, 7, 1.6); fin.position.y = y + 14.5; g.add(fin);
  g.userData.height = y + 18;
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

// ---------- 现代建筑立面纹理 ----------
function facadeTexture(base, win, lit, cols, rows, seed, style = 0) {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = base; g.fillRect(0, 0, 128, 256);
  const rng = mulberry32(seed);
  const cw = 128 / cols, ch = 256 / rows;
  for (let r = 0; r < rows; r++) {
    for (let colI = 0; colI < cols; colI++) {
      const on = rng() > 0.22;
      g.fillStyle = on ? (rng() > 0.82 ? lit : win) : 'rgba(20,26,30,0.9)';
      const m = style === 1 ? 2.2 : 3.2;
      g.fillRect(colI * cw + m, r * ch + m * 0.7, cw - m * 2, ch - m * 1.6);
    }
  }
  if (style === 1) {
    g.strokeStyle = 'rgba(255,255,255,0.18)';
    g.lineWidth = 2;
    for (let i = 1; i < cols; i++) {
      g.beginPath(); g.moveTo(i * cw, 0); g.lineTo(i * cw, 256); g.stroke();
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.anisotropy = 4;
  return tex;
}
const facadeMats = [];
[
  ['#8fa3ad', '#d8ecf2', '#ffe9b0', 8, 18, 11, 0],
  ['#6e8894', '#cfe5ee', '#ffd98a', 7, 20, 22, 0],
  ['#b7b2a6', '#dfe7ea', '#ffe4a0', 9, 22, 33, 1],
  ['#9aa6ad', '#cfe0e8', '#fff0bf', 6, 24, 44, 1],
  ['#a8957f', '#e8e0cf', '#ffdf9e', 8, 20, 55, 1],
  ['#7d8f76', '#dce8d4', '#ffe2a0', 7, 22, 66, 0]
].forEach(a => {
  const tex = facadeTexture(...a);
  facadeMats.push(new THREE.MeshStandardMaterial({ map: tex, roughness: 0.55, metalness: 0.18 }));
});
const concreteMat = new THREE.MeshStandardMaterial({ color: 0xb4afa4, roughness: 0.9 });
const podiumMat = new THREE.MeshStandardMaterial({ color: 0xc2b49c, roughness: 0.8 });
const glassDark = new THREE.MeshStandardMaterial({ color: 0x33424c, roughness: 0.2, metalness: 0.6 });

// 现代办公楼（写字楼）
export function makeOfficeTower(rand) {
  const g = new THREE.Group();
  const w = 46 + rand() * 34;
  const d = 42 + rand() * 26;
  const floors = 12 + Math.floor(rand() * 14);
  const fh = 6.2;
  const h = floors * fh;
  const mat = facadeMats[Math.floor(rand() * 4)];
  const body = shadowify(new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat));
  body.position.y = h / 2; g.add(body);
  // 裙房
  const pw = w + 18 + rand() * 14;
  const pd = d + 14 + rand() * 10;
  const podium = shadowify(new THREE.Mesh(new THREE.BoxGeometry(pw, 14, pd), podiumMat));
  podium.position.y = 7; g.add(podium);
  const shopGlass = new THREE.Mesh(new THREE.BoxGeometry(pw - 4, 7, pd - 4), glassDark);
  shopGlass.position.y = 7; g.add(shopGlass);
  // 顶部退台/构架
  if (rand() > 0.4) {
    const cap = shadowify(new THREE.Mesh(new THREE.BoxGeometry(w * 0.55, 8, d * 0.55), mat));
    cap.position.y = h + 4; g.add(cap);
    const mast = shadowify(new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 18, 6), mats.gold), false, false);
    mast.position.y = h + 17; g.add(mast);
  }
  g.userData.height = h + 20;
  return g;
}

// 现代居民楼（板式住宅）
export function makeResidentialTower(rand) {
  const g = new THREE.Group();
  const w = 26 + rand() * 14;
  const d = 60 + rand() * 30;
  const floors = 11 + Math.floor(rand() * 12);
  const fh = 4.6;
  const h = floors * fh;
  const mat = facadeMats[2 + Math.floor(rand() * 4) % 4];
  const body = shadowify(new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat));
  body.position.y = h / 2; g.add(body);
  // 阳台条
  for (let r = 2; r < floors; r += 2) {
    const slab = shadowify(new THREE.Mesh(new THREE.BoxGeometry(w + 2.4, 0.5, d + 2.4), concreteMat), false, true);
    slab.position.y = r * fh; g.add(slab);
  }
  // 楼顶水箱/电梯间
  const cap = shadowify(new THREE.Mesh(new THREE.BoxGeometry(w * 0.5, 6, d * 0.35), concreteMat));
  cap.position.set(0, h + 3, 0); g.add(cap);
  return g;
}

// 现代低层商业体
export function makeCommercialLow(rand) {
  const g = new THREE.Group();
  const w = 70 + rand() * 50;
  const d = 40 + rand() * 24;
  const h = 16 + rand() * 10;
  const body = shadowify(new THREE.Mesh(new THREE.BoxGeometry(w, h, d), podiumMat));
  body.position.y = h / 2; g.add(body);
  const glass = new THREE.Mesh(new THREE.BoxGeometry(w - 4, h * 0.55, d - 4), glassDark);
  glass.position.y = h * 0.42; g.add(glass);
  const cap = shadowify(new THREE.Mesh(new THREE.BoxGeometry(w + 6, 2.4, d + 6), facadeMats[1]));
  cap.position.y = h + 1.2; g.add(cap);
  return g;
}

// ---------- 临街二层仿古商铺 ----------
const SHOP_SIGNS = ['正定八大碗', '马家卤鸡', '崩肝小吃', '郝家排骨', '常山郡', '真定府', '宋记糕坊', '阳和茶馆', '元曲书场', '非遗工坊', '老字号', '古玩字画', '正定特产', '腊味铺子'];
const signTexCache = {};
function signTexture(text) {
  if (signTexCache[text]) return signTexCache[text];
  const c = document.createElement('canvas');
  c.width = 256; c.height = 64;
  const g = c.getContext('2d');
  g.fillStyle = '#3a2117'; g.fillRect(0, 0, 256, 64);
  g.strokeStyle = '#d8b15a'; g.lineWidth = 5; g.strokeRect(4, 4, 248, 56);
  g.fillStyle = '#f0d590';
  g.font = 'bold 34px "KaiTi","STKaiti","SimSun",serif';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(text, 128, 35);
  const tex = new THREE.CanvasTexture(c);
  signTexCache[text] = tex;
  return tex;
}
export function makeShop(text) {
  const g = new THREE.Group();
  const w = 17, d = 13, h = 11;
  const base = shadowify(new THREE.Mesh(new THREE.BoxGeometry(w + 1.5, 1.6, d + 1.5), mats.stone));
  base.position.y = 0.8; g.add(base);
  const body = shadowify(new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mats.wall));
  body.position.y = 1.6 + h / 2; g.add(body);
  // 一层铺面（暗红敞廊）
  const front = new THREE.Mesh(new THREE.BoxGeometry(w - 2, 4.6, 0.8), mats.redDark);
  front.position.set(0, 1.6 + 2.4, -d / 2 - 0.1); g.add(front);
  // 檐柱
  for (const sx of [-1, 1]) {
    const col = shadowify(new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.5, 5.4, 8), mats.red));
    col.position.set(sx * (w / 2 - 1.2), 1.6 + 2.7, -d / 2 - 0.5); g.add(col);
  }
  // 招牌
  const sign = new THREE.Mesh(
    new THREE.PlaneGeometry(w - 2, 3.2),
    new THREE.MeshBasicMaterial({ map: signTexture(text) })
  );
  sign.position.set(0, 1.6 + 7.6, -d / 2 - 0.45); g.add(sign);
  // 二层窗
  const win = new THREE.Mesh(new THREE.BoxGeometry(w - 3, 3, 0.6), new THREE.MeshStandardMaterial({ map: latticeTexture(), roughness: 0.7 }));
  win.position.set(0, 1.6 + h - 2.4, -d / 2 - 0.2); g.add(win);
  // 檐顶
  const roof = makeHipRoof(w + 3.5, d + 3.5, 4.2, ROOF_GREY, 0.12);
  roof.position.y = 1.6 + h; g.add(roof);
  return g;
}
export function randomShopName(rand) {
  return SHOP_SIGNS[Math.floor(rand() * SHOP_SIGNS.length)];
}

// ---------- 牌坊 ----------
export function makePaifang(text) {
  const g = new THREE.Group();
  const span = 42;
  for (const sx of [-1, 1]) {
    const col = shadowify(new THREE.Mesh(new THREE.BoxGeometry(2.6, 22, 2.6), mats.red));
    col.position.set(sx * span / 2, 11, 0); g.add(col);
    const foot = shadowify(new THREE.Mesh(new THREE.BoxGeometry(5, 2, 5), mats.stone));
    foot.position.set(sx * span / 2, 1, 0); g.add(foot);
  }
  const beam1 = shadowify(new THREE.Mesh(new THREE.BoxGeometry(span + 8, 3, 3.4), mats.red));
  beam1.position.y = 15; g.add(beam1);
  const beam2 = shadowify(new THREE.Mesh(new THREE.BoxGeometry(span + 2, 2.4, 3), mats.redDark));
  beam2.position.y = 19.5; g.add(beam2);
  const board = new THREE.Mesh(
    new THREE.PlaneGeometry(span - 10, 7),
    new THREE.MeshBasicMaterial({ map: plaqueTexture(text, '#2a1a10', '#f0d590') })
  );
  board.position.set(0, 17.4, -1.9); g.add(board);
  const roof = makeHipRoof(span + 10, 8, 5, ROOF_GREY, 0.16);
  roof.position.y = 21; g.add(roof);
  return g;
}

// ---------- 游客服务中心（新中式） ----------
export function makeVisitorCenter() {
  const g = new THREE.Group();
  const plat = shadowify(new THREE.Mesh(new THREE.BoxGeometry(120, 2, 70), mats.stone));
  plat.position.y = 1; g.add(plat);
  const body = shadowify(new THREE.Mesh(new THREE.BoxGeometry(96, 16, 50), mats.wall));
  body.position.y = 10; g.add(body);
  const glass = new THREE.Mesh(new THREE.BoxGeometry(40, 10, 1.2), glassDark);
  glass.position.set(0, 8, -25.4); g.add(glass);
  for (const sx of [-1, 1]) for (let i = -2; i <= 2; i++) {
    const col = shadowify(new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1, 16, 10), mats.red));
    col.position.set(sx * 30 + i * 10, 10, -25.8); g.add(col);
  }
  const roof = makeHipRoof(108, 62, 12, ROOF_GREEN, 0.2);
  roof.position.y = 18; g.add(roof);
  const sign = new THREE.Mesh(
    new THREE.PlaneGeometry(52, 9),
    new THREE.MeshBasicMaterial({ map: plaqueTexture('游客服务中心', '#2a1a10', '#f0d590') })
  );
  sign.position.set(0, 14.5, -26.4); g.add(sign);
  return g;
}

// ---------- 博物馆（庄重现代） ----------
export function makeMuseum() {
  const g = new THREE.Group();
  const steps = shadowify(new THREE.Mesh(new THREE.BoxGeometry(150, 2.4, 90), mats.stone));
  steps.position.y = 1.2; g.add(steps);
  const body = shadowify(new THREE.Mesh(new THREE.BoxGeometry(120, 26, 64), new THREE.MeshStandardMaterial({ color: 0xcac2b0, roughness: 0.75 })));
  body.position.y = 15.2; g.add(body);
  // 柱廊
  for (let i = -5; i <= 5; i++) {
    const col = shadowify(new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.5, 20, 12), mats.stoneDark));
    col.position.set(i * 10, 14, -33); g.add(col);
  }
  const door = new THREE.Mesh(new THREE.BoxGeometry(20, 14, 1), glassDark);
  door.position.set(0, 9, -32.6); g.add(door);
  const roof = shadowify(new THREE.Mesh(new THREE.BoxGeometry(130, 3, 72), mats.stoneDark));
  roof.position.y = 29.5; g.add(roof);
  const sign = new THREE.Mesh(
    new THREE.PlaneGeometry(60, 10),
    new THREE.MeshBasicMaterial({ map: plaqueTexture('正定博物馆', '#241a10', '#f0d590') })
  );
  sign.position.set(0, 23, -33.6); g.add(sign);
  return g;
}

function plaqueTexture(text, bg, fg) {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = bg; roundRect(g, 4, 4, 504, 120, 12); g.fill();
  g.strokeStyle = '#c9a454'; g.lineWidth = 5; roundRect(g, 4, 4, 504, 120, 12); g.stroke();
  g.fillStyle = fg;
  g.font = `bold ${text.length > 5 ? 58 : 70}px "KaiTi","STKaiti","SimSun",serif`;
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(text, 256, 66);
  return new THREE.CanvasTexture(c);
}

// ---------- 停车场 ----------
export function makeParking(w, d) {
  const g = new THREE.Group();
  const c = document.createElement('canvas');
  c.width = 256; c.height = 256;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#6b6860'; ctx.fillRect(0, 0, 256, 256);
  ctx.strokeStyle = 'rgba(255,255,255,0.75)';
  ctx.lineWidth = 4;
  for (let i = 0; i <= 8; i++) {
    ctx.beginPath(); ctx.moveTo(i * 32, 0); ctx.lineTo(i * 32, 256); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, i * 32); ctx.lineTo(256, i * 32); ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  const plane = new THREE.Mesh(
    new THREE.PlaneGeometry(w, d),
    new THREE.MeshStandardMaterial({ map: tex, roughness: 1 })
  );
  plane.rotation.x = -Math.PI / 2;
  plane.position.y = 0.12;
  plane.receiveShadow = true;
  g.add(plane);
  return g;
}

// ---------- 广场 ----------
export function makePlaza(w, d) {
  const g = new THREE.Group();
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#b0a693'; ctx.fillRect(0, 0, 128, 128);
  ctx.strokeStyle = 'rgba(90,84,72,0.5)';
  ctx.lineWidth = 2;
  ctx.strokeRect(1, 1, 126, 126);
  ctx.beginPath(); ctx.moveTo(64, 0); ctx.lineTo(64, 128); ctx.moveTo(0, 64); ctx.lineTo(128, 64); ctx.stroke();
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(w / 24, d / 24);
  const plane = new THREE.Mesh(
    new THREE.PlaneGeometry(w, d),
    new THREE.MeshStandardMaterial({ map: tex, roughness: 1 })
  );
  plane.rotation.x = -Math.PI / 2;
  plane.position.y = 0.1;
  plane.receiveShadow = true;
  g.add(plane);
  // 中央鼎式雕塑
  const ped = shadowify(new THREE.Mesh(new THREE.CylinderGeometry(5, 6, 3, 8), mats.stoneDark));
  ped.position.y = 1.5; g.add(ped);
  const ding = shadowify(new THREE.Mesh(new THREE.CylinderGeometry(4, 3, 5, 8), new THREE.MeshStandardMaterial({ color: 0x6b4a26, metalness: 0.5, roughness: 0.4 })));
  ding.position.y = 5.5; g.add(ding);
  for (const sx of [-1, 1]) {
    const handle = shadowify(new THREE.Mesh(new THREE.TorusGeometry(1.6, 0.3, 8, 14, Math.PI), mats.gold));
    handle.position.set(sx * 4, 8.4, 0);
    handle.rotation.z = sx > 0 ? 0 : Math.PI;
    g.add(handle);
  }
  // 灯柱
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const pole = shadowify(new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 12, 6), mats.stoneDark));
    pole.position.set(sx * (w / 2 - 8), 6, sz * (d / 2 - 8)); g.add(pole);
    const lamp = new THREE.Mesh(GEO.sphere, new THREE.MeshBasicMaterial({ color: 0xfff2c0 }));
    lamp.scale.setScalar(1.1);
    lamp.position.set(sx * (w / 2 - 8), 12.4, sz * (d / 2 - 8)); g.add(lamp);
  }
  return g;
}

// ---------- 桥梁 ----------
export function makeBridge(len, width, opts = {}) {
  const g = new THREE.Group();
  const stone = opts.stone ? mats.stone : concreteMat;
  const deck = shadowify(new THREE.Mesh(new THREE.BoxGeometry(width, 3, len), stone));
  deck.position.y = 7; g.add(deck);
  // 路面
  const road = new THREE.Mesh(
    new THREE.PlaneGeometry(width - 8, len),
    new THREE.MeshStandardMaterial({ map: asphaltTexture(width, len), roughness: 1 })
  );
  road.rotation.x = -Math.PI / 2;
  road.position.y = 8.6;
  g.add(road);
  // 护栏
  for (const sx of [-1, 1]) {
    const rail = shadowify(new THREE.Mesh(new THREE.BoxGeometry(1.4, 3.4, len), mats.stoneDark));
    rail.position.set(sx * (width / 2 - 1.2), 10.4, 0); g.add(rail);
  }
  // 桥墩
  const pierCount = Math.max(1, Math.floor(len / 110));
  for (let i = 0; i <= pierCount; i++) {
    const z = -len / 2 + (i / pierCount) * len;
    if (Math.abs(z) < 20) continue;
    for (const sx of [-1, 1]) {
      const pier = shadowify(new THREE.Mesh(new THREE.BoxGeometry(3, 13, 6), mats.stoneDark));
      pier.position.set(sx * (width / 2 - 8), 0.5, z); g.add(pier);
    }
  }
  if (!opts.stone) {
    // 路灯
    for (let lz = -len / 2 + 30; lz < len / 2; lz += 90) for (const sx of [-1, 1]) {
      const pole = shadowify(new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 16, 6), mats.stoneDark));
      pole.position.set(sx * (width / 2 - 5), 16, lz); g.add(pole);
      const lamp = new THREE.Mesh(GEO.sphere, new THREE.MeshBasicMaterial({ color: 0xfff2c0 }));
      lamp.scale.setScalar(1);
      lamp.position.set(sx * (width / 2 - 5), 24.4, lz); g.add(lamp);
    }
  }
  return g;
}

export function asphaltTexture(width, len) {
  const c = document.createElement('canvas');
  c.width = 64; c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#4a4742'; g.fillRect(0, 0, 64, 256);
  const rng = mulberry32(Math.floor(len) + Math.floor(width));
  for (let i = 0; i < 300; i++) {
    g.fillStyle = `rgba(255,255,255,${rng() * 0.05})`;
    g.fillRect(rng() * 64, rng() * 256, 2, 2);
  }
  g.strokeStyle = 'rgba(240,235,210,0.85)';
  g.lineWidth = 3;
  g.setLineDash([26, 22]);
  g.beginPath(); g.moveTo(32, 0); g.lineTo(32, 256); g.stroke();
  g.setLineDash([]);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(1, Math.max(1, len / 90));
  return tex;
}

// 现代城区地面铺装
export function makeUrbanPad(w, d) {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#9b9a92'; g.fillRect(0, 0, 128, 128);
  const rng = mulberry32(Math.floor(Math.abs(w * 7 + d)) + 1);
  for (let i = 0; i < 500; i++) {
    g.fillStyle = `rgba(60,60,58,${rng() * 0.08})`;
    g.fillRect(rng() * 128, rng() * 128, 2, 2);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(Math.abs(w) / 120, Math.abs(d) / 120);
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(w, d),
    new THREE.MeshStandardMaterial({ map: tex, roughness: 1 })
  );
  m.rotation.x = -Math.PI / 2;
  m.position.y = 0.06;
  m.receiveShadow = true;
  return m;
}

export const MATERIALS = mats;
