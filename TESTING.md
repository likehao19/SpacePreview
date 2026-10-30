# 验证记录

## v0.10.13 发布准备（2026-10-24）

- 发布矩阵新增 Ubuntu 22.04 / Linux x64，生成 `.deb`、AppImage 和签名，检查 ELF/DEB 架构并在 Xvfb 中检查桌面进程启动；Windows x64 与 Mac Intel/ARM 保持原构建流程。
- 更新清单新增 `linux-x86_64` AppImage，测试覆盖四种架构映射，以及任一架构缺包、空包、缺签名、无效签名时拒绝生成清单。123 项前端单元测试及 TypeScript/Vite 生产构建通过；版本一致性与差异空白检查通过。
- 生产构建的 Edge 浏览器重试检查通过：模拟 PDF/Word 读取失败后同一文件重新加载，PDF 页面恢复、Word 两页及图片恢复、连续失败重试均正常且无页面脚本异常。修正测试脚本对 PDF Blob 读取的故障注入（使用 XMLHttpRequest）；这不等同于原始 Windows 原生路径间歇性问题已复现。
- [GitHub Actions 39993319226](https://github.com/likehao19/SpacePreview/actions/runs/39993319226) 的 Windows x64、Linux x64、Mac Intel、Mac ARM 构建及发布全部成功；原生测试、签名产物收集、Windows PE/Mac 架构与签名/DMG 检查、Linux ELF/DEB 架构与 Xvfb 启动检查通过。
- [v0.10.13 Release](https://github.com/likehao19/SpacePreview/releases/tag/v0.10.13) 已公开并标为最新稳定版，共 13 个附件，包括 5 个安装包。核对安装包均非空、校验文件覆盖安装包、更新清单包含四种架构且指向已发布更新包和签名；下载的 latest.json SHA-256 与发布的校验文件一致。未下载并重算全部安装包，安装包校验和由发布任务生成。
- Linux 文件管理器空格监听未实现，macOS Developer ID 签名和公证未完成，PDF/Word 原生路径实机重试回归仍待完成。

## 提交前回归（2026-10-24）

- 123 项前端单元测试再次通过，`git diff --check` 通过。本次按用户要求提交并推送现有代码；下述 PDF/Word 实机重试回归仍待完成，不计为通过。

## PDF / Word 加载错误与重试（2026-10-23，实机回归待完成）

- 修改前通过 Windows WebView2 和原生磁盘路径只读检查：用户桌面 DOCX 正常渲染 1 页、桌面 jl 中的对照 PDF 正常识别 2 页、合成 PDF 识别 40 页。重启开发版后未复现用户原始失败，不能据此判定原文件损坏或原问题已彻底修复。
- PDF 保留具体异常，仅对引擎明确报告的密码/无效内容给出对应说明；PDF、Word/RTF 增加重新加载，重试清理旧状态和任务，Word 同时重建图片资源缓存并清除旧事件监听。
- 开发依赖扫描限定 index.html，提前优化 PDF Worker，避免扫描打包生成的 HTML；旧开发日志曾记录 PDF Worker 首次优化导致页面重载。这是已发现的开发加载风险，尚不能确认就是用户本次失败的唯一原因。
- 123 项前端单元测试及 TypeScript/Vite 生产构建通过。单元测试初次因沙盒临时目录重命名被拒绝未执行；改用工作区内临时目录后通过。
- 新增 `scripts/smoke-document-retry.mjs`，用于注入 PDF/Word 读取失败并验证同一文件重试、页面和图片恢复；尚未运行成功，不计为通过。沙盒内 WebView2 连接被 EACCES 拒绝，独立浏览器启动也未成功；沙盒外进程检查的自动审批因服务额度耗尽失败。用户选择先保留修改，实机回归和本地 Git 提交留待后续。

## 文件内检索与目录搜索（2026-10-23）

- Ctrl/Command+F 接管为文件内检索，在输入框及 Word/HTML iframe 中同样生效；此组合在前端与原生预览快捷键设置中保留。更多菜单提供入口，支持上/下一个、Enter/Shift+Enter、Esc 优先关闭检索、切换/关闭时取消查询与移除高亮。
- 文本、代码、MD、HTML/RTF 等检索当前预览正文；Word 按已解析结构检索并按需挂载命中段落，PDF 提取各页文字，表格检索已加载工作簿数据并定位虚拟行，电子书/幻灯片切换命中章节/页面，压缩包按文件名筛选。纯图像与扫描件不提供 OCR。
- 目录搜索移除输入框内层焦点边框，外框保留焦点提示；有输入时提供清空按钮，并保留输入焦点。
- 120 项前端单元测试、22 项 Rust 测试通过（另有 2 项依赖外部环境的测试跳过）；TypeScript/Vite 生产构建通过。`scripts/smoke-file-search.mjs` 在生产构建及桌面 CSP 下通过：Ctrl/Command+F 默认行为拦截、文本匹配导航、MD 目录清空、Word/HTML iframe、1201 段 Word 未挂载末段、PDF 第三页、1000 行 CSV 尾部、ZIP 文件名及高亮清理。空格焦点与 1200 章节大纲回归通过；未进行 macOS 真机测试。

## Markdown 完整大纲（2026-10-23）

- 移除共用文档阅读器生成大纲时的 1000 标题截断，不再静默遗漏后面的标题及锚点映射。
- TypeScript 检查及 `scripts/smoke-markdown-outline.mjs` 通过：合成 1200 标题 MD 完整目录、正文标题、末章锚点、1001/1200 章搜索跳转、无匹配/清空搜索及空格关闭。运行中的桌面开发版已收到组件热更新。

## 按钮焦点与预览快捷键（2026-10-23）

- 移除普通按钮焦点对预览快捷键的例外；Windows 窗口按钮鼠标点击时清除旧焦点，键盘 Tab 焦点提示保留。
- TypeScript/Vite 生产构建及 119 项单元测试通过。`scripts/smoke-focus-shortcuts.mjs` 在生产前端、Edge 和 Windows/macOS 原生接口模拟下验证：Windows 窗口按钮点击及焦点清理、最大化/恢复、MD/Word 大纲、按钮焦点下空格松开关闭一次、Enter 激活按钮、搜索框正常输入空格。
- 此次为前端行为回归，未重新打包桌面安装包，未进行 macOS 真机验证。

- v0.10.11 发布验证：Mac Intel CI 暴露大字节数组深比较超过默认 5 秒；改为逐字节比较布尔结果，保留全部内容断言，本地该组 4 项测试降至 72 ms。v0.10.10 构建未发布。

## 更多格式后加载（2026-10-16，未发布）

- 大于 512 KiB 的文本、代码、Markdown、AsciiDoc、CSV 与 HTML 分阶段读取，首段 64 KiB；大于 1 MiB 的 XLSX、EPUB 和 PPTX 文本预览按工作表、章节或幻灯片读取。OpenDocument 和旧工作簿在结构解析后分批交付内容。
- TypeScript/Vite 生产构建通过，25 个文件的 103 项单元测试通过，包含取消读取、短读失败、CSV 未闭合记录、多字节边界及 OpenDocument 分批结果完整性。
- `smoke-progressive-formats.mjs` 在生产 CSP 下通过：暂停后续读取时首段可用、完整尾部、CSV 未完成记录不提前显示、失败保留内容及重试、HTML 样式/脚本过滤/滚动位置、Excel 后续工作表、EPUB 自定义清单路径与后续章节、PPTX 文本后续幻灯片。
- `smoke-table-full.mjs` 通过大于 8 MB CSV 的 20,001 行、末尾滚动和 125 列 TSV；`smoke-large.mjs` 通过 80,001 行文本/UTF-16、全文搜索、Markdown、40 MB Word 和 ZIP 回归。
- 后加载不等于所有格式都可流式解码：DOC/RTF、整图解码、模型及原生 Office 转换仍受现有引擎限制；结构化格式仍须先解析必要索引/XML，现有安全与预览容量限制保留。

## 渐进 Word、目录树与整页提示（2026-10-16，未发布）

- TypeScript/Vite 构建与 cargo check 通过；98 项前端单元测试通过。原生测试 22 项通过、2 项既有交互桌面/PowerPoint 测试跳过；本地 GNU 测试补齐 Common Controls 清单并将构建目录加入 PATH 后执行。
- 新增 `smoke-progressive-directory.mjs`：12 页 DOCX 首次挂载 2 页、后续补齐，暂停图片读取时原排版首屏可用；恢复后图片正确显示，切换文件取消旧加载，未引用媒体不读取。
- 目录树覆盖按需展开深层目录、分批加载、空目录、权限错误、收起后保留文件预览及 640×480 布局。系统选择失败和未知二进制显示整页提示，支持 Esc/Space 关闭与文件信息入口。
- `smoke-reading.mjs` 通过字体、表格、图片、分页、目录导航、缩放和 RTF 回归；`smoke-large.mjs` 通过 40 MB Word、完整大文本和 ZIP 等既有回归。
- 浏览器中的原生目录接口使用模拟数据，Rust 真实文件系统测试覆盖 503 项目录分两批、无重叠、不递归及拒绝按文件读取目录。未宣称已完成 Finder/Explorer 真机端到端验收。
- DOCX 正文 XML 仍需先解析；旧版 DOC、RTF 及其他 Office 渲染引擎未改为流式排版。

## v0.10.9 引导与侧栏设置（2026-10-16）

- TypeScript/Vite 生产构建通过；生产页面检查确认启动页没有文件选择按钮或示例列表，三个分类页及合并后的设置分组、选中状态、图标加载和预览/设置返回正常。
- 浅色、深色、跟随系统与 640×480、420×640 布局通过；右侧设置内容独立滚动，左侧分类保持可见。
- 偏好回归与 Windows/macOS 模拟桥接快捷键回归通过，包含自启动状态与失败处理、快捷键录入/持久化、精确修饰键、松开触发、文档内快捷键。
- 生产 CSP 下更新回归通过，包含通知可点击并直接跳转更新页、切换分类后下载状态保留、签名/安装失败、独立重启重试。
- 截图：`test-results/settings-guide-light.png`、`settings-general-light.png` 及对应深色和小窗口版本。浏览器截图中的系统设置禁用属于预期；本次未发布安装包。

## 应用内更新（2026-10-16，待发布）

- `npm test`：24 个文件、98 项测试通过，含三平台更新清单映射、缺失/空包/无签名拒绝。
- TypeScript/Vite 生产构建、Rust `cargo check --lib`、Rust 格式检查通过。
- `scripts/smoke-updater.mjs` 在桌面 CSP 下通过：浏览器禁用、启动/手动检查、断网重试、重复点击、更新资源释放、纯文本版本说明、已知/未知总长度的下载进度、设置关闭后恢复、签名/安装失败不重启、重启失败单独重试、640×480 深色布局。
- 现有 `scripts/smoke-preferences-audit.mjs` 回归通过。已查看 `test-results/updater-available.png` 和 `test-results/updater-small-dark.png`。
- 使用 Tauri CLI 对本地测试数据签名，再使用与更新器相同的 `minisign-verify` 库验证：应用配置内公钥接受原始签名数据，拒绝篡改后的数据。此步骤没有安装或上传更新包。
- 本机只有 Rust GNU 工具链。原生测试程序初次运行因未激活 Common Controls v6，缺少 `TaskDialogIndirect` 入口而失败；仅为生成的测试可执行文件嵌入 v6 清单后，21 项通过、2 项交互依赖测试按原设置跳过。未修改项目原生逻辑来绕过该环境问题。
- 本机未安装 MSVC 目标及 C++ Build Tools，正式 Windows MSVC 安装包构建未完成；macOS 实机升级未验证。界面测试使用模拟更新接口，不等同于真实安装覆盖升级。

# v0.9.13 验证记录

## v0.9.13 偏好设置与自定义预览快捷键（2026-10-11）

- 设置弹窗宽 680px、主题按钮横排、常用操作两列，默认 1000×760 中完整显示，无溢出滚动：Windows 内容高约 606px，含 macOS 未授权说明约 696px；640×480 保留滚动且无页面横向溢出。真实 Windows WebView2 目视确认布局完整。
- Windows/macOS 快捷键独立持久化，当前平台同步到原生监听；录入时屏蔽预览操作，Esc 取消、失焦取消、一键恢复 Space，导航键、Shift 和 Ctrl/⌘+O 不作为预览键。配置更新清理旧按键状态，仍在松开主键后先清状态再排队。
- 原生 WebView2 的注入/远程按键可缺少 `KeyboardEvent.code`：实际诊断捕获 `code=`、`shift=false`、`composing=false`，增加 `key` 回退，并覆盖录入、匹配与松开处理。Word/HTML 沙盒文档转发完整修饰键，由主窗口决定是否接管，未接管时保留文字复制等操作。
- 前端 11 文件 / 55 项测试通过；Windows 原生 18 项通过、2 项交互依赖默认忽略。TypeScript/Vite 与 Windows release EXE / NSIS 构建通过，Rust 格式检查通过，94 个代码文件 UTF-8 无 BOM 检查通过。
- 生产 UI 验证 Windows/macOS 布局、F8 与 Ctrl+Alt+P/⌘+P 录入、独立保存、重载恢复、无效组合、Esc 取消、重置、主键重复按下仅松开触发一次、空键码回退及 Word/HTML 中组合键关闭。阅读字体/编码/Word/RTF/HTML、36px 合并头部、macOS 权限流程和 PDF Promise/Worker 兼容回归通过；Mac UI 使用模拟桥接，Finder 权限与按键交互仍需 Mac 实机验收。
- 最终 Windows 便携版实际录入 F8 后，Explorer 选择合成 TXT 按一次 F8 显示正文；再按 F8 关闭，选择下一份 Markdown 后一次 F8 正常显示。原生日志两次均从 `held=false` 开始，松开时仅提交一次并加载成功，保留本地 `test-results/shortcut-native-after.log`，不加入发行包。

## v0.9.12 PowerPoint 页面预览（2026-10-10）

- 原因：原 PPTX 引擎仅提取段落，没有渲染图片及幻灯片布局；XML 默认去除每个富文本片段两端空格，造成 SQL 单词连接。
- Windows 对已授权的本地文稿使用 PowerPoint 只读、无窗口、禁宏转换，缓存于应用缓存目录，源文件更新使缓存失效。后台串行转换、90 秒超时；转换失败回退文字速览。不终止用户的 PowerPoint 进程，正常转换后关闭本次文稿并恢复自动化设置。
- 页面复用 PDF 连续阅读与文字层，默认适应窗口；原始页面/文字速览选择及缩放/翻页都放在更多菜单。文字解析独立使用保序 XML 配置，保留空格、缩进、换行、字段顺序，Excel 解析不受影响。
- 真实文稿转换为 28 页、16:9 PDF；第 2 页及第 28 页图片与布局目视检查通过。后端实际转换/缓存复用测试通过，原文件字节保持一致；路径与缓存失效单元测试通过。
- 前端 10 个文件 / 52 项测试通过；后端 16 项通过，2 项需要交互式环境的测试默认忽略，其中真实 PPT 转换已单独运行通过。TypeScript/Vite 构建通过。
- 生产界面 smoke 通过：真实文稿 28 页、图片页及末页彩色内容绘制、首页文字层、原始页面/文字速览切换、SQL 空格、640px 窗口适应，以及模拟 PowerPoint 不可用时回退。PDF 文字复制与 40 页连续阅读、菜单头部布局回归通过。
- Windows release EXE / NSIS 构建通过，版本 0.9.12。最终便携程序真实 WebView2 从指定 PPT 生成 28 页，原始第一页 SQL 与混合字体、第二/第三页截图正确显示；更多菜单显示原始页面和 28 页总数。应用缓存中生成 PDF，正常结束后 PowerPoint 转换进程退出。85 个代码文件无 BOM 检查通过，私人文稿及其转换文件未加入发行包。

## v0.9.11 PDF 文字选择与复制（2026-10-10）

- 原因：PDF 只绘制 canvas 位图，没有提供浏览器可选中的文字。增加 PDF.js TextLayer，在 CSS 页面尺度下覆盖透明文字与选择高亮；位图仍按设备像素比绘制。
- 文字层与缩放/页面尺寸同步，随邻近页生成；离屏或卸载取消文字渲染并清空 DOM。保留连续页面与工具菜单。纯扫描图像仍需 OCR，本轮未增加 OCR。
- 浏览器实测拖选与 Ctrl+C 后剪贴板文字一致；DPR 2 / 125% 的文字框缩放比例正确，横向页、90/180/270 度旋转页面文字框与实际位图字形重叠/复制、相邻页选区复制、离屏释放与返回重绘通过。两份指定实际 PDF 第一/二页可提取与复制文字，未输出私人文档正文，原文件字节保持不变。
- 连续 PDF 回归通过：两份实际文档与 40 页合成样本，后续页非空白绘制、搜索/目录跳转、快速缩放、位图上限和离屏回收正常。TypeScript/Vite 构建通过。
- Windows release EXE / NSIS 构建通过，版本 0.9.11。最终便携 EXE 真实 WebView2 双击选中合成 PDF 文字，高亮与字形对齐；按 Ctrl+C 后实际 Windows 剪贴板与测试文字一致。随后已切回用户的简历 PDF，新版保留运行。82 个代码文件 UTF-8 无 BOM 检查通过。

## v0.9.10 PDF 连续页预览（2026-10-10）

- 原因：旧预览仅渲染当前页的一个 canvas，翻页工具收在菜单内，正文滚动无法看到后续页；文件本身没有丢页。
- 改为全页连续布局，邻近页按需绘制，每页保留原 PDF 尺寸比例；离屏 canvas 清零释放位图，单页位图限制约 1600 万像素。加载时显示动画，单页渲染错误独立显示。
- 菜单翻页、全文搜索和内置目录定位到连续页面；滚动更新当前页，缩放保持当前页。头部保持整洁。
- 修复前多页回归失败，修复后 jl 目录四份实际 PDF 验证通过：2 / 12 / 2 / 2 页，滚到后续页与末页能绘制非空白内容，翻页/缩放正常，原文件字节一致；私有文件未复制到测试样本或发布产物。
- 40 页合成 PDF 验证通过：横竖页混排、末页超大尺寸，搜索定位第 20 页、内置目录到末页、快速缩放到 300%、位图上限、离屏释放与返回首页重绘，无页面异常。
- header 回归通过：1000 / 640px 窗口下单行 36px 头部、菜单内 PDF 搜索/缩放、单页 PDF、Word/Markdown 工具与窗口操作。TypeScript/Vite 构建通过。
- Windows release EXE 与 NSIS 安装包构建通过，版本 0.9.10。最终便携程序真实 WebView2 验证截图中的两页简历：直接向下滚动可见第一页末尾、分页间隔、第二页内容以及末页后半部分；确认旧实例为 v0.9.9，已替换并保留新版运行。81 个代码文件 UTF-8 无 BOM 检查通过。

## v0.9.9 Word 大纲兼容与样式（2026-10-10）

- 原因：指定的第一份 DOCX 全部段落未设置 pStyle/outlineLvl，章节通过直接加粗、字号和编号排版；第二份使用 Heading1/Heading2。
- 在没有正式标题时识别正文中的短段落完整加粗标题，支持中文章节、括号序号和多级数字编号。正式标题、继承层级、显式正文等级优先，不扫描表格作为推断标题，不修改原文件及字体样式。
- 目录字体从 14px 调为 12px，目录滚动条从 5px 调为 3px；修复标准 scrollbar-color 覆盖 WebKit 自定义宽度的问题，回归检查实际占用宽度为 3px；保留当前项背景和键盘焦点。
- 3 个测试文件 / 7 项通过：直接格式标题、混合加粗/正文/表格排除、原生/继承标题与正文覆盖、循环样式、DOCX/字体解析。
- 本地实际文档 smoke 通过：第一份 37 项，第二份 20 项，目录节点对应正文、点击中间/末尾跳转、滚动跟随、12px 字体、3px 滚动条，源文件字节一致。私人文档未复制为测试样本或放入发布产物。
- 原有 reader-style 回归通过：Markdown 字号/字体/大纲拖动与键盘调整/长目录跟随/搜索，Word 页数/原字体，FB2/Notebook，小窗口深色界面。TypeScript/Vite 生产构建通过。
- Windows release EXE / NSIS 构建通过，版本 0.9.9。最终便携 EXE 在真实 WebView2 中显示 37 项大纲、较小字体与细目录滚动条，点击章节可跳转正文并显示当前项背景。新版保留运行。78 个代码文件 UTF-8 无 BOM 检查通过。

## v0.9.8 压缩包选中样式（2026-10-10）

- 复现旧版列表行按下时继承全局 button:active 的 translateY(1px) 与 0.15s transform 过渡，测试捕获 matrix(1, 0, 0, 1, 0, 1)。仅对压缩包列表行禁用 transform/transition，保留选中背景与边框、键盘焦点提示。
- 在既有压缩包界面回归中加入按下/松开前后坐标与尺寸一致、transform 为 none、鼠标与键盘选中检查。原测试在旧构建中失败，修复后重新验证。
- 修复后 smoke-polish.mjs 通过：按压/松开无位移，键盘选择无位移，选中高亮、目录/筛选/页码/滚动/选择保留、嵌套预览/返回、二进制样式与窄窗口深色回归正常。TypeScript/Vite 生产构建通过。本轮只修改列表样式和版本，未修改解析或原生键盘逻辑。
- Windows release EXE 与 NSIS 安装包构建通过，版本 0.9.8；最终便携程序真实 WebView2 检查压缩包列表可选中文件夹并保留背景高亮，新版保留运行。按住状态的位移与几何尺寸由 Edge 回归验证。75 个源码文件 UTF-8 无 BOM 检查通过。

## v0.9.7 统一预览操作菜单（2026-10-10）

- 所有共享预览工具改为挂载到右侧“更多”菜单，移除头部工具目标与对应样式。Word 缩放/适应宽度、大纲/文字速览、阅读字体/字号/编码、文本搜索/换行、图片/PDF 缩放/翻页、TIFF 翻页、CAD/模型适应视图、HTML 模式、幻灯片与电子书章节、压缩包筛选与所选项打开均使用原操作函数与状态。只挂载当前压缩包层的工具。
- 菜单宽 280px，按窗口限制最大高度并可滚动，头部仍为 36px。文件名可使用更大的头部空间。输入框聚焦时 Esc 关闭操作菜单，不丢失搜索内容。
- 48 项单元测试、TypeScript/Vite 构建通过；Word/Markdown/编码/RTF/HTML 阅读、字体与大纲互动、HTML/CAD/STL/OBJ/TIFF、表格/演示/EPUB、ZIP 内部预览/返回、压缩包筛选/目录/页码/选中项/滚动保留回归通过。
- 合并头部回归验证 1000×760/640×480：关闭菜单后没有预览工具显示在头部或正文工具条；菜单不超出窗口，Word 缩放改变并关开保留，文本搜索 Esc 关闭并关开保留，PDF 125% 缩放、图片单击/双击缩放、窗口按钮模拟与偏好设置入口通过。已查看 menu-word-640.png、menu-pdf-640.png 与小窗口深色菜单截图。
- CSV 全量回归通过：超过 8 MB 的 20001 行表格/125 列 TSV、末行可见、ZIP 内部 CSV 与返回正常，统计信息移入菜单。测试为合成样本，模拟原生桥接的窗口按钮测试不代替实机验收。
- 本轮未修改原生空格捕获或解析引擎，未重新执行 Explorer 连续 Space 或 macOS 实机测试。
- 大文件回归通过：80001 行文本/UTF16、全文搜索菜单/高亮/末尾滚动、完整 Markdown、33.3 MB 文本、40 MB Word 页面与图片、ZIP 按需读取。Windows release EXE 与 NSIS 构建通过，版本 0.9.7；最终便携程序真实 WebView2 验证 Word 头部没有大纲/缩放/模式工具，更多菜单显示大纲、页数、适应宽度与文字速览，Esc 关闭后文档保留显示。程序保留运行。75 个源码文件 UTF-8 无 BOM 检查通过。

## v0.9.6 CSV/TSV 完整表格（2026-10-10）

- 修复 CSV 解析到 5000 行/100 列停止的行为，全部行列保留。CSV/TSV 走完整读取流程，取消原 8 MB 容器限制，读取期间显示加载动画。原始公式文本不会执行。
- 列数在逐行解析时统计，避免大量行通过展开运算符传给 Math.max 触发参数栈上限。单元测试验证 5002 行/102 列、150001 行 TSV、超过旧行数限制后的损坏引号检测。48 项单元测试通过。
- 新增 smoke-table-full.mjs：真实桌面 CSP 下验证超过 8 MB 的 20001 行/12 列 CSV，加载动画、超过第 5000 行与第 15000 行可见、末行 row-20000 可见、滚回顶部正常；界面同时最多绘制 50 行。125 列 TSV 最后一列可水平滚动到达。ZIP 内相同大 CSV 完整加载，返回列表保留选择。无页面脚本异常，已查看 table-full-tail.png。
- 本轮修复范围为 CSV/TSV；XLSX/ODS 的展开与行列限制、ZIP 单条目 32 MB 限制保留。测试使用合成数据，未取得截图中的 usage-events-gh.csv 原文件，未验证 GB 级表格性能。
- 本轮未修改原生空格监听，未重新执行 Explorer 连续 Space 或 macOS 实机验收。
- Windows release EXE/NSIS 构建通过，版本 0.9.6。最终便携程序真实 WebView2 验证 12,097,864 字节 CSV 显示 20001 行/12 列且无“已截断”；拖动滚动条到末尾可见第 20001 行与 row-20000 数据。新版保留运行。74 个源码文件 UTF-8 无 BOM 检查通过。

## v0.9.5 更多菜单阅读选项（2026-10-10）

- 编码、阅读字体与字号移入右侧“更多”菜单；文本/代码显示编码，Markdown 等阅读视图显示字体和字号，Word 页面保留原字体和头部缩放。隐藏的压缩包层不会挂载菜单选项。
- 46 项单元测试及 TypeScript/Vite 构建通过。
- Edge 生产界面回归通过：1000×760/640×480 的 36px 头部、菜单不越界、字体/字号修改与关闭重开保留、Word 页面无阅读字体选项、文本搜索、PDF Canvas/搜索、窗口按钮模拟、偏好设置入口。手动 Windows-1252 重新解析正确显示 café，无旧编码控件残留。
- ZIP 内 SVG/PNG、MD、Word、TXT/代码/CSV/HTML/PDF、二进制及 9 MB 文本全文回归通过；返回列表保留选择，并检查图片/列表无选项、Markdown 三项、文本仅编码。
- 阅读样式回归通过：字体/字号、大纲拖动与键盘调整、跟随和搜索、Word 原字体/页数、FB2/Notebook、小窗口深色主题。已查看 menu-markdown-640.png 与 menu-small-dark.png。
- 本轮未修改原生空格捕获或解析引擎，未重新执行 Explorer 连续 Space 验收或 macOS 实机测试。
- Windows release EXE 与 NSIS 安装包构建通过，文件版本 0.9.5。最终便携程序真实 WebView2 检查通过：头部仅显示大纲等常用工具，更多菜单显示编码/字体/字号，选择 22px 后正文放大，关闭并重新打开菜单仍保留 22px。程序保留运行。73 个源码文件通过 UTF-8 无 BOM 检查。

## v0.9.4 合并预览头部（2026-10-10）

- 使用共享工具栏挂载目标将现有控制移入 36px 头部，保留组件本身的状态和处理函数。只挂载压缩包当前层级的工具；隐藏层不显示到头部，返回时复用原列表状态。
- 合并文件名、文件切换与预览操作，删除底部本地预览/重复导航状态栏、文件名旁只读标签、头部类型/大小重复标签和冗余技术摘要。大小保留在文件名提示及文件信息中。Word/Markdown 大纲、字号/字体、编码/搜索、图片/PDF 缩放与翻页、幻灯片切换等操作保留。
- 取消最小化左侧独立偏好设置按钮；欢迎页和预览页均从“更多”访问偏好设置。选择文件、默认应用打开、预览模式及复制路径保留在预览页菜单，原有快捷键保留。
- 新增生产 Edge 合并头部检查，通过真实桌面 CSP，模拟原生按钮验证 1000×760 与 640×480 布局：头部 36px、内容区域占剩余高度、无底部重复栏、最小化/最大化仍在视图内。Word/Markdown 控件、正文字号/缩放、代码查找、PDF Canvas/搜索、文件前后切换、设置菜单及最大化/恢复调用通过。桥接模拟不代替实际桌面测试。
- 图片操作移入头部后隔离指针、滚轮和双击事件，防止触发内容区的平移或双击重置。真实 SVG 解码后单击与双击放大分别显示 125%/175%，重置恢复；无底部浮动操作条。
- 既有压缩包回归通过：嵌套预览及返回、目录/搜索/页码/选择/滚动位置保留；内部 SVG/PNG、Word/Markdown、TXT/TS/CSV/HTML、PDF Canvas、二进制以及 9 MB 文本全文预览通过。既有 Word/Markdown/编码/RTF/HTML、表格/工作表/演示/电子书、阅读字号/大纲互动及小窗口深色检查通过。
- 已查看 header-markdown-1000.png、header-markdown-640.png、header-word-640.png、header-pdf-640.png。新增 SVG 放大手势和文件切换检查通过；生产 PDF Canvas 已等到实际渲染尺寸后再截图。HTML/CAD/STL/OBJ/TIFF、模拟 macOS 桥接、80,001 行文本/UTF16、33.3 MB 文本全文及 40 MB Word 回归通过，46 项单元测试通过。
- Windows release EXE 与 NSIS 安装包构建通过，产物版本 0.9.4。最终便携版真实 WebView2 验收：Markdown 单行头部、无重复底栏、文件前后切换入口与大纲可见；最小化左侧仅保留“更多”，菜单中设置实际可打开并关闭；最大化后为恢复按钮，恢复后窗口回到 1002×762。最终程序保留运行。73 个源码文件 UTF-8 无 BOM 检查通过。
- 本轮只修改前端布局及入口，没有重新验收 Explorer 连续空格按键；macOS 为桥接模拟检查，仍未在 Mac 编译或实机验证。

## v0.9.3 全文加载（2026-10-10）

- 文本/代码移除手动分段视图，Markdown/HTML 移除 512 KB/5,000 行前缀截断。内部每次最多读取 4 MB，组装完整文件后解析并连续显示；不向用户提供下一段/上一段操作。
- 46 项单元测试通过：新增超过原生单次上限的 33 MB 完整读取、进度到 100%、跨内部边界 UTF-8 中文、中途取消及短读拒绝；新增中文为主的无 BOM UTF-16 LE/BE 自动识别。删除失去引用的旧 text-chunks 实现和测试。
- 生产 Edge 大文件回归通过：80,001 行中文/UTF-16 末尾和全文搜索计数、33.3 MB 文本的全部 8,501 行及末尾、12,001 行代码完整高亮以及跨语法节点搜索高亮、超过旧限制的 Markdown 正文与末尾大纲、40 MB DOCX 直接显示两页和引用图片。人工延迟 Blob 读取验证动画，切换到 license.dat 后旧读取不能覆盖新内容。无文本分段按钮，采用真实桌面 CSP，无页面异常。
- Word/RTF 取消文件容器大小的 32 MB/8 MB 门槛；Word 不再自动降级为文字速览。DOCX 单展开部分 16 MB、合计 64 MB 校验和宏/外部资源过滤保留。40 MB 合成文档由五个未引用 8 MB 部分填充，验证大容器路由和实际引用图片，不是大型复杂文档性能基准。
- ZIP 内容回归通过：9 MB 文本显示完整内容，无手动分段；SVG/PNG 解码、Word/Markdown 大纲、TXT/TS/CSV/HTML、PDF Canvas、二进制信息及返回选择保留。
- 既有阅读/界面回归通过：Word 字体/表格/图片/Space 关闭、Markdown/GFM/大纲、编码切换、RTF/HTML；头部高度、滚动条、图标、压缩包导航/状态、640×480 深色界面。21 项生产引擎检查通过；14 项 Rust 测试通过，1 项交互式 Shell 测试默认忽略；cargo fmt 检查通过，TypeScript/Vite 构建通过。
- 大于 512 KB 的 Worker 请求超时改为 120 秒，小请求仍为 10 秒，取消时终止旧 Worker；Word/RTF DOM 排版仍在主线程。完整读取占用文件及解析内容的内存，未完成 GB 级实机性能验证。CSV/表格行列、其他容器与 ZIP 单条目限制保留，本轮未改原生空格监听。
- 已查看 large-text-tail.png、large-markdown-tail.png、large-word-pages.png。Windows release EXE 和 NSIS 安装包构建通过，产物版本 0.9.3。最终便携 EXE 在真实 Windows WebView2 中验收：33.3 MB 文本按 Ctrl+End 连续滚到第 8,501 行，末尾标记可见；40 MB Word 直接页面预览，目录点击跳转第二页并显示 2/2 页。新版保留运行。本轮未重新执行 Explorer 连续 Space 按键验收；macOS 未编译或实机测试。71 个源码文件的 UTF-8 无 BOM 检查通过。

## v0.9.2 大纲与 ZIP 内部预览（2026-10-10）

- Word/Markdown 共用大纲选中样式，删除形成左侧竖线的 inset box-shadow，保留背景及文字高亮。生产回归验证两种文档的 active 项 `box-shadow: none`。
- 使用合成 ZIP 在旧生产构建中复现 SVG 内部图片无法解码；解压输出创建 Blob 时没有 MIME 类型。补充按文件类型生成图片/音视频/HTML/PDF/文本 MIME，传给 Blob 和预览文件信息。压缩包只在内存中解压所选文件，不要求用户手动解压。
- ZIP 内部文件压缩/展开限制由 8 MB 提升至 32 MB，和原生单次读取上限一致；保留实际展开大小、CRC32 校验和 Worker 取消/超时。大 Office 文字速览的 XML 单部分限制显式保留 8 MB。
- `node scripts/smoke-archive-content.mjs` 通过：SVG/PNG 图片实际解码；Word 两页及大纲、Markdown 内容及大纲；TXT/TS/CSV/HTML 内容；PDF 实际 Canvas 像素；未知二进制信息；9 MB 文本分段阅读；返回后保留原选择。采用实际桌面 CSP，无页面脚本异常。
- 44 项解析单元测试通过，新增 MIME 映射回归，并验证 9 MB 条目成功、40 MB 条目拒绝、伪造解压大小和 CRC 错误拒绝。TypeScript/Vite 生产构建通过。
- 14 项 Rust 测试通过（另 1 项交互式 Shell 测试默认忽略）；21 项生产引擎/PDF 检查、既有 ZIP 返回/状态保留及 Word/Markdown/编码阅读回归通过。
- 最终 Windows v0.9.2 便携包实机验收：ZIP 中双击 SVG，实际 WebView2 显示蓝色矩形与 120×80 尺寸；点击返回列表后 SVG 条目仍选中。未手动解压或把内部文件写入磁盘。release EXE 与 NSIS 安装包构建通过；本轮未重新执行 Explorer 连续 Space 验收。
- 不代表所有格式和压缩算法均可渲染。ZIP/ZIP64 Stored/Deflate 条目可使用现有引擎；加密/分卷/其他算法仍明确提示，未支持的内容格式显示文件信息。

## v0.9.1 Windows 软件图标（2026-10-10）

- Windows 文件信息页使用系统 Shell 图标，保留软件颜色、透明背景和快捷方式箭头。ZIP 条目没有本地路径，只取系统关联/文件夹图标；macOS/浏览器继续使用彩色绘制图标。
- 14 项 Rust 测试通过（另 1 项交互式 Shell 测试默认忽略），包括 BGRA/透明度转换、自定义软件图标的真实 `.lnk`、系统 Explorer EXE 自带图标、TXT/LNK/文件夹图标。并发执行曾复现 `DrawIconEx` 无效句柄，串行化 Shell 图标请求及句柄生命周期后连续三轮通过。
- `node scripts/smoke-icons.mjs` 通过：模拟原生 IPC 返回实际提取的 PNG，验证本地路径传递、快捷方式标签、图片解码、快速切换忽略旧响应、读取失败/损坏 PNG 回退、ZIP 类型图标缓存和实际桌面 CSP；无页面脚本异常。该模拟不能代替最终桌面包验收。
- 43 项解析单元测试、21 项生产引擎/PDF 检查、ZIP/二进制界面、Word/Markdown/编码/RTF 阅读回归通过。macOS 桥模拟与 PDF 兼容回归通过；仍未进行 Mac 编译或实机检查。
- 已查看系统提取的 `test-results/system-shortcut-icon.png` 与模拟桥截图 `system-shortcut-preview.png`，自定义蓝绿软件图标与箭头正常显示。前端 TypeScript/Vite 构建与 Rust 格式检查通过。
- 复现方法：先运行 Rust 图标测试以生成 PNG，再启动生产预览服务（1423），执行 `node scripts/smoke-icons.mjs`。阅读回归默认端口 1420，可设置 `UI_TEST_URL=http://127.0.0.1:1423`。
- 最终 v0.9.1 Windows 便携包实机通过：真实 `.lnk` 显示指定的蓝绿软件图标和左下角箭头，`explorer.exe` 显示其黄色/蓝色内嵌程序图标，ZIP 列表显示系统文件夹和 PNG 类型图标。使用 computer-use 检查实际 WebView2 窗口；预览文件通过本程序命令行传入，未执行被预览的快捷方式或 EXE。本轮未重新执行 Explorer 连续 Space 验收。
- Windows release EXE 与 NSIS 安装包已重新构建；便携 EXE 的文件版本为 0.9.1，便携 EXE/安装包副本与源产物 SHA-256 一致。

## v0.9.0 macOS 接入（2026-10-09）

- 43 项解析单元测试通过，21 项生产引擎/PDF 检查通过；TypeScript/Vite 生产构建通过。
- Windows 上 10 项 Rust 测试通过（另 1 项交互式 Shell 测试按默认规则忽略），新增 3 项 macOS 手势状态测试：连续开关预览、组合键/输入/迟到重复按键放行、丢失 key-up 后下一次物理按键恢复。
- macOS Rust 桥接模块使用已编译的 Tauri 依赖进行独立 metadata 类型检查通过；这不是 Apple SDK 编译或原生链接验收。
- 生产界面使用模拟 macOS 原生桥验证：未授权不自动弹权限请求、明确点击授权按钮、辅助功能/自动化/运行状态刷新、Finder 监听开关、⌘O 标签、初始文件读取等待事件订阅、640×480 深色设置界面；采用实际桌面 CSP，无页面脚本异常。已查看 macos-permissions.png。
- 原有 ZIP/二进制界面和 Word/Markdown/编码/RTF/HTML 回归通过，原生 Windows 空格 Hook 未修改。
- PDF 兼容回归通过：在主页面与 Worker 中禁用原生 Promise.withResolvers，PDF 一页实际 Canvas 渲染成功；强制独立 Worker 创建失败后，PDF.js 内置回退仍可渲染。该回归在 Edge 中模拟接口缺失，不能代替 Mac WebKit 实机验收。
- 已加入 macOS 12.3+ APP/DMG 配置、ICNS 图标、Apple Events 用途说明和 entitlement，附带 Apple Silicon/Intel 通用构建命令与 GitHub macOS 构建流程。前端目标设为 Safari 15.4，PDF 主程序和 Worker 使用含兼容补丁的 legacy 版本。
- macOS 合并配置通过 Tauri 实际 Config 类型解码，两份 plist 通过 XML 解析；代码/配置/文档通过 UTF-8 无 BOM 校验。Windows v0.9.0 release 编译通过（本轮不生成新的 Windows 安装包）。Mac 构建脚本在 Windows 上按预期拒绝执行，并提示需要 Mac 环境。
- 当前环境是 Windows，没有 Apple SDK 或 Mac 桌面。本轮未执行 Objective-C 原生编译、macOS Rust 链接、DMG 构建、Finder/TCC 权限和 WebKit 实机检查、签名及公证；不得把模拟界面测试视为 Mac 实机通过。实机清单见 MACOS.md。

## v0.8.0 样式与压缩包交互（2026-10-09）

- 43 项原有解析单元测试通过。
- 生产界面新增回归通过：头部 36px、正文 18px、5px 滚动条，按类型彩色图标；ZIP 单击选择、双击/Enter 打开、列头排序，嵌套预览逐层返回，目录/搜索/分页/选中项/滚动位置保持；二进制信息卡、128/512 字节切换、签名/可读/空字节颜色；640×480 深色界面和实际桌面 CSP，无页面脚本异常。
- 大文件、Word/Markdown、编码、RTF/HTML、表格/电子书、CAD/三维/TIFF 原有界面回归通过。Word 保留原字体/字号，表格行高仍为 32px，虚拟滚动正常。
- 已查看 polish-archive.png、polish-binary.png、polish-archive-small-dark.png 及新图标 PNG。新蓝绿叠页 SVG 已生成多分辨率 Windows ICO/PNG，并供窗口/托盘/安装包使用。
- 21 项生产解析引擎/PDF 检查通过；Word 和 HTML 页面内的滚动条实测为 5px。
- Windows 最终 v0.8.0 便携版实机验证：双击 ZIP 的 docs 目录，双击 readme.txt 后显示完整中文正文；点击头部「返回列表」回到 docs，readme.txt 保持选中，彩色文件图标与类型/大小/压缩后列正常显示。最终程序保持运行。未重新执行资源管理器连续 Space 按键验收，也未检查安装后快捷方式图标缓存。
- TypeScript/Vite、Rust release 与 NSIS 安装包构建通过。便携 EXE 和安装包副本均与源产物 SHA-256 一致，根版本信息均为 0.8.0；71 个代码/配置/文档文件通过 UTF-8 无 BOM 校验。


## v0.7.0 网页与工程图形（2026-10-08）

- 43 项单元测试通过：HTML 声明编码/BOM；代码扩展名与构建文件、高亮语法；DXF 圆弧/多段线 bulge、文字/图层、块原点/缩放/旋转、无效图纸；ASCII/二进制 STL、OBJ 负索引/凹多边形、无效顶点；TIFF 像素解码和页码/像素限制。
- 21 项生产解析检查通过：原有 Office/Markdown/ZIP/OpenDocument/EPUB/FB2/Notebook/PDF 回归，加 DXF/STL/OBJ/TIFF/HTML/Dockerfile，覆盖动态加载的 Worker 模块与输出传输。
- 桌面 CSP 下的生产 Edge 界面验证通过：HTML 原始内嵌样式/网格布局、脚本清理/无远程请求、iframe 内 Space 关闭、阅读/源码切换；Dockerfile.dev、CMakeLists.txt、PowerShell 高亮；DXF 图层、缩放/平移；STL/OBJ WebGL 实际渲染与鼠标旋转改变画面；TIFF 图像；640×480 深色窗口。测试中无页面脚本异常。
- 原有 Word/Markdown/文本编码/RTF/HTML 阅读界面回归通过。已查看 graphics-html.png、graphics-dxf.png、graphics-stl.png 等截图。
- 最终 Windows v0.7.0 便携版已实机启动，确认 HTML 内嵌样式和两列布局、阅读模式与四条大纲，以及 WebView2 中 STL 四面体的 WebGL 渲染。TypeScript/Vite、Rust release 与 NSIS 安装包生成通过，便携 EXE 与最终源产物 SHA-256 一致。
- 新引擎设置独立 Worker 取消/10 秒超时及文件/图元/像素限制。样本为合成文件；未覆盖所有 CAD 生成器、复杂 DWG 或所有 TIFF 变体。DWG/STEP/IGES/PSD/HEIC 仍未提供专用渲染。
- DOMPurify 已更新到官方修复版本；官方生产 audit 仍报告 Mammoth 命令行依赖 argparse/sprintf-js 的 3 条中等风险关联。项目使用 mammoth.browser，不使用该 CLI；未采用 audit 建议的破坏性旧版 Mammoth 降级。


## v0.6.0 阅读样式（2026-10-08）

- 34 项单元测试通过，新增 Notebook 保存输出过滤、单元格数量/版本限制；FB2 章节与强调/实体声明过滤、Windows-1251 与 UTF-16BE 编码。
- 15 项生产解析引擎检查通过，新增 FB2 章节强调与 Notebook 保存文本输出，原有 Office/ZIP/Markdown/OpenDocument/EPUB/PDF 回归通过。
- 新样式生产 Edge 回归通过：14–20px 字号、字体切换、大纲鼠标拖动/键盘调整、80 标题搜索与自动保持当前章节可见、Word 页数与原字体、FB2/Notebook、640×480 深色界面。
- 原有实际桌面 CSP 下的阅读回归通过，包括 Word 样式/字体/Space 关闭、Markdown 大纲、文本编码、RTF/HTML。
- 已查看 reader-typora.png、reader-office.png、reader-small-dark.png。
- Windows 便携版实机验证：打开 Markdown，点击头部最大化后按钮变为「恢复窗口」、系统标题栏为「还原」；点击恢复并刷新后窗口恢复到 1002×762，按钮重新为「最大化」。验证使用最终 v0.6.0 便携版，保留程序运行。
- TypeScript/Vite、Rust release 编译及 Windows NSIS 安装包生成通过。Word 复杂排版和缺失字体仍可能与 Office 存在差异；新增格式使用合成样本验证。


## v0.5.0 大文件与压缩包（2026-10-08）

- 31 项单元测试：新增 40 MB ZIP 有界目录/条目读取、CRC、超额解压、ZIP64、UTF-8 连续分段、长行跨段和 UTF-16 边界。
- 8 项原生测试通过，有界随机读取增加非零偏移和 EOF 覆盖；现有 Windows 状态机/Shell/Hook 测试通过。
- 13 项原有生产引擎检查通过。
- 生产构建 Edge 回归：40 MB ZIP 目录导航、每页 100 项、全包搜索、条目预览与返回；大文本前进/后退/末尾；40 MB Word 跳过图片读取正文；640×480 深色界面；实际桌面 CSP。
- 原有 Word 字体/样式、Markdown 大纲、编码、RTF/HTML 回归通过。浏览器并发启动曾失败，逐个启动重试后通过。
- 已查看 archive-small-dark.png、large-text-tail.png，读取范围调整为精确字节，末尾自动滚到最后一行。
- 样本为合成文件，未完成 GB 级真实文件性能或 Explorer 端到端手工按键验收。


## v0.4.2 字体（2026-09-22）

- 26 项单元测试通过：新增 Word 中文/日文主题字体、显式字体保留、文本前后空白和数字字符串保留、未知语言不猜测。
- 生产界面回归通过：TXT 16px 与默认换行、代码 14px 等宽字体声明、IDEA 明暗关键字配色、Word 宋体主题实际 CSS；原有大纲、模式切换和编码回归通过。
- 已查看 typography-text.png、typography-code-dark.png、typography-word.png。测试文档为合成样本，尚未比较用户实际 Word 文档。


## v0.4.1 阅读导航（2026-09-22）

- 24 项解析测试通过，TypeScript 和生产前端构建通过。
- 生产版 Edge 回归通过：Markdown 长文滚动章节跟随、Word 跨页滚动跟随、125% 缩放、收起/展开大纲后跳转、文字速览返回页面预览。
- 原有阅读回归同时通过：编码、内容识别、DOCX 页面与样式、iframe Space 关闭、RTF/HTML。
- 本轮没有修改原生键盘逻辑，也没有重新进行 Explorer 手动按键验收。


## v0.4.0 阅读与编码（2026-09-22）

- 24 项单元测试：内容识别、UTF-16/GBK/手动编码、截断 UTF-8、DOCX 包校验与原有格式。
- 8 项 Rust 测试通过，包括 Windows Shell COM、Hook 安装/卸载及连续空格状态机。
- 13 项生产引擎检查通过，覆盖原有 Office/OpenDocument/EPUB/ZIP/PDF 等。
- 生产构建在无头 Edge 中使用桌面版实际 CSP 验证：纯文本 license.dat、无 BOM UTF-16、GBK、Windows-1252 手动切换；Markdown 大纲/GFM/代码高亮；Word 三条大纲、两页、标题颜色、表格底色、图片解码、导航、iframe 内 Space 关闭、含图片文档切换文字速览；RTF 中文和粗体；HTML 内容清理与大纲。
- 小窗口、深色主题及 CSV/ODS/ODP/EPUB 原有界面回归通过。
- Word 和 Markdown 截图已查看：test-results/reading-word.png、reading-markdown.png。
- 使用合成文档测试，未收到用户出现乱码或加载慢的实际文件。不能据此保证所有字体、复杂 Word 排版或文件变体一致，也未承诺真实文件加载时间。
- 当前仅系统接口/状态机测试与浏览器内 Space 关闭已验证；本轮未重新执行 Explorer 连续选择文件的完整手工验收。历史实机记录如下。

## v0.3.0 紧凑界面与格式扩展（2026-09-20）

- 20 项单元测试通过：新增 CSV/TSV 引号、换行、行列限制，ODT 混合文字顺序，ODS 重复单元格与展开限制，ODP 顺序，EPUB spine 阅读顺序、XHTML DTD 兼容及外部资源过滤。
- 13 项构建后生产引擎检查通过：原有 8 项加 CSV、ODT、ODS、ODP、EPUB。
- 独立无头 Edge 对生产构建完成界面检查：ODT 阅读、CSV 虚拟滚动、ODS 工作表切换、ODP 翻页、EPUB 章节切换、640×480 小窗口及深色主题，无页面脚本异常。
- 在 1000×760 窗口测得头部 42 px、底部 30 px、内容区域 688 px；比原先头部 68 px / 底部 42 px 增加 38 px。内容工具栏进一步由 44 px 缩至 34 px。
- 截图：`test-results/compact-document.png`、`compact-table.png`、`compact-book.png`、`compact-small.png`、`compact-dark.png`。
- 界面测试：先运行本地服务，再执行 `npm run test:ui`，默认访问 1420；可设置 `UI_TEST_URL` 指向生产预览端口。需要本机 Edge。

新增文档与电子书为文字速览，图片、复杂排版和 DRM 不在支持范围。测试使用合成文件；不等同于覆盖所有第三方生成器和文件变体。Windows 空格处理沿用 v0.2.2，下面保留其历史实机记录。

## 空格双击问题：实机定位

`test-results/space-input-before-fix.log` 捕获到：106543 ms Space 按下后成功打开预览，但没有对应 key-up；109395 ms 下一次按下时 `held=true suppress=true`，请求未提交；109463 ms key-up 才清空状态；110755 ms 第二次按下才打开。由此确认是按键状态残留，而非文件读取或窗口显示失败。

v0.2.2 改为松开时清空状态并提交请求，窗口内的 Space 关闭同样延后至松开。新增状态机回归测试覆盖连续五次预览、重复按下、重复松开、普通输入和 Shift+Space。

实机修复后 `test-results/space-input-after-fix.log` 共 14 次请求，11 次加载成功，3 次未获得普通文件；所有请求均由第一次 Space 松开提交，无残留 `held=true` 的下一次 key-down。记录包含鼠标关闭及 Space 关闭后再次成功打开。因此已验证本次残留状态缺陷修复，但不能把 3 次选择失败算作成功：当时所选项目类型尚未确认。最终版增加文件夹、无本地路径的系统图标、文件无法访问的分别提示和匿名选择项计数，供后续定位。

诊断仅在设置 `SPACE_PREVIEW_TRACE` 环境变量时启用，日志最大 1 MiB，异步写入本地，仅记录 Space 事件、窗口控件类别和流程阶段，不记录文件名或内容。普通启动不写诊断文件。

## 已通过

- `npm test`：20 项测试。包括路由与兜底、中文编码、损坏 ZIP、真实解压大小限制、Excel 稀疏坐标与公式缓存、PowerPoint 页面顺序、XML 实体拒绝及新增格式。
- `cargo test --manifest-path src-tauri/Cargo.toml --lib -- --include-ignored`：8 项测试。包括按键状态机连续操作、普通输入不触发预览、有界读取、未授权文件拒绝、非文件窗口过滤、本机 Windows Shell COM 连接、键盘 Hook 安装/卸载、选择项重试与切换窗口时取消。
- `node scripts/smoke-preview.mjs`：13 项生产引擎检查。直接运行构建后的 Worker，验证 DOCX、XLSX、PPTX、ZIP 列表、ZIP 内部文件、Markdown、CSV、ODT、ODS、ODP、EPUB；另验证 PDF 文字提取与实际 Canvas 渲染。
- 前端 TypeScript 与 Vite 生产构建、Rust release 编译、NSIS 安装包生成。
- 在线 `npm audit`：0 项已知漏洞（2026-09-15）。
- 源代码采用 UTF-8 无 BOM。

2026-09-16 在真实用户桌面会话重新执行 Windows 系统接口测试，修复了无选择项时 `IFolderView2::GetSelection` 返回“找不到元素”的分支。桌面 Shell、资源管理器 Shell、键盘 Hook 安装/卸载均通过；这仍不等同于实际按键端到端验收。

## 已进行的界面检查

初版浏览器中查看了欢迎页，并操作验证 Markdown 内容、SVG 尺寸、文件切换、代码搜索、ZIP 筛选以及通用十六进制预览。后续浏览器连接关闭、Windows UI 自动化工具无法初始化，因此新增 Office 界面与原生空格端到端操作没有被标为已完成实机验收；改用实际生产 Worker 和 Windows 系统接口测试验证其核心功能。

## Windows 手动回归清单

使用 **桌面程序**，浏览器页面不能接收资源管理器快捷键。

1. 启动 `space-preview.exe`，确认显示「Space 预览已就绪」。
2. Explorer 中选择 PNG、PDF、TXT、DOCX、XLSX、ZIP、未知格式，各按 Space，确认内容或通用信息出现。
3. 再按 Space / Esc 关闭；在 Explorer 中 Shift + Space 确认进入纯文本。
4. 测试桌面图标、多选文件、Windows 11 活动标签页。
5. 在搜索框、地址栏、F2 重命名以及其他应用输入空格，确认原输入行为正常。
6. 关闭设置中的空格预览开关，确认不再唤起；重新开启后恢复。
7. Excel 切换工作表，ZIP 点击内部文件并用左箭头返回，PDF 搜索并跳转匹配页面。
8. 播放音视频后关闭窗口，确认播放停止；托盘仍可打开主界面。
9. 连续选择至少 10 个文件：每次仅按一下 Space 打开，分别用 Space、Esc、关闭按钮关闭，然后选择下一个文件。快速点击后立即按 Space 也应打开。
10. 开启「失去焦点关闭」重复上述步骤；新预览不应被上一次的失焦通知关闭。点击其他应用后，不应被强行切回资源管理器。
11. 长按 Space 关闭后，不应触发重新打开或改变 Explorer 选择项；关闭空格监听后，原生 Space 与 Ctrl/Alt/Win 组合键不应被拦截。

v0.2.1 已通过上述自动测试与 8 项生产引擎检查。Windows UI 工具仍报 `failed to write kernel assets`，第 9–11 项连续按键和焦点恢复尚未做自动化实机验收。用户原问题的具体触发分支未被直接捕获；本次修复针对代码中发现的焦点与事件时序缺陷，不宣称完整兼容性矩阵已通过。

本版本尚未测量 100 ms 唤起或 50 MB 空闲内存目标；macOS 编译、Finder 扩展及操作系统级沙箱未完成。

## OFD PR #1 maintainer regression (2026-10-29)

- Added resource-pool tests for shared pages, last-user release, cancellation during load,
  document close, stale release after reopen, and failed-load retry. All 142 unit tests and
  the production build passed locally.
- Browser synthetic OFD: a composite-only image now appears on its first render. After
  rendering/releasing the composite and three image pages, all four created image URLs
  were revoked; reopening and closing balanced five created/five revoked URLs.
- Browser 3,000-page OFD: first page, jump to page 1,500, return to page 1, then close.
  Nearby image URLs stayed within eight during this fixture run and dropped to zero on
  close. This is a resource-lifetime assertion, not a measured memory/CPU improvement.
- The real preview-window hook with mocked native window calls selected OFD page dimensions
  rather than the default fallback size. Native Mac window interaction and Windows
  installation were not exercised by this browser regression.


## 自定义快捷键与文件切换（2026-10-30）

- 设置 → 快捷键新增复制路径、默认应用打开、上一文件、下一文件的录入和重置；Windows/macOS 分别保存。检查与预览触发键（包含 Shift 纯文本变体）以及其他操作的冲突，保留系统菜单、编辑、查找和字号快捷键。
- 上下键在当前预览内按同目录文件名自然排序切换，不改变 Finder/资源管理器的选择或跟随其自定义排序。目录树、输入框和按钮保留自身键盘行为。浏览器文件、文件夹和压缩包内部不使用同目录切换。
- 首次切换后台枚举普通文件名，最多检查 10000 个目录项，超限显示提示，不返回不完整列表；随后复用目录列表，只有选中的文件才读取内容。隐藏文件不加入列表（当前文件除外）。关闭、打开其他文件或进入设置时废弃旧导航会话。
- 验证：148 项前端测试、13 项 Rust 测试、TypeScript 与生产构建通过。Playwright CLI 配合 Tauri IPC 模拟验证 macOS/Windows 分支的自然排序、首尾边界、一次目录枚举、复制路径、搜索输入框保护、关闭后迟到结果无效；设置录入、重复按键拒绝、刷新后恢复与重置通过。
- 本轮未替换已安装应用，未在 Windows 实机/WebView2 内验证；IPC 模拟不等同于原生端到端测试。未测量 CPU、内存或首屏耗时，不作性能数值结论。
