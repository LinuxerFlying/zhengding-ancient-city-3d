window.__zdLoaded = true;
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { buildWorld, getPickables, MODERN_DISTRICTS } from './world.js';
import { POIS, CATEGORY_LABELS } from './data.js';

// ============ 场景基础 ============
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xbfd9e8);
scene.fog = new THREE.Fog(0xbfd9e8, 2600, 7200);

const camera = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 1, 12000);
camera.position.set(0, 460, -1650);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
document.getElementById('app').appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 40, 0);
controls.enabled = false;
controls.enableDamping = true;
controls.dampingFactor = 0.06;
controls.minDistance = 60;
controls.maxDistance = 4200;
controls.minPolarAngle = 0.05;
controls.maxPolarAngle = Math.PI / 2 - 0.03;
controls.rotateSpeed = 0.55;
controls.zoomSpeed = 0.9;
controls.autoRotateSpeed = 0.6;

// ============ 光照 ============
const hemi = new THREE.HemisphereLight(0xdfeeff, 0x8a7d5f, 0.95);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff2d8, 1.6);
sun.position.set(-1200, 1800, -900);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -2400;
sun.shadow.camera.right = 2400;
sun.shadow.camera.top = 2400;
sun.shadow.camera.bottom = -2400;
sun.shadow.camera.far = 5200;
sun.shadow.bias = -0.0004;
scene.add(sun);
scene.add(new THREE.AmbientLight(0xffffff, 0.25));

// ============ 构建世界 ============
const poiObjects = buildWorld(scene);

// ============ 射线点击 ============
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
let downPos = null;

renderer.domElement.addEventListener('pointerdown', e => {
  downPos = [e.clientX, e.clientY];
});
renderer.domElement.addEventListener('pointerup', e => {
  if (!downPos) return;
  const moved = Math.hypot(e.clientX - downPos[0], e.clientY - downPos[1]);
  downPos = null;
  if (moved > 6) return;
  pickPoi(e.clientX, e.clientY);
});
let hoverLast = 0;
renderer.domElement.addEventListener('pointermove', e => {
  const now = performance.now();
  if (now - hoverLast < 80) return;
  hoverLast = now;
  pointer.x = (e.clientX / innerWidth) * 2 - 1;
  pointer.y = -(e.clientY / innerHeight) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);
  const hit = raycaster.intersectObjects(getPickables(), false)[0];
  renderer.domElement.style.cursor = hit ? 'pointer' : 'grab';
});

function pickPoi(clientX, clientY) {
  pointer.x = (clientX / innerWidth) * 2 - 1;
  pointer.y = -(clientY / innerHeight) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);
  const hits = raycaster.intersectObjects(getPickables(), false);
  if (hits.length) {
    const poi = hits[0].object.userData.poi;
    flyToPoi(poi);
    showPanel(poi);
  }
}

// ============ 飞行跳转 ============
let flight = null;
function easeInOut(t) {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}
function flyTo(target, position, duration = 1800) {
  flight = {
    t0: performance.now(),
    duration,
    p0: camera.position.clone(),
    p1: position.clone(),
    o0: controls.target.clone(),
    o1: target.clone()
  };
  controls.autoRotate = false;
  document.getElementById('auto-rota').classList.remove('on');
}

// 数据坐标(东+x,北+z) → 场景坐标(场景-x 对应东)
const SX = x => -x;

function flyToPoi(poi) {
  const target = new THREE.Vector3(SX(poi.x), 30, poi.z);
  // 从南偏东方向看建筑正面（东 = 场景 -X）
  const dist = poi.model === 'stele' ? 220
    : poi.model === 'landmark' ? 560
    : poi.model === 'riverbridge' ? 480
    : poi.model === 'museum' || poi.model === 'visitor' ? 400
    : 330;
  const height = poi.model === 'longxing' ? 420
    : poi.model === 'landmark' ? 360
    : poi.model === 'riverbridge' ? 300
    : 260;
  const pos = new THREE.Vector3(SX(poi.x) - dist * 0.45, height, poi.z - dist * 0.9);
  flyTo(target, pos, 1900);
  highlightMarker(poi);
}

