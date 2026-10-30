<h1 align="center">SpacePreview</h1>

<p align="center"><strong>A local-first file previewer. Select a file, press Space, and see what is inside.</strong></p>

<p align="center">
  English |
  <a href="README.zh-CN.md">简体中文</a> |
  <a href="README.zh-TW.md">繁體中文</a> |
  <a href="README.ja.md">日本語</a> |
  <a href="README.ko.md">한국어</a>
</p>

<p align="center">
  <a href="https://github.com/likehao19/SpacePreview/releases/latest"><img src="https://img.shields.io/github/v/release/likehao19/SpacePreview?display_name=tag&sort=semver" alt="Latest release" /></a>
  <a href="https://github.com/likehao19/SpacePreview/actions/workflows/release.yml"><img src="https://github.com/likehao19/SpacePreview/actions/workflows/release.yml/badge.svg" alt="Build status" /></a>
  <a href="https://github.com/likehao19/SpacePreview/releases"><img src="https://img.shields.io/github/downloads/likehao19/SpacePreview/total" alt="Downloads" /></a>
  <a href="https://github.com/likehao19/SpacePreview/stargazers"><img src="https://img.shields.io/github/stars/likehao19/SpacePreview?style=flat&logo=github" alt="GitHub stars" /></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-green" alt="MIT License" /></a>
</p>

<p align="center">
  <a href="https://spacepreview.likh.cn/">Website</a> ·
  <a href="https://github.com/likehao19/SpacePreview/releases/latest">Download</a> ·
  <a href="https://github.com/likehao19/SpacePreview/issues">Issues</a>
</p>

<p align="center">
  <img src="website/assets/preview-archive.png" alt="SpacePreview browsing a ZIP archive and previewing an image" width="1000" />
</p>

## Files at a glance, without opening every app

SpacePreview is a local file previewer. Select a file in Windows Explorer, on the desktop, or in macOS Finder, then press Space to preview it. Press Space again to return. Documents, images, code, spreadsheets, and archives share one window, so a quick look does not require launching a full editor.

- **Local first** — previews are read-only, do not modify the original file, and do not upload its contents.
- **Quick to inspect** — PDF pages render near the viewport, ZIP entries load on demand, and old tasks are cancelled when switching or closing.
- **Many kinds of content** — common documents, images, code, archives, and selected specialist formats, with format-specific limits.
- **Across platforms** — installers for Windows, macOS, and Linux. Linux currently uses drag-and-drop or `Ctrl+O`, without file-manager Space integration.

## Two ways to preview

<table>
  <tr>
    <td width="50%"><img src="website/assets/preview-word.png" alt="Page preview and reading navigation" /></td>
    <td width="50%"><img src="website/assets/preview-code.png" alt="Source inspection and folding" /></td>
  </tr>
  <tr>
    <td align="center"><strong>Page preview and reading navigation</strong><br />Read document pages, images, and tables, and jump between sections using the outline.</td>
    <td align="center"><strong>Source inspection and folding</strong><br />Inspect code, configuration, and text with highlighting, search, and conditional code folding.</td>
  </tr>
</table>

## What SpacePreview does

### Read documents

- Continuous PDF scrolling, zoom, text selection and copying, search, and embedded outlines. Scanned PDFs do not have OCR.
- OFD (GB/T 33190) documents such as Chinese e-invoices: pages render on demand with text, vector graphics, images, templates, annotations and visible seals, plus full-text search. Signatures are not verified.
- Word pages, images, tables, and heading outlines, with a text-only fallback. Complex layouts may differ; legacy DOC is text-only.
- Markdown outlines, task lists, tables, and highlighted code, plus RTF, OpenDocument, EPUB, and FB2 reading.
- Static PowerPoint pages on Windows with locally installed and activated Microsoft PowerPoint; text previews elsewhere. No presentation animations.

### Inspect code and specialist content

- Syntax highlighting, full-text search, encoding selection, and text sizing. Structured code such as JSON/XML supports folding within size and line limits.
- Local HTML webpage, reading, and source modes, with budgeted same-directory/subdirectory static resources and no script execution.
- DXF drawings and STL, OBJ, GLB, STEP, and other supported geometry. This is not a complete CAD editor or a guarantee for every format version.
- Separate local engines for selected professional images, SQLite, fonts, mail, diagrams, and animation. RAW variants and embedded design previews have compatibility limits.

### Browse directories and content

- Expand folder trees and continue previewing supported files inside them.
- Browse ZIP, TAR, 7Z, RAR, and other supported archive directories and entries without extracting the entire archive first.
- Multiple worksheets or virtual scrolling for tables, and paginated SQLite records. No macro execution or formula recalculation.
- Switch between files in the same directory, drag files in, or open them with a file picker.

### Personalize the workflow

- Light, dark, and system appearance, reading fonts, text sizes, and page zoom.
- Separate Windows/macOS preview shortcut settings, with a reset to the default Space key.
- Optional launch at login, close on loss of focus, and tray or menu-bar operation.
- In-app update checks. Linux AppImage supports in-app updates; DEB users download a new package.

See the [preview guide](docs/PREVIEW-GUIDE.md), [format list](docs/FORMAT_PARITY.md), and [format audit](docs/WEBSITE-FORMAT-AUDIT.md) for capabilities and limits. A registered format is not a guarantee for every variant. The latest sample checks used Windows Edge; macOS/Linux still need device testing.

## Download

