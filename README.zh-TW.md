<h1 align="center">瞬覽 SpacePreview</h1>

<p align="center"><strong>本地優先，選中檔案，輕按空格，即刻預覽。</strong></p>

<p align="center">
  <a href="README.md">English</a> |
  <a href="README.zh-CN.md">简体中文</a> |
  繁體中文 |
  <a href="README.ja.md">日本語</a> |
  <a href="README.ko.md">한국어</a>
</p>

<p align="center">
  <a href="https://github.com/likehao19/SpacePreview/releases/latest"><img src="https://img.shields.io/github/v/release/likehao19/SpacePreview?display_name=tag&sort=semver" alt="最新版本" /></a>
  <a href="https://github.com/likehao19/SpacePreview/actions/workflows/release.yml"><img src="https://github.com/likehao19/SpacePreview/actions/workflows/release.yml/badge.svg" alt="建置狀態" /></a>
  <a href="https://github.com/likehao19/SpacePreview/releases"><img src="https://img.shields.io/github/downloads/likehao19/SpacePreview/total" alt="下載量" /></a>
  <a href="https://github.com/likehao19/SpacePreview/stargazers"><img src="https://img.shields.io/github/stars/likehao19/SpacePreview?style=flat&logo=github" alt="GitHub Stars" /></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-green" alt="MIT 授權條款" /></a>
</p>

<p align="center">
  <a href="https://spacepreview.likh.cn/">官方網站</a> ·
  <a href="https://github.com/likehao19/SpacePreview/releases/latest">下載</a> ·
  <a href="https://github.com/likehao19/SpacePreview/issues">問題反饋</a>
</p>

<p align="center">
  <img src="website/assets/preview-archive.png" alt="瞬覽瀏覽 ZIP 目錄并預覽內部圖片" width="1000" />
</p>

## 保留查看節奏，減少反覆打開

SpacePreview 是一款本地檔案預覽器。在 Windows 資源管理器、桌面或 macOS Finder 中選中檔案，按下空格即可查看，再按一次返回。文檔、圖片、程式碼、表格與壓縮包集中在一個預覽窗口中，臨時查看不必反覆啟動完整編輯軟體。

- **本地優先**：不上傳檔案內容，以只讀方式預覽，不修改原檔案。
- **快速查看**：PDF 按可見頁繪制，ZIP 按需讀取，切換或關閉預覽時取消舊任務。
- **多類內容**：覆蓋常見文檔、圖像、程式碼、壓縮包，以及部分專業格式；不同格式的能力與限制有所區別。
- **多系統使用**：Windows、macOS、Linux 均提供安裝包；Linux 通過拖入檔案或 `Ctrl+O` 預覽，暫不支援檔案管理器空格喚起。

## 兩種查看方式

<table>
  <tr>
    <td width="50%"><img src="website/assets/preview-word.png" alt="瞬覽 Word 頁面與文檔大綱" /></td>
    <td width="50%"><img src="website/assets/preview-code.png" alt="瞬覽 JSON 程式碼高亮與折疊" /></td>
  </tr>
  <tr>
    <td align="center"><strong>頁面預覽與閱讀導航</strong><br />查看文檔頁面、圖片與表格，通過大綱找到需要的章節。</td>
    <td align="center"><strong>源碼查看與結構折疊</strong><br />直接查看程式碼、配置與文本，使用語法高亮、搜索和按條件啟用的程式碼折疊。</td>
  </tr>
</table>

## SpacePreview 能做什麼

### 文檔與閱讀

- PDF 連續滾動、縮放、文字選擇與複製、搜索和內置目錄；掃描圖片 PDF 暫無 OCR。
- OFD 版式文件（如電子發票）按可見頁繪製文字、向量圖形、圖片、模板、註釋與印章外觀，支援全文搜尋；不校驗簽章有效性。
- Word 頁面、圖片、表格與標題大綱，可切換文字速覽；復雜排版可能與 Word 不同，舊 DOC 僅文字速覽。
- Markdown 大綱、任務列表、表格與程式碼高亮，以及 RTF、OpenDocument、EPUB、FB2 內容閱讀。
- PowerPoint 在 Windows 本地安裝并激活 Microsoft PowerPoint 時生成靜態頁面；其他情況提供文字速覽，不播放演示動畫。

### 程式碼與專業內容

