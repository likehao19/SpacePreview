<h1 align="center">瞬览 SpacePreview</h1>

<p align="center"><strong>本地优先，选中文件，轻按空格，即刻预览。</strong></p>

<p align="center">
  <a href="README.md">English</a> |
  简体中文 |
  <a href="README.zh-TW.md">繁體中文</a> |
  <a href="README.ja.md">日本語</a> |
  <a href="README.ko.md">한국어</a>
</p>

<p align="center">
  <a href="https://github.com/likehao19/SpacePreview/releases/latest"><img src="https://img.shields.io/github/v/release/likehao19/SpacePreview?display_name=tag&sort=semver" alt="最新版本" /></a>
  <a href="https://github.com/likehao19/SpacePreview/actions/workflows/release.yml"><img src="https://github.com/likehao19/SpacePreview/actions/workflows/release.yml/badge.svg" alt="构建状态" /></a>
  <a href="https://github.com/likehao19/SpacePreview/releases"><img src="https://img.shields.io/github/downloads/likehao19/SpacePreview/total" alt="下载量" /></a>
  <a href="https://github.com/likehao19/SpacePreview/stargazers"><img src="https://img.shields.io/github/stars/likehao19/SpacePreview?style=flat&logo=github" alt="GitHub Stars" /></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-green" alt="MIT 许可证" /></a>
</p>

<p align="center">
  <a href="https://spacepreview.likh.cn/">官方网站</a> ·
  <a href="https://github.com/likehao19/SpacePreview/releases/latest">下载</a> ·
  <a href="https://github.com/likehao19/SpacePreview/issues">问题反馈</a>
</p>

<p align="center">
  <img src="website/assets/preview-archive.png" alt="瞬览浏览 ZIP 目录并预览内部图片" width="1000" />
</p>

## 保留查看节奏，减少反复打开

SpacePreview 是一款本地文件预览器。在 Windows 资源管理器、桌面或 macOS Finder 中选中文件，按下空格即可查看，再按一次返回。文档、图片、代码、表格与压缩包集中在一个预览窗口中，临时查看不必反复启动完整编辑软件。

- **本地优先**：不上传文件内容，以只读方式预览，不修改原文件。
- **快速查看**：PDF 按可见页绘制，ZIP 按需读取，切换或关闭预览时取消旧任务。
- **多类内容**：覆盖常见文档、图像、代码、压缩包，以及部分专业格式；不同格式的能力与限制有所区别。
- **多系统使用**：Windows、macOS、Linux 均提供安装包；Linux 通过拖入文件或 `Ctrl+O` 预览，暂不支持文件管理器空格唤起。

## 两种查看方式

<table>
  <tr>
    <td width="50%"><img src="website/assets/preview-word.png" alt="瞬览 Word 页面与文档大纲" /></td>
    <td width="50%"><img src="website/assets/preview-code.png" alt="瞬览 JSON 代码高亮与折叠" /></td>
  </tr>
  <tr>
    <td align="center"><strong>页面预览与阅读导航</strong><br />查看文档页面、图片与表格，通过大纲找到需要的章节。</td>
    <td align="center"><strong>源码查看与结构折叠</strong><br />直接查看代码、配置与文本，使用语法高亮、搜索和按条件启用的代码折叠。</td>
  </tr>
</table>

## SpacePreview 能做什么

### 文档与阅读

- PDF 连续滚动、缩放、文字选择与复制、搜索和内置目录；扫描图片 PDF 暂无 OCR。
- OFD 版式文档（如电子发票）按可见页绘制文字、矢量图形、图片、模板、注释与印章外观，支持全文搜索；不校验签名有效性。
- Word 页面、图片、表格与标题大纲，可切换文字速览；复杂排版可能与 Word 不同，旧 DOC 仅文字速览。
- Markdown 大纲、任务列表、表格与代码高亮，以及 RTF、OpenDocument、EPUB、FB2 内容阅读。
- PowerPoint 在 Windows 本地安装并激活 Microsoft PowerPoint 时生成静态页面；其他情况提供文字速览，不播放演示动画。

### 代码与专业内容

- 文本与代码的语法高亮、全文搜索、编码切换和字号调整；JSON/XML 等结构化代码在大小与行数限制内支持折叠。
- 本地 HTML 网页、阅读和源码切换，可加载预算内同目录及子目录静态资源，不执行脚本。
- DXF 图纸及 STL、OBJ、GLB、STEP 等三维几何查看；不等于完整 CAD 编辑或所有版本兼容。
- 通过独立引擎查看部分专业图像、SQLite、字体、邮件、图表和动画；RAW 等变体及设计文件预览图存在兼容边界。