let activeMarker = null;
function highlightMarker(poi) {
  if (activeMarker) {
    activeMarker.userData.beam.material.color.set(0xffcf6b);
  }
  const obj = poiObjects.find(o => o.poi.id === poi.id);
  if (obj) {
    activeMarker = obj.marker;
    activeMarker.userData.beam.material.color.set(0xff5a3c);
  }
}

function flyOverview() {
  flyTo(new THREE.Vector3(0, 40, 0), new THREE.Vector3(0, 900, -1900), 2000);
}

// ============ 景点面板 ============
const panel = document.getElementById('poi-panel');
let currentPoi = null;
function showPanel(poi) {
  currentPoi = poi;
  panel.dataset.id = poi.id;
  document.getElementById('poi-name').textContent = poi.name;
  document.getElementById('poi-tag').textContent = poi.tag + (poi.level ? ` · ${poi.level}` : '');
  document.getElementById('poi-intro').textContent = poi.intro;
  const photoEl = document.getElementById('poi-photo');
  if (poi.photo) {
    panel.classList.add('has-photo');
    photoEl.src = poi.photo;
    photoEl.alt = poi.name + '实景照片';
  } else {
    panel.classList.remove('has-photo');
    photoEl.removeAttribute('src');
  }
  panel.classList.add('show');
}
function closePanel() {
  panel.classList.remove('show');
}
document.getElementById('panel-close').addEventListener('click', closePanel);
document.getElementById('poi-photo').addEventListener('error', e => {
  panel.classList.remove('has-photo');
  e.currentTarget.removeAttribute('src');
});
document.getElementById('panel-fly').addEventListener('click', () => {
  if (currentPoi) flyToPoi(currentPoi);
});

// ============ 景点列表 ============
const listEl = document.getElementById('poi-list');
const order = ['gate', 'corner', 'tower', 'pagoda', 'temple', 'mansion', 'street', 'service', 'bridge', 'modern', 'ruin', 'outside'];
const grouped = {};
for (const p of POIS) (grouped[p.cat] = grouped[p.cat] || []).push(p);
for (const cat of order) {
  if (!grouped[cat]) continue;
  const h = document.createElement('div');
  h.className = 'list-group';
  h.textContent = CATEGORY_LABELS[cat];
  listEl.appendChild(h);
  for (const p of grouped[cat]) {
    const item = document.createElement('div');
    item.className = 'list-item';
    item.innerHTML = `<span class="dot cat-${cat}"></span><span>${p.name}</span>`;
    item.addEventListener('click', () => {
      flyToPoi(p);
      showPanel(p);
      setSidebar(false);
    });
    listEl.appendChild(item);
  }
}

const sidebar = document.getElementById('sidebar');
const sideMask = document.getElementById('side-mask');
function setSidebar(open) {
  sidebar.classList.toggle('open', open);
  sideMask.classList.toggle('show', open);
}
document.getElementById('menu-toggle').addEventListener('click', () => setSidebar(!sidebar.classList.contains('open')));
document.getElementById('side-close').addEventListener('click', () => setSidebar(false));
sideMask.addEventListener('click', () => setSidebar(false));
document.getElementById('overview-btn').addEventListener('click', flyOverview);
const rotaBtn = document.getElementById('auto-rota');
rotaBtn.addEventListener('click', () => {
  controls.autoRotate = !controls.autoRotate;
  rotaBtn.classList.toggle('on', controls.autoRotate);
});

// ============ 指南针 ============
const compassNeedle = document.getElementById('compass-n');

