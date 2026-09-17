# AGENTS.md

本文件用于指导 AI 编程助手（以及新加入的开发者）在本仓库中工作。

## 项目简介

《畅游正定古城》—— 基于 Three.js 的浏览器端 3D 古城漫游应用，呈现正定"九楼四塔八大寺"及城内外文物古迹。纯前端，无后端依赖。

## 技术栈

- Three.js r160（ES Module 方式引用，通过 importmap 指向 `node_modules`）
- 原生 JavaScript（ES2020）、HTML、CSS，无前端框架
- esbuild 打包为单文件 IIFE（`dist/app.js`），使 `file://` 双击打开也能运行
- Node.js 内置模块实现的零依赖静态服务器（`server.cjs`）

## 常用命令

```bash
npm install            # 安装依赖（three、esbuild）
npm run dev            # 启动本地静态服务 http://127.0.0.1:5173
npm run build          # 打包 js/main.js → dist/app.js（修改 js/ 源码后必须执行）
npm run start          # 先打包再起服务
# Windows 可直接双击 启动.bat
```

验证方式：浏览器打开页面；自动化验证可用 Playwright（系统已安装 Edge，可 `channel: 'msedge'` 启动，无需额外下载 chromium）。

## 目录结构

```
index.html        页面与 UI 容器（顶栏/侧栏/面板/指南针/小地图）
css/style.css     全部样式（古风深色描金）
js/data.js        景点数据：坐标、类别、保护级别、简介（唯一事实来源）
js/builders.js    古建构件：曲面屋顶、殿堂、楼阁、四塔、城门、寺庙、民居、树、标签
js/world.js       世界组装：地形/滹沱河/道路/城墙/建筑填充/实例化树木/网格合并
js/main.js        场景初始化、射线拾取、相机动画、指南针、小地图、UI 事件
server.cjs        零依赖静态服务器
dist/app.js       构建产物（勿手改）
docs/设计方案.md   架构与设计文档
```

## 关键约定（修改代码前必读）

1. **方位坐标体系**：`data.js` 中 x+ 为东、z+ 为北、长乐门在正南 `(0,-820)`；Three.js 场景放置时必须经 `SX = x => -x` 映射（相机面南望北时屏幕右为场景 -X）。小地图与指南针均按数据方位坐标计算，见 `main.js` 中的 `w2m / sceneToData`。
2. **改源码后重新打包**：修改 `js/` 下任何文件后运行 `npm run build`，否则双击 index.html 看到的仍是旧 `dist/app.js`（http 服务下则直接读源码）。
3. **静态网格必须可合并**：`world.js` 中 `mergeStatic` 会按材质合并全部静态网格——新几何体若带 index 已统一转非索引；动态对象（标记光环、光柱等）通过 `userData.keep` 排除，InstancedMesh 自动跳过。
4. **景点注册拾取**：新景点在 `data.js` 增加条目（id/name/cat/x/z/model/intro），并在 `world.js buildPoiModel` 与 `builders.js` 中提供对应模型；模型经 `register()` 按材质合并并烘焙世界坐标，**不要**把合并网格再挂回带 position 的 group（曾导致二次平移 bug）。
5. **性能红线**：树木用 InstancedMesh；材质/几何体优先复用 `builders.js` 顶部缓存；避免在渲染循环中创建对象。
6. **确定性随机**：使用 `mulberry32(seed)`，不要用 `Math.random()` 生成场景布局，保证每次构建一致。
7. **无注释原则**：除非用户明确要求，新增代码不要加注释。

## 当前阶段

第一阶段已完成（九楼四塔八大寺、城内外建筑、指南针、区域导航缩略图、缩放/360°/点击飞行/简介、file:// 可运行）。第二阶段规划见 `docs/设计方案.md` 第十一节：实景照片、摩尼殿爆炸图、高德实时定位导航、周边交通、文旅标语等。
