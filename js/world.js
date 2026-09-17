// 正定古城 3D 世界组装
import * as THREE from 'three';
import { CITY, POIS } from './data.js';
import * as B from './builders.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const { halfW: W, halfD: D, wallH, wallThick } = CITY;

const pickables = [];

// 方位映射：数据坐标 x+ = 东、z+ = 北；Three.js 初始相机在 -Z（南）向北看时，
// 屏幕右侧对应场景 -X，故场景位置 sx = -数据x，sz = 数据z。
const SX = x => -x;

function register(group, poi, scene) {
  // 将一个景点的网格按材质合并，减少 draw call；保留可拾取性。
  // 几何烘焙为世界坐标，合并网格直接加入场景（避免挂回带偏移的 group 造成二次平移）。
  const buckets = new Map();
  group.updateMatrixWorld(true);
  group.traverse(o => {
    if (!o.isMesh) return;
    let geo = o.geometry.clone();
    if (geo.index) geo = geo.toNonIndexed();
    geo.applyMatrix4(o.matrixWorld);
    if (!buckets.has(o.material)) buckets.set(o.material, []);
    buckets.get(o.material).push(geo);
  });
  for (const [mat, geos] of buckets) {
    const merged = mergeGeometries(geos, false);
    if (!merged) continue;
    const m = new THREE.Mesh(merged, mat);
    m.userData.poi = poi;
    m.castShadow = !(mat.transparent || mat.isMeshBasicMaterial);
    m.receiveShadow = true;
    scene.add(m);
    pickables.push(m);
  }
}

export function getPickables() {
  return pickables;
}

// ---------- 地形 ----------
function buildGround(scene) {
  const tex = makeGroundTexture();
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(14, 14);
  const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 1 });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(6400, 6400), mat);
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.15;
  ground.receiveShadow = true;
  scene.add(ground);

  // 古城内地坪（略高，颜色略不同）
  const innerTex = makeInnerTexture();
  innerTex.wrapS = innerTex.wrapT = THREE.RepeatWrapping;
  innerTex.repeat.set(8, 9);
  const inner = new THREE.Mesh(
    new THREE.PlaneGeometry(W * 2 - 80, D * 2 - 80),
    new THREE.MeshStandardMaterial({ map: innerTex, roughness: 1 })
  );
  inner.rotation.x = -Math.PI / 2;
  inner.position.y = 0.02;
  inner.receiveShadow = true;
  scene.add(inner);
}

function makeGroundTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#7d8f5f';
  g.fillRect(0, 0, 256, 256);
  const rng = B.mulberry32(7);
  for (let i = 0; i < 2600; i++) {
    const v = 90 + rng() * 60;
    g.fillStyle = `rgba(${v * 0.75},${v},${v * 0.55},0.25)`;
    g.fillRect(rng() * 256, rng() * 256, 2 + rng() * 3, 2 + rng() * 3);
  }
  return new THREE.CanvasTexture(c);
}

function makeInnerTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#b3a487';
  g.fillRect(0, 0, 256, 256);
  const rng = B.mulberry32(13);
  for (let i = 0; i < 2200; i++) {
    const v = 120 + rng() * 70;
    g.fillStyle = `rgba(${v},${v * 0.92},${v * 0.74},0.3)`;
    g.fillRect(rng() * 256, rng() * 256, 2 + rng() * 3, 2 + rng() * 3);
  }
  return new THREE.CanvasTexture(c);
}

// ---------- 滹沱河（城南，自西向东） ----------
function buildRiver(scene) {
  const shape = new THREE.Shape();
  const pts = [
    [-3200, -1240], [-2200, -1150], [-1400, -1200], [-700, -1290],
    [0, -1350], [700, -1300], [1400, -1220], [2200, -1260], [3200, -1180]
  ];
  shape.moveTo(pts[0][0], -pts[0][1]);
  for (let i = 1; i < pts.length; i++) shape.lineTo(pts[i][0], -pts[i][1]);
  for (let i = pts.length - 1; i >= 0; i--) shape.lineTo(pts[i][0], -(pts[i][1] - 260 - (i % 2) * 60));
  shape.closePath();
  const geo = new THREE.ShapeGeometry(shape);
  const waterMat = new THREE.MeshStandardMaterial({
    color: 0x4a7d8c, roughness: 0.25, metalness: 0.35, transparent: true, opacity: 0.9
  });
  const river = new THREE.Mesh(geo, waterMat);
  river.rotation.x = -Math.PI / 2;
  river.position.y = 0.05;
  river.receiveShadow = true;
  scene.add(river);

  // 河岸沙带
  const sand = new THREE.Mesh(geo.clone(), new THREE.MeshStandardMaterial({ color: 0xc9bd97, roughness: 1 }));
  sand.rotation.x = -Math.PI / 2;
  sand.position.y = 0.0;
  sand.scale.set(1.04, 1.04, 1);
  scene.add(sand);

  // 河流名称
  const label = B.makeLabel('滹 沱 河', '#bfe6ef');
  label.position.set(SX(-1100), 40, -1380);
  label.scale.multiplyScalar(2.2);
  scene.add(label);
}