// ============ 缩略导航图 ============
const mm = document.getElementById('minimap');
const mctx = mm.getContext('2d');
const MM_RANGE = 2800; // 半幅对应世界距离
// 统一以“数据方位坐标”入参（x+ 东，z+ 北）；相机坐标需先用 SX 转换
function w2m(dataX, dataZ) {
  return [
    (dataX / MM_RANGE) * (mm.width / 2) + mm.width / 2,
    -(dataZ / MM_RANGE) * (mm.height / 2) + mm.height / 2
  ];
}
// 场景坐标 → 数据方位坐标
function sceneToData(sx, sz) {
  return [-sx, sz];
}
function drawMinimap() {
  const W2 = mm.width, H2 = mm.height;
  mctx.clearRect(0, 0, W2, H2);
  mctx.fillStyle = 'rgba(24,20,14,0.66)';
  mctx.fillRect(0, 0, W2, H2);
  // 河流
  mctx.strokeStyle = 'rgba(120,190,210,0.85)';
  mctx.lineWidth = 7;
  mctx.beginPath();
  const riverPts = [[-2500, -1240], [-1400, -1200], [0, -1350], [1400, -1220], [2500, -1180]];
  riverPts.forEach(([x, z], i) => {
    const [px, py] = w2m(x, z);
    i ? mctx.lineTo(px, py) : mctx.moveTo(px, py);
  });
  mctx.stroke();
  // 现代城区
  for (const d of MODERN_DISTRICTS) {
    const [dx0, dy0] = w2m(d.x0, d.z1);
    const [dx1, dy1] = w2m(d.x1, d.z0);
    mctx.fillStyle = 'rgba(150,160,168,0.4)';
    mctx.fillRect(dx0, dy0, dx1 - dx0, dy1 - dy0);
    mctx.strokeStyle = 'rgba(210,215,220,0.55)';
    mctx.lineWidth = 0.8;
    mctx.strokeRect(dx0, dy0, dx1 - dx0, dy1 - dy0);
    mctx.fillStyle = 'rgba(235,238,240,0.85)';
    mctx.font = '9px sans-serif';
    mctx.textAlign = 'center';
    mctx.fillText(d.label, (dx0 + dx1) / 2, (dy0 + dy1) / 2);
  }
  // 主干道
  mctx.strokeStyle = 'rgba(225,210,170,0.7)';
  mctx.lineWidth = 1.6;
  mctx.beginPath();
  for (const [ax, az, bx, bz] of [[0, -820, 0, 2500], [0, -820, 0, -1850], [-700, 0, 2700, 0], [700, 0, -2700, 0]]) {
    const [p0, p1] = [w2m(ax, az), w2m(bx, bz)];
    mctx.moveTo(p0[0], p0[1]); mctx.lineTo(p1[0], p1[1]);
  }
  mctx.stroke();
  // 城墙
  const [x1, y1] = w2m(-700, -820);
  const [x2, y2] = w2m(700, 820);
  mctx.strokeStyle = '#e8d9a8';
  mctx.lineWidth = 1.6;
  mctx.strokeRect(x1, y2, x2 - x1, y1 - y2);
  // 中轴
  mctx.strokeStyle = 'rgba(255,255,255,0.25)';
  mctx.lineWidth = 0.6;
  mctx.setLineDash([3, 3]);
  const [ax0, ay0] = w2m(0, -MM_RANGE);
  const [ax1, ay1] = w2m(0, MM_RANGE);
  mctx.beginPath(); mctx.moveTo(ax0, ay0); mctx.lineTo(ax1, ay1); mctx.stroke();
  mctx.setLineDash([]);
  // 景点
  for (const p of POIS) {
    const [px, py] = w2m(p.x, p.z);
    const major = p.cat === 'gate' || p.cat === 'pagoda' || p.id === 'longxing';
    const modern = p.cat === 'modern' || p.cat === 'bridge';
    mctx.beginPath();
    mctx.arc(px, py, major ? 3.4 : 2.2, 0, Math.PI * 2);
    mctx.fillStyle = modern ? '#7fc7ff' : major ? '#ffd36b' : '#f3ead2';
    mctx.fill();
  }
  // 相机视锥（转换到数据方位坐标）
  const [dcx, dcz] = sceneToData(camera.position.x, camera.position.z);
  const [dtx, dtz] = sceneToData(controls.target.x, controls.target.z);
  const [cx, cy] = w2m(dcx, dcz);
  const fx = dtx - dcx;
  const fz = dtz - dcz;
  const heading = Math.atan2(fx, fz);
  mctx.fillStyle = 'rgba(255,90,60,0.5)';
  mctx.strokeStyle = '#ff5a3c';
  mctx.lineWidth = 1;
  mctx.beginPath();
  mctx.moveTo(cx, cy);
  const spread = 0.5;
  const len = 20;
  mctx.lineTo(cx + Math.sin(heading + spread) * len, cy - Math.cos(heading + spread) * len);
  mctx.lineTo(cx + Math.sin(heading - spread) * len, cy - Math.cos(heading - spread) * len);
  mctx.closePath();
  mctx.fill(); mctx.stroke();
  mctx.beginPath();
  mctx.arc(cx, cy, 3, 0, Math.PI * 2);
  mctx.fillStyle = '#ff5a3c';
  mctx.fill();
}

