# 官方下载与自动更新运维

## 生产入口

- 官网：`https://spacepreview.likh.cn/`
- 应用更新清单：`https://spacepreview.likh.cn/downloads/latest.json`
- 官网版本/更新说明：`https://spacepreview.likh.cn/downloads/release.json`
- 校验清单：`https://spacepreview.likh.cn/downloads/SHA256SUMS.txt`
- 固定版本文件：`/downloads/v0.10.23/SpacePreview-0.10.23-<平台文件后缀>`。
- 无脚本/检查失败的备用下载：`/downloads/latest/SpacePreview-windows-x64-setup.exe`、`SpacePreview-macos-x64.dmg`、`SpacePreview-macos-arm64.dmg`、`SpacePreview-linux-x64.AppImage`、`SpacePreview-linux-x64.deb`。

所有入口都要求可信 HTTPS。版本接口、清单和包均 `Cache-Control: no-store`；首页及入口 JS 重新验证缓存。包路径携带版本号，旧路径在清理后返回 404，绝不会指向另一个版本。已经打开的 Nginx 下载文件描述符不受删除影响；切换前取得旧清单、切换后才下载的请求可能 404，应重新检查更新。历史安装包继续由 GitHub Release 提供。

## 发布与凭据

`release.yml` 保留 GitHub Release。四个平台成功后生成完整清单、四份签名、五种安装包、两种 Mac 更新归档和 `SHA256SUMS.txt`，全部上传 GitHub 后执行 `scripts/upload-release.sh`。上传失败让 CI 明确报错，GitHub Release 仍保留，服务器补同步可自行恢复。

Actions Secrets：`SPACEPREVIEW_DEPLOY_HOST`、`SPACEPREVIEW_DEPLOY_KEY`、`SPACEPREVIEW_DEPLOY_KNOWN_HOSTS`。更新签名仍为原来的 `TAURI_SIGNING_PRIVATE_KEY`，不能轮换为新公钥。

部署使用独立 `spacepreview-deploy` 系统账号与独立 Ed25519 SSH 密钥。公钥在 root 拥有且部署用户不可写的 `/var/lib/spacepreview-deploy/.ssh/authorized_keys` 中，设置 `restrict` 和强制接收命令，只允许 `receive v数字.数字.数字`，禁止任意 shell、PTY、转发和用户 rc。账号不能修改同步程序、服务或 Nginx 配置，无 sudo 权限。CI 使用专用 `known_hosts`、`StrictHostKeyChecking=yes`、`IdentitiesOnly=yes`，不使用管理员密钥。主机密钥变化时停止，须经已信任渠道复核再更新 Secret，不能自动 keyscan 接受新密钥。

SSH 专用密钥可独立轮换：生成新密钥，将带相同限制的公钥安装到该账号后验证，更新 Actions Secret，撤销旧公钥，并清理所有临时私钥副本。不得打印、提交私钥或在参数中传递私钥内容。

该账号整个 home（包括 shell 启动文件）由 root 所有，账号不能通过修改初始化脚本绕过强制命令。服务器只保存公钥，不保存 Actions 部署私钥或 Tauri 更新签名私钥。

## 服务器与互斥

- 主机 SSH 别名：`likh`；沿用已有宝塔 Nginx、HTTPS、站点登记和证书续期。
- 站点根目录：`/www/wwwroot/spacepreview.likh.cn`。
- 原 vhost：`/www/server/panel/vhost/nginx/html_spacepreview.likh.cn.conf`。
- 本站扩展：`/www/server/panel/vhost/nginx/extension/spacepreview.likh.cn/spacepreview-downloads.conf`。
- root 只读程序：`/opt/spacepreview-release-mirror/release_mirror.py`。
- 数据：`/srv/spacepreview-downloads`，`current -> releases/v版本`；Nginx 仅公开 `current` 内容。
- 临时数据：`staging`（700），位于 webroot 外；共享锁 `sync.lock`。
- 定时器：`spacepreview-release-sync.timer`，`OnCalendar=*:0/30`，持久化补执行；服务 `spacepreview-release-sync.service`。

上传与拉取都在同一个非阻塞 flock 内进行；其他任务占锁时失败退出，CI 有限重试，定时器下轮继续。只有持锁任务能清理遗留文件、判断当前版本和发布，因此迟到的旧任务无法覆盖新版本。定时拉取只查询 GitHub 最新已发布正式版，元数据缺包/尺寸不合理则拒绝，不拉取不完整版本。稳定版本按三段数字比较，不依赖文件名字符串顺序。

