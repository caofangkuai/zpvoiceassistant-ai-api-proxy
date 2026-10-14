# iot-ai-proxy

面向 **iot-study 助手** 上游（`com.zuoyebang.iot.pad.zpvoiceassistant`）的
OpenAI 兼容 API 反向代理，运行在 Cloudflare Workers 上。

它接收标准 OpenAI `/v1/chat/completions` 请求，转换为上游 `chat` 协议（包括逆向
得到的请求签名），并把上游 SSE 流式转换回 OpenAI chunk 格式。上游会话状态以
`chatId` 为键，因此代理同时提供会话连续性与历史回填能力。

## 功能特性

- OpenAI 兼容的 `GET /v1/models` 与 `POST /v1/chat/completions`。
- 流式（SSE）与非流式响应。
- 推理模型：`deepseek-r1` 会把上游 `reasonContent` 映射为 OpenAI 的
  `reasoning_content`（流式 delta + 非流式 message 字段）。
- 公开凭证模式：每个调用方通过 API key 自带设备凭证（`secret-sn`），worker 中不存
  放任何设备相关参数；token 由代理自动登录获取并缓存。
- 以 `chatId` 为键的会话连续性；多轮对话使用确定性 chatId，新会话使用全新
  chatId。
- 历史回填：当客户端在单次请求中携带完整消息历史时，代理会把更早的轮次逐条回放
  到上游线程（基于 KV，可选）。
- 清空上下文：通过 `x-iot-new-chat: true` 或包含 `[new_chat]` 的 system 消息。
- 首轮注入系统提示词（默认人格 + 中文回复）。
- 上游强制要求：发送给 AI 的聊天文本自动全部转为 Unicode 转义（`\uXXXX`），
  请求体为纯 ASCII；转义在签名之前完成，保证签名与请求体一致。
- 上游错误以 OpenAI 错误格式透传。
- 已启用 CORS，供浏览器客户端使用（反射 Origin 与请求头）。
- 内置中文 Web 调试主页（`/`）：secret/sn 生成 API Key、拉取模型列表、白天/黑夜主题
  切换、完整接口地址显示、聊天调试与实时指标。
- Token 用量记录：按 `sn` 累计请求数、输入/输出 token（KV，30 天），可用
  `GET /v1/usage` 查询。

## 接口

| 方法 | 路径 | 说明 |
| ---- | ---- | ---- |
| GET  | `/`、`/ui` | 中文 Web 调试主页（无需鉴权）。 |
| GET  | `/health` | 健康检查（无需鉴权）。 |
| GET  | `/v1/models` | 模型列表：`deepseek-v3`、`deepseek-r1`、`baike`。 |
| GET  | `/v1/usage` | 查询该 API Key 对应 `sn` 的累计 token 用量（需鉴权）。 |
| POST | `/v1/chat/completions` | OpenAI 对话补全（支持流式）。 |

## 鉴权

API key 支持两种形式：

### 1. `secret-sn`（推荐，最简单）

```
********************************-*************
```

代理会用 `sn` + `secret` 自动调用设备登录接口
（`iot-device/device/login`）获取 token，并缓存（按 `sn` + secret 指纹，TTL 12 小时）。

### 2. base64(JSON)（兼容/高级，可带额外覆盖项）

```json
{
  "secret": "********************************",
  "sn": "*************",
  "token": "<jwt>"
}
```

只有 `secret` 与 `sn` 必填；`token` 可选，省略时自动登录获取。可选覆盖字段（详见
`src/credential.js`）：`buildNum`、`buildTime`、`versionName`、`versionCode`、
`appName`、`romVersion`、`local`。

生成 base64 key：

```bash
node -e 'console.log(Buffer.from(JSON.stringify({secret:process.argv[1],sn:process.argv[2]})).toString("base64"))' \
  "********************************" "*************"
```

以 `Authorization: Bearer <key>` 发送（也支持 `x-api-key` / `api-key`）。

## 使用

### curl

```bash
# 设置你的 base64 API key
KEY="<你的-base64-key>"

# 非流式
curl http://127.0.0.1:8787/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $KEY" \
  -d '{"model":"deepseek-v3","stream":false,"messages":[{"role":"user","content":"你好"}]}'

# 流式
curl -N http://127.0.0.1:8787/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $KEY" \
  -d '{"model":"deepseek-v3","stream":true,"messages":[{"role":"user","content":"数到五"}]}'
```

