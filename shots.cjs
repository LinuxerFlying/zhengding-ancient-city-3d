const { chromium } = require('playwright');
const path = require('path');

const OUT = path.join(__dirname, 'docs', '第一阶段效果图');
const BASE = 'file:///' + __dirname.replace(/\\/g, '/') + '/index.html?debug&skipintro=1';

const shots = [
  { file: '01-全城鸟瞰（南望）.png', cam: [0, 900, -1900], tgt: [0, 40, 0] },
  { file: '02-全城鸟瞰（北望）.png', cam: [0, 950, 1950], tgt: [0, 40, 0] },
  { file: '03-全城鸟瞰（东南俯瞰）.png', cam: [-1500, 1000, -1300], tgt: [0, 30, 60] },
  { file: '04-长乐门与南关古道滹沱河.png', cam: [0, 210, -1250], tgt: [0, 55, -820] },
  { file: '05-隆兴寺全景（古城东北隅）.png', cam: [-1150, 420, -150], tgt: [-560, 40, 330] },
  { file: '06-隆兴寺大悲阁与摩尼殿.png', cam: [-840, 170, 220], tgt: [-560, 50, 340] },
  { file: '07-广惠寺华塔.png', cam: [-130, 200, -880], tgt: [-260, 55, -520] },
  { file: '08-天宁寺凌霄塔.png', cam: [60, 230, -260], tgt: [-180, 70, 60] },
  { file: '09-临济寺澄灵塔.png', cam: [60, 210, -560], tgt: [-240, 60, -180] },
  { file: '10-开元寺须弥塔.png', cam: [-640, 230, -560], tgt: [260, 60, -200] },
  { file: '11-阳和楼与燕赵南大街.png', cam: [0, 180, -640], tgt: [0, 50, -250] },
  { file: '12-荣国府.png', cam: [-1000, 230, 250], tgt: [-600, 35, 610] },
  { file: '13-城内街巷俯瞰.png', cam: [520, 200, -560], tgt: [0, 30, 120] },
  { file: '14-北门与城外村庄.png', cam: [100, 320, 1500], tgt: [0, 50, 820] },
  { file: '15-西城门镇远门.png', cam: [950, 200, -420], tgt: [700, 50, 0] }
];

(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'msedge' });
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('file:///' + __dirname.replace(/\\/g, '/') + '/index.html', { waitUntil: 'load' });
  await page.waitForTimeout(3500);
  await page.screenshot({ path: path.join(OUT, '00-启动介绍页.png') });
  console.log('shot 00 intro');
  await page.goto(BASE, { waitUntil: 'load' });
  await page.waitForTimeout(3500);

  for (let i = 0; i < shots.length; i++) {
    const s = shots[i];
    await page.evaluate(([cam, tgt]) => {
      const { camera, controls } = window.__zd;
      camera.position.set(cam[0], cam[1], cam[2]);
      controls.target.set(tgt[0], tgt[1], tgt[2]);
      controls.update();
    }, [s.cam, s.tgt]);
    await page.waitForTimeout(700);
    await page.screenshot({ path: path.join(OUT, s.file) });
    console.log('shot', i + 1, s.file);
  }

  // 16-华塔景点简介面板（通过点击 3D 场景）
  await page.evaluate(() => {
    const { camera, controls, THREE, POIS, SX } = window.__zd;
    camera.position.set(-130, 200, -880);
    controls.target.set(SX(260), 55, -520);
    controls.update();
  });
  await page.waitForTimeout(500);
  const p = await page.evaluate(() => {
    const { camera, THREE, POIS, SX } = window.__zd;
    const poi = POIS.find(p => p.id === 'guanghui');
    const v = new THREE.Vector3(SX(poi.x), 60, poi.z).project(camera);
    return { x: (v.x * 0.5 + 0.5) * 1600, y: (-v.y * 0.5 + 0.5) * 900 };
  });
  await page.mouse.click(p.x, p.y);
  await page.waitForTimeout(2400);
  await page.screenshot({ path: path.join(OUT, '16-点击景点弹出简介.png') });
  console.log('shot 16 panel');

  // 17-景点目录侧栏
  await page.click('#panel-close');
  await page.waitForTimeout(400);
  await page.click('#menu-toggle');
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(OUT, '17-景点目录侧栏.png') });
  console.log('shot 17 sidebar');

  // 18-360°环游按钮状态
  await page.click('#side-close');
  await page.waitForTimeout(300);
  await page.click('#auto-rota');
  await page.waitForTimeout(2500);
  await page.screenshot({ path: path.join(OUT, '18-360度环游视角.png') });

  console.log('errors:', errors.length ? errors.join(' | ') : 'none');
  await browser.close();
  process.exit(errors.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