- 文本與程式碼的語法高亮、全文搜索、編碼切換和字號調整；JSON/XML 等結構化程式碼在大小與行數限制內支援折疊。
- 本地 HTML 網頁、閱讀和源碼切換，可加載預算內同目錄及子目錄靜態資源，不執行腳本。
- DXF 圖紙及 STL、OBJ、GLB、STEP 等三維幾何查看；不等于完整 CAD 編輯或所有版本兼容。
- 通過獨立引擎查看部分專業圖像、SQLite、字體、郵件、圖表和動畫；RAW 等變體及設計檔案預覽圖存在兼容邊界。

### 目錄與內容瀏覽

- 展開資料夾目錄層級，選擇支援的內部檔案繼續預覽。
- 瀏覽 ZIP、TAR、7Z、RAR 等歸檔目錄和內部支援的內容，不必先完整解壓。
- 表格支援多工作表或虛擬滾動，SQLite 記錄分頁瀏覽；不執行宏、不重新計算公式。
- 同目錄檔案切換、拖入檔案與檔案選擇器，減少反覆進入和返回的操作。

### 外觀與使用習慣

- 亮色、暗色和跟隨系統的界面外觀，閱讀字體、字號和頁面縮放。
- Windows / macOS 分別保存預覽快速鍵，可重置為預設空格鍵。
- 可選開機自啟動、失去焦點時關閉，以及托盤或菜單欄駐留。
- 應用內檢查更新；Linux AppImage 支援應用內更新，DEB 通過下載新包升級。

完整格式與大小限制見 [預覽使用指南](docs/PREVIEW-GUIDE.md)、[格式清單](docs/FORMAT_PARITY.md) 和 [格式核對記錄](docs/WEBSITE-FORMAT-AUDIT.md)。已接入不等于所有變體均實測；本輪格式樣本驗證在 Windows Edge 中完成，macOS / Linux 仍需實機驗收。

## 下載