// ---------- 道路 ----------
function addRoad(scene, dx1, z1, dx2, z2, width, mat, y = 0.06) {
  const x1 = SX(dx1), x2 = SX(dx2);
  const ddx = x2 - x1, dz = z2 - z1;
  const len = Math.hypot(ddx, dz);
  if (len < 0.001) return;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(width, len), mat);
  m.rotation.x = -Math.PI / 2;
  m.rotation.z = -Math.atan2(ddx, dz);
  m.position.set((x1 + x2) / 2, y, (z1 + z2) / 2);
  m.receiveShadow = true;
  scene.add(m);
  return m;
}

// 隆兴寺寺址占位（数据坐标），街巷在此区间断开（寺内自有院落甬道）
const TEMPLE_BLOCK = { x0: 432, x1: 698, z0: 128, z1: 542 };

function splitByBlock(a, b, blockStart, blockEnd, width) {
  let segs = [[a, b]];
  const b0 = blockStart - width * 0.5, b1 = blockEnd + width * 0.5;
  for (let i = segs.length - 1; i >= 0; i--) {
    const [s, e] = segs[i];
    if (b1 > s && b0 < e) {
      segs.splice(i, 1);
      if (b0 - s > 4) segs.push([s, Math.min(b0, e)]);
      if (e - b1 > 4) segs.push([Math.max(b1, s), e]);
    }
  }
  return segs;
}

function segRoadH(scene, x1, x2, z, width, mat, block = null) {
  const segs = block && z > block.z0 && z < block.z1
    ? splitByBlock(x1, x2, block.x0, block.x1, width)
    : [[x1, x2]];
  for (const [s, e] of segs) addRoad(scene, s, z, e, z, width, mat);
}

function segRoadV(scene, x, z1, z2, width, mat, block = null) {
  const segs = block && x > block.x0 && x < block.x1
    ? splitByBlock(z1, z2, block.z0, block.z1, width)
    : [[z1, z2]];
  for (const [s, e] of segs) addRoad(scene, x, s, x, e, width, mat);
}

function buildRoads(scene) {
  const roadMat = new THREE.MeshStandardMaterial({ color: 0x8d8270, roughness: 1 });
  const mainMat = new THREE.MeshStandardMaterial({ color: 0x9c9078, roughness: 1 });
  // 燕赵南大街 / 北大街（南北中轴）
  addRoad(scene, 0, -D + 30, 0, D - 30, 46, mainMat);
  // 中山路等东西向
  addRoad(scene, -W + 30, 0, W - 30, 0, 40, mainMat);
  segRoadH(scene, -W + 60, W - 60, -430, 20, roadMat, null);
  segRoadH(scene, -W + 60, W - 60, -100, 22, roadMat, null);
  segRoadH(scene, -W + 60, W - 60, 230, 20, roadMat, TEMPLE_BLOCK);
  segRoadH(scene, -W + 60, W - 60, 480, 20, roadMat, TEMPLE_BLOCK);
  // 纵向次干道（数据坐标；x=470 一路在寺址处断开）
  for (const x of [-470, -240, 240, 470]) {
    if (x === 470) segRoadV(scene, x, -D + 60, D - 60, 18, roadMat, TEMPLE_BLOCK);
    else segRoadV(scene, x, -D + 60, D - 60, 18, roadMat);
  }
  // 南关古道（长乐门至滹沱河大桥北端）
  addRoad(scene, 0, -D - 30, 0, -1290, 34, mainMat, 0.04);
  // 东门内至隆兴寺引道（迎旭门内 → 寺院山门外）
  addRoad(scene, W - 40, 60, 620, 60, 24, mainMat, 0.05);
  addRoad(scene, 620, 60, 560, 132, 24, mainMat, 0.05);
  // 城外道路网
  addRoad(scene, -2600, -1000, 2600, -1000, 18, roadMat, 0.03);
  addRoad(scene, -1000, -1200, -1000, 1500, 16, roadMat, 0.03);
  addRoad(scene, 1100, -1200, 1100, 1500, 16, roadMat, 0.03);
  addRoad(scene, -2600, 700, 2600, 700, 14, roadMat, 0.03);
}

