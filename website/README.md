# 瞬览官网

原生 HTML、CSS 和 JavaScript，无框架、无构建步骤、无外部字体或脚本依赖。参考 [Cometixy 官网](https://find.cometix.dev/) 的居中排版、衬线标题和蓝青渐变，使用固定白色主题、轻量动画和紧凑的平台下载卡片呈现产品，不包含价格模块。

## 本地预览

直接用浏览器打开 `index.html` 即可，也可在项目根目录运行：

```sh
python -m http.server 8080 --directory website
```

然后访问 <http://localhost:8080>。

## 文件与截图

- `index.html`：产品介绍、功能、文件类型表格、真实截图、四个平台下载入口和常见问题。
- `styles.css`：白色主题响应式布局，包含居中首屏、渐变按钮、功能卡片与下载区，适配手机与桌面，支持减少动态效果的系统设置。
- `script.js`：通过 GitHub 公共 API 获取最新发布版本与安装包地址，不读取本地文件。
- `i18n.js`：完整中英文切换，默认跟随浏览器语言并记忆选择，翻译页面正文、截图说明和动态下载状态。语言按钮与墨笺官网采用一致布局。
- `gallery.js`：截图切换、方向键导航、点击放大与 Esc 关闭；无脚本时可直接打开原图。
- `motion.js`：首屏入场、滚动渐入和背景动画可见性控制；尊重减少动态效果设置，无脚本时内容仍可见。
- `assets/app-icon.png`：直接使用 `src-tauri/icons/icon.png` 中当前桌面软件的黑色 S 图标，包含页签、导航、首屏和页脚。
- `assets/preview-*.png`：用户提供的 Windows 版真实截图，按原图复制，未裁剪或重绘软件界面。

截图来自用户提供的 `帖子.md` 中引用的图片。选择的文件对应如下，便于以后更新：

| 本地文件               | 原图片文件名                                     | 内容                |
| ---------------------- | ------------------------------------------------ | ------------------- |
| `preview-archive.png`  | `image-235a2943-8548-49df-9dd5-e71dfc9f7a23.png` | ZIP 目录与内部图片  |
| `preview-code.png`     | `image-e2d5526a-e1b6-48a1-b508-bc7a367ae2f7.png` | JSON 代码高亮与折叠 |
| `preview-word.png`     | `image-cec7023e-3d4a-4682-a84d-5093ffee3554.png` | Word 页面与大纲     |
| `preview-pdf.png`      | `image-a37219f7-edda-4efb-871c-7dcd0a5de3c4.png` | PDF 阅读            |
| `preview-tar.png`      | `image-a96763fd-8ea3-4adf-82d3-aff88c91a388.png` | TAR 目录与内部源码  |
| `preview-html.png`     | `image-9c5f6682-e9ba-4387-a06d-a57b63ad76c0.png` | 本地 HTML 网页      |
| `preview-settings.png` | `image-178a51b4-78cc-48f2-b3bd-e1ef7012e90c.png` | 通用设置            |

展示七张真实截图，按所选标签加载；支持方向键切换和点击放大。图库菜单与墨笺官网采用一致的布局和交互。

## 下载与部署

页面加载时以 `cache: no-store` 请求 `https://spacepreview.likh.cn/downloads/release.json`，显示最新完整版本并将五种安装包按钮映射到官方服务器带版本的 URL。Windows 使用 EXE，两种 macOS 架构分别使用 DMG，Linux 提供 AppImage 和 DEB。系统/架构信息可用时推荐对应卡片；Mac CPU 不可识别时保留两种选择。

请求超时、数据不完整或失败时，保留 HTML 自带的 `/downloads/latest/SpacePreview-平台文件名` 服务器备用下载链接；禁用脚本时这些地址仍有效。所有平台先验证后一起更新，避免出现部分新版、部分旧版链接。发布、缓存、服务器目录与恢复方式见 [官方分发运维](../docs/OFFICIAL-DOWNLOADS.md)。

沿用服务器现有宝塔 Nginx 和 HTTPS，部署静态文件到已有站点，下载目录由独立同步程序管理，无额外常驻 Web 服务。

## 更新与检查

发布新版时同步更新版本、格式与平台说明；更换图标时将 `src-tauri/icons/icon.png` 复制为 `assets/app-icon.png`。动画由 `motion.js` 和 `styles.css` 管理，进入视口时播放一次，首屏背景在离开视口时暂停。系统启用减少动态效果时禁用动画。

安装项目依赖后，在项目根目录运行：

```sh
node scripts/smoke-website.mjs
```

需要本机 Microsoft Edge。检查覆盖离线打开、截图切换与放大、头部单一 GitHub 入口、系统图标、格式表格、FAQ、最新版本获取、各平台直接下载、接口失败 / 超时 / 缺包回退、导航链接、六种视口宽度、禁用脚本后的内容，以及 Markdown 本地链接。桌面和手机截图保存到忽略跟踪的 `test-results/`。