| 平臺 | 安裝包 | 架構 |
| --- | --- | --- |
| Windows | [下載安裝程序](https://github.com/likehao19/SpacePreview/releases/download/v0.10.16/SpacePreview-0.10.16-windows-x64-setup.exe) | x64 |
| macOS | [下載 Apple 芯片版](https://github.com/likehao19/SpacePreview/releases/download/v0.10.16/SpacePreview-0.10.16-macos-arm64.dmg) | ARM64 |
| macOS | [下載 Intel 版](https://github.com/likehao19/SpacePreview/releases/download/v0.10.16/SpacePreview-0.10.16-macos-x64.dmg) | x86_64 |
| Linux | [AppImage](https://github.com/likehao19/SpacePreview/releases/download/v0.10.16/SpacePreview-0.10.16-linux-x64.AppImage) · [DEB](https://github.com/likehao19/SpacePreview/releases/download/v0.10.16/SpacePreview-0.10.16-linux-x64.deb) | x86_64 |

以上為 v0.10.16 的直接下載地址。[官方網站](https://spacepreview.likh.cn/) 可自動獲取最新發布版本；更新說明和歷史版本也可在 [GitHub Releases](https://github.com/likehao19/SpacePreview/releases) 查看。

## 安裝

### Windows

下載 `SpacePreview-0.10.16-windows-x64-setup.exe` 并按照安裝程序提示操作。當前 Windows 版本支援 Windows 10 / 11 x64，需要 Microsoft Edge WebView2 Runtime。

啟動后在資源管理器或桌面選中檔案，按 `Space` 即可預覽。關閉窗口后應用駐留托盤，右鍵托盤圖標可退出。

### macOS

根據 Mac 處理器下載對應 DMG，打開后將 **SpacePreview** 拖入 **應用程序** 資料夾。

安裝包采用臨時簽名，尚未進行 Apple Developer ID 簽名和公證。如果首次啟動被 Gatekeeper 攔截，可在 **系統設置 → 隱私與安全性** 中檢查是否提供 **仍要打開** 入口。

Finder 空格預覽需要授予輔助功能與 Finder 自動化權限。完整權限、建置與驗收步驟見 [MACOS.md](MACOS.md)。

### Linux

運行 `uname -m` 檢查架構，當前提供 `x86_64` 安裝包。

- Debian / Ubuntu 系發行版可選擇 **DEB**。
- 其他適配的發行版可選擇 **AppImage**，首次使用前授予執行權限。

```bash
# AppImage
chmod +x SpacePreview-0.10.16-linux-x64.AppImage
./SpacePreview-0.10.16-linux-x64.AppImage

# Debian 系
sudo apt install ./SpacePreview-0.10.16-linux-x64.deb
```

Linux 當前通過拖入檔案或 `Ctrl+O` 預覽，暫不支援檔案管理器空格喚起。未提供 RPM 或 ARM64 安裝包。

## 常用快速鍵

| 功能 | Windows | macOS |
| --- | --- | --- |
| 喚起 / 關閉預覽 | `Space` | `Space` |
| 關閉菜單、設置或預覽 | `Esc` | `Esc` |
| 請求 / 切換純文本預覽 | `Shift+Space` | `Shift+Space` |
| 上一個 / 下一個檔案 | `←` / `→` | `←` / `→` |
| 選擇檔案 | `Ctrl+O` | `⌘O` |
| 複製路徑 | `Ctrl+Shift+C` | `⌘⇧C` |
| 調整字號或頁面縮放 | `Ctrl++` / `Ctrl+-` | `⌘+` / `⌘-` |
| 使用滾輪調整字號或頁面縮放 | `Ctrl+滾輪` | `⌘+滾輪` |
| 使用預設應用打開 | `Enter` | `Enter` |

預覽鍵可在 **偏好設置 → 快速鍵** 中修改。輸入框、媒體控件與聚焦按鈕保留各自的按鍵行為。複製路徑對瀏覽器檔案和壓縮包內部檔案僅複製檔案名；預設打開不執行程序或腳本。完整說明見 [預覽使用指南](docs/PREVIEW-GUIDE.md)。

## 隱私與本地資料

SpacePreview 不上傳檔案內容，檔案仍保存在原來的位置，預覽不會修改原檔案。偏好設置保存在本機，預覽引擎可能創建本地緩存；應用更新會訪問發布服務器。

文檔腳本和 Office 宏不執行，Notebook 不運行單元格。單檔案大小上限預設 **256 MB**，可調整為 **16–1024 MB**，各格式還有獨立解析限制。當前 Web Worker 不是操作系統級沙箱，也不提供進程級 CPU / 記憶體隔離。詳見 [架構與安全邊界](docs/PREVIEW-GUIDE.md#架构与安全边界)。

## 從原始碼建置

### 環境要求

- Node.js **22.13+** 與 npm。
- Rust stable。
- Windows 需要 Visual Studio C++ Build Tools、Windows SDK 和 WebView2；macOS 需要 Xcode Command Line Tools，平臺步驟見 [MACOS.md](MACOS.md)。

```bash
git clone https://github.com/likehao19/SpacePreview.git
cd SpacePreview
npm ci
npm run desktop
```

運行專案檢查并建置桌面安裝包：

```bash
npm test
npm run build
cargo test --manifest-path src-tauri/Cargo.toml --lib
cargo fmt --manifest-path src-tauri/Cargo.toml --check
npm run desktop:build
```

瀏覽器模式執行 `npm run dev`，預覽引擎回歸執行 `npm run test:preview`。macOS 通用建置在 Mac 上執行 `npm run desktop:build:mac`。驗證記錄見 [TESTING.md](TESTING.md)，應用內更新配置見 [更新說明](docs/UPDATING.md)。獨立 HTML / CSS / JS 官網位于 [website/](website/)，使用方法見 [官網 README](website/README.md)。

## 技術堆疊

SpacePreview 使用 Tauri 2 與 Rust、React 19 與 TypeScript、PDF.js、docx-preview、highlight.js，以及面向圖像、壓縮包、資料庫與模型的本地 JS / WASM 預覽引擎建置。

## 參與貢獻

歡迎通過 [GitHub Issues](https://github.com/likehao19/SpacePreview/issues) 提交可復現的問題或聚焦的功能建議。請附上系統版本、瞬覽版本、檔案格式與復現步驟；提交程式碼前運行相關前端測試、生產建置與 Rust 檢查。源檔案使用 UTF-8 無 BOM。

社區交流：[LinuxDo](https://linux.do/)。歷史迭代見 [歷史更新](docs/HISTORY.md)，當前版本說明見 [RELEASE-NOTES.md](RELEASE-NOTES.md)。

## 貢獻者

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

## Star 增長趨勢

<picture>
  <img alt="SpacePreview Star 增長曲線" src="https://api.star-history.com/svg?repos=likehao19/SpacePreview&type=Date" />
</picture>

## 開源授權

SpacePreview 基于 [MIT 授權條款](LICENSE) 開源。第三方依賴的授權條款與聲明見 [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md)。