// ---------- 城墙 ----------
function buildWalls(scene) {
  const mat = B.MATERIALS.brick;
  const mkWall = (w, d, x, z) => {
    const wall = new THREE.Mesh(new THREE.BoxGeometry(w, wallH, d), mat);
    wall.position.set(x, wallH / 2, z);
    wall.castShadow = true;
    wall.receiveShadow = true;
    scene.add(wall);
    // 顶部海墁
    const top = new THREE.Mesh(new THREE.BoxGeometry(w + 2, 1.2, d + 2), B.MATERIALS.stone);
    top.position.set(x, wallH + 0.4, z);
    top.receiveShadow = true;
    scene.add(top);
  };
  // 四门开口，每面墙分两段
  const gap = 34;
  // 南北墙（沿X）
  for (const z of [-D, D]) {
    const seg = W - gap / 2;
    mkWall(seg, wallThick, -(W + gap / 2) / 2 - gap / 4, z);
    mkWall(seg, wallThick, (W + gap / 2) / 2 + gap / 4, z);
  }
  // 东西墙（沿Z）
  for (const x of [-W, W]) {
    const seg = D - gap / 2;
    mkWall(wallThick, seg, x, -(D + gap / 2) / 2 - gap / 4);
    mkWall(wallThick, seg, x, (D + gap / 2) / 2 + gap / 4);
  }
  // 垛口（crenellations）
  const crenGeo = new THREE.BoxGeometry(6, 5, wallThick + 3);
  const crenMat = B.MATERIALS.stoneDark;
  const addCren = (x, z, rotY) => {
    const c = new THREE.Mesh(crenGeo, crenMat);
    c.position.set(x, wallH + 3, z);
    c.rotation.y = rotY;
    c.castShadow = true;
    scene.add(c);
  };
  for (let x = -W + 14; x <= W - 14; x += 22) {
    if (Math.abs(x) < gap + 8) continue;
    addCren(x, -D, 0); addCren(x, D, 0);
  }
  const crenGeo2 = new THREE.BoxGeometry(wallThick + 3, 5, 6);
  for (let z = -D + 14; z <= D - 14; z += 22) {
    if (Math.abs(z) < gap + 8) continue;
    for (const x of [-W, W]) {
      const c = new THREE.Mesh(crenGeo2, crenMat);
      c.position.set(x, wallH + 3, z);
      c.castShadow = true;
      scene.add(c);
    }
  }
  // 护城河
  const moatMat = new THREE.MeshStandardMaterial({ color: 0x47676f, roughness: 0.3, transparent: true, opacity: 0.85 });
  const addMoat = (w, d, x, z) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), moatMat);
    m.rotation.x = -Math.PI / 2;
    m.position.set(x, 0.08, z);
    scene.add(m);
  };
  for (const z of [-D - 60, D + 60]) addMoat(W * 2 + 200, 60, 0, z);
  for (const x of [-W - 60, W + 60]) addMoat(60, D * 2 + 200, x, 0);
}

// ---------- 城市填充建筑 ----------
function reservedAreas() {
  // 以景点为中心的占位区
  return POIS.map(p => ({
    x: p.x, z: p.z,
    r: p.id === 'longxing' ? 175
      : p.cat === 'temple' || p.cat === 'mansion' ? 82
      : p.cat === 'pagoda' || p.model === 'yanghe' ? 62
      : 42
  }));
}

function isFree(x, z, list, r) {
  for (const a of list) {
    if (Math.hypot(x - a.x, z - a.z) < a.r + r) return false;
  }
  return true;
}

// 现代城区与文化街区矩形占位（数据坐标），树木/散村/民居避让
const RECTS = {
  cbd: { x0: 1450, x1: 2900, z0: -700, z1: 500 },
  westRes: { x0: -2700, x1: -1350, z0: -1500, z1: -350 },
  northRes: { x0: -800, x1: 800, z0: 1350, z1: 2150 },
  museumBlock: { x0: 150, x1: 500, z0: 880, z1: 1100 },
  visitorBlock: { x0: 790, x1: 1120, z0: -40, z1: 200 },
  oldStreet1: { x0: 60, x1: 190, z0: -560, z1: -120 },
  oldStreet2: { x0: 300, x1: 620, z0: -500, z1: -360 },
  nanguan: { x0: -130, x1: 130, z0: -1240, z1: -880 },
  plaza: { x0: -240, x1: -120, z0: -380, z1: -270 }
};
const MODERN_RECTS = [RECTS.cbd, RECTS.westRes, RECTS.northRes, RECTS.museumBlock, RECTS.visitorBlock];

export const MODERN_DISTRICTS = [
  { ...RECTS.cbd, label: '正定新区' },
  { ...RECTS.westRes, label: '滨河社区' },
  { ...RECTS.northRes, label: '北部居住区' }
];

