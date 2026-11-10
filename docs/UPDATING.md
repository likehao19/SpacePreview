# 应用内更新

桌面版启动 10 秒后检查一次 GitHub Releases，发现新版显示可关闭的提示，不自动下载。
偏好设置 → 软件更新提供手动检查、版本说明、下载进度、失败重试。
用户点击「下载并安装」后，Tauri 校验签名再安装；Windows 启动 NSIS 安装器并退出，
macOS 替换应用后重启。重启失败时保留「重启瞬览」入口，不重复安装。
关闭设置或切换预览文件不会取消正在进行的下载。
后台检查失败不弹窗，设置中显示错误；浏览器体验版禁用更新。
更新检查只请求发布清单和更新包，不发送预览文件内容或路径。

## 发布要求

- 更新地址：`https://spacepreview.likh.cn/downloads/latest.json`。
- 公钥固定在 `src-tauri/tauri.conf.json`，私钥不进入 Git。
- GitHub Actions 必须配置 `TAURI_SIGNING_PRIVATE_KEY` Secret；加密私钥还需要
  `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`。密钥内容通过标准输入配置，避免出现在命令历史或日志。
- 本次生成的私钥位于 Git 忽略目录 `.updater-keys/spacepreview.key`；发布前应安全备份。
  后续版本沿用同一密钥。不要重新生成公钥替换已经发布客户端信任的公钥。
- 首次带此功能的版本需用户手动安装；此前发布的旧客户端不能自行获得更新功能。
- 后续发布提升 `package.json`、`package-lock.json`、`Cargo.toml`、`Cargo.lock` 和
  `tauri.conf.json` 中的应用版本，更新 `RELEASE-NOTES.md`，再推送对应 `v版本号` 标签。

发布工作流使用 `src-tauri/tauri.updater.conf.json` 开启更新产物签名。普通开发、PR 构建
和 `npm run desktop:build` 不需要私钥，且不生成可发布的签名更新包。

Windows、Linux、两种 macOS 架构全部构建成功后，`scripts/package-release.mjs` 收集：

| 平台标识 | 更新包 | 签名 |
| --- | --- | --- |
| `windows-x86_64` | `SpacePreview-版本-windows-x64-setup.exe` | 同名 `.sig` |
| `darwin-x86_64` | `SpacePreview-版本-macos-x64.app.tar.gz` | 同名 `.sig` |
| `darwin-aarch64` | `SpacePreview-版本-macos-arm64.app.tar.gz` | 同名 `.sig` |
| `linux-x86_64` | `SpacePreview-版本-linux-x64.AppImage` | 同名 `.sig` |

macOS DMG 保留给首次安装使用。更新清单使用带版本的下载地址，签名保存的是 `.sig` 内容。
Linux AppImage 支持应用内更新；`.deb` 用户通过下载安装新版本升级。Linux 安装包在 Ubuntu 22.04 构建，首次提供文件拖入和 Ctrl+O 预览，暂不支持文件管理器空格唤起。
`scripts/updater-manifest.mjs` 检查全部更新包与签名后才写入 `release-assets/latest.json`；
发布工作流一起上传安装包、更新包、签名、清单与 SHA-256 校验文件。
仅发布稳定版，版本比较由官方更新器完成，不自动降级。
Tauri 更新签名与 Apple Developer ID 签名、公证是不同机制；现有 Mac 分发签名要求仍适用。

官方服务器部署、受限账号、定时补同步、缓存和恢复方式见 [官方分发运维](OFFICIAL-DOWNLOADS.md)。v0.10.22 及以前的客户端需要先通过 GitHub 或手动安装 v0.10.23，之后更新入口迁到官方服务器。

## 本地验证

```powershell
npm ci
npm test
npm run build
cargo test --manifest-path src-tauri/Cargo.toml --lib --locked
# 在一个终端启动生产资源服务，在另一个终端运行界面测试：
npm run preview -- --port 1423 --strictPort
npm run test:updater
```

界面测试使用 Edge 和模拟原生桥接，覆盖启动/手动检查、网络错误、重复点击、资源释放、
进度与无 Content-Length、签名/安装失败、重启失败、设置重新打开、小窗口与深色主题。
这些测试不替代真实 Windows/macOS 安装升级验收。

本地生成签名更新包（私钥路径可按备份位置调整）：

```powershell
$env:TAURI_SIGNING_PRIVATE_KEY = (Resolve-Path .updater-keys/spacepreview.key).Path
npm run tauri -- build --ci --config src-tauri/tauri.updater.conf.json --target x86_64-pc-windows-msvc --bundles nsis -- --locked
node scripts/package-release.mjs x86_64-pc-windows-msvc windows-x64
```

Updater 禁用旧版 Windows ZIP 兼容功能，Windows 使用原生 NSIS 包，macOS 仍使用 tar.gz；
保留 HTTPS、系统代理和原生签名校验。
参考：[Tauri 官方更新器](https://v2.tauri.app/plugin/updater/)。