mm.addEventListener('click', e => {
  const rect = mm.getBoundingClientRect();
  const mx = (e.clientX - rect.left) * (mm.width / rect.width);
  const my = (e.clientY - rect.top) * (mm.height / rect.height);
  const wx = ((mx - mm.width / 2) / (mm.width / 2)) * MM_RANGE;
  const wz = -((my - mm.height / 2) / (mm.height / 2)) * MM_RANGE;
  let best = null, bd = 1e9;
  for (const p of POIS) {
    const d = Math.hypot(p.x - wx, p.z - wz);
    if (d < bd) { bd = d; best = p; }
  }
  // 仅当点击足够接近某点时跳转
  const px = (best.x / MM_RANGE) * (mm.width / 2) + mm.width / 2;
  const py = -(best.z / MM_RANGE) * (mm.height / 2) + mm.height / 2;
  if (Math.hypot(px - mx, py - my) < 14) {
    flyToPoi(best);
    showPanel(best);
  } else {
    // 否则飞到该处俯瞰（wx 为数据东向坐标，场景需取反）
    const scx = SX(wx);
    flyTo(new THREE.Vector3(scx, 30, wz), new THREE.Vector3(scx, 600, wz - 900), 1600);
  }
});

// ============ 渲染循环 ============
const clock = new THREE.Clock();
function animate() {
  requestAnimationFrame(animate);
  const dt = clock.getDelta();
  const t = clock.elapsedTime;

  if (flight) {
    const k = Math.min(1, (performance.now() - flight.t0) / flight.duration);
    const e = easeInOut(k);
    camera.position.lerpVectors(flight.p0, flight.p1, e);
    controls.target.lerpVectors(flight.o0, flight.o1, e);
    if (k >= 1) flight = null;
  }
  controls.update();

  // 标记光环脉动
  for (const { marker } of poiObjects) {
    const ring = marker.userData.ring;
    const s = 1 + Math.sin(t * 2.4) * 0.12;
    ring.scale.setScalar(s);
    ring.material.opacity = 0.55 + Math.sin(t * 2.4) * 0.25;
  }

  // 指南针：相机朝向（换算到数据方位：东+X、北+Z）
  const sfx = controls.target.x - camera.position.x;
  const sfz = controls.target.z - camera.position.z;
  const heading = Math.atan2(-sfx, sfz); // 0=正北
  compassNeedle.style.transform = `rotate(${-heading}rad)`;

  drawMinimap();
  renderer.render(scene, camera);
}
animate();

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

if (new URLSearchParams(location.search).has('debug')) {
  window.__zd = { camera, controls, THREE, POIS, SX, flyToPoi, showPanel, scene };
}

// 启动介绍页
const intro = document.getElementById('intro');
document.getElementById('intro-start').addEventListener('click', () => {
  intro.classList.add('hide');
  controls.enabled = true;
  setTimeout(() => {
    document.getElementById('hint').classList.add('fade');
  }, 8000);
});

// 自动化/截图模式：?skipintro=1 直接进入
if (new URLSearchParams(location.search).has('skipintro')) {
  intro.classList.add('hide');
  controls.enabled = true;
  setTimeout(() => document.getElementById('hint').classList.add('fade'), 6000);
}