export const AVENUES = [
  [0, -820, 0, -1200], [0, 820, 0, 2500], [-700, 0, 2700, 0], [700, 0, -2700, 0]
];

function inRect(x, z, r) {
  return x > r.x0 && x < r.x1 && z > r.z0 && z < r.z1;
}

function buildHouses(scene) {
  const rng = B.mulberry32(20240917);
  const reserved = reservedAreas();
  // 道路带避让
  const nearRoad = (x, z) => {
    if (Math.abs(x) < 34 || Math.abs(z) < 30) return true;
    for (const rz of [-430, -100, 230, 480]) if (Math.abs(z - rz) < 20) return true;
    for (const rx of [-470, -240, 240, 470]) if (Math.abs(x - rx) < 18) return true;
    return false;
  };
  let count = 0;
  for (let gx = -W + 70; gx < W - 70; gx += 58) {
    for (let gz = -D + 70; gz < D - 70; gz += 58) {
      if (count > 720) break;
      const x = gx + (rng() - 0.5) * 22;
      const z = gz + (rng() - 0.5) * 22;
      if (nearRoad(x, z)) continue;
      if (!isFree(x, z, reserved, 26)) continue;
      if ([RECTS.oldStreet1, RECTS.oldStreet2, RECTS.nanguan, RECTS.plaza, RECTS.museumBlock].some(r => inRect(x, z, r))) continue;
      if (rng() < 0.06) continue;
      const h = B.makeHouse(rng);
      h.position.set(x, 0, z);
      h.rotation.y = Math.round(rng() * 3) * Math.PI / 2;
      scene.add(h);
      count++;
    }
  }
}

// 城外建筑：村庄 + 少量现代楼
function buildSuburbs(scene) {
  const rng = B.mulberry32(8831);
  const reserved = POIS.filter(p => p.cat === 'outside').map(p => ({ x: p.x, z: p.z, r: 80 }));
  // 村庄簇（数据坐标，避开现代城区）
  const villages = [
    [-1500, 400, 24], [-1750, 1000, 22], [1500, 1050, 22],
    [-2100, -300, 18], [2050, 800, 18], [-2250, 1100, 16],
    [600, -1820, 18], [-1100, -1850, 16], [2350, -1050, 16], [-1900, 1500, 14]
  ];
  for (const [vcx, cz, n] of villages) {
    for (let i = 0; i < n; i++) {
      const x = vcx + (rng() - 0.5) * 360;
      const z = cz + (rng() - 0.5) * 360;
      if (MODERN_RECTS.some(r => inRect(x, z, r))) continue;
      if (!isFree(x, z, reserved, 40)) continue;
      const h = rng() < 0.2 ? B.makeModernBuilding(rng) : B.makeHouse(rng);
      h.position.set(SX(x), 0, z);
      h.rotation.y = Math.round(rng() * 4) * Math.PI / 2;
      scene.add(h);
    }
  }
  // 关厢（城门外街区，避开文化街区与现代地块）
  const gates = [[0, -D - 220], [0, D + 200], [W + 220, 0], [-W - 200, 0]];
  const gateRects = [RECTS.nanguan, RECTS.visitorBlock];
  for (const [gcx, gcz] of gates) {
    for (let i = 0; i < 14; i++) {
      const x = gcx + (rng() - 0.5) * 300;
      const z = gcz + (rng() - 0.5) * 300;
      if (gateRects.some(r => inRect(x, z, r))) continue;
      const h = B.makeHouse(rng);
      h.position.set(SX(x), 0, z);
      h.rotation.y = Math.round(rng() * 4) * Math.PI / 2;
      scene.add(h);
    }
  }
}

