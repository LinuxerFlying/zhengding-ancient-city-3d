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
function addRoad(scene, x1, z1, x2, z2, width, mat, y = 0.06) {
  const dx = x2 - x1, dz = z2 - z1;
  const len = Math.hypot(dx, dz);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(width, len), mat);
  m.rotation.x = -Math.PI / 2;
  m.rotation.z = -Math.atan2(dx, dz); // 面片局部+Z 对齐道路方向
  m.position.set((x1 + x2) / 2, y, (z1 + z2) / 2);
  m.receiveShadow = true;
  scene.add(m);
  return m;
}

// 隆兴寺寺址占位（数据坐标），街巷在此区间断开（寺内自有院落甬道）
const TEMPLE_BLOCK = { x0: 432, x1: 698, z0: 128, z1: 542 };

function segRoadH(scene, x1, x2, z, width, mat, block, y = 0.06) {
  const segs = [[x1, x2]];
  if (block && z > block.z0 && z < block.z1) {
    const b0 = block.x0 - width * 0.5, b1 = block.x1 + width * 0.5;
    for (let i = segs.length - 1; i >= 0; i--) {
      const [s, e] = segs[i];
      if (b1 > s && b0 < e) {
        segs.splice(i, 1);
        if (b0 - s > 4) segs.push([s, Math.min(b0, e)]);
        if (e - b1 > 4) segs.push([Math.max(b1, s), e]);
      }
    }
  }
  for (const [s, e] of segs) addRoad(scene, s, z, e, z, width, mat, y);
}

function segRoadV(scene, x, z1, z2, width, mat, block, y = 0.06) {
  const segs = [[z1, z2]];
  if (block && x > block.x0 && x < block.x1) {
    const b0 = block.z0 - width * 0.5, b1 = block.z1 + width * 0.5;
    for (let i = segs.length - 1; i >= 0; i--) {
      const [s, e] = segs[i];
      if (b1 > s && b0 < e) {
        segs.splice(i, 1);
        if (b0 - s > 4) segs.push([s, Math.min(b0, e)]);
        if (e - b1 > 4) segs.push([Math.max(b1, s), e]);
      }
    }
  }
  for (const [s, e] of segs) addRoad(scene, x, s, x, e, width, mat, y);
}

function buildRoads(scene) {
  const roadMat = new THREE.MeshStandardMaterial({ color: 0x8d8270, roughness: 1 });
  const mainMat = new THREE.MeshStandardMaterial({ color: 0x9c9078, roughness: 1 });
  // 燕赵南大街 / 北大街（南北中轴）
  addRoad(scene, 0, -D + 30, 0, D - 30, 46, mainMat);
  // 中山路等东西向
  addRoad(scene, -W + 30, W - 30, 0, 40, mainMat);
  segRoadH(scene, -W + 60, W - 60, -430, 20, roadMat, null);
  segRoadH(scene, -W + 60, W - 60, -100, 22, roadMat, null);
  segRoadH(scene, -W + 60, W - 60, 230, 20, roadMat, TEMPLE_BLOCK);
  segRoadH(scene, -W + 60, W - 60, 480, 20, roadMat, TEMPLE_BLOCK);
  // 纵向次干道
  for (const x of [-470, -240, 240, 470]) {
    segRoadV(scene, x, -D + 60, D - 60, 18, roadMat, TEMPLE_BLOCK);
  }
  // 南关古道（长乐门至滹沱河）
  addRoad(scene, 0, -D - 30, 0, -1150, 34, mainMat, 0.04);
  // 东门内至隆兴寺引道（迎旭门内 → 寺院山门外）
  addRoad(scene, SX(-W + 40), 60, SX(-620), 60, 24, mainMat, 0.05);
  addRoad(scene, SX(-620), 60, SX(-560), 132, 24, mainMat, 0.05);
  // 城外道路网
  addRoad(scene, -2600, -1000, 2600, -1000, 18, roadMat, 0.03);
  addRoad(scene, SX(-1000), -1200, SX(-1000), 1500, 16, roadMat, 0.03);
  addRoad(scene, SX(1100), -1200, SX(1100), 1500, 16, roadMat, 0.03);
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
  // 村庄簇
  const villages = [
    [-1500, 400, 26], [1600, 600, 30], [1300, -600, 20],
    [-1600, -700, 22], [600, 1400, 24], [-700, 1450, 18],
    [1900, -100, 16], [-2000, 100, 16], [400, -1700, 18], [-1500, -1600, 14]
  ];
  for (const [vcx, cz, n] of villages) {
    const cx = SX(vcx);
    for (let i = 0; i < n; i++) {
      const x = cx + (rng() - 0.5) * 360;
      const z = cz + (rng() - 0.5) * 360;
      if (!isFree(x, z, reserved, 40)) continue;
      const h = rng() < 0.25 ? B.makeModernBuilding(rng) : B.makeHouse(rng);
      h.position.set(x, 0, z);
      h.rotation.y = Math.round(rng() * 4) * Math.PI / 2;
      scene.add(h);
    }
  }
  // 关厢（城门外街区）
  const gates = [[0, -D - 220], [0, D + 200], [W + 220, 0], [-W - 200, 0]];
  for (const [cx, cz] of gates) {
    for (let i = 0; i < 16; i++) {
      const x = cx + (rng() - 0.5) * 260;
      const z = cz + (rng() - 0.5) * 260;
      const h = B.makeHouse(rng);
      h.position.set(x, 0, z);
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
  // 乡村散树
  for (let i = 0; i < 500; i++) {
    positions.push([(rng() - 0.5) * 5200, (rng() - 0.5) * 5200, 0.7 + rng() * 1.1]);
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
    const topY = group.userData.height || (poi.model === 'gate' ? 92 : poi.model === 'corner' ? 80 : 55);
    label.position.set(sx, topY + 16, sz);
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
  buildWalls(scene);
  buildHouses(scene);
  buildSuburbs(scene);
  buildTrees(scene);
  mergeStatic(scene);
  const poiObjects = buildPois(scene);
  return poiObjects;
}