每个文件以 64 KiB 块下载，SHA-256 / Blake2b 以块处理；上限单文件 1 GiB、总版本 2 GiB、元数据 2 MiB、网络单次读取 30 秒、任务 30 分钟。systemd 限制内存 256 MiB、CPU 25%、16 个任务；接收进程另外设 256 MiB 地址空间、180 CPU 秒、30 分钟墙钟和低优先级。大更新包要求现有 ED 预哈希 Minisign 格式，不将整包读进内存。

完整检查包括：13 个必须资产、GitHub 声明大小/摘要、完整 SHA256SUMS、四个平台清单、版本/URL/签名对应关系，以及原公钥对内容与 trusted comment 的真实 Ed25519 验证。Minisign 格式依据[官方规范](https://jedisct1.github.io/minisign/)。临时 tar 禁止路径穿越、符号链接、重复/额外文件和超限文件。旧版 GitHub 清单被重写为官方服务器 URL 后，重算公开清单哈希。

检查完成后 fsync 文件/目录，原子替换 `current`，之后只保留当前一个版本。失败清理临时目录并保留当前版本。SIGTERM/超时尽量清理，SIGKILL/掉电遗留在下次持锁任务中回收；切换后的旧目录也在下次任务回收。不会在验证前删除正在服务的版本。

## 检查与恢复

```sh
ssh likh 'systemctl status spacepreview-release-sync.timer --no-pager'
ssh likh 'journalctl -u spacepreview-release-sync.service -n 40 --no-pager'
ssh likh 'systemctl start spacepreview-release-sync.service'
ssh likh 'readlink /srv/spacepreview-downloads/current; du -sh /srv/spacepreview-downloads'
curl --fail https://spacepreview.likh.cn/downloads/latest.json
```

`deploy/install-server.sh` 在改动本站之前创建 `/srv/spacepreview-backups/<UTC时间>/`（700），内含 `website.tar.gz`、原 vhost、扩展目录及已有同步程序/单元。首次部署备份为 `/srv/spacepreview-backups/20261110T045317Z`。备份不保存历史安装包，历史包留在 GitHub。

回退站点配置：先停止本项目 timer/service；保留下载 `current` 及程序数据，备份现场。还原 `website.tar.gz` 到本站根目录、还原本站 vhost 与扩展目录，执行 `/www/server/nginx/sbin/nginx -t` 后才平滑 reload。只恢复本站文件，不覆盖其他业务。新客户端仍依赖官方更新地址，因此一般只回退页面/配置问题，不撤除有效下载路由。

只回退官网页面的示例（在服务器 root 会话执行，不会降低客户端发布版本）：

```sh
systemctl stop spacepreview-release-sync.timer spacepreview-release-sync.service
tar -xzf /srv/spacepreview-backups/20261110T045317Z/website.tar.gz -C /www/wwwroot/spacepreview.likh.cn
# 保留有效 downloads 扩展、current 和数据；如需恢复 vhost，先备份现场并仅恢复本站配置。
/www/server/nginx/sbin/nginx -t && /www/server/nginx/sbin/nginx -s reload
systemctl enable --now spacepreview-release-sync.timer
```

包同步故障无需回退版本，修复网络/磁盘/权限后启动 service 即可；它会回收临时文件并重试最新正式版。若文件系统已损坏，应停止本项目同步，将损坏目录隔离留作调查，用原公钥与同一验证程序从 GitHub 重建最新正式版，验证后恢复下载路由。禁止绕过验签、关闭 TLS/主机校验或自动降级。

初始安装运行服务器补同步，再发布 v0.10.23 验证 CI 主动上传；以 journal 的定时触发、完整包公网 SHA-256 和真实网页访问作为验收证据。Windows/macOS/Linux 全平台真实安装升级仍需对应机器；构建、签名校验、下载完整性与更新器界面测试不能替代全部实机安装。

本次实测记录见 [2026-11-10 部署验收](official-downloads-verification-2026-11-10.md)。公开下载验证可重跑 `python3 scripts/verify-official-downloads.py`；它会从公网下载全部平台包，检查服务器 SHA-256、GitHub 原包摘要和四份更新签名，完成后清理临时下载。该脚本使用系统 curl 的可信 TLS，不关闭证书校验。

## 旧客户端迁移

v0.10.22 及以前的客户端将 GitHub 更新地址编译在程序内，服务器不能改写已经安装的二进制。它们至少需要成功访问一次 GitHub 更新清单，或手动安装官网提供的 v0.10.23。过渡版本的清单仍发布在 GitHub，实际包 URL 指向官网；完成升级后检查、说明和下载全部使用官网域名。GitHub 公开版本与官方同步之间若有短暂间隔/上传失败，旧客户端的首次下载可能暂时失败，补同步完成后重新检查即可。新客户端只看到服务器已完整切换的版本。