// ---------- 树木 ----------
function buildTrees(scene) {
  const rng = B.mulberry32(4499);
  const dummy = new THREE.Object3D();
  // 城墙外绿化带
  const positions = [];
  for (let i = 0; i < 420; i++) {
    const side = i % 4;
    let x, z;
    if (side === 0) { x = -W + rng() * W * 2; z = -D - 90 - rng() * 40; }
    else if (side === 1) { x = -W + rng() * W * 2; z = D + 90 + rng() * 40; }
    else if (side === 2) { x = -W - 90 - rng() * 40; z = -D + rng() * D * 2; }
    else { x = W + 90 + rng() * 40; z = -D + rng() * D * 2; }
    positions.push([x, z, 0.8 + rng() * 0.7]);
  }
  // 行道树（中轴与主街）
  for (let z = -D + 60; z < D - 60; z += 55) {
    positions.push([38, z, 0.9 + rng() * 0.3]);
    positions.push([-38, z, 0.9 + rng() * 0.3]);
  }
  for (let x = -W + 60; x < W - 60; x += 60) {
    if (Math.abs(x) < 60) continue;
    positions.push([x, 30, 0.9 + rng() * 0.3]);
    positions.push([x, -30, 0.9 + rng() * 0.3]);
  }
  // 乡村散树（避开现代城区与广场地块；positions 使用场景坐标，需经 SX 反算数据坐标）
  const excludeRects = [...MODERN_RECTS, RECTS.oldStreet1, RECTS.oldStreet2, RECTS.nanguan, RECTS.plaza];
  let added = 0, guard = 0;
  while (added < 460 && guard++ < 3000) {
    const dx = (rng() - 0.5) * 5200;
    const z = (rng() - 0.5) * 5200;
    if (excludeRects.some(r => inRect(dx, z, r))) continue;
    positions.push([SX(dx), z, 0.7 + rng() * 1.1]);
    added++;
  }
  // 古城外环大道行道树（场景坐标，距墙约 230）
  const ring = W + 240, ringZ = D + 240;
  for (let x = -W - 120; x <= W + 120; x += 70) {
    positions.push([x, -ringZ, 0.85 + rng() * 0.3]);
    positions.push([x, ringZ, 0.85 + rng() * 0.3]);
  }
  for (let z = -D - 120; z <= D + 120; z += 70) {
    positions.push([-ring, z, 0.85 + rng() * 0.3]);
    positions.push([ring, z, 0.85 + rng() * 0.3]);
  }
  // 实例化（树干+树冠两批）
  const trunkGeo = new THREE.CylinderGeometry(0.7, 1, 6, 6);
  const crownGeo = new THREE.SphereGeometry(4.4, 8, 6);
  const trunkInst = new THREE.InstancedMesh(trunkGeo, B.MATERIALS.trunk, positions.length);
  const crownMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.85, vertexColors: true });
  const crownInst = new THREE.InstancedMesh(crownGeo, crownMat, positions.length);
  const color = new THREE.Color();
  positions.forEach(([x, z, s], i) => {
    dummy.position.set(x, 3 * s, z);
    dummy.scale.setScalar(s);
    dummy.rotation.set(0, 0, 0);
    dummy.updateMatrix();
    trunkInst.setMatrixAt(i, dummy.matrix);
    dummy.position.y = 8.2 * s;
    dummy.updateMatrix();
    crownInst.setMatrixAt(i, dummy.matrix);
    color.setHSL(0.25 + rng() * 0.08, 0.42 + rng() * 0.18, 0.4 + rng() * 0.13);
    crownInst.setColorAt(i, color);
  });
  if (crownInst.instanceColor) crownInst.instanceColor.needsUpdate = true;
  trunkInst.castShadow = true;
  scene.add(trunkInst, crownInst);
}

// ---------- 文化街区（仿古商铺） ----------
function shopRow(scene, rng, { x0, z0, x1, z1, side, n }) {
  // side: 'E' 店铺在道路东侧(x大)朝西；'W' 西侧朝东；'N' 北侧(z大)朝南；'S' 南侧朝北
  for (let i = 0; i < n; i++) {
    const shop = B.makeShop(B.randomShopName(rng));
    const t = (i + 0.5) / n;
    let x, z, rot = 0;
    if (side === 'E' || side === 'W') {
      x = side === 'E' ? x0 + 15 : x0 - 15;
      z = z0 + (z1 - z0) * t;
      rot = side === 'E' ? -Math.PI / 2 : Math.PI / 2;
    } else {
      z = side === 'N' ? z0 + 15 : z0 - 15;
      x = x0 + (x1 - x0) * t;
      rot = side === 'N' ? Math.PI : 0;
    }
    shop.position.set(SX(x), 0, z);
    shop.rotation.y = rot;
    scene.add(shop);
  }
}

function addStoneStreet(scene, w, d, dataX, z) {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#9d9587'; g.fillRect(0, 0, 128, 128);
  g.strokeStyle = 'rgba(70,64,54,0.55)';
  g.lineWidth = 2;
  for (let i = 0; i <= 4; i++) {
    g.beginPath(); g.moveTo(i * 32, 0); g.lineTo(i * 32, 128); g.stroke();
    g.beginPath(); g.moveTo(0, i * 32); g.lineTo(128, i * 32); g.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(Math.abs(w) / 16, Math.abs(d) / 16);
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(w, d),
    new THREE.MeshStandardMaterial({ map: tex, roughness: 1 })
  );
  m.rotation.x = -Math.PI / 2;
  m.position.set(SX(dataX), 0.09, z);
  m.receiveShadow = true;
  scene.add(m);
}

