const messages = {
  zh: {
    copy0: '跳到主要内容',
    copy1: '瞬览 <small>SpacePreview</small>',
    copy2: '瞬览 <small>SpacePreview</small>',
    copy3: '功能',
    copy4: '界面',
    copy5: '格式',
    copy6: '下载',
    copy7: '立即下载',
    copy8: '<i></i> 本地优先 · WINDOWS / MACOS / LINUX',
    copy9: '不必打开，<br><span class="accent">看一眼就好。</span>',
    copy10:
      '\n            选中文件，轻按空格。文档、图片、代码、压缩包，<br class="desktop-break">都在一个窗口里快速查看，把注意力留给内容本身。\n          ',
    copy11: '立即下载 <span aria-hidden="true">↓</span>',
    copy12: '查看 GitHub <span aria-hidden="true">↗</span>',
    copy13: '本地预览',
    copy14: '只读 · 无需上传',
    copy15: 'UI / 真实软件截图',
    copy16: '文件的模样，直接看见。',
    copy17: '从压缩包里的图片，到文档里的细节，用一个窗口继续浏览。',
    copy18: '\n              压缩包与图片',
    copy19: '\n              代码高亮',
    copy20: '\n              Word 文档',
    copy21: '\n              PDF 阅读',
    copy22: '\n              TAR 与源码',
    copy23: '\n              HTML 网页',
    copy24: '\n              偏好设置\n            ',
    copy25: '01 / 为快速查看而设计',
    copy26: '少一步打开，多一点专注。',
    copy27: '围绕“看一眼”这件小事，把常用能力放在顺手的位置。',
    copy28: '空格，直接预览',
    copy29: '让查看快一步',
    copy30: '压缩包里，继续看',
    copy31: '阅读，清晰有序',
    copy32: '本地文件，本地处理',
    copy33: '按你的习惯使用',
    copy34: 'Windows 资源管理器、桌面与 macOS Finder 中选中文件，按下空格查看，再按一次返回。',
    copy35:
      '\n              速度与资源占用优先。PDF 按可见页绘制，ZIP 按需读取，切换或关闭时取消旧的解析任务。\n            ',
    copy36:
      '\n              浏览 ZIP、TAR、7Z 等归档的目录层级，打开其中支持的图片、文本与文档，无需先完整解压。\n            ',
    copy37:
      '\n              Word / Markdown 大纲、文本搜索、字体字号和缩放。代码高亮，结构化代码支持按条件折叠。\n            ',
    copy38:
      '\n              只读预览，不修改原文件，不上传内容。文档脚本与 Office 宏不会执行，Notebook\n              单元格不会运行。\n            ',
    copy39: '明暗主题、自定义预览键、可选开机自启动和应用内更新，工具集中在「更多」菜单中。',
    copy40: '02 / 多种内容，一个窗口',
    copy41: '不止图片，也不止文档。',
    copy42: '常见格式随手查看，专业内容也有各自的预览方式。',
    copy43: '完整能力与测试状态 ↗',
    copy44: '文档与阅读',
    copy45: '图片与设计',
    copy46: '代码与网页',
    copy47: '压缩包与容器',
    copy48: '表格与数据',
    copy49: '三维与更多',
    copy50: 'PNG · SVG · PSD · HEIC · TIFF · 部分相机 RAW',
    copy51: 'STL · OBJ · STEP · 字体 · 音视频',
    copy52: '展开查看已接入的文件类型与支持范围 <span aria-hidden="true">＋</span>',
    copy53: '文件类别',
    copy54: '代表格式 / 扩展名（含有限支持）',
    copy55: '常见图片',
    copy56: 'TIFF 多页图像',
    copy57: '专业图像',
    copy58: '相机 RAW（部分样本已验证）',
    copy59: '图标与矢量',
    copy60: 'PDF 文档',
    copy61: 'Word 文档与模板',
    copy62: '旧版 Word（文字速览）',
    copy63: '富文本与开放文档',
    copy64: 'Markdown',
    copy65: '电子书',
    copy66: '文本与日志',
    copy67: '代码与脚本',
    copy68: '配置与数据文本',
    copy69: 'HTML 网页',
    copy70: '网页存档与邮件',
    copy71: 'Excel 工作簿与模板',
    copy72: '分隔符表格与旧数据表',
    copy73: 'OpenDocument 表格',
    copy74: 'PowerPoint 文稿与模板',
    copy75: 'OpenDocument 演示',
    copy76: 'ZIP 及同类容器',
    copy77: '其他压缩包',
    copy78: '应用与资源容器（目录 / 流列表）',
    copy79: '二维 CAD',
    copy80: '三维模型与 CAD',
    copy81: 'SQLite 数据库',
    copy82: '字体',
    copy83: '技术文档与图表',
    copy84: 'Notebook',
    copy85: 'Lottie 动画',
    copy86: '设计文件（仅内置预览图）',
    copy87: '音频',
    copy88: '视频',
    copy89:
      '\n              <strong>接入引擎不等于所有文件变体均已验证。</strong>\n              表格保留已接入的类别，具体范围如下：\n            ',
    copy90:
      '\n                <strong>相机 RAW：</strong>本次验证 CR2、KDC\n                样本，其余列出的相机格式已接入但尚未逐一验收；通用 .raw 文件不支持。\n              ',
    copy91:
      '\n                <strong>设计文件：</strong>KRA、Sketch、XD、XMind、FIG、CDR、PIX/PIP、PDN\n                仅尝试读取内置预览图，已用结构样本验证；非 ZIP FIG、旧版 CDR/PDN\n                等变体不保证可用，不还原完整设计画布。\n              ',
    copy92:
      '\n                <strong>Office：</strong>旧 DOC 仅文字速览；PPT 静态页面依赖 Windows 本地安装并激活\n                PowerPoint。复杂 Word 排版与 OpenDocument 原始布局可能不同。\n              ',
    copy93:
      '\n                <strong>三维 / CAD：</strong>本次验证 BLEND 样本为 Blender\n                2.48，不保证所有新版；GLTF 需内嵌几何，不加载外部贴图与动画。LWO\n                已接入但尚未验收，暂不列入上表。\n              ',
    copy94:
      '\n                <strong>容器与数据库：</strong>MSI 等仅浏览文件 / 流，不等于安装包语义解析；PAK 仅限\n                Chromium 变体；DB 等仅识别 SQLite 内容，GPKG / MBTiles 不显示地图。\n              ',
    copy95:
      '\n                <strong>图片、字体与媒体：</strong>依赖系统和解码器的支持范围；WMF/EMF 为 GDI\n                子集，WOFF2 的完整字形解析有限。音视频不保证所有内部编码均可播放。\n              ',
    copy96:
      '\n              本轮验收环境为 Windows\n              Edge，其他系统未在本轮实机验收；不同格式还有独立的大小、页数等限制。<a class="text-link" href="https://github.com/likehao19/SpacePreview/blob/main/docs/WEBSITE-FORMAT-AUDIT.md">查看本次核对记录 ↗</a>\n            ',
    copy97: '03 / 一个简单的动作',
    copy98: '看完，回到手头的事。',
    copy99: '不用为一次临时查看打断工作节奏。<br>从文件列表到内容，再自然地回到文件列表。',
    copy100: '选中',
    copy101: '按下 <kbd>Space</kbd>',
    copy102: '看完，关闭',
    copy103: '在资源管理器或 Finder 中选择文件',
    copy104: '浏览内容，用方向键继续切换文件',
    copy105: '再按空格或 Esc，继续原来的工作',
    copy106: '04 / 选择你的平台',
    copy107: '下一次查看，从瞬览开始。',
    copy108: 'Windows 10 / 11 · x64<br>安装程序 · 需要 WebView2',
    copy109: 'Intel 芯片 · x64<br>DMG 安装包',
    copy110: 'Apple Silicon · ARM64<br>DMG 安装包',
    copy111: 'Intel / AMD · x64<br>AppImage / DEB',
    copy112: '下载 Windows 版',
    copy113: '下载 Mac Intel 版',
    copy114: '下载 Mac ARM 版',
    copy115:
      '\n            macOS 使用临时签名，尚未进行 Apple Developer ID 签名与公证；Finder 预览需授权。Linux\n            暂不支持文件管理器空格唤起。<a href="https://github.com/likehao19/SpacePreview/blob/main/README.md">查看安装说明 ↗</a>\n          ',
    copy116:
      '\n            旧版本与版本说明：<a class="text-link" href="https://github.com/likehao19/SpacePreview/releases">查看全部 Releases ↗</a>\n          ',
    copy117: '开始之前。',
    copy118: '三个系统都支持空格唤起吗？',
    copy119: 'Office 文档能完全还原吗？',
    copy120: '大文件预览有什么限制？',
    copy121:
      '\n              Windows 支持资源管理器和桌面；macOS 已接入\n              Finder，需要辅助功能与自动化授权，相关兼容性仍需真机验收。Linux 当前通过拖入文件或\n              Ctrl+O 预览，尚未接入文件管理器空格唤起。\n            ',
    copy122:
      '\n              Word 支持页面、图片、表格和大纲，复杂排版、公式及缺失字体可能影响显示。PowerPoint\n              静态页面需要 Windows 本地安装并激活 Microsoft PowerPoint；其他情况提供文字速览。\n            ',
    copy123:
      '\n              默认单文件大小上限为 512 MiB，可在偏好设置中调整为 16–2048 MiB；压缩包内单文件默认 256\n              MiB，最高可设为 1024\n              MiB，各格式仍有独立解析限制。部分格式完整读取后再展示，实际速度与内存占用取决于文件及设备；尚未完成\n              GB 级真实文件的性能验证。\n            ',
    copy124: '为每一次“看一眼”而设计。',
    copy125: '问题反馈',
    copy126: '压缩包里，也能直接看图。左侧浏览目录，右侧继续预览。',
    copy127: '语法高亮、行号与结构化代码折叠。',
    copy128: 'Word 页面与图片一起看，用左侧大纲找到需要的章节。',
    copy129: '保留内容层次，按需缩放与连续浏览。',
    copy130: '深入 TAR 目录，直接查看其中的脚本源码。',
    copy131: '本地 HTML 网页预览，展示静态布局与样式。',
    copy132: '明暗主题、窗口行为与启动选项，按习惯调整。',
    copy133:
      '\n                      PSD、PSB、HEIC、HEIF、DDS、EXR、HDR、JP2、J2K、JXL、QOI、TGA、PCX、XCF 等\n                    ',
    copy134: 'ARW、CR2、CR3、DNG、NEF、NRW、ORF、RAF、RW2、PEF、KDC 等',
    copy135: 'MD、Markdown、MDX、MMD、MDC、MKD、QMD、RMD 等',
    copy136: 'TXT、TEXT、LOG、ASC 等',
    copy137:
      '\n                      JS、JSX、TS、TSX、PY、JAVA、C、CPP、CS、GO、RS、SWIFT、KT、RB、PHP、LUA、SH、PS1、BAT\n                      等\n                    ',
    copy138:
      '\n                      JSON、JSONC、JSONL、XML、YAML、YML、TOML、INI、CONF、ENV、SQL、Dockerfile 等\n                    ',
    copy139: 'ZIP、ZIP64、JAR、APK、IPA、CBZ、WHL、NUPKG、VSIX、XPI 等',
    copy140:
      '\n                      7Z、RAR、TAR、TGZ、GZ、BZ2、XZ、ZST、ZSTD、CB7、CBR、CBT、AR、CPIO、XAR 等\n                    ',
    copy141:
      '\n                      ASAR、CRX、CFB、MSI、MSP、APPX、MSIX、AAB、HAP、WGT、部分 Chromium PAK 等\n                    ',
    copy142: '瞬览首页',
    copy143: '主导航',
    copy144: '在 GitHub 查看 SpacePreview 源码',
    copy145: '放大当前软件截图',
    copy146: '软件截图大图',
    copy147: '关闭大图',
    copy148: ' 查看最新发布 ↗',
    copy149: '\n                点击按钮直接下载对应系统的安装包。',
    title: '瞬览 SpacePreview · 不必打开，看一眼就好',
    description:
      '瞬览 SpacePreview，本地优先的多格式文件预览工具。选中文件，轻按空格，快速查看文档、图片、代码和压缩包。支持 Windows、macOS 与 Linux。',
    checking: '正在检查最新版本…',
    latest: '最新版本',
    downloadVersion: '下载版本',
    ready: '最新版本 {version} · 点击即可下载',
    partial: '最新版本 {version} · 部分安装包请查看发布页',
    fallback: '暂时无法获取版本信息，仍可从官方服务器下载。',
    releasePage: '查看发布页',
    noPackage: '此版本暂无对应安装包',
  },
  en: {
    copy0: 'Skip to main content',
    copy1: 'SpacePreview',
    copy2: 'SpacePreview',
    copy3: 'Features',
    copy4: 'Interface',
    copy5: 'Formats',
    copy6: 'Download',
    copy7: 'Download now',
    copy8: '<i></i> LOCAL FIRST · WINDOWS / MACOS / LINUX',
    copy9: 'Skip the launch.<br /><span class="accent">Take a quick look.</span>',
    copy10:
      'Select a file and press Space. Preview documents, images, code and archives in one window, and keep your attention on the content.',
    copy11: 'Download now <span aria-hidden="true">↓</span>',
    copy12: 'View on GitHub <span aria-hidden="true">↗</span>',
    copy13: 'Local preview',
    copy14: 'Read only · No uploads',
    copy15: 'UI / APP SCREENSHOTS',
    copy16: 'Your files, in plain sight.',
    copy17:
      'From images inside archives to the details of a document, explore it all in one window.',
    copy18: 'Archives & images',
    copy19: 'Code highlighting',
    copy20: 'Word documents',
    copy21: 'PDF reading',
    copy22: 'TAR & source code',
    copy23: 'HTML pages',
    copy24: 'Preferences',
    copy25: '01 / BUILT FOR A QUICK LOOK',
    copy26: 'One less launch. More focus.',
    copy27: 'The tools you need for a quick look, right where you expect them.',
    copy28: 'Press Space to preview',
    copy29: 'Get to the content sooner',
    copy30: 'Look inside archives',
    copy31: 'A clearer reading experience',
    copy32: 'Local files, local processing',
    copy33: 'Make it your own',
    copy34:
      'Select a file in Windows Explorer, on the desktop or in macOS Finder. Press Space to preview, then press it again to return.',
    copy35:
      'Speed and resource use come first. PDFs render visible pages, ZIPs load on demand, and switching or closing cancels previous parsing tasks.',
    copy36:
      'Browse ZIP, TAR, 7Z and other archives. Open supported images, text and documents inside without extracting the entire archive first.',
    copy37:
      'Word and Markdown outlines, text search, fonts, text size and zoom. Syntax highlighting and folding for structured code.',
    copy38:
      'Read-only previews keep original files intact and do not upload content. Document scripts, Office macros and Notebook cells are not executed.',
    copy39:
      'Light and dark themes, custom preview keys, optional launch at login and in-app updates. Tools stay together in the More menu.',
    copy40: '02 / MANY FORMATS. ONE WINDOW.',
    copy41: 'Beyond images. Beyond documents.',
    copy42: 'Everyday formats at a glance, with dedicated viewers for specialized content.',
    copy43: 'Full capabilities & test status ↗',
    copy44: 'Documents & reading',
    copy45: 'Images & design',
    copy46: 'Code & web',
    copy47: 'Archives & containers',
    copy48: 'Spreadsheets & data',
    copy49: '3D & more',
    copy50: 'PNG · SVG · PSD · HEIC · TIFF · Selected camera RAW',
    copy51: 'STL · OBJ · STEP · Fonts · Audio & video',
    copy52:
      'Explore supported file types and preview capabilities <span aria-hidden="true">＋</span>',
    copy53: 'File category',
    copy54: 'Representative formats / extensions (includes limited support)',
    copy55: 'Common images',
    copy56: 'Multipage TIFF',
    copy57: 'Professional images',
    copy58: 'Camera RAW (selected samples tested)',
    copy59: 'Icons & vectors',
    copy60: 'PDF documents',
    copy61: 'Word documents & templates',
    copy62: 'Legacy Word (text preview)',
    copy63: 'Rich text & OpenDocument',
    copy64: 'Markdown',
    copy65: 'Ebooks',
    copy66: 'Text & logs',
    copy67: 'Code & scripts',
    copy68: 'Configuration & text data',
    copy69: 'HTML pages',
    copy70: 'Web archives & email',
    copy71: 'Excel workbooks & templates',
    copy72: 'Delimited tables & legacy data',
    copy73: 'OpenDocument spreadsheets',
    copy74: 'PowerPoint slides & templates',
    copy75: 'OpenDocument presentations',
    copy76: 'ZIP & related containers',
    copy77: 'Other archives',
    copy78: 'App & resource containers (file / stream lists)',
    copy79: '2D CAD',
    copy80: '3D models & CAD',
    copy81: 'SQLite databases',
    copy82: 'Fonts',
    copy83: 'Technical documents & diagrams',
    copy84: 'Notebooks',
    copy85: 'Lottie animations',
    copy86: 'Design files (embedded previews only)',
    copy87: 'Audio',
    copy88: 'Video',
    copy89:
      '<strong>An integrated engine does not mean every file variant has been verified.</strong> The table lists integrated categories; the boundaries are described below.',
    copy90:
      '<strong>Camera RAW:</strong> CR2 and KDC samples have been tested. The other listed camera formats are integrated but have not all been verified individually. Generic .raw files are unsupported.',
    copy91:
      '<strong>Design files:</strong> KRA, Sketch, XD, XMind, FIG, CDR, PIX/PIP and PDN only attempt to read embedded previews and have been checked with structural samples. Non-ZIP FIG, older CDR/PDN and other variants may fail. Full design canvases are not reconstructed.',
    copy92:
      '<strong>Office:</strong> Legacy DOC provides a text preview. Static PPT pages require a locally installed and activated PowerPoint on Windows. Complex Word layouts and original OpenDocument layouts may differ.',
    copy93:
      '<strong>3D / CAD:</strong> The verified BLEND sample is from Blender 2.48; newer versions are not guaranteed. GLTF requires embedded geometry; external textures and animation are not loaded. LWO is integrated but unverified and is omitted from the table.',
    copy94:
      '<strong>Containers & databases:</strong> MSI and similar containers expose files / streams, not installation semantics. PAK support is limited to Chromium variants. DB files must contain SQLite data; GPKG / MBTiles do not display maps.',
    copy95:
      '<strong>Images, fonts & media:</strong> Support depends on the system and decoder. WMF/EMF implement a GDI subset; complete WOFF2 glyph parsing is limited. Not every audio or video codec can be played.',
    copy96:
      'The format audit used Microsoft Edge on Windows; other systems were not verified on physical devices in that round. Individual formats also have size and page limits. <a class="text-link" href="https://github.com/likehao19/SpacePreview/blob/main/docs/WEBSITE-FORMAT-AUDIT.md">View the audit notes ↗</a>',
    copy97: '03 / ONE SIMPLE ACTION',
    copy98: 'Take a look. Get back to work.',
    copy99:
      'A quick preview should not interrupt your flow.<br />Move from the file list to its content, and back again.',
    copy100: 'Select',
    copy101: 'Press <kbd>Space</kbd>',
    copy102: 'Close when done',
    copy103: 'Select a file in Explorer or Finder',
    copy104: 'Browse the content; use arrow keys to switch files',
    copy105: 'Press Space or Esc to return to your work',
    copy106: '04 / CHOOSE YOUR PLATFORM',
    copy107: 'Your next quick look starts here.',
    copy108: 'Windows 10 / 11 · x64<br />Installer · Requires WebView2',
    copy109: 'Intel chip · x64<br />DMG installer',
    copy110: 'Apple silicon · ARM64<br />DMG installer',
    copy111: 'Intel / AMD · x64<br />AppImage / DEB',
    copy112: 'Download for Windows',
    copy113: 'Download for Intel Mac',
    copy114: 'Download for Apple silicon',
    copy115:
      'macOS builds are ad-hoc signed and are not yet signed or notarized with an Apple Developer ID. Finder integration requires permission. Linux does not currently support Space activation in file managers. <a href="https://github.com/likehao19/SpacePreview/blob/main/README.md">Installation guide ↗</a>',
    copy116:
      'Previous versions & release notes: <a class="text-link" href="https://github.com/likehao19/SpacePreview/releases">View all Releases ↗</a>',
    copy117: 'Before you begin.',
    copy118: 'Does Space activation work on all three systems?',
    copy119: 'Can Office layouts be reproduced exactly?',
    copy120: 'What are the limits for large files?',
    copy121:
      'Windows supports Explorer and the desktop. macOS Finder integration requires Accessibility and Automation permissions; compatibility still needs physical-device verification. On Linux, use drag and drop or Ctrl+O; file-manager Space activation is not yet integrated.',
    copy122:
      'Word supports pages, images, tables and outlines. Complex layouts, equations and missing fonts may affect the result. Static PowerPoint pages require a locally installed and activated Microsoft PowerPoint on Windows; other cases provide a text preview.',
    copy123:
      'The default file limit is 512 MiB, adjustable from 16 to 2048 MiB in Preferences. Archive entries default to 256 MiB and can be set up to 1024 MiB. Each format also has parsing limits. Some formats load the full file before display; speed and memory depend on the file and device. GB-scale real-file performance has not yet been verified.',
    copy124: 'Designed for every quick look.',
    copy125: 'Report an issue',
    copy126:
      'Look at images inside an archive. Browse folders on the left and preview on the right.',
    copy127: 'Syntax highlighting, line numbers and folding for structured code.',
    copy128: 'View Word pages and images, and find chapters with the outline.',
    copy129: 'Preserve the page structure, with zoom and continuous reading.',
    copy130: 'Explore TAR folders and preview source files directly.',
    copy131: 'Preview local HTML layouts and styles.',
    copy132: 'Adjust themes, window behavior and startup options.',
    copy133:
      '\n                      PSD, PSB, HEIC, HEIF, DDS, EXR, HDR, JP2, J2K, JXL, QOI, TGA, PCX, XCF, etc.\n                    ',
    copy134: 'ARW, CR2, CR3, DNG, NEF, NRW, ORF, RAF, RW2, PEF, KDC, etc.',
    copy135: 'MD, Markdown, MDX, MMD, MDC, MKD, QMD, RMD, etc.',
    copy136: 'TXT, TEXT, LOG, ASC, etc.',
    copy137:
      '\n                      JS, JSX, TS, TSX, PY, JAVA, C, CPP, CS, GO, RS, SWIFT, KT, RB, PHP, LUA, SH, PS1, BAT\n                     , etc.\n                    ',
    copy138:
      '\n                      JSON, JSONC, JSONL, XML, YAML, YML, TOML, INI, CONF, ENV, SQL, Dockerfile, etc.\n                    ',
    copy139: 'ZIP, ZIP64, JAR, APK, IPA, CBZ, WHL, NUPKG, VSIX, XPI, etc.',
    copy140:
      '\n                      7Z, RAR, TAR, TGZ, GZ, BZ2, XZ, ZST, ZSTD, CB7, CBR, CBT, AR, CPIO, XAR, etc.\n                    ',
    copy141:
      '\n                      ASAR, CRX, CFB, MSI, MSP, APPX, MSIX, AAB, HAP, WGT, selected Chromium PAK, etc.\n                    ',
    copy142: 'SpacePreview home',
    copy143: 'Main navigation',
    copy144: 'View SpacePreview on GitHub',
    copy145: 'Enlarge current screenshot',
    copy146: 'Screenshot viewer',
    copy147: 'Close image',
    copy148: 'View latest release ↗',
    copy149: 'Download the installer for your system. ',
    title: 'SpacePreview · Take a quick look',
    description:
      'SpacePreview is a local-first file preview tool. Select a file and press Space to view documents, images, code and archives on Windows, macOS and Linux.',
    checking: 'Checking the latest release…',
    latest: 'Latest release',
    downloadVersion: 'Download version',
    ready: 'Latest release {version} · Click to download',
    partial: 'Latest release {version} · Some installers are on the release page',
    fallback: 'Version information is unavailable. Official server downloads remain available.',
    releasePage: 'View release',
    noPackage: 'No installer for this platform in this release',
  },
};
let language = navigator.language.toLowerCase().startsWith('zh') ? 'zh' : 'en';
try {
  language = localStorage.getItem('spacepreview-site-language') || language;
} catch {
  /* Storage may be unavailable for local files. */
}
if (!messages[language]) language = 'zh';
function t(key, values = {}) {
  return (messages[language][key] ?? key).replace(/\{(\w+)\}/g, (_, name) =>
    String(values[name] ?? ''),
  );
}
function translate(next) {
  language = messages[next] ? next : 'zh';
  document.documentElement.lang = language === 'zh' ? 'zh-CN' : 'en';
  document.title = t('title');
  document.querySelector('meta[name="description"]').content = t('description');
  document.querySelectorAll('[data-i18n]').forEach((el) => {
    el.innerHTML = t(el.dataset.i18n);
  });
  document
    .querySelectorAll('[data-i18n-aria]')
    .forEach((el) => el.setAttribute('aria-label', t(el.dataset.i18nAria)));
  document.querySelectorAll('[data-i18n-caption]').forEach((el) => {
    el.dataset.caption = t(el.dataset.i18nCaption);
  });
  document
    .querySelectorAll('[data-lang]')
    .forEach((button) =>
      button.setAttribute('aria-pressed', String(button.dataset.lang === language)),
    );
  try {
    localStorage.setItem('spacepreview-site-language', language);
  } catch {
    /* Keep switching functional when storage is disabled. */
  }
  document.dispatchEvent(new Event('site-language-change'));
}
window.SpacePreviewI18n = { t };
document
  .querySelectorAll('[data-lang]')
  .forEach((button) => button.addEventListener('click', () => translate(button.dataset.lang)));
translate(language);
