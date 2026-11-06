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

页面加载时请求 `https://api.github.com/repos/likehao19/SpacePreview/releases/latest`，显示最新版本号，按平台和架构从 assets 中匹配安装包，并将按钮更新为 `browser_download_url`，点击即可开始下载。Windows 使用 EXE，两种 macOS 架构分别使用 DMG，Linux 主按钮下载 AppImage，另提供 DEB 链接。签名文件和更新归档不会被误选为安装包。

请求 8 秒超时或失败时，保留已核实的 v0.10.14 固定版本下载地址，并显示备用版本提示；禁用脚本时这些地址仍可使用。若成功获取的新版缺少某个平台安装包，该按钮改为查看发布页，不会误下载其他架构。发布新版时可同时更新 HTML 中的备用链接、备用版本文字和脚本中的失败提示。

将本文件夹的内容上传到静态网站托管服务，以 `index.html` 为首页即可，支持子目录部署。当前改动保存在本地，未部署到线上。

## 更新与检查

发布新版时同步更新版本、格式与平台说明；更换图标时将 `src-tauri/icons/icon.png` 复制为 `assets/app-icon.png`。动画由 `motion.js` 和 `styles.css` 管理，进入视口时播放一次，首屏背景在离开视口时暂停。系统启用减少动态效果时禁用动画。

安装项目依赖后，在项目根目录运行：

```sh
node scripts/smoke-website.mjs
```

需要本机 Microsoft Edge。检查覆盖离线打开、截图切换与放大、头部单一 GitHub 入口、系统图标、格式表格、FAQ、最新版本获取、各平台直接下载、接口失败 / 超时 / 缺包回退、导航链接、六种视口宽度、禁用脚本后的内容，以及 Markdown 本地链接。桌面和手机截图保存到忽略跟踪的 `test-results/`。