function buildCulturalStreets(scene) {
  const rng = B.mulberry32(31201);
  // 燕赵老街：阳和楼东南，南北小街（数据 x≈145，z -560~-130），东西两侧铺面
  addStoneStreet(scene, 96, 430, 145, -340);
  shopRow(scene, rng, { x0: 100, z0: -545, z1: -135, side: 'W', n: 15 });
  shopRow(scene, rng, { x0: 190, z0: -545, z1: -135, side: 'E', n: 15 });
  // 东西向横街（z≈-430 南侧一带）
  addStoneStreet(scene, 320, 130, 460, -430);
  shopRow(scene, rng, { x0: 300, z0: -356, x1: 600, side: 'S', n: 12 });
  shopRow(scene, rng, { x0: 300, z0: -504, x1: 600, side: 'N', n: 12 });
  // 南关古镇：长乐门外南北大街两侧
  addStoneStreet(scene, 130, 360, 0, -1060);
  shopRow(scene, rng, { x0: -80, z0: -1230, z1: -890, side: 'W', n: 9 });
  shopRow(scene, rng, { x0: 80, z0: -1230, z1: -890, side: 'E', n: 9 });
}

// ---------- 现代马路（沥青多车道） ----------
function addAvenue(scene, dataX1, z1, dataX2, z2, width = 60) {
  const ddx = SX(dataX2) - SX(dataX1);
  const len = Math.hypot(ddx, z2 - z1);
  if (len < 0.001) return;
  const tex = B.asphaltTexture(width, len);
  const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.95 });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(width, len), mat);
  m.rotation.x = -Math.PI / 2;
  m.rotation.z = -Math.atan2(ddx, z2 - z1);
  m.position.set((SX(dataX1) + SX(dataX2)) / 2, 0.07, (z1 + z2) / 2);
  m.receiveShadow = true;
  scene.add(m);
}

function buildAvenues(scene) {
  // 中轴向城外延伸的城市主干道
  addAvenue(scene, 0, -D + 20, 0, -1290, 64);   // 南关大街（接滹沱河大桥北端）
  addAvenue(scene, 0, -1670, 0, -1850, 64);     // 大桥南岸引道
  addAvenue(scene, 0, D - 20, 0, 2500, 64);     // 燕赵北大街
  addAvenue(scene, -W - 20, 0, 2700, 0, 58);    // 中山路向东接新区
  addAvenue(scene, W + 20, 0, -2700, 0, 58);    // 向西
  // 古城外环大道
  const ringX = W + 240, ringZ = D + 240;
  addAvenue(scene, -ringX, -ringZ, ringX, -ringZ, 46);
  addAvenue(scene, -ringX, ringZ, ringX, ringZ, 46);
  addAvenue(scene, -ringX, -ringZ, -ringX, ringZ, 46);
  addAvenue(scene, ringX, -ringZ, ringX, ringZ, 46);
  // 新区网格路
  const R = RECTS.cbd;
  for (let z = R.z0 + 180; z < R.z1; z += 200) addAvenue(scene, R.x0 + 40, z, R.x1 - 40, z, 34);
  for (let x = R.x0 + 240; x < R.x1; x += 320) addAvenue(scene, x, R.z0 + 40, x, R.z1 - 40, 34);
  // 西部滨河社区路网
  const Wr = RECTS.westRes;
  for (let z = Wr.z0 + 220; z < Wr.z1; z += 260) addAvenue(scene, Wr.x0 + 40, z, Wr.x1 - 40, z, 30);
  for (let x = Wr.x0 + 300; x < Wr.x1; x += 340) addAvenue(scene, x, Wr.z0 + 40, x, Wr.z1 - 40, 30);
  // 北部住宅路网
  const Nr = RECTS.northRes;
  for (let z = Nr.z0 + 200; z < Nr.z1; z += 260) addAvenue(scene, Nr.x0 + 40, z, Nr.x1 - 40, z, 30);
  for (let x = Nr.x0 + 260; x < Nr.x1; x += 300) addAvenue(scene, x, Nr.z0 + 40, x, Nr.z1 - 40, 30);
}

// ---------- 现代城区建筑群 ----------
function buildModernCity(scene) {
  // 东区 CBD
  buildDistrict(scene, RECTS.cbd, 51, { office: 0.62, residential: 0.12, commercial: 0.26 });
  // 西部滨河社区
  buildDistrict(scene, RECTS.westRes, 62, { office: 0, residential: 0.82, commercial: 0.18 });
  // 北部居住组团
  buildDistrict(scene, RECTS.northRes, 58, { office: 0.05, residential: 0.78, commercial: 0.17 });
}

