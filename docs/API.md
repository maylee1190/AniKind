# API 开发契约

所有路径以 `/api` 开头。JSON 响应编码 UTF-8。私人 API 返回 `Cache-Control: no-store`；使用 HttpOnly / SameSite=Strict 会话 Cookie。生产模式追加 Secure。

所有 POST / PATCH / DELETE 都要求 `X-AniKind: 1`，且存在 Origin 时必须与 Host 一致。无跨域允许头。前端上传为二进制请求体，其他变更为 JSON。

## 公共及账号

| 方法与路径 | 说明 |
| --- | --- |
| GET `/health` | 服务健康状态 |
| GET `/config` | 场景、演示状态、供应商是否开启、媒体校验能力；不含密钥 |
| GET `/session` | 当前账号，未登录为 `user: null` |
| POST `/auth/register` | `email, password, name, adult: true` |
| POST `/auth/login` | `email, password` |
| POST `/auth/logout` | 删除服务端会话并清除 Cookie |
| GET `/species?q=&region=&scope=&category=` | 名称 / 英文 / 学名检索、同步筛选、去重总数、口径和数据集标识 |
| GET `/species/:id` | 仅已发布资料或开发模式示例 |

## 私人记忆

| 方法与路径 | 输入 / 返回 |
| --- | --- |
| GET / POST `/pets` | 列表 / 创建；`name, species, breed, traits, birthDate, memorialDate, location, description` |
| GET / PATCH `/pets/:id` | 读取 / 更新；更新带完整可编辑字段及 `version`，可指定自己的原始 `avatarId` |
| DELETE `/pets/:id` | `confirm: 宠物名称, password`，返回删除任务 |
| GET `/assets?petId=` | 所有原始 / 生成素材元数据 |
| POST `/assets?petId=&name=` | 二进制上传；真实格式检查、时长检查、同宠物去重 |
| GET `/assets/:id/content` | 每次验证所有权；支持字节范围读取 |
| DELETE `/assets/:id` | 删除素材及关联创作、移除引用、撤销导出快照，返回删除任务 |
| GET `/memories?petId=&q=&kind=&favorite=&sort=` | 当前宠物检索，`sort=newest/oldest`，未知日期置于末尾 |
| POST `/memories` | `petId,title,body,eventDate,assetIds`；必需 `Idempotency-Key` 请求头 |
| GET / PATCH `/memories/:id` | 更新 `title,body,eventDate,favorite,version`；类型不可伪造为 original |
| DELETE `/memories/:id` | 删除记录，原始素材仍保留，支持素材库单独清理 |
| PATCH `/settings` | 支持 processingConsent、aiConsent、pauseAI、hideAI、ecoRecommendations、notifications、name；读取使用 `/session` |
| GET `/consents` | 当前用户授权变更历史 |

`species` 枚举为 `dog/cat/other/unknown`。日期使用 `YYYY-MM-DD` 或 `null`，不做时区换算。修改必须提供当前版本，不匹配返回 409。

## 生成与数据生命周期

| 方法与路径 | 输入 / 返回 |
| --- | --- |
| POST `/jobs` | `petId,kind,scene,tone,assetIds,subjectConfirmed`；必需 `Idempotency-Key` |
| GET `/jobs` | 当前任务及每日 quota |
| GET `/jobs/:id` | 同一个稳定任务 ID 的状态 |
| POST `/jobs/:id/cancel` | 取消非终态任务并返额，重复操作不重复结算 |
| POST `/jobs/:id/accept` | 接受 ready 结果；头像替换或创建 generated 记忆 |
| POST `/jobs/:id/reject` | 拒绝 ready 预览，删除预览资产 |
| POST `/exports` | `password, petId?`；返回 202 + export ID |
| GET `/exports` | 当前账户的导出状态与到期时间 |
| GET `/exports/:id/download` | ready 且未过期的本人导出包 |
| GET `/deletions` | 本地、供应商、备份处理状态 |
| DELETE `/account` | `confirm: 删除我的账户, password`；立即撤销会话并返回删除状态 |
| POST `/reports` | `speciesId,reason`；只进入纠错审核，不直接覆盖内容 |

归档为 gzip 压缩的 USTAR，包含 UTF-8 `manifest.json` 和素材；素材使用安全 ID 文件名，中文原名保留在清单。生成图片导出为包含可见创作说明的 SVG。应用内单条记忆也可导出 PNG + JSON。

## 内容后台

| 方法与路径 | 权限与行为 |
| --- | --- |
| GET `/admin/content` | editor / reviewer / admin，公开内容工作台及纠错 |
| POST `/admin/content` | editor / admin 创建草稿 |
| PATCH `/admin/content/:id` | editor / admin 编辑未发布内容，带 version |
| POST `/admin/content/:id/submit` | editor / admin，校验证据完整后进入 pending |
| POST `/admin/content/:id/publish` | reviewer / admin，禁止审核自己的编辑内容 |
| POST `/admin/content/:id/reject` | reviewer / admin，需要 reason |
| POST `/admin/content/:id/withdraw` | reviewer / admin，下架并记录 reason |
| GET `/admin/content/:id/versions` | 历史快照与操作者 |
| POST `/admin/content/:id/restore` | editor / admin，`snapshotId, version, reason`，只恢复为草稿 |
| GET `/admin/audit` | 最近 100 条后台审计记录 |
| PATCH `/admin/reports/:id` | reviewer / admin，`resolution` |
| PATCH `/admin/generation` | admin，`enabled, reason` |

所有审核动作携带 version。Source URL 仅允许 HTTPS。首次或后续发布均需来源、许可、地区、评估体系、日期和版本。附加地域评估用 `assessments` 数组，不覆盖主评估。

## 错误响应

```json
{"error":{"code":"VERSION_CONFLICT","message":"内容已更新，请重新打开后再修改","fields":{"currentVersion":2},"traceId":"uuid","retryable":false}}
```

401 未登录 / 重新认证失败；403 角色或来源不允许；404 不存在或无所有权；409 版本 / 幂等冲突；410 已删除 / 已过期；413 大小超限；422 校验失败；429 限频 / 额度；503 功能关闭或依赖未配置。

目前所有列表使用单实例完整结果，尚未实现大规模数据游标分页。扩大数据量前需补分页与负载验证。