### OpenAI SDK（覆盖 base URL）

```python
from openai import OpenAI

client = OpenAI(base_url="http://127.0.0.1:8787/v1", api_key="<你的-base64-key>")

resp = client.chat.completions.create(
    model="deepseek-v3",
    messages=[{"role": "user", "content": "你好"}],
)
print(resp.choices[0].message.content)
```

### 浏览器 / 网页前端

设置 base URL（包含 `/v1`）与 base64 key。CORS 由代理处理。隧道的开发服务器示例
base URL：

```
https://<你的隧道域名>/v1
```

## 会话与历史

上游按 `chatId` 保存状态。代理按以下优先级决定 chat ID：

1. `x-iot-chat-id` 请求头 —— 客户端显式固定会话。
2. 新会话信号 —— 生成全新 chat ID：
   - 请求头 `x-iot-new-chat: true`
   - 包含 `[new_chat]` 的 system 消息
   - 单条消息请求（仅一条非 system 消息）
3. 多轮历史 —— 由首条非 system 消息派生的确定性 chat ID，重复发送同一历史会复用
   同一上游线程。

选定的 chat ID 会通过 `x-iot-chat-id` 响应头返回，方便客户端持久化。

### 历史回填

当请求携带完整 OpenAI 历史（2 条及以上非 system 消息）时，代理会把更早的轮次
（除最后一条 user 消息外的全部）逐条回放到上游线程，再把最后一条消息作为实时轮次
发送。进度按 `(sn, chatId)` 记录在 KV 命名空间中，避免重复回放。

回填依赖 `HISTORY` KV 绑定；未绑定时自动跳过。

## 首轮系统提示词

在新会话的首个轮次，代理会在用户消息前注入一段系统指令（见
`src/openai.js` 中的 `FIRST_TURN_SYSTEM_PROMPT`）。修改该常量即可调整新会话的默认
人格与行为。

## 配置

`wrangler.toml`：

```toml
name = "iot-ai-proxy"
main = "src/index.js"
compatibility_date = "2024-09-23"

[vars]
UPSTREAM_BASE = "https://iot-admin.zuoyebang.com/iot-study/assistant"
DEFAULT_MODEL = "deepseek-v3"

[[kv_namespaces]]
binding = "HISTORY"
id = "<你的-kv-命名空间-id>"
```

创建 KV 命名空间并使用其真实 ID：

```bash
wrangler kv namespace create HISTORY
```

## 本地开发

```bash
# 全局安装 Wrangler CLI
npm install -g wrangler

# 在 http://127.0.0.1:8787 本地运行 worker
wrangler dev --port 8787
```

本地 KV 状态存放在 `.wrangler/state` 下。

## 部署

```bash
wrangler deploy
```

然后把 `wrangler.toml` 中 `HISTORY` 的 `id` 换成真实命名空间 ID，必要时再次部署。

## 项目结构

| 文件 | 用途 |
| ---- | ---- |
| `src/index.js` | 路由、鉴权、CORS、顶层错误处理。 |
| `src/openai.js` | OpenAI 请求/响应处理、流式、会话逻辑。 |
| `src/upstream.js` | 上游签名、请求构建、SSE 解析、模型映射。 |
| `src/credential.js` | base64 API key 解码与提取。 |
| `src/history.js` | 基于 KV 的历史回填。 |
| `src/models.js` | `/v1/models` 响应。 |
| `src/md5.js` | 纯 JS MD5 与签名计算。 |
| `src/cors.js` | 共享 CORS 头辅助函数。 |

## 错误格式

错误使用 OpenAI 结构：

```json
{ "error": { "message": "...", "type": "invalid_request_error", "param": null, "code": null } }
```

上游错误会透传，`errno` 作为 `code`，例如：

```json
{ "error": { "message": "Upstream: error.invalid.token", "type": "api_error", "param": null, "code": 20600013 } }
```

## 注意事项

- WebCrypto 不支持 MD5，因此使用纯 JS 实现（`src/md5.js`）。
- 签名 secret 是设备原生值，由调用方在凭证中提供，worker 中不存储。
- `error.invalid.token` 有时是上游的瞬时故障；先重试，再判断 token 是否失效。