function buildDistrict(scene, rect, seed, ratio) {
  const rng = B.mulberry32(seed);
  const pad = B.makeUrbanPad(rect.x1 - rect.x0, rect.z1 - rect.z0);
  pad.position.set(SX((rect.x0 + rect.x1) / 2), 0, (rect.z0 + rect.z1) / 2);
  scene.add(pad);

  const reserved = POIS.map(p => ({ x: p.x, z: p.z, r: p.cat === 'service' || p.cat === 'modern' ? 130 : 70 }));
  const cell = 130;
  for (let x = rect.x0 + 70; x < rect.x1 - 50; x += cell) {
    for (let z = rect.z0 + 70; z < rect.z1 - 50; z += cell) {
      if (rng() < 0.28) continue;
      const bx = x + (rng() - 0.5) * 26;
      const bz = z + (rng() - 0.5) * 26;
      if (!isFree(bx, bz, reserved, 55)) continue;
      if (MODERN_RECTS.filter(r2 => r2 !== rect).some(r2 => inRect(bx, bz, r2))) continue;
      const t = rng();
      let m;
      if (t < ratio.office) m = B.makeOfficeTower(rng);
      else if (t < ratio.office + ratio.residential) m = B.makeResidentialTower(rng);
      else m = B.makeCommercialLow(rng);
      m.position.set(SX(bx), 0, bz);
      m.rotation.y = Math.round(rng() * 4) * Math.PI / 2;
      scene.add(m);
    }
  }
}

// ---------- 广场、停车场、桥梁 ----------
function buildServiceSites(scene) {
  // 阳和楼前文化广场
  const plaza = B.makePlaza(120, 110);
  plaza.position.set(SX(-180), 0, -325);
  scene.add(plaza);
  // 游客中心停车场
  const p1 = B.makeParking(150, 110);
  p1.position.set(SX(1040), 0, 140);
  scene.add(p1);
  // 南关停车场
  const p2 = B.makeParking(200, 90);
  p2.position.set(SX(220), 0, -1050);
  scene.add(p2);
  // 博物馆前广场
  const p3 = B.makePlaza(150, 110);
  p3.position.set(SX(320), 0, 870);
  scene.add(p3);
}

function buildBridges(scene) {
  // 四座城门护城河平桥（石桥）
  const specs = [
    { x: 0, z: -D - 60, rot: 0 },
    { x: 0, z: D + 60, rot: 0 },
    { x: W, z: 0, rot: Math.PI / 2 },
    { x: -W, z: 0, rot: Math.PI / 2 }
  ];
  for (const s of specs) {
    const br = B.makeBridge(150, 46, { stone: true });
    br.position.set(SX(s.x), 0, s.z);
    br.rotation.y = s.rot;
    scene.add(br);
  }
}

// ---------- 景点模型 ----------
function buildPoiModel(poi) {
  switch (poi.model) {
    case 'gate':
      return B.makeGate(poi.id === 'changle' ? 'south' : poi.id === 'guangyuan' ? 'north' : poi.id === 'yingxu' ? 'east' : 'west');
    case 'corner':
      return B.makeCornerTower();
    case 'yanghe':
      return B.makeYangheLou();
    case 'huata':
      return B.makeHuataPagoda();
    case 'chengling':
      return B.makeChenglingPagoda();
    case 'xumi':
      return B.makeXumiPagoda();
    case 'lingxiao':
      return B.makeLingxiaoPagoda();
    case 'longxing':
      return B.makeLongxingTemple();
    case 'temple':
      return B.makeTempleComplex(poi.id === 'zhaoyun' || poi.id === 'chongyin' ? 1.05 : 1);
    case 'mosque':
      return B.makeMosque();
    case 'mansion':
      return B.makeMansion(poi.id === 'rongguo');
    case 'courtyard':
      return B.makeCourtyard(poi.name.length);
    case 'paifang':
      return B.makePaifang(poi.paifangText);
    case 'visitor':
      return B.makeVisitorCenter();
    case 'museum':
      return B.makeMuseum();
    case 'riverbridge':
      return B.makeCableStayedBridge(380, 64);
    case 'landmark':
      return B.makeOfficeTower(B.mulberry32(701));
    case 'stele':
    default:
      return B.makeStele();
  }
}

// 景点基座光环（可点击提示）
function makeMarker(poi) {
  const g = new THREE.Group();
  const ringMat = new THREE.MeshBasicMaterial({
    color: poi.cat === 'pagoda' || poi.cat === 'gate' ? 0xffd36b : 0xfff3c4,
    transparent: true, opacity: 0.75, side: THREE.DoubleSide
  });
  const ring = new THREE.Mesh(new THREE.RingGeometry(26, 30, 40), ringMat);
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.3;
  g.add(ring);
  // 发光柱（远处可见）
  const beamMat = new THREE.MeshBasicMaterial({
    color: 0xffcf6b, transparent: true, opacity: 0.22, depthWrite: false
  });
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(3, 8, 260, 12, 1, true), beamMat);
  beam.position.y = 130;
  g.add(beam);
  g.userData.ring = ring;
  g.userData.beam = beam;
  return g;
}

