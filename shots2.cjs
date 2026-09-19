const { chromium } = require('playwright');
const path = require('path');

const OUT = path.join(__dirname, 'docs', '第二阶段效果图');
const SX = x => -x;
const VIEW = { width: 1600, height: 900 };

// 坐标均为场景坐标（sceneX = -数据x, sceneZ = 数据z）
const shots = [
  { file: '01-古今交融全城（南望）.png', cam: [900, 1450, -3150], tgt: [0, 0, -300] },
  { file: '02-古今交融全城（北望）.png', cam: [350, 1550, 3250], tgt: [0, 0, 250] },
  { file: '03-正定新区东部CBD.png', cam: [-2450, 430, -1250], tgt: [-2150, 70, -100] },
  { file: '04-滨河社区现代住宅.png', cam: [950, 420, -1700], tgt: [2050, 50, -850] },
  { file: '05-滹沱河双塔斜拉桥（侧视）.png', cam: [920, 130, -1480], tgt: [0, 40, -1480] },
  { file: '06-桥面北望长乐门.png', cam: [0, 42, -1650], tgt: [0, 46, -1230] },
  { file: '07-南关古镇牌坊.png', cam: [170, 75, -1260], tgt: [0, 25, -1000] },
  { file: '08-燕赵老街文化街区.png', cam: [120, 120, -640], tgt: [-145, 25, -330] },
  { file: '09-游客服务中心.png', cam: [-1350, 130, -350], tgt: [-900, 25, 70] },
  { file: '10-正定博物馆.png', cam: [-880, 150, 430], tgt: [-320, 30, 980] },
  { file: '11-天宁寺凌霄塔（木构重做）.png', cam: [90, 250, -300], tgt: [-180, 80, 60] }
];

function setCam(page, cam, tgt) {
  return page.evaluate(([cam, tgt]) => {
    const { camera, controls } = window.__zd;
    camera.position.set(cam[0], cam[1], cam[2]);
    controls.target.set(tgt[0], tgt[1], tgt[2]);
    controls.update();
  }, [cam, tgt]);
}

function openPanel(page, poiId, cam, tgt) {
  return page.evaluate(([poiId, cam, tgt]) => {
    const { camera, controls, POIS, showPanel } = window.__zd;
    camera.position.set(cam[0], cam[1], cam[2]);
    controls.target.set(tgt[0], tgt[1], tgt[2]);
    controls.update();
    const poi = POIS.find(p => p.id === poiId);
    showPanel(poi);
  }, [poiId, cam, tgt]);
}

(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'msedge' });
  const page = await browser.newPage({ viewport: VIEW });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));

  // 00 启动页（含河北文旅标语 logo）
  await page.goto('file:///' + __dirname.replace(/\\/g, '/') + '/index.html', { waitUntil: 'load' });
  await page.waitForTimeout(2800);
  await page.screenshot({ path: path.join(OUT, '00-启动页-河北文旅标语logo.png') });
  console.log('shot 00 intro');

  await page.goto('file:///' + __dirname.replace(/\\/g, '/') + '/index.html?debug&skipintro=1', { waitUntil: 'load' });
  await page.waitForTimeout(4000);

  for (let i = 0; i < shots.length; i++) {
    const s = shots[i];
    await setCam(page, s.cam, s.tgt);
    await page.waitForTimeout(800);
    await page.screenshot({ path: path.join(OUT, s.file) });
    console.log('shot', String(i + 1).padStart(2, '0'), s.file);
  }

  // 12 实景照片面板（广惠寺华塔）
  await openPanel(page, 'guanghui', [-650, 200, -950], [SX(260), 60, -520]);
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(OUT, '12-景点简介-实景照片面板.png') });
  console.log('shot 12 photo panel');

  // 13 长乐门出行交通图
  await page.evaluate(() => window.__zd.showPanel(window.__zd.POIS.find(p => p.id === 'changle')));
  await setCam(page, [0, 200, -1150], [0, 60, -820]);
  await page.waitForTimeout(1200);
  await page.screenshot({ path: path.join(OUT, '13-长乐门简介-出行交通图.png') });
  console.log('shot 13 transport panel');

  console.log('errors:', errors.length ? errors.join(' | ') : 'none');
  await browser.close();
  process.exit(errors.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
