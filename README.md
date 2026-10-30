# AniKind

根据 Parallel Life PRD v0.9 和 AniKind UI 设计规范 v1.0 实现的本地全栈 MVP。移动端优先，支持中文 / English；桌面双栏自适应。前端为原生 JavaScript ES Modules + CSS，后端为 Node.js 24 + SQLite，无 npm 运行依赖。

## 运行

在当前目录执行：

```powershell
node --env-file-if-exists=.env server/index.mjs
```

或运行 `./Start-AniKind.ps1`，然后打开 [本地应用](http://127.0.0.1:4173/#explore)。脚本检测已运行的服务，否则在隐藏后台进程启动，日志保存在 `data/logs`；需要前台调试时传 `-Foreground`。默认只监听本机，关闭浏览器不会关闭服务。数据保存在 `data/anikind.sqlite`，重启不会丢失；电脑重启后需再次运行脚本。

`package.json` 也提供 `start`、`dev`、`test`、`check` 脚本。无需 `npm install`。

```powershell
node scripts/check.mjs
node --test --test-concurrency=1 tests/*.test.mjs
```

测试使用操作系统临时目录中的独立数据库，结束后清理，不修改使用中的资料库。

## 已实现

- 中文 / English 切换、浏览器语言记忆、中英文和学名检索；40 条物种资料及 31 个拼图知识卡提供英文。切换保留地球视角、筛选和已保存的拼图进度，私人输入保持原文。见 [双语实现](docs/LANGUAGES.md)。
- 邮箱密码注册与登录、成年用户说明、HttpOnly 会话、退出失效、密码 scrypt 哈希、登录限频、同源请求验证。
- 最多 3 个私有宠物档案、可见字符计数、可选日期、日期校验、头像、资料编辑和切换。
- 素材实际文件签名检查、逐文件上传进度、账号内去重、用户 / 宠物归属校验、存储限额、受鉴权的媒体读取和 Range 请求。
- 真实记忆创建、日期排序、检索、收藏、相册、详情、版本冲突检测、文字草稿恢复、单条导出。
- 创作任务持久化、提交幂等、并发限制、每日额度、取消 / 失败返额、预览确认、拒绝、7 天预览过期处理。
- 纪念形象与旅行明信片流程，参考照片主动选择，来源和创作标识保留；AI 内容编辑不会改变内容类别。
- Natural Earth 1:50m 陆地正射投影、Figma 原始动物图标、拖动与惯性旋转、滚轮 / 双指 / 按钮缩放、键盘旋转、南北极、地区切换和复位；40 条历史物种档案、33 个设计绑定（其中 31 个显示为动物标记）、名称和学名检索、地区 / 范围 / 等级筛选。
- 物种详情、来源和日期、附加地域评估、外链离站说明、用户报错。
- 拼图解锁知识卡：仅包含交互地球上有图标的 31 种动物，沿用 Figma 拼块轮廓，全部使用对应物种实拍；拖放、点选交换、键盘、完整照片参考、提示、断点续玩和卡片收藏，支持手机与电脑。
- 素材处理与 AI 授权记录、暂停创作、隐藏创作、生态推荐和通知偏好。
- 带密码复核的后台导出、24 小时下载期限、完整素材和 JSON 清单、可见标识的创作图片。
- 单个素材、档案和账户删除；关联创作、任务、头像引用和导出快照清理；第三方删除未确认时保留待处理状态。
- 内容编辑 / 审核 / 管理员分权、证据必填检查、禁止自审、发布 / 退回 / 下架、历史版本恢复为草稿、纠错处理、生成服务开关与审计。
- 320 / 402 / 840 / 1280 宽度适配、实体正文承载面、48px 控件目标、原生模态焦点、减弱动效、离线提示。

## 当前运行模式

仓库不包含本机 `.env`。未配置时 AI 功能关闭；开发环境可设置 `AI_MODE=demo` 和 `DEMO_CONTENT=true` 体验本地模板演示。页面显式标注：

1. **创作是本地模板演示。** 固定文字及 Figma 配图用于验证排队、预览和确认，不是模型生成，也不会还原上传的宠物。可将 `AI_MODE=disabled` 关闭。真实供应商接入见 [AI 服务契约](docs/AI_PROVIDER.md)。
2. **地球收录此前 ChatGPT 图谱保存的 40 条历史物种资料。** 33 条记录与 Figma 素材绑定，其中 2 个空占位不显示，地球实际显示 31 个动物标记。其余记录保留在资料列表。分类沿用原物种表，正式评估日期和发布许可留空；生产模式不公开未审核示例。原有大熊猫编辑示例不在这个 40 种集合中。对应表与限制见 [地球实现记录](docs/GLOBE_IMPLEMENTATION.md)。
3. **邮箱密码可用；未接入邮件验证、找回密码、短信或系统推送。** 通知开关保存偏好，任务结果通过应用内状态查询呈现。
4. **照片可直接存档。** 音视频在配置 `FFPROBE_PATH` 后启用时长校验；未配置时拒绝上传并说明原因。HEIC 原件可以保存，但显示取决于浏览器支持。
5. **离线支持当前会话已载入的文字与草稿。** 未实现 Service Worker 离线冷启动、媒体离线包、多设备离线合并或分片续传；网络恢复后可按文件重试并去重。原始图片不做公开分发。

本版本是可运行开发 MVP，不是 PRD 全部生产发布门槛的验收结论。尚需真实 AI 供应商联调、授权内容、生产存储与备份、HTTPS 部署、负载与恢复演练、真机读屏及隐私流程验收。P1 / P2 的 Vlog、通话、支付、商城与社交没有纳入本版。拼图交互及当前范围见 [拼图实现记录](docs/PUZZLE_IMPLEMENTATION.md)。

## 内容后台

先通过应用注册两个独立账号，再由本机操作者授予角色：

```powershell
node --env-file-if-exists=.env scripts/role.mjs editor@example.com editor
node --env-file-if-exists=.env scripts/role.mjs reviewer@example.com reviewer
# 如需运营开关，将受信任账号设为 admin
node --env-file-if-exists=.env scripts/role.mjs operator@example.com admin
```

刷新后进入「我的 → 内容管理」，或打开 [内容后台](http://127.0.0.1:4173/#admin)。角色只能经本地 CLI 配置；普通注册接口不能授予后台权限。管理员同样不能发布自己编辑的内容。

内容被下架后，公开 API 即时停止提供；恢复历史版本只产生草稿，仍需重新审核。未提供绕过审核直接公开的按钮。

## 路由与代码

主页面：`#memorial`、`#album`、`#explore`、`#puzzles`、`#settings`、`#admin`。
深链接：`#pet/<id>`、`#memory/<id>`、`#species/<id>`、`#puzzle/<id>`。私人链接仍要求本人登录。

```text
server/
  app.mjs          HTTP 路由、业务约束、内容审核、导出与删除
  core.mjs         SQLite、版本控制、校验与事务
  auth.mjs         登录、密码、会话与角色
  generation.mjs   生成状态机、供应商适配、额度
  media.mjs        类型 / 时长检查、归档、创作标识
  seed.mjs         场景与编辑示例
public/
  styles.css      设计语义 Token 与响应式组件
  js/app.js       路由、表单、交互、草稿、任务轮询
  js/views.js     页面与组件
  js/api.js       请求、上传与错误
  globe.css       Figma 地球页面与响应式布局
  js/globe.js     Canvas 地球、拖动 / 缩放 / 标记交互
  js/globe-math.js 经纬度投影与设计标记坐标换算
  assets/         本地 Figma 原始资源与地图
tests/            权限、状态机、生命周期、发布链路集成测试
docs/             API、供应商契约、需求追踪和验证记录
```

SQLite 中 `users` / `sessions` 独立存储；`records` 使用类型、所有者、宠物、状态、版本等索引列加 JSON 负载；素材原件存在 `blobs`。所有私人读取由后端 `owned()` 检查。此设计适合单实例开发环境；大体量媒体、分布式任务、并发实例需迁移到对象存储、专用任务队列与合适的关系数据库。

## 数据与部署说明

新加坡部署的 Docker、Compose、Caddy HTTPS 配置和操作步骤已准备好，见 [部署说明](docs/SINGAPORE_DEPLOYMENT.md)。尚未购买域名、开通服务器或发布公网地址。运行 `./scripts/package-deployment.ps1` 可生成不含本机数据库和密钥的部署压缩包。

将 `.env.example` 复制成 `.env` 配置。正式环境必须设置 `NODE_ENV=production`、`DEMO_CONTENT=false`，且不得启用 `AI_MODE=demo`；否则服务器拒绝启动。生产使用 Secure Cookie，需在 HTTPS 反向代理之后运行并保留请求 Host。

没有自动配置备份，因此界面明确显示「未配置备份」。需要备份时应设计删除墓碑、备份保留和恢复清理流程；不能仅复制旧库后对外恢复。导出当前采用单进程内构建 gzip / tar，较大媒体集合需改为流式对象存储导出后再扩大规模。

所有测试用名字、邮箱和记录都是本地测试数据。无真实付款、外部通知、对外发布或供应商调用。

## 设计与资料来源

视觉依据为项目 `output/design-spec/AniKind-UI设计规范-v1.0.md` 与 `anikind-tokens.json`。主导航采用 PRD 的「纪念 / 探索 / 我的」；设计规范中建议的品牌色、深紫操作色、系统中文字体、稳定内容面与悬浮导航已落地。未打包授权未知的 Sekuya 字体。

宠物和场景图、导航图标直接下载自 [Figma 宠物主页 289:204](https://www.figma.com/design/UocyNNHftoeYl1Q6DxGmez/ui?node-id=289-204)，不是截图铺底。资源使用记录见 [ASSETS.md](docs/ASSETS.md)。

生态示例的简短摘要分别核对 [WWF 大熊猫](https://www.worldwildlife.org/species/giant-panda/)、[WWF 虎](https://www.worldwildlife.org/species/tiger/)、[WWF 非洲森林象](https://www.worldwildlife.org/species/elephant/african-elephant/african-forest-elephant/) 页面；核对日为 2026-09-16，未把网页读取日期当作物种评估日期。

## 迭代与历史版本

- [迭代索引与完整记录](docs/iterations/README.md)
- [历史版本启动工具](tools/history/README.md)
- [技术关系图](docs/iterations/technical.png) / [硬件与终端关系图](docs/iterations/hardware.png)
- `snapshot-2026-09-17` 标签保留原始部署源码；`main` 保存当前实现。提交时间为归档上传时间，不伪造历史开发日期。