export function buildPois(scene) {
  const list = [];
  for (const poi of POIS) {
    const sx = SX(poi.x), sz = poi.z;
    const group = buildPoiModel(poi);
    group.position.set(sx, 0, sz);
    if (poi.model === 'gate') {
      // 映射后：迎旭门（东，场景 -X 处）朝 -X 开；镇远门（西，场景 +X 处）朝 +X 开
      group.rotation.y = poi.id === 'yingxu' ? Math.PI / 2
        : poi.id === 'zhenyuan' ? -Math.PI / 2
        : poi.id === 'guangyuan' ? Math.PI : 0;
    }
    if (poi.model === 'paifang' && poi.paifangRot) group.rotation.y = poi.paifangRot;
    // 城门题额（面向城外）
    if (poi.model === 'gate') {
      const plaques = {
        changle: { text: '三关雄镇', side: 'south' },
        guangyuan: { text: '拱护神京', side: 'north' },
        yingxu: { text: '光含瀛海', side: 'east' },
        zhenyuan: { text: '秀挹太行', side: 'west' }
      };
      const p = plaques[poi.id];
      if (p) {
        const plaque = B.makePlaque(p.text);
        // 放到门洞上方、朝向城外
        const off = 30;
        if (p.side === 'south') plaque.position.set(0, 0, -off), plaque.rotation.y = Math.PI;
        if (p.side === 'north') plaque.position.set(0, 0, off);
        if (p.side === 'east') plaque.position.set(-off, 0, 0), plaque.rotation.y = Math.PI / 2;
        if (p.side === 'west') plaque.position.set(off, 0, 0), plaque.rotation.y = -Math.PI / 2;
        group.add(plaque);
      }
    }
    register(group, poi, scene);

    const marker = makeMarker(poi);
    marker.position.set(sx, 0, sz);
    scene.add(marker);

    const label = B.makeLabel(poi.name);
    const topYMap = { gate: 92, corner: 80, paifang: 28, visitor: 42, museum: 44, riverbridge: 22 };
    const topY = group.userData.height || topYMap[poi.model] || 55;
    label.position.set(sx, topY + 14, sz);
    scene.add(label);

    // 扩大点击区域（隐形圆柱）
    const hit = new THREE.Mesh(
      new THREE.CylinderGeometry(40, 40, 300, 10),
      new THREE.MeshBasicMaterial({ visible: false })
    );
    hit.position.set(sx, 120, sz);
    hit.userData.poi = poi;
    scene.add(hit);
    pickables.push(hit);

    list.push({ poi, group, marker, label, sx, sz });
  }
  return list;
}

// ---------- 静态网格按材质合并，降低 draw call ----------
function mergeStatic(scene) {
  const buckets = new Map();
  scene.traverse(o => {
    if (!o.isMesh || o.userData.keep) return;
    if (o.isInstancedMesh) return;
    if (!buckets.has(o.material)) buckets.set(o.material, []);
    let geo = o.geometry.clone();
    if (geo.index) geo = geo.toNonIndexed();
    o.updateMatrixWorld(true);
    geo.applyMatrix4(o.matrixWorld);
    buckets.get(o.material).push(geo);
  });
  // 收集待移除对象
  const toRemove = [];
  scene.traverse(o => {
    if (o.isMesh && !o.isInstancedMesh && !o.userData.keep) {
      // 仅移除被遍历过的普通网格（全部静态物此时都未标记 keep）
      if (o !== scene) toRemove.push(o);
    }
  });
  for (const m of toRemove) {
    if (m.parent) m.parent.remove(m);
  }
  for (const [mat, geos] of buckets) {
    const merged = mergeGeometries(geos, false);
    if (!merged) continue;
    const mesh = new THREE.Mesh(merged, mat);
    mesh.castShadow = !(mat.transparent || mat.isMeshBasicMaterial);
    mesh.receiveShadow = true;
    scene.add(mesh);
  }
}

// ---------- 主入口 ----------
export function buildWorld(scene) {
  buildGround(scene);
  buildRiver(scene);
  buildRoads(scene);
  buildAvenues(scene);
  buildWalls(scene);
  buildServiceSites(scene);
  buildHouses(scene);
  buildCulturalStreets(scene);
  buildSuburbs(scene);
  buildModernCity(scene);
  buildBridges(scene);
  buildTrees(scene);
  mergeStatic(scene);
  const poiObjects = buildPois(scene);
  return poiObjects;
}