| Platform | Package | Architecture |
| --- | --- | --- |
| Windows | [Installer](https://github.com/likehao19/SpacePreview/releases/download/v0.10.15/SpacePreview-0.10.15-windows-x64-setup.exe) | x64 |
| macOS | [Apple silicon DMG](https://github.com/likehao19/SpacePreview/releases/download/v0.10.15/SpacePreview-0.10.15-macos-arm64.dmg) | ARM64 |
| macOS | [Intel DMG](https://github.com/likehao19/SpacePreview/releases/download/v0.10.15/SpacePreview-0.10.15-macos-x64.dmg) | x86_64 |
| Linux | [AppImage](https://github.com/likehao19/SpacePreview/releases/download/v0.10.15/SpacePreview-0.10.15-linux-x64.AppImage) · [DEB](https://github.com/likehao19/SpacePreview/releases/download/v0.10.15/SpacePreview-0.10.15-linux-x64.deb) | x86_64 |

These direct links download v0.10.15. The [website](https://spacepreview.likh.cn/) checks the latest release automatically. Release notes and older builds are available on [GitHub Releases](https://github.com/likehao19/SpacePreview/releases).

## Installation

### Windows

Download `SpacePreview-0.10.15-windows-x64-setup.exe` and follow the installer. The current release supports Windows 10/11 x64 and requires Microsoft Edge WebView2 Runtime.

Start SpacePreview, select a file in Explorer or on the desktop, and press `Space`. Closing the preview leaves the app in the tray; use the tray menu to quit.

### macOS

Download the DMG for your Mac, open it, and drag **SpacePreview** into **Applications**.

Packages are ad-hoc signed and have not received Apple Developer ID signing or notarization. If Gatekeeper blocks the first launch, check **System Settings → Privacy & Security** for **Open Anyway**.

Finder preview requires Accessibility and Finder Automation permission. See [MACOS.md](MACOS.md) for permissions, builds, and device checks.

### Linux

Check your architecture with `uname -m`. The current packages target `x86_64`.

- Choose **DEB** for compatible Debian/Ubuntu-based distributions.
- Use **AppImage** on other compatible distributions and make it executable first.

```bash
# AppImage
chmod +x SpacePreview-0.10.15-linux-x64.AppImage
./SpacePreview-0.10.15-linux-x64.AppImage

# Debian family
sudo apt install ./SpacePreview-0.10.15-linux-x64.deb
```

Open files by dragging them in or using `Ctrl+O`. Linux file-manager Space integration, RPM, and ARM64 packages are not currently provided.

## Keyboard shortcuts

| Action | Windows | macOS |
| --- | --- | --- |
| Show / close preview | `Space` | `Space` |
| Close menu, settings, or preview | `Esc` | `Esc` |
| Request / switch to text preview | `Shift+Space` | `Shift+Space` |
| Previous / next file | `←` / `→` | `←` / `→` |
| Choose a file | `Ctrl+O` | `⌘O` |
| Copy path | `Ctrl+Shift+C` | `⌘⇧C` |
| Adjust text size or page zoom | `Ctrl++` / `Ctrl+-` | `⌘+` / `⌘-` |
| Adjust with the mouse wheel | `Ctrl+wheel` | `⌘+wheel` |
| Open in the default application | `Enter` | `Enter` |

Customize the preview key in **Preferences → Shortcuts**. Inputs, media controls, and focused buttons retain their own keyboard behavior. Browser files and archive entries copy the filename rather than a local path. Default-open does not run executables or scripts. See the [preview guide](docs/PREVIEW-GUIDE.md).

## Privacy and local data

SpacePreview does not upload file contents or modify source files. Files stay in their original locations. Preferences are stored locally; preview engines may create local caches. Update checks contact release servers.

Document scripts and Office macros do not run, and Notebook cells are not executed. The default per-file size limit is **256 MB**, adjustable to **16–1024 MB**, with additional format-specific limits. Web Workers are not operating-system sandboxes and do not provide process-level CPU/memory isolation. See [architecture and security boundaries](docs/PREVIEW-GUIDE.md#架构与安全边界).

## Build from source

### Requirements

- Node.js **22.13+** and npm.
- Rust stable.
- Windows: Visual Studio C++ Build Tools, Windows SDK, and WebView2. macOS: Xcode Command Line Tools; see [MACOS.md](MACOS.md).

```bash
git clone https://github.com/likehao19/SpacePreview.git
cd SpacePreview
npm ci
npm run desktop
```

Run the project checks and build a desktop installer with:

```bash
npm test
npm run build
cargo test --manifest-path src-tauri/Cargo.toml --lib
cargo fmt --manifest-path src-tauri/Cargo.toml --check
npm run desktop:build
```

Use `npm run dev` for browser development, `npm run test:preview` for engine regression checks, and `npm run desktop:build:mac` on a Mac for a universal build. See [TESTING.md](TESTING.md) and [updater documentation](docs/UPDATING.md). The standalone HTML/CSS/JS website lives in [website/](website/); see its [README](website/README.md).

## Technology

SpacePreview uses Tauri 2 and Rust, React 19 and TypeScript, PDF.js, docx-preview, highlight.js, and local JS/WASM engines for images, archives, databases, and models.

## Contributing

Reproducible bug reports and focused feature requests are welcome in [GitHub Issues](https://github.com/likehao19/SpacePreview/issues). Include your OS, app version, format, and reproduction steps. Run relevant frontend tests, production builds, and Rust checks before submitting code. Source files use UTF-8 without BOM.

Community discussion: [LinuxDo](https://linux.do/). See [history](docs/HISTORY.md) and [release notes](RELEASE-NOTES.md).

## Contributors

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

## Star history

<picture>
  <img alt="SpacePreview star history chart" src="https://api.star-history.com/svg?repos=likehao19/SpacePreview&type=Date" />
</picture>

## License

SpacePreview is open source under the [MIT License](LICENSE). Third-party dependency licenses and notices are listed in [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md).
