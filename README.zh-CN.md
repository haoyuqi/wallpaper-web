<h1 align="center">Wallpaper Web</h1>

<p align="center">
  <a href="https://github.com/haoyuqi/wallpaper-web/actions/workflows/ci.yml"><img alt="CI" src="https://github.com/haoyuqi/wallpaper-web/actions/workflows/ci.yml/badge.svg?branch=main"></a>
  <a href="https://github.com/haoyuqi/wallpaper-web/actions/workflows/ci.yml?query=branch%3Amain"><img alt="覆盖率" src="https://img.shields.io/endpoint?url=https%3A%2F%2Fraw.githubusercontent.com%2Fhaoyuqi%2Fwallpaper-web%2Fcoverage-badge%2Fcoverage.json"></a>
  <a href="https://github.com/haoyuqi/wallpaper-web/releases/latest"><img alt="最新版本" src="https://img.shields.io/github/v/release/haoyuqi/wallpaper-web"></a>
  <a href="LICENSE"><img alt="MIT 许可证" src="https://img.shields.io/badge/License-MIT-blue.svg"></a>
</p>

<p align="center">
  <a href="README.md">English</a> | 简体中文
</p>

Bing 壁纸归档前端。使用 Vue 3、TypeScript、Vue Router 与原生 CSS，由项目内置的
Vite+ 构建。界面采用影院式布局、暖亚麻配色与 LXGW WenKai 字体。应用使用真实
v1 API 元数据，不存在生产环境的模拟数据模式。

界面支持英语与简体中文。首次访问会按浏览器首选语言匹配，未匹配时回退到英语。
已保存的手动选择在后续访问中优先；可在右上角切换语言。

```sh
npm ci
npm run dev
```

打开 http://127.0.0.1:5174/。开发服务器把 `/api` 代理到 `API_PROXY_TARGET`，
默认值为 `http://wallpaper-api.test:8100`。该主机名只是本地开发默认值，不是本
仓库自带的后端。要使用自己的 API，请把 `.env.example` 复制为 `.env.local`，
并将 `API_PROXY_TARGET` 设为它的源。请求不会携带凭据。

```sh
npm test
npm run test:unit
npm run test:coverage
npm run test:e2e
npm run check
npm run build
npm run preview
```

在全新环境中运行端到端测试前，先安装一次 Chromium 浏览器：
`npx playwright install chromium`。

生产产物是 `dist/`，一个静态 SPA。开发用的 API 代理不会随产物发布：请在构建时
配置公开的 `VITE_API_BASE_URL`，或在静态主机上配置同源 API 反向代理与 SPA
history 回退。

当前 API 客户端与响应校验位于 `src/services/wallpapers.ts`。它使用 `date` 或
`from`/`to` 参数请求 `GET /api/v1/wallpapers`。本前端未实现认证与服务端分页。

## 开发规范

保持改动范围聚焦，不要动无关的工作。使用 Node.js 26.12.1 或更高版本，以及
`package.json` 中声明的 npm 版本；所有构建工具都是项目本地依赖。切勿提交 `.env`
或凭据。

用自动化测试（`npm test`）、格式与静态检查及类型检查（`npm run check`）、生产
构建（`npm run build`）和针对性的浏览器检查来验证改动。单元/组件测试通过
`vp test` 在 `happy-dom` 中运行；端到端测试通过 Playwright 在无头 Chromium 中
针对生产预览构建运行，网络边界已 mock（无需本地后端或真实外部服务）。请审查
实际文件（包括未跟踪的源码），关注正确性、可读性、架构、安全与性能。报告实际
执行的验证命令与结果；没有证据时不要声称通过 CI，也不要声称满足广泛的浏览器或
无障碍要求。

## 持续集成

[GitHub Actions](.github/workflows/ci.yml) 执行格式检查、静态检查、类型检查、
单元/组件测试、生产构建、Chromium E2E 测试与依赖审计。

上方覆盖率徽章会在默认分支每次 CI 成功后更新。Vitest 的覆盖率报告覆盖每个
`src/**/*.{ts,vue}` 文件；只有 statements、branches、functions、lines 全部保持
100%，CI 才会通过。

## 浏览器检查

用 Chrome 验证：真实 API 加载，日期查询/刷新/后退/清除，每次追加六张卡片，三个
弹窗入口，查看器不提供上一张/下一张切换，键盘焦点与 Esc，滚动位置恢复，轮播暂停
与 reduced motion，下载或如实回退提示。检查 320/390/700/701/768/1120/1121/1440/1920
宽度与 844x390 横屏、缩放与重排、长文本、空/错误/限流/图片失败，以及控制台与
资源加载。面向用户的应用在任何情况下都不得回退到假数据。

## 字体重新生成

字体资源许可证为 `public/fonts/OFL.txt`。字体重新生成是可选的，使用 Python 3
以及 FontTools 与 Brotli。现有资源由 fonttools 4.67.0 与 brotli 1.2.0 生成。
请为这些依赖使用虚拟环境，然后运行：

```sh
python3 scripts/build-fonts.py /path/to/LXGWWenKai-Regular.ttf
```

请使用虚拟环境中的 Python 3 解释器。
原始 LXGW WenKai Regular v1.530 TTF 需另行准备；使用仓库自带的 WOFF2 资源构建
或运行应用并不需要它。脚本会校验完整的 cmap 一致性。该 TTF 是设计源文件，不是
要加入生产包的资源。优化优先子集后，若改动了固定 UI 文案，请重新生成；无论是否
重新生成，源字符始终完整覆盖。
