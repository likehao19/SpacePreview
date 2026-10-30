# SpacePreview v0.10.16

## 修复

- 修复 Windows 复制文件路径时带有内部扩展路径前缀的问题：复制到剪贴板的本地路径恢复为常见的盘符路径，网络共享路径恢复为标准 UNC 格式。
- 菜单中的“复制文件路径”和自定义复制路径快捷键均应用此修复；程序内部文件访问仍保留原始路径，不影响长路径读取。macOS、Linux 路径及其他设备命名空间保持不变。

## 安装包与验证

提供 Windows x64 安装程序、macOS Intel / Apple Silicon DMG、Linux x64 DEB / AppImage，以及签名更新包、应用内更新清单和 SHA-256 校验文件。

本地通过 151 项前端测试和 TypeScript 检查，覆盖盘符路径、网络共享路径、中文与空格，以及其他平台路径保持不变。Windows 实机剪贴板交互尚未验收；各平台编译、测试和打包由本次发布工作流验证。

macOS 使用临时签名，尚未进行 Apple Developer ID 签名和公证。Finder 空格预览需要辅助功能与自动化授权。Linux 应用内更新适用于 AppImage，DEB 用户请下载新安装包升级。