### 目录与内容浏览

- 展开文件夹目录层级，选择支持的内部文件继续预览。
- 浏览 ZIP、TAR、7Z、RAR 等归档目录和内部支持的内容，不必先完整解压。
- 表格支持多工作表或虚拟滚动，SQLite 记录分页浏览；不执行宏、不重新计算公式。
- 同目录文件切换、拖入文件与文件选择器，减少反复进入和返回的操作。

### 外观与使用习惯

- 亮色、暗色和跟随系统的界面外观，阅读字体、字号和页面缩放。
- Windows / macOS 分别保存预览快捷键，可重置为默认空格键。
- 可选开机自启动、失去焦点时关闭，以及托盘或菜单栏驻留。
- 应用内检查更新；Linux AppImage 支持应用内更新，DEB 通过下载新包升级。

完整格式与大小限制见 [预览使用指南](docs/PREVIEW-GUIDE.md)、[格式清单](docs/FORMAT_PARITY.md) 和 [格式核对记录](docs/WEBSITE-FORMAT-AUDIT.md)。已接入不等于所有变体均实测；本轮格式样本验证在 Windows Edge 中完成，macOS / Linux 仍需实机验收。

## 下载

| 平台 | 安装包 | 架构 |
| --- | --- | --- |
| Windows | [下载安装程序](https://github.com/likehao19/SpacePreview/releases/download/v0.10.16/SpacePreview-0.10.16-windows-x64-setup.exe) | x64 |
| macOS | [下载 Apple 芯片版](https://github.com/likehao19/SpacePreview/releases/download/v0.10.16/SpacePreview-0.10.16-macos-arm64.dmg) | ARM64 |
| macOS | [下载 Intel 版](https://github.com/likehao19/SpacePreview/releases/download/v0.10.16/SpacePreview-0.10.16-macos-x64.dmg) | x86_64 |
| Linux | [AppImage](https://github.com/likehao19/SpacePreview/releases/download/v0.10.16/SpacePreview-0.10.16-linux-x64.AppImage) · [DEB](https://github.com/likehao19/SpacePreview/releases/download/v0.10.16/SpacePreview-0.10.16-linux-x64.deb) | x86_64 |

以上为 v0.10.16 的直接下载地址。[官方网站](https://spacepreview.likh.cn/) 可自动获取最新发布版本；更新说明和历史版本也可在 [GitHub Releases](https://github.com/likehao19/SpacePreview/releases) 查看。

## 安装

### Windows

下载 `SpacePreview-0.10.16-windows-x64-setup.exe` 并按照安装程序提示操作。当前 Windows 版本支持 Windows 10 / 11 x64，需要 Microsoft Edge WebView2 Runtime。

启动后在资源管理器或桌面选中文件，按 `Space` 即可预览。关闭窗口后应用驻留托盘，右键托盘图标可退出。

### macOS

根据 Mac 处理器下载对应 DMG，打开后将 **SpacePreview** 拖入 **应用程序** 文件夹。

安装包采用临时签名，尚未进行 Apple Developer ID 签名和公证。如果首次启动被 Gatekeeper 拦截，可在 **系统设置 → 隐私与安全性** 中检查是否提供 **仍要打开** 入口。

Finder 空格预览需要授予辅助功能与 Finder 自动化权限。完整权限、构建与验收步骤见 [MACOS.md](MACOS.md)。

### Linux

运行 `uname -m` 检查架构，当前提供 `x86_64` 安装包。

- Debian / Ubuntu 系发行版可选择 **DEB**。
- 其他适配的发行版可选择 **AppImage**，首次使用前授予执行权限。

```bash
# AppImage
chmod +x SpacePreview-0.10.16-linux-x64.AppImage
./SpacePreview-0.10.16-linux-x64.AppImage

# Debian 系
sudo apt install ./SpacePreview-0.10.16-linux-x64.deb
```

Linux 当前通过拖入文件或 `Ctrl+O` 预览，暂不支持文件管理器空格唤起。未提供 RPM 或 ARM64 安装包。

## 常用快捷键

| 功能 | Windows | macOS |
| --- | --- | --- |
| 唤起 / 关闭预览 | `Space` | `Space` |
| 关闭菜单、设置或预览 | `Esc` | `Esc` |
| 请求 / 切换纯文本预览 | `Shift+Space` | `Shift+Space` |
| 上一个 / 下一个文件 | `←` / `→` | `←` / `→` |
| 选择文件 | `Ctrl+O` | `⌘O` |
| 复制路径 | `Ctrl+Shift+C` | `⌘⇧C` |
| 调整字号或页面缩放 | `Ctrl++` / `Ctrl+-` | `⌘+` / `⌘-` |
| 使用滚轮调整字号或页面缩放 | `Ctrl+滚轮` | `⌘+滚轮` |
| 使用默认应用打开 | `Enter` | `Enter` |

预览键可在 **偏好设置 → 快捷键** 中修改。输入框、媒体控件与聚焦按钮保留各自的按键行为。复制路径对浏览器文件和压缩包内部文件仅复制文件名；默认打开不执行程序或脚本。完整说明见 [预览使用指南](docs/PREVIEW-GUIDE.md)。

## 隐私与本地数据

SpacePreview 不上传文件内容，文件仍保存在原来的位置，预览不会修改原文件。偏好设置保存在本机，预览引擎可能创建本地缓存；应用更新会访问发布服务器。

文档脚本和 Office 宏不执行，Notebook 不运行单元格。单文件大小上限默认 **256 MB**，可调整为 **16–1024 MB**，各格式还有独立解析限制。当前 Web Worker 不是操作系统级沙箱，也不提供进程级 CPU / 内存隔离。详见 [架构与安全边界](docs/PREVIEW-GUIDE.md#架构与安全边界)。

## 从源码构建

### 环境要求

- Node.js **22.13+** 与 npm。
- Rust stable。
- Windows 需要 Visual Studio C++ Build Tools、Windows SDK 和 WebView2；macOS 需要 Xcode Command Line Tools，平台步骤见 [MACOS.md](MACOS.md)。

```bash
git clone https://github.com/likehao19/SpacePreview.git
cd SpacePreview
npm ci
npm run desktop
```

运行项目检查并构建桌面安装包：

```bash
npm test
npm run build
cargo test --manifest-path src-tauri/Cargo.toml --lib
cargo fmt --manifest-path src-tauri/Cargo.toml --check
npm run desktop:build
```

浏览器模式执行 `npm run dev`，预览引擎回归执行 `npm run test:preview`。macOS 通用构建在 Mac 上执行 `npm run desktop:build:mac`。验证记录见 [TESTING.md](TESTING.md)，应用内更新配置见 [更新说明](docs/UPDATING.md)。独立 HTML / CSS / JS 官网位于 [website/](website/)，使用方法见 [官网 README](website/README.md)。

## 技术栈

SpacePreview 使用 Tauri 2 与 Rust、React 19 与 TypeScript、PDF.js、docx-preview、highlight.js，以及面向图像、压缩包、数据库与模型的本地 JS / WASM 预览引擎构建。

## 参与贡献

欢迎通过 [GitHub Issues](https://github.com/likehao19/SpacePreview/issues) 提交可复现的问题或聚焦的功能建议。请附上系统版本、瞬览版本、文件格式与复现步骤；提交代码前运行相关前端测试、生产构建与 Rust 检查。源文件使用 UTF-8 无 BOM。

社区交流：[LinuxDo](https://linux.do/)。历史迭代见 [历史更新](docs/HISTORY.md)，当前版本说明见 [RELEASE-NOTES.md](RELEASE-NOTES.md)。

## 贡献者

<table>
  <tr>
    <td align="center">
      <a href="https://github.com/likehao19">
        <img src="https://avatars.githubusercontent.com/u/96912988?v=4" width="72" height="72" alt="likehao19" /><br />
        <sub><strong>likehao19</strong></sub>
      </a>
    </td>
    <td align="center">
      <a href="https://github.com/StackTao">
        <img src="https://avatars.githubusercontent.com/u/243470334?v=4" width="72" height="72" alt="StackTao" /><br />
        <sub><strong>StackTao</strong></sub>
      </a>
    </td>
  </tr>
</table>

## Star 增长趋势

<picture>
  <img alt="SpacePreview Star 增长曲线" src="https://api.star-history.com/svg?repos=likehao19/SpacePreview&type=Date" />
</picture>

## 开源协议

SpacePreview 基于 [MIT 许可证](LICENSE) 开源。第三方依赖的许可证与声明见 [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md)。
