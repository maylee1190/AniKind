# AI 供应商适配契约

`disabled` 不创建任务。`demo` 仅用于本地流程演示，输出固定文本和设计配图。`http` 通过服务端 HTTPS 调用已授权供应商网关；客户端永远不会收到密钥。

```dotenv
NODE_ENV=production
DEMO_CONTENT=false
AI_MODE=http
AI_ENDPOINT=https://your-authorized-gateway.example/generations
AI_API_KEY=your-server-side-key
AI_MODEL=your-model-version
AI_DAILY_LIMIT=5
AI_PLATFORM_DAILY_LIMIT=100
```

这里定义的是项目网关协议，不能直接假设与某家厂商 API 相容。需由供应商适配层完成协议转换、权限与内容审核，再开启真实处理。未实际对任何供应商进行端到端调用测试。

## 创建

服务端发送 `POST AI_ENDPOINT`，带 `Authorization: Bearer ...` 和 `Idempotency-Key: jobId`。请求结构：

```json
{
  "jobId": "uuid",
  "model": "configured-model",
  "kind": "postcard",
  "scene": "meadow",
  "tone": "third",
  "petName": "宠物名字",
  "instruction": "明确虚构纪念内容、不得冒充真实共同记忆等约束",
  "assets": [{"id":"asset-uuid","mime":"image/png","base64":"..."}]
}
```

仅发送用户主动勾选、当前宠物所属、至少 256×256 的 JPEG / PNG 原始照片。明信片至少 1 张，形象至少 3 张，最多 10 张。存档音视频不发送。供应商必须遵守素材用途、删除和不用于通用训练的约定。

成功返回：

```json
{
  "moderation": "approved",
  "title": "一封来自草地的想象来信",
  "body": "明确虚构的中文第三人称内容",
  "imageBase64": "PNG 或 JPEG 的 base64",
  "model": "实际模型版本"
}
```

HTTP 非成功、审核未批准、格式不合法、超过大小限制、300 秒超时均失败并返还预占额度。响应 JSON 最大 30 MB，图片最大 20 MB。网关必须完成模型安全审核和可核验的质量控制；`moderation` 是协议字段，不等于平台独立审核已完成。

状态：`queued → generating → reviewing → ready → accepted / rejected`。取消后迟到响应无法入库。进程重启对遗留执行任务标为失败并退款，不自动重复向供应商发送可能重复收费的请求。

## 删除

当删除已发送供应商处理的参考素材、档案或账户时，调用：

```text
DELETE {AI_ENDPOINT}/{jobId}
Authorization: Bearer ...
```

仅供应商确认删除的成功响应才标记 `providerState=completed`。失败保持 `pending` 并每 30 秒重试；本地访问立即停止。网关应实现幂等删除，并确保响应代表关联输入与输出均按约定清除。单纯 HTTP 202 不能代表最终清除完成，网关应在最终清除后返回 200 / 204。

## 上线前补齐

真实供应商许可、地域与保留期限；图像质量及故事审核评估集；市场所需隐式标识；按供应商实际账单记录费用；日金额预算熔断（当前是任务次数上限）；监控、供应商取消、长任务回调签名与延迟结果删除核对。
