# 新加坡公网部署

当前状态：已准备部署文件。2026-09-17 用户表示暂时不需要付费资源，公网部署暂停；尚未购买服务器、注册域名或发布公网地址。127.0.0.1 只能用于本机。

## 所需资源

- 一台位于 Singapore 的 Linux 服务器，建议起步 2 GB 内存、有公网 IPv4，安装 Docker Engine 与 Compose。地域由云平台选择，不能通过改网页域名改变服务器地域。
- 你持有的域名。向新加坡服务器公网 IPv4 添加 A 记录；没有配置 IPv6 服务时不要添加 AAAA 记录。
- 云安全组开放 80/TCP、443/TCP；SSH 只允许管理员访问。应用 4173 端口不映射到公网。

本应用的地图、Figma 图标、脚本与系统字体均从同一站点或设备加载。首次打开不依赖 Figma、Google Fonts 或海外 JS CDN。新加坡部署本身不能保证所有中国网络都可达，上线后需从中国电信、联通、移动网络验证 DNS、HTTPS 和页面加载。

## 上线

将项目代码上传到新加坡服务器（排除本机 data、.env 和私人素材）：

Windows 上可运行 `./scripts/package-deployment.ps1`，使用生成的 `output/deploy/anikind-singapore-日期时间.zip`；压缩包采用明确的文件清单，只包含应用代码、公开资源、测试、部署模板和文档。它不包含本机 `.env`、数据库、上传的私人文件或参考视频。先解压，再执行：

```sh
cp deploy/.env.example deploy/.env
# 编辑 deploy/.env 中的 DOMAIN 为自己持有的域名。
docker compose --env-file deploy/.env config --quiet
docker compose --env-file deploy/.env up -d --build
docker compose --env-file deploy/.env ps
```

Caddy 自动申请与续期 HTTPS 证书并压缩资源，域名必须正确解析、80/443 端口可达。随后访问 https://你的域名/#explore。验证 https://你的域名/api/health 返回 status=ok。

## 内容模式与存储

- 部署模板默认 production，关闭 AI 模拟和历史示例。正式内容应通过现有编辑、审核流程发布后才出现在生产列表中；开发机的 40 条历史物种资料不会冒充已审核内容。需要公开演示环境时，应另外配置演示内容模式及明确标签。
- 首次注册两个内容工作人员账号后，在服务器分别运行 `docker compose --env-file deploy/.env exec app node scripts/role.mjs 编辑者邮箱 editor` 和对应的审核者 `reviewer` 命令；然后通过 `/#admin` 建立和审核物种条目。审核前的生产页面不会显示历史示例。
- SQLite 与私有素材在 anikind_data 持久卷中；重建容器保留数据。不要运行 docker compose down -v。
- 本机数据库包含私人内容，不会自动复制或上传。迁移需要单独确认来源和目标。
- 当前是单实例部署，不能让多个 app 容器同时写同一 SQLite 数据库。
- 备份时使用 SQLite 在线备份 API 或停应用后复制整个数据卷，不要仅拷贝正在写入的 .sqlite 文件而遗漏 WAL。

## 验证与更新

```sh
docker compose --env-file deploy/.env logs --tail=100 app web
docker compose --env-file deploy/.env up -d --build
```

更新前先备份数据卷。代码可回退到上一个镜像；数据库回退需要与备份版本匹配。购买费用、平台账号、域名名称及地域开通仍待用户确定，本地尚无 Docker 引擎，容器运行验证须在服务器完成。

参考：[Caddy reverse_proxy](https://caddyserver.com/docs/caddyfile/directives/reverse_proxy)、[Docker Compose 变量插值](https://docs.docker.com/compose/how-tos/environment-variables/variable-interpolation/)。
