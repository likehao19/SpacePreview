# SpacePreview v0.10.26

## macOS Dock 图标

- 在「设置 → 通用」关闭「显示 Dock 图标」，即可隐藏 Dock 和应用切换列表中的瞬览图标。[#11](https://github.com/likehao19/SpacePreview/issues/11)
- Dock 图标与菜单栏图标分别设置，重启后保留。两个图标都隐藏时，仍可从 Spotlight 或「应用程序」再次打开瞬览。

## 文件保存后重新加载

- 当前预览的本地文件被外部修改后，右下角提示「文件已更新」。点击「重新加载」后更新内容，并尽量保留滚动位置。[#12](https://github.com/likehao19/SpacePreview/issues/12)
- 连续保存合并为一条提示。原文件变得不可读、移除或改名时，显示对应状态。
- 可在「设置 → 预览」切换为自动刷新或关闭检查。

## 安装与更新

提供 Windows x64 安装程序、macOS Intel 和 Apple Silicon DMG、Linux x64 DEB 和 AppImage，以及签名更新包和 SHA-256 校验文件。可在应用内检查更新或从官网下载。[官方下载](https://spacepreview.likh.cn/#download)

macOS 使用临时签名。Linux 应用内更新适用于 AppImage，DEB 用户可下载新安装包升级。
