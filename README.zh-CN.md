<h1 align="center">Wallpaper Web</h1>

<p align="center">
  <a href="https://github.com/haoyuqi/wallpaper-web/actions/workflows/ci.yml"><img alt="CI" src="https://github.com/haoyuqi/wallpaper-web/actions/workflows/ci.yml/badge.svg?branch=main"></a>
  <a href="https://github.com/haoyuqi/wallpaper-web/actions/workflows/ci.yml?query=branch%3Amain"><img alt="覆盖率" src="https://img.shields.io/endpoint?url=https%3A%2F%2Fraw.githubusercontent.com%2Fhaoyuqi%2Fwallpaper-web%2Fcoverage-badge%2Fcoverage.json"></a>
  <a href="https://github.com/haoyuqi/wallpaper-web/releases/latest"><img alt="最新版本" src="https://img.shields.io/github/release/haoyuqi/wallpaper-web.svg"></a>
  <a href="LICENSE"><img alt="MIT 许可证" src="https://img.shields.io/badge/license-MIT-blue.svg"></a>
</p>

<p align="center">
  <a href="README.md">English</a> | 简体中文
</p>

一个用于浏览 Bing 壁纸归档的静态前端。使用 Vue 3、TypeScript、Vue Router 与原生 CSS，由项目内置的 Vite+ 构建；界面采用影院式布局、暖亚麻配色与 LXGW WenKai 字体。元数据来自 v1 API，不存在生产环境的模拟数据模式。

## 功能

- 通过 URL 按日期浏览归档，例如 `/?date=2026-10-18`；不带日期时显示最近 30 个 UTC 日历日。
- 首图轮播支持播放、上一张和下一张，下方画廊每次追加六张卡片。
- 首图与卡片共用同一个详情弹窗，包含键盘焦点锁定、滚动位置恢复和带大小上限的下载。
- 英语与简体中文界面。首次访问跟随浏览器语言偏好，手动选择会被保存并在之后复用。
- 空数据、错误、限流与图片加载失败都有如实的界面状态，应用不会回退到假数据。

## 环境要求

- Node.js 26.12.1 或更高版本，以及 `package.json` 中声明的 npm 版本。
- 一个提供 `GET /api/v1/wallpapers` 的 v1 API，接受 `date` 或 `from`/`to` 区间参数。本仓库不包含后端。

## 快速开始

```sh
npm ci
npm run dev
```

开发服务器监听 `http://127.0.0.1:5174/`，并把 `/api` 代理到 `API_PROXY_TARGET`，默认值为 `http://wallpaper-api.test:8100`；该主机名只是本地默认值，不是本仓库自带的后端。要接入其它 API，请把 `.env.example` 复制为 `.env.local`，并将 `API_PROXY_TARGET` 设为它的源。请求不会携带凭据。

## 环境变量

| 变量                | 作用范围     | 用途                                                                           |
| ------------------- | ------------ | ------------------------------------------------------------------------------ |
| `API_PROXY_TARGET`  | 仅开发服务器 | `/api` 代理的上游源，不会进入浏览器产物。                                      |
| `VITE_API_BASE_URL` | 构建时       | 浏览器访问的公开 API 源。留空则调用同源 `/api`。不要在 `VITE_*` 变量中放密钥。 |

## 命令

| 命令                    | 用途                                                    |
| ----------------------- | ------------------------------------------------------- |
| `npm run dev`           | 启动 Vite 开发服务器。                                  |
| `npm run build`         | 先用 `vue-tsc` 做类型检查，再把静态产物构建到 `dist/`。 |
| `npm run preview`       | 在本地预览构建产物。                                    |
| `npm test`              | 运行单元/组件测试与端到端测试。                         |
| `npm run test:unit`     | 只运行单元与组件测试。                                  |
| `npm run test:coverage` | 运行单元测试并采集覆盖率、校验阈值。                    |
| `npm run test:e2e`      | 构建后针对预览服务器运行 Playwright Chromium 套件。     |
| `npm run check`         | 检查格式与静态规则，再做类型检查。                      |
| `npm run typecheck`     | 只运行 `vue-tsc`。                                      |
| `npm run format`        | 格式化仓库。                                            |

在全新环境中首次运行端到端测试前，先安装一次浏览器：

```sh
npx playwright install chromium
```

## 测试与质量门禁

单元与组件测试通过 `vp test` 在 `happy-dom` 中运行；Playwright 驱动无头 Chromium 针对生产预览构建运行，API 与图片请求均已 mock，因此不需要后端或真实外部服务。

覆盖率统计覆盖每个 `src/**/*.{ts,vue}` 模块，statements、branches、functions、lines 必须全部保持 100%。CI 还会检查格式、静态规则与类型，构建产物，并运行依赖审计——出现 high 或 critical 级漏洞即失败。

Playwright 的 HTML 报告与失败附件输出到 `tests/e2e/.results/`。

## 部署

生产产物是 `dist/`，一个静态单页应用，不包含开发用的 API 代理。请在构建时配置公开的 `VITE_API_BASE_URL`，或在静态主机前置同源 API 反向代理，并让主机把未知路径回退到 `index.html`，以保证客户端路由可用。

## 手动浏览器检查

改动涉及布局或交互时，发布前请在 Chrome 中验证：真实 API 加载、日期查询、刷新、后退与清除、每次追加六张卡片、三个弹窗入口、查看器内不提供上一张/下一张切换、键盘焦点与 Escape、滚动位置恢复、轮播暂停与 reduced motion，以及下载或明确的回退提示。同时检查 320、390、700、701、768、1120、1121、1440、1920 像素宽度和 844x390 横屏，以及缩放与重排、长文本和空数据、错误、限流、图片失败等状态。

## 字体重新生成

字体资源以 `public/fonts/OFL.txt` 授权。重新生成是可选的，使用 Python 3 以及 FontTools 与 Brotli；仓库中的资源由 fonttools 4.67.0 与 brotli 1.2.0 生成。请为这些依赖使用虚拟环境，然后运行：

```sh
python3 scripts/build-fonts.py /path/to/LXGWWenKai-Regular.ttf
```

原始 LXGW WenKai Regular v1.530 TTF 是设计源文件，需要另行准备；仓库自带的 WOFF2 分片足以构建和运行应用。脚本会校验完整的字符映射与源文件一致。改动固定界面文案后，可重新生成优先子集；无论是否重新生成，源字符始终完整覆盖。

## 许可证

基于 [MIT 许可证](LICENSE) 发布。
