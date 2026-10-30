# 本机历史版本浏览

需要 Node.js 24、Git 和 Windows PowerShell。完整克隆仓库后，双击本目录的 `打开网站历史版本.cmd`，或在仓库根目录运行：

```powershell
./tools/history/Start-History.ps1 -OpenBrowser
```

脚本从 `snapshot-2026-09-17` 标签展开旧源码到被 Git 忽略的 `releases/`，然后在后台启动目录与历史服务。当前应用如果未运行，也会启动。

| 页面 | 地址 |
| --- | --- |
| 历史目录 | http://127.0.0.1:4180/ |
| 9 月 17 日交互地球 | http://127.0.0.2:4174/#explore |
| 双语之前的真实截图 | http://127.0.0.1:4180/2026-10-29-before-language |
| 当前中文地球 | http://127.0.0.1:4173/?lang=zh-CN#explore |
| 当前英文地球 | http://127.0.0.1:4173/?lang=en#explore |
| 当前拼图 | http://127.0.0.1:4173/?lang=zh-CN#puzzles |

这些是本机地址，不是 GitHub 托管网页。服务器需保持运行。GitHub Pages 无法直接运行本应用的 Node/SQLite 后端。

旧版使用 `runtime/2026-09-17/` 下的独立演示数据库，AI 关闭。不同回环主机隔离旧版与当前版的 Cookie。不会复制或修改当前私人资料。

如果下载的是不含 `.git` 和标签的源代码 ZIP，请改用 `git clone https://github.com/maylee1190/AniKind.git`。浅克隆缺少标签时先运行 `git fetch --tags`。

`-VerifyAssets` 会检查旧版公共资源、物种接口和当前拼图接口。日志与 PID 位于 `runtime/logs/`。
