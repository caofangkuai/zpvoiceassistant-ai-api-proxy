// Home page UI, adapted from turingevo/tiny-webui (MIT), localized to Chinese.
// Adds a secret/sn -> API key generator on top of the streaming chat client.

export function renderHome() {
  const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>iot-study AI 代理</title>
<link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@300;400;500;700&family=Syne:wght@400;700;800&display=swap" rel="stylesheet">
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/github-dark.min.css">
<script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/highlight.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/marked/12.0.2/marked.min.js"></script>
<style>
  :root {
    --bg-deep: #0a0a0f;
    --bg-panel: rgba(20, 20, 30, 0.85);
    --bg-input: rgba(15, 15, 25, 0.9);
    --amber: #ffb000;
    --amber-dim: #cc8800;
    --amber-glow: rgba(255, 176, 0, 0.15);
    --green: #00ff88;
    --green-dim: #00cc6a;
    --green-glow: rgba(0, 255, 136, 0.12);
    --cyan: #00d4ff;
    --cyan-glow: rgba(0, 212, 255, 0.12);
    --text: #e0e0e0;
    --text-dim: #888;
    --border: rgba(255, 176, 0, 0.2);
    --code-bg: #0d1117;
    --scan-opacity: 0.03;
    --vignette: rgba(0,0,0,0.4);
  }
  html[data-theme="light"] {
    --bg-deep: #f2f3f5;
    --bg-panel: rgba(255, 255, 255, 0.9);
    --bg-input: #ffffff;
    --amber: #b87400;
    --amber-dim: #9a6100;
    --amber-glow: rgba(184, 116, 0, 0.12);
    --green: #0a8f4d;
    --green-dim: #0a7a42;
    --green-glow: rgba(10, 143, 77, 0.1);
    --cyan: #0077b6;
    --cyan-glow: rgba(0, 119, 182, 0.1);
    --text: #1a1a1a;
    --text-dim: #666;
    --border: rgba(0, 0, 0, 0.14);
    --code-bg: #f6f8fa;
    --scan-opacity: 0;
    --vignette: rgba(0,0,0,0.05);
  }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body { height: 100%; overflow: hidden; background: var(--bg-deep); }
  body {
    font-family: 'JetBrains Mono', monospace;
    background: var(--bg-deep);
    color: var(--text);
    height: 100%;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }
  body::before {
    content: '';
    position: fixed;
    top: 0; left: 0; right: 0; bottom: 0;
    background: repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,var(--scan-opacity)) 2px, rgba(0,0,0,var(--scan-opacity)) 4px);
    pointer-events: none;
    z-index: 9999;
  }
  body::after {
    content: '';
    position: fixed;
    top: 0; left: 0; right: 0; bottom: 0;
    background: radial-gradient(ellipse at center, transparent 50%, var(--vignette) 100%);
    pointer-events: none;
    z-index: 9998;
  }
  .header {
    height: 60px;
    padding: 0 24px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    border-bottom: 1px solid var(--border);
    background: var(--bg-panel);
    backdrop-filter: blur(20px);
    flex-shrink: 0;
    z-index: 10;
  }
  .logo {
    font-family: 'Syne', sans-serif;
    font-weight: 800;
    font-size: 18px;
    letter-spacing: 2px;
    color: var(--amber);
    text-shadow: 0 0 20px var(--amber-glow);
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .logo-icon {
    width: 28px; height: 28px;
    border: 2px solid var(--amber);
    border-radius: 6px;
    display: flex; align-items: center; justify-content: center;
    font-size: 14px;
  }
  .header-stats { display: flex; gap: 24px; }
  .stat-item { display: flex; flex-direction: column; align-items: flex-end; }
  .stat-label { font-size: 9px; color: var(--text-dim); letter-spacing: 1px; text-transform: uppercase; }
  .stat-value { font-size: 15px; font-weight: 700; color: var(--green); font-variant-numeric: tabular-nums; }
  .stat-value.amber { color: var(--amber); }
  .stat-value.cyan { color: var(--cyan); }
  .main-container { flex: 1; display: flex; overflow: hidden; min-height: 0; }
  .sidebar {
    width: 280px; min-width: 200px;
    border-right: 1px solid var(--border);
    background: var(--bg-panel);
    display: flex; flex-direction: column; overflow-y: auto; flex-shrink: 0;
  }
  .sidebar::-webkit-scrollbar { width: 4px; }
  .sidebar::-webkit-scrollbar-thumb { background: var(--amber-dim); border-radius: 2px; }
  .settings-section { padding: 20px; border-bottom: 1px solid var(--border); }
  .settings-title {
    font-family: 'Syne', sans-serif;
    font-size: 12px; font-weight: 700; letter-spacing: 2px;
    text-transform: uppercase; color: var(--amber); margin-bottom: 16px;
  }
  .setting-item { margin-bottom: 14px; }
  .setting-label {
    font-size: 10px; letter-spacing: 1px; text-transform: uppercase;
    color: var(--text-dim); margin-bottom: 6px;
  }
  .setting-input {
    width: 100%;
    background: var(--bg-input);
    border: 1px solid var(--border);
    border-radius: 6px;
    padding: 10px 12px;
    color: var(--text);
    font-family: 'JetBrains Mono', monospace;
    font-size: 13px; outline: none; transition: border-color 0.2s;
  }
  .setting-input:focus { border-color: var(--amber); }
  textarea.setting-input { resize: vertical; }
  .hint { font-size: 10px; color: var(--text-dim); line-height: 1.6; margin-top: 6px; }
  .hint code { background: rgba(255,176,0,0.1); color: var(--amber); padding: 1px 5px; border-radius: 4px; }
  .mini-btn {
    margin-top: 8px; width: 100%; padding: 8px;
    background: transparent; border: 1px solid var(--border);
    border-radius: 6px; color: var(--amber);
    font-family: inherit; font-size: 11px; letter-spacing: 1px;
    cursor: pointer; transition: all 0.2s;
  }
  .mini-btn:hover { background: var(--amber-glow); border-color: var(--amber); }
  .live-metrics { padding: 20px; background: rgba(0, 255, 136, 0.03); border-top: 1px solid rgba(0, 255, 136, 0.12); }
  .metrics-title {
    font-size: 10px; letter-spacing: 1px; text-transform: uppercase;
    color: var(--green); margin-bottom: 12px; display: flex; align-items: center; gap: 6px;
  }
  .live-dot { width: 6px; height: 6px; background: var(--green); border-radius: 50%; animation: pulse 1.5s infinite; }
  @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
  .metric-row { display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid rgba(255,255,255,0.04); }
  .metric-row:last-child { border-bottom: none; }
  .metric-label { font-size: 11px; color: var(--text-dim); }
  .metric-value { font-size: 12px; font-weight: 500; color: var(--amber); font-variant-numeric: tabular-nums; }
  .metric-value.green { color: var(--green); }
  .metric-value.cyan { color: var(--cyan); }
  .progress-bar { height: 3px; background: rgba(255,255,255,0.08); border-radius: 2px; margin-top: 12px; overflow: hidden; }
  .progress-fill { height: 100%; background: linear-gradient(90deg, var(--green), var(--cyan)); transition: width 0.3s; }
  .sidebar-footer { margin-top: auto; padding: 16px 20px; border-top: 1px solid var(--border); }
  .clear-btn {
    width: 100%; padding: 10px; background: transparent;
    border: 1px solid var(--border); border-radius: 6px;
    color: var(--text-dim); font-family: inherit; font-size: 11px;
    letter-spacing: 1px; cursor: pointer; transition: all 0.2s;
  }
  .clear-btn:hover { color: var(--amber); border-color: var(--amber); }
  .chat-wrapper { flex: 1; display: flex; flex-direction: column; overflow: hidden; min-width: 0; }
  .messages-container { flex: 1; overflow-y: auto; padding: 20px 28px; }
  .messages-container::-webkit-scrollbar { width: 6px; }
  .messages-container::-webkit-scrollbar-track { background: transparent; }
  .messages-container::-webkit-scrollbar-thumb { background: var(--amber-dim); border-radius: 3px; }
  .empty-state {
    height: 100%; display: flex; flex-direction: column; align-items: center;
    justify-content: center; color: var(--text-dim); gap: 16px;
  }
  .empty-icon { font-size: 48px; opacity: 0.3; }
  .empty-text { font-size: 14px; letter-spacing: 1px; }
  .message { max-width: 80%; margin: 0 auto 16px; animation: msgIn 0.3s ease-out; }
  @keyframes msgIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
  .msg-role {
    font-size: 11px; letter-spacing: 2px; text-transform: uppercase;
    margin-bottom: 8px; display: flex; align-items: center; gap: 8px;
  }
  .msg-role::before { content: ''; width: 6px; height: 6px; border-radius: 50%; background: currentColor; box-shadow: 0 0 6px currentColor; }
  .msg-role.user { color: var(--cyan); }
  .msg-role.assistant { color: var(--green); }
  .msg-role.system { color: var(--amber); }
  .msg-content {
    background: var(--bg-panel); border: 1px solid var(--border);
    border-radius: 12px; padding: 16px 20px; line-height: 1.7;
    font-size: 14px; word-break: break-word;
  }
  .msg-content > :first-child { margin-top: 0; }
  .msg-content > :last-child { margin-bottom: 0; }
  .user .msg-content { background: rgba(0, 212, 255, 0.05); border-color: rgba(0, 212, 255, 0.15); }
  .assistant .msg-content { background: rgba(0, 255, 136, 0.03); border-color: rgba(0, 255, 136, 0.12); }
  .msg-stats {
    display: flex; gap: 16px; margin-top: 10px; padding-top: 10px;
    border-top: 1px solid rgba(255,255,255,0.05); font-size: 10px; color: var(--text-dim);
  }
  .msg-stats span { color: var(--amber-dim); }
  .reasoning-block {
    margin: 0 0 16px; border: 1px solid rgba(255, 176, 0, 0.2);
    border-radius: 8px; overflow: hidden; background: rgba(255, 176, 0, 0.04);
  }
  .reasoning-header {
    display: flex; align-items: center; gap: 8px; padding: 10px 14px;
    background: rgba(255, 176, 0, 0.08); cursor: pointer; user-select: none;
    font-size: 11px; letter-spacing: 1px; text-transform: uppercase;
    color: var(--amber); transition: background 0.2s;
  }
  .reasoning-header:hover { background: rgba(255, 176, 0, 0.14); }
  .reasoning-arrow { font-size: 10px; transition: transform 0.2s; }
  .reasoning-arrow.open { transform: rotate(90deg); }
  .reasoning-body {
    padding: 14px 18px; font-size: 12px; line-height: 1.7;
    color: var(--text-dim); white-space: pre-wrap;
  }
  .reasoning-body.hidden { display: none; }
  .reasoning-spinner {
    display: inline-block; width: 12px; height: 12px;
    border: 2px solid var(--amber-dim); border-top-color: var(--amber);
    border-radius: 50%; animation: spin 0.8s linear infinite; flex-shrink: 0;
  }
  @keyframes spin { to { transform: rotate(360deg); } }
  .msg-content h2 { font-size: 18px; margin: 16px 0 8px; color: var(--amber); }
  .msg-content h3 { font-size: 15px; margin: 14px 0 6px; color: var(--amber-dim); }
  .msg-content h4 { font-size: 13px; margin: 12px 0 4px; color: var(--amber); opacity: 0.8; }
  .msg-content ul, .msg-content ol { padding-left: 24px; margin: 8px 0; }
  .msg-content li { margin: 3px 0; }
  .msg-content blockquote {
    border-left: 3px solid var(--amber-dim); margin: 12px 0;
    padding: 8px 16px; background: rgba(255, 176, 0, 0.04);
    color: var(--text-dim); border-radius: 0 6px 6px 0;
  }
  .msg-content table { border-collapse: collapse; width: 100%; margin: 12px 0; font-size: 13px; }
  .msg-content th, .msg-content td { border: 1px solid var(--border); padding: 8px 12px; text-align: left; }
  .msg-content th { background: rgba(255, 176, 0, 0.1); color: var(--amber); font-weight: 600; }
  .msg-content td { color: var(--text); }
  .msg-content tr:nth-child(even) td { background: rgba(255, 255, 255, 0.02); }
  .msg-content a { color: var(--cyan); text-decoration: none; border-bottom: 1px solid transparent; transition: border-color 0.2s; }
  .msg-content a:hover { border-bottom-color: var(--cyan); }
  .msg-content hr { border: none; height: 1px; background: linear-gradient(90deg, transparent, var(--border), transparent); margin: 20px 0; }
  .msg-content strong { color: var(--amber); }
  .msg-content em { color: var(--cyan); }
  .msg-content code:not(pre code) {
    background: rgba(255, 176, 0, 0.12); color: var(--amber);
    padding: 2px 7px; border-radius: 4px; font-size: 13px; font-family: 'JetBrains Mono', monospace;
  }
  .code-block-wrapper {
    margin: 16px 0; border-radius: 12px; overflow: hidden;
    border: 1px solid rgba(255, 176, 0, 0.12); background: var(--code-bg);
  }
  .code-block-header {
    display: flex; justify-content: space-between; align-items: center;
    padding: 8px 16px; border-bottom: 1px solid rgba(255, 176, 0, 0.08);
  }
  .code-block-scroll-container { max-height: 500px; overflow-y: auto; overflow-x: auto; padding: 16px; line-height: 1.5; }
  .code-block-scroll-container::-webkit-scrollbar { width: 6px; height: 6px; }
  .code-block-scroll-container::-webkit-scrollbar-thumb { background: var(--amber-dim); border-radius: 3px; }
  .code-language {
    color: var(--text); font-weight: 500; font-family: 'JetBrains Mono', monospace;
    text-transform: uppercase; font-size: 11px; letter-spacing: 0.5px;
  }
  .code-block-actions { display: flex; align-items: center; gap: 8px; }
  .copy-code-btn, .preview-code-btn {
    display: flex; align-items: center; justify-content: center;
    width: 28px; height: 28px; padding: 0; background: transparent;
    border: none; border-radius: 4px; color: var(--text-dim);
    cursor: pointer; transition: all 0.2s;
  }
  .copy-code-btn:hover, .preview-code-btn:hover { color: var(--amber); transform: scale(1.05); }
  .copy-code-btn.copied { color: var(--green); }
  .code-block-wrapper pre { background: transparent; margin: 0; padding: 0; border: none; font-size: 13px; line-height: 1.5; }
  .code-block-wrapper pre code { background: transparent; padding: 0; }
  .code-preview-overlay { position: fixed; inset: 0; background: rgba(0, 0, 0, 0.8); z-index: 100000; display: none; }
  .code-preview-overlay.open { display: block; }
  .code-preview-content { position: fixed; inset: 0; width: 100dvw; height: 100dvh; z-index: 100001; }
  .code-preview-close {
    position: absolute; top: 16px; right: 16px; width: 36px; height: 36px;
    background: rgba(0,0,0,0.6); border: 1px solid rgba(255,255,255,0.2);
    border-radius: 8px; color: #fff; font-size: 18px; cursor: pointer;
    display: flex; align-items: center; justify-content: center; z-index: 100002; transition: all 0.2s;
  }
  .code-preview-close:hover { background: rgba(255,255,255,0.15); border-color: rgba(255,255,255,0.4); }
  .code-preview-iframe { display: block; width: 100%; height: 100%; border: 0; background: #fff; }
  .typing-cursor { display: inline-block; width: 2px; height: 14px; background: var(--green); animation: blink 0.8s infinite; vertical-align: middle; margin-left: 2px; }
  @keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0; } }
  .input-container { flex-shrink: 0; padding: 16px 28px 24px; border-top: 1px solid var(--border); background: var(--bg-panel); }
  .input-row { max-width: 800px; margin: 0 auto; display: flex; gap: 12px; align-items: flex-end; }
  .input-wrapper { flex: 1; position: relative; }
  textarea#msg-input {
    width: 100%; background: var(--bg-input); border: 1px solid var(--border);
    border-radius: 10px; padding: 14px 18px; color: var(--text);
    font-family: 'JetBrains Mono', monospace; font-size: 14px;
    resize: none; outline: none; min-height: 52px; max-height: 200px;
    transition: border-color 0.2s, box-shadow 0.2s;
  }
  textarea#msg-input:focus { border-color: var(--amber); box-shadow: 0 0 0 3px var(--amber-glow); }
  textarea#msg-input::placeholder { color: var(--text-dim); }
  .send-btn {
    width: 52px; height: 52px; background: var(--amber); border: none;
    border-radius: 10px; cursor: pointer; display: flex; align-items: center;
    justify-content: center; transition: all 0.2s; flex-shrink: 0;
  }
  .send-btn:hover { background: #ffc333; box-shadow: 0 0 20px var(--amber-glow); transform: scale(1.05); }
  .send-btn:active { transform: scale(0.95); }
  .send-btn:disabled { background: var(--text-dim); cursor: not-allowed; transform: none; box-shadow: none; }
  .send-btn svg { width: 20px; height: 20px; fill: var(--bg-deep); }
  @media (max-width: 768px) {
    .sidebar { display: none; }
    .messages-container { padding: 16px; }
    .input-container { padding: 12px 16px; }
  }
</style>
</head>
<body>

<header class="header">
  <div class="logo">
    <div class="logo-icon">⬡</div>
    iot-study AI 代理
  </div>
  <div class="web" style="font-size:11px;color:var(--text-dim);display:flex;align-items:center;gap:12px;">
    <span>兼容 OpenAI 格式 · SSE 流式</span>
    <button id="theme-toggle" class="mini-btn" style="width:auto;margin:0;padding:6px 12px;">☀ 白天</button>
  </div>
  <div class="header-stats">
    <div class="stat-item">
      <span class="stat-label">速度</span>
      <span class="stat-value" id="header-speed">—</span>
    </div>
    <div class="stat-item">
      <span class="stat-label">总耗时</span>
      <span class="stat-value amber" id="header-time">—</span>
    </div>
    <div class="stat-item">
      <span class="stat-label">思考</span>
      <span class="stat-value cyan" id="header-thinking">—</span>
    </div>
  </div>
</header>

<div class="main-container">
  <aside class="sidebar">
    <div class="settings-section">
      <div class="settings-title">API Key 生成</div>

      <div class="setting-item">
        <label class="setting-label">secret（设备密钥）</label>
        <input type="text" class="setting-input" id="gen-secret" placeholder="getprop ro.boot.secretkey" autocomplete="off" />
      </div>

      <div class="setting-item">
        <label class="setting-label">sn（序列号）</label>
        <input type="text" class="setting-input" id="gen-sn" placeholder="getprop persist.sys.serialno" autocomplete="off" />
      </div>

      <button class="mini-btn" onclick="generateApiKey()">生成并填入 API Key</button>

      <div class="hint">
        设备上执行以下命令可直接得到两个值：<br>
        <code>echo "API Key为: $(getprop ro.boot.secretkey);$(getprop persist.sys.serialno)"</code>
      </div>
    </div>

    <div class="settings-section">
      <div class="settings-title">配置</div>

      <div class="setting-item">
        <label class="setting-label">接口地址（完整 URL）</label>
        <input type="text" class="setting-input" id="endpoint" value="" />
        <div class="hint" id="endpoint-full"></div>
      </div>

      <div class="setting-item">
        <label class="setting-label">API Key</label>
        <input type="password" class="setting-input" id="api-key" placeholder="secret;sn 或 base64 JSON" />
      </div>

      <div class="setting-item">
        <label class="setting-label">模型</label>
        <div style="display:flex;gap:6px;">
          <input type="text" class="setting-input" id="model" value="deepseek-v3" />
          <button class="mini-btn" style="width:auto;margin:0;padding:0 10px;flex-shrink:0;" onclick="fetchModels()" title="从 /v1/models 拉取模型列表">拉取</button>
        </div>
        <select class="setting-input" id="model-select" style="margin-top:6px;display:none;">
          <option value="">（尚未拉取）</option>
        </select>
      </div>

      <div class="setting-item">
        <label class="setting-label">最大 Token</label>
        <input type="number" class="setting-input" id="max-tokens" value="1000000" />
      </div>

      <div class="setting-item">
        <label class="setting-label">温度</label>
        <input type="number" class="setting-input" id="temperature" value="0.7" step="0.1" />
      </div>

      <div class="setting-item">
        <label class="setting-label">系统提示词</label>
        <textarea class="setting-input" id="system-prompt" rows="3" placeholder="你是一个乐于助人的助手……"></textarea>
      </div>
    </div>

    <div class="live-metrics">
      <div class="metrics-title"><span class="live-dot"></span> 实时指标</div>
      <div class="metric-row">
        <span class="metric-label">速度 (t/s)</span>
        <span class="metric-value green" id="live-speed">0.00</span>
      </div>
      <div class="metric-row">
        <span class="metric-label">首字时间</span>
        <span class="metric-value" id="live-first-token">—</span>
      </div>
      <div class="metric-row">
        <span class="metric-label">TTFT (ms)</span>
        <span class="metric-value amber" id="live-ttft">—</span>
      </div>
      <div class="metric-row">
        <span class="metric-label">输出 Token</span>
        <span class="metric-value cyan" id="live-tokens-out">0</span>
      </div>
      <div class="metric-row">
        <span class="metric-label">总时长</span>
        <span class="metric-value amber" id="live-duration">—</span>
      </div>
      <div class="metric-row">
        <span class="metric-label">本会话 Token</span>
        <span class="metric-value cyan" id="live-session-tokens">0</span>
      </div>
      <div class="progress-bar"><div class="progress-fill" id="progress-fill" style="width:0%"></div></div>
      <button class="mini-btn" style="margin-top:12px;" onclick="refreshUsage()">查看累计用量</button>
      <div class="hint" id="usage-info" style="margin-top:8px;">—</div>
    </div>

    <div class="sidebar-footer">
      <button class="clear-btn" onclick="clearChat()">清空对话</button>
    </div>
  </aside>

  <div class="chat-wrapper">
    <div class="messages-container" id="messages-container">
      <div class="empty-state" id="empty-state">
        <div class="empty-icon">◈</div>
        <div class="empty-text">等待输入</div>
      </div>
    </div>

    <div class="code-preview-overlay" id="code-preview-overlay">
      <div class="code-preview-content">
        <button class="code-preview-close" id="code-preview-close" title="关闭预览">&#x2715;</button>
        <iframe class="code-preview-iframe" id="code-preview-iframe" sandbox="allow-scripts"></iframe>
      </div>
    </div>

    <div class="input-container">
      <div class="input-row">
        <div class="input-wrapper">
          <textarea id="msg-input" rows="1" placeholder="输入消息，Enter 发送，Shift+Enter 换行……" autofocus></textarea>
        </div>
        <button class="send-btn" id="send-btn">
          <svg viewBox="0 0 24 24"><path d="M2 21l21-9L2 3v7l15 2-15 2v7z"/></svg>
        </button>
      </div>
    </div>
  </div>
</div>

<script>
const messagesContainer = document.getElementById('messages-container');
const msgInput = document.getElementById('msg-input');
const sendBtn = document.getElementById('send-btn');
const emptyState = document.getElementById('empty-state');

let conversation = [];
let isStreaming = false;
let currentController = null;
let renderTimer = null;
let newChat = false;
let sessionTokens = 0;

// ---- Theme ----
(function initTheme() {
  var saved = localStorage.getItem('iot-theme') || 'dark';
  document.documentElement.setAttribute('data-theme', saved);
})();

document.getElementById('theme-toggle').addEventListener('click', function() {
  var cur = document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
  var next = cur === 'light' ? 'dark' : 'light';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('iot-theme', next);
  updateThemeButton();
});

function updateThemeButton() {
  var light = document.documentElement.getAttribute('data-theme') === 'light';
  document.getElementById('theme-toggle').textContent = light ? '☾ 黑夜' : '☀ 白天';
}

// ---- Endpoint (full URL) ----
function defaultEndpoint() {
  return location.origin + '/v1/chat/completions';
}
function updateEndpointFull() {
  var v = document.getElementById('endpoint').value.trim() || defaultEndpoint();
  var full = v.startsWith('http') ? v : location.origin + (v.startsWith('/') ? v : '/' + v);
  document.getElementById('endpoint-full').textContent = '完整 URL: ' + full;
}
document.getElementById('endpoint').value = defaultEndpoint();
document.getElementById('endpoint').addEventListener('input', updateEndpointFull);
updateEndpointFull();
updateThemeButton();

// ---- Fetch model list from /v1/models ----
async function fetchModels() {
  var sel = document.getElementById('model-select');
  try {
    var res = await fetch('/v1/models');
    var data = await res.json();
    var models = (data.data || []).map(function(m) { return m.id; });
    if (!models.length) throw new Error('模型列表为空');
    sel.innerHTML = models.map(function(id) {
      return '<option value="' + id + '">' + id + '</option>';
    }).join('');
    sel.style.display = 'block';
    if (models.indexOf(document.getElementById('model').value) < 0) {
      document.getElementById('model').value = models[0];
    }
    sel.value = document.getElementById('model').value;
  } catch (e) {
    alert('拉取模型列表失败: ' + e.message);
  }
}
document.getElementById('model-select').addEventListener('change', function() {
  if (this.value) document.getElementById('model').value = this.value;
});

// ---- Cumulative usage from /v1/usage ----
async function refreshUsage() {
  var info = document.getElementById('usage-info');
  var key = document.getElementById('api-key').value.trim();
  if (!key) { info.textContent = '请先填写 API Key'; return; }
  info.textContent = '查询中……';
  try {
    var res = await fetch('/v1/usage', { headers: { 'Authorization': 'Bearer ' + key } });
    var data = await res.json();
    if (!res.ok) throw new Error(data.error?.message || ('HTTP ' + res.status));
    info.textContent = '请求 ' + data.requests + ' 次 · 输入 ' + data.prompt_tokens +
      ' · 输出 ' + data.completion_tokens + ' · 合计 ' +
      (data.prompt_tokens + data.completion_tokens) + ' tokens';
  } catch (e) {
    info.textContent = '查询失败: ' + e.message;
  }
}

msgInput.addEventListener('keydown', function(e) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
});

msgInput.addEventListener('input', function() {
  this.style.height = 'auto';
  this.style.height = Math.min(this.scrollHeight, 200) + 'px';
});

sendBtn.addEventListener('click', sendMessage);

document.getElementById('code-preview-close').addEventListener('click', closeCodePreview);
document.getElementById('code-preview-overlay').addEventListener('click', function(e) {
  if (e.target === this) closeCodePreview();
});
document.addEventListener('keydown', function(e) {
  if (e.key === 'Escape') closeCodePreview();
});

function generateApiKey() {
  const secret = document.getElementById('gen-secret').value.trim();
  const sn = document.getElementById('gen-sn').value.trim();
  if (!secret || !sn) { alert('请填写 secret 和 sn'); return; }
  document.getElementById('api-key').value = secret + ';' + sn;
  alert('API Key 已生成并填入左侧「API Key」输入框');
}

function getSettings() {
  return {
    endpoint: document.getElementById('endpoint').value.trim() || '/v1/chat/completions',
    apiKey: document.getElementById('api-key').value.trim() || 'empty',
    model: document.getElementById('model').value.trim() || 'deepseek-v3',
    maxTokens: parseInt(document.getElementById('max-tokens').value) || 4096,
    temperature: parseFloat(document.getElementById('temperature').value) || 0.7,
    systemPrompt: document.getElementById('system-prompt').value.trim()
  };
}

if (typeof window.idxCodeBlock === 'undefined') { window.idxCodeBlock = 0; }

const COPY_ICON_SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>';
const PREVIEW_ICON_SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2.062 12.345a1 1 0 0 1 0-.69C3.5 7.73 7.36 5 12 5s8.5 2.73 9.938 6.655a1 1 0 0 1 0 .69C20.5 16.27 16.64 19 12 19s-8.5-2.73-9.938-6.655"/><circle cx="12" cy="12" r="3"/></svg>';

function getCodeInfoFromTarget(target) {
  const wrapper = target.closest('.code-block-wrapper');
  if (!wrapper) return null;
  const codeEl = wrapper.querySelector('code[data-code-id]');
  if (!codeEl) return null;
  const rawCode = codeEl.textContent || '';
  const langLabel = wrapper.querySelector('.code-language');
  const language = langLabel?.textContent?.trim() || 'text';
  return { rawCode, language };
}

async function handleCopyClick(event) {
  event.preventDefault();
  event.stopPropagation();
  const btn = event.currentTarget;
  const info = getCodeInfoFromTarget(btn);
  if (!info) return;
  try {
    await navigator.clipboard.writeText(info.rawCode);
    btn.classList.add('copied');
    setTimeout(() => btn.classList.remove('copied'), 1500);
  } catch (err) {
    console.error('复制失败:', err);
  }
}

function handlePreviewClick(event) {
  event.preventDefault();
  event.stopPropagation();
  const btn = event.currentTarget;
  const info = getCodeInfoFromTarget(btn);
  if (!info) return;
  const iframe = document.getElementById('code-preview-iframe');
  const overlay = document.getElementById('code-preview-overlay');
  if (iframe && overlay) {
    iframe.srcdoc = info.rawCode;
    overlay.classList.add('open');
  }
}

function closeCodePreview() {
  const overlay = document.getElementById('code-preview-overlay');
  const iframe = document.getElementById('code-preview-iframe');
  if (overlay) overlay.classList.remove('open');
  if (iframe) iframe.srcdoc = '';
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

marked.use({ renderer: { html: function({ text }) { return escapeHtml(text); } } });
marked.use({ breaks: true, gfm: true });

function buildCodeBlockWrapper(lang, highlightedCode, rawCode, codeId) {
  const langLabel = lang || 'text';
  const isHtml = langLabel.toLowerCase() === 'html';
  const copyBtn = '<button class="copy-code-btn" data-code-id="' + codeId + '" title="复制代码" onclick="handleCopyClick(event)"><span>' + COPY_ICON_SVG + '</span></button>';
  const previewBtn = isHtml
    ? '<button class="preview-code-btn" data-code-id="' + codeId + '" title="预览代码" onclick="handlePreviewClick(event)"><span>' + PREVIEW_ICON_SVG + '</span></button>'
    : '';
  return '<div class="code-block-wrapper">'
    + '<div class="code-block-header">'
    + '<span class="code-language">' + escapeHtml(langLabel) + '</span>'
    + '<div class="code-block-actions">' + copyBtn + previewBtn + '</div>'
    + '</div>'
    + '<div class="code-block-scroll-container">'
    + '<pre><code class="hljs" data-code-id="' + codeId + '">' + highlightedCode + '</code></pre>'
    + '</div>'
    + '</div>';
}

function highlightCode(code, lang) {
  if (!code) return '';
  try {
    if (typeof hljs !== 'undefined' && hljs.highlight) {
      return hljs.highlight(code, { language: lang || 'plaintext', ignoreIllegals: true }).value;
    }
  } catch (e) {
    console.error('[highlightCode] hljs error:', e);
  }
  return escapeHtml(code);
}

function renderMarkdown(text, isStreaming) {
  if (!text) return '';
  try {
    if (typeof marked === 'undefined' || !marked.parse) {
      throw new Error('marked not available');
    }
    if (isStreaming) {
      var fencePos = findUnclosedCodeFence(text);
      if (fencePos >= 0) {
        var before = text.slice(0, fencePos);
        var codePart = text.slice(fencePos);
        var fenceMatch = codePart.match(/^[ \\t]*\`\`\`(\\w*)\\n?([\\s\\S]*)/);
        var streamLang = (fenceMatch ? fenceMatch[1] : null) || 'text';
        var streamCode = fenceMatch ? fenceMatch[2] : codePart;
        var streamHighlighted = highlightCode(streamCode, streamLang);
        var streamCodeId = 'code-' + (++window.idxCodeBlock);
        var beforeResult = marked.parse(before) || '';
        return beforeResult + buildCodeBlockWrapper(streamLang, streamHighlighted, streamCode, streamCodeId);
      }
    }
    var codeBlocks = [];
    var outParts = [];
    var inCode = false;
    var codeLang = '';
    var codeAccum = '';
    var rawLines = text.split(/\\r?\\n/);
    var i;
    for (i = 0; i < rawLines.length; i++) {
      var raw = rawLines[i];
      var fenceMatch = raw.match(/^[ \\t]*\`\`\`(\\w*)$/);
      var line = raw + (i < rawLines.length - 1 ? '\\n' : '');
      if (fenceMatch && !inCode) {
        inCode = true;
        codeLang = fenceMatch[1] || 'text';
        codeAccum = '';
      } else if (fenceMatch && inCode) {
        codeBlocks.push({ lang: codeLang, code: codeAccum });
        outParts.push('@@CBIDX_' + (codeBlocks.length - 1) + '@@');
        inCode = false; codeLang = ''; codeAccum = '';
      } else if (inCode) {
        codeAccum += line;
      } else {
        outParts.push(line);
      }
    }
    if (inCode) {
      codeBlocks.push({ lang: codeLang, code: codeAccum });
      outParts.push('@@CBIDX_' + (codeBlocks.length - 1) + '@@');
    }
    var processed = outParts.join('');
    var result = marked.parse(processed) || '';
    for (var j = 0; j < codeBlocks.length; j++) {
      var block = codeBlocks[j];
      var highlighted = highlightCode(block.code, block.lang);
      var codeId = 'code-' + (++window.idxCodeBlock);
      var wrapper = buildCodeBlockWrapper(block.lang, highlighted, block.code, codeId);
      result = result.replace('@@CBIDX_' + j + '@@', wrapper);
    }
    return result;
  } catch (e) {
    console.error('[renderMarkdown] error:', e);
  }
  return '<pre style="white-space:pre-wrap;font-size:13px;">' + escapeHtml(text) + '</pre>';
}

function findUnclosedCodeFence(text) {
  var depth = 0;
  var lastOpenIdx = -1;
  var fenceRegex = /^[ \\t]*\`\`\`+/gm;
  var match;
  while ((match = fenceRegex.exec(text)) !== null) {
    if (depth === 0) lastOpenIdx = match.index;
    depth++;
  }
  if (depth % 2 === 1) return lastOpenIdx;
  return -1;
}

function toggleReasoning(headerEl) {
  const body = headerEl.nextElementSibling;
  const arrow = headerEl.querySelector('.reasoning-arrow');
  if (body) body.classList.toggle('hidden');
  if (arrow) arrow.classList.toggle('open');
}

function renderMessages() {
  const existing = messagesContainer.querySelectorAll('.message');
  existing.forEach(m => m.remove());
  conversation.forEach((msg, i) => {
    if (msg.role === 'system') return;
    if (msg.role === 'user') createUserMessageElement('msg-' + i, msg.content);
    else createAssistantMessageElement('msg-' + i, msg.content, msg.reasoningContent);
  });
}

function createUserMessageElement(id, content) {
  const div = document.createElement('div');
  div.className = 'message user';
  div.id = id;
  div.innerHTML = '<div class="msg-role user">用户</div><div class="msg-content"></div>';
  div.querySelector('.msg-content').textContent = content;
  messagesContainer.appendChild(div);
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function createAssistantMessageElement(id, content, reasoningContent) {
  const div = document.createElement('div');
  div.className = 'message assistant';
  div.id = id;
  let html = '<div class="msg-role assistant">助手</div><div class="msg-content">';
  if (reasoningContent) {
    html += '<div class="reasoning-block">'
      + '<div class="reasoning-header" onclick="toggleReasoning(this)">'
      + '<span class="reasoning-arrow">▸</span><span>思考过程</span>'
      + '</div>'
      + '<div class="reasoning-body hidden">' + escapeHtml(reasoningContent) + '</div>'
      + '</div>';
  }
  html += renderMarkdown(content) || '';
  html += '</div>';
  html += '<div class="msg-stats">'
    + '<span>速度: <span>—</span></span>'
    + '<span>耗时: <span>—</span></span>'
    + '<span>Token: <span>—</span></span>'
    + '</div>';
  div.innerHTML = html;
  messagesContainer.appendChild(div);
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
  return div;
}

async function sendMessage() {
  if (isStreaming) return;
  const text = msgInput.value.trim();
  if (!text) return;
  const settings = getSettings();
  if (emptyState) emptyState.remove();

  conversation.push({ role: 'user', content: text });
  createUserMessageElement('msg-user-' + Date.now(), text);
  msgInput.value = '';
  msgInput.style.height = 'auto';

  isStreaming = true;
  sendBtn.disabled = true;

  const startTime = performance.now();
  let firstTokenTime = null;
  let totalTokens = 0;
  let cachedCompletion = '';
  let reasoningAccum = '';
  const assistantId = 'msg-' + Date.now();

  try {
    const messages = [];
    if (settings.systemPrompt) messages.push({ role: 'system', content: settings.systemPrompt });
    conversation.forEach(m => {
      if (m.role === 'system') return;
      if (m.role === 'assistant') {
        messages.push({ role: 'assistant', content: m.content || '', reasoning_content: m.reasoningContent || undefined });
      } else {
        messages.push({ role: m.role, content: m.content });
      }
    });

    const body = {
      model: settings.model,
      messages: messages,
      max_tokens: settings.maxTokens,
      temperature: settings.temperature,
      stream: true
    };

    const headers = {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + settings.apiKey
    };
    if (newChat) { headers['x-iot-new-chat'] = 'true'; newChat = false; }

    conversation.push({ role: 'assistant', content: '', reasoningContent: '' });
    const placeholderDiv = createAssistantMessageElement(assistantId, '', '');
    const contentEl = placeholderDiv.querySelector('.msg-content');
    const statsEl = placeholderDiv.querySelector('.msg-stats');

    currentController = new AbortController();

    const res = await fetch(settings.endpoint, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(body),
      signal: currentController.signal
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error?.message || ('HTTP ' + res.status));
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\\n');
      buffer = lines.pop() || '';
      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const data = line.slice(6).trim();
        if (data === '[DONE]') continue;
        try {
          const json = JSON.parse(data);
          if (json.usage && json.usage.total_tokens) {
            sessionTokens += json.usage.total_tokens;
            document.getElementById('live-session-tokens').textContent = sessionTokens;
          }
          const choice = json.choices?.[0]?.delta || {};
          const delta = choice.content || '';
          const reasoningDelta = choice.reasoning_content || '';
          if (!delta && !reasoningDelta) continue;
          if (firstTokenTime === null) firstTokenTime = performance.now() - startTime;
          totalTokens++;
          if (reasoningDelta) reasoningAccum += reasoningDelta;
          if (delta) cachedCompletion += delta;
          if (!renderTimer) {
            renderTimer = setTimeout(() => {
              renderTimer = null;
              updateAssistantMessage(contentEl, reasoningAccum, cachedCompletion, true);
            }, 30);
          }
          const now = performance.now();
          const elapsed = (now - startTime) / 1000;
          const speed = totalTokens / elapsed;
          document.getElementById('live-speed').textContent = speed.toFixed(2);
          document.getElementById('live-first-token').textContent = firstTokenTime ? firstTokenTime.toFixed(0) + ' ms' : '—';
          document.getElementById('live-ttft').textContent = firstTokenTime ? firstTokenTime.toFixed(0) + ' ms' : '—';
          document.getElementById('live-tokens-out').textContent = totalTokens;
          document.getElementById('header-speed').textContent = speed.toFixed(1) + '/s';
          document.getElementById('header-time').textContent = elapsed.toFixed(1) + 's';
          document.getElementById('header-thinking').textContent = reasoningAccum ? '是' : '—';
          if (settings.maxTokens > 0) {
            const progress = Math.min((totalTokens / settings.maxTokens) * 100, 100);
            document.getElementById('progress-fill').style.width = progress + '%';
          }
        } catch (_) {}
      }
    }

    if (renderTimer) { clearTimeout(renderTimer); renderTimer = null; }
    const lastMsg = conversation[conversation.length - 1];
    lastMsg.content = cachedCompletion;
    lastMsg.reasoningContent = reasoningAccum;

    const finalTime = performance.now() - startTime;
    const finalSpeed = totalTokens / (finalTime / 1000);
    updateAssistantMessage(contentEl, reasoningAccum, cachedCompletion, false);
    if (statsEl) {
      statsEl.innerHTML =
        '<span>速度: <span>' + finalSpeed.toFixed(2) + ' t/s</span></span>' +
        '<span>耗时: <span>' + (finalTime / 1000).toFixed(2) + 's</span></span>' +
        '<span>Token: <span>' + totalTokens + '</span></span>';
    }
    document.getElementById('header-speed').textContent = finalSpeed.toFixed(1) + '/s';
    document.getElementById('header-time').textContent = (finalTime / 1000).toFixed(2) + 's';
    document.getElementById('live-duration').textContent = (finalTime / 1000).toFixed(3) + ' s';
    document.getElementById('progress-fill').style.width = '100%';
    document.getElementById('header-thinking').textContent = reasoningAccum ? '是' : '—';
  } catch (err) {
    if (renderTimer) { clearTimeout(renderTimer); renderTimer = null; }
    if (err.name === 'AbortError') {
      const lastMsg = conversation[conversation.length - 1];
      if (lastMsg.content !== cachedCompletion || lastMsg.reasoningContent !== reasoningAccum) {
        lastMsg.content = cachedCompletion;
        lastMsg.reasoningContent = reasoningAccum;
        renderMessages();
      }
    } else {
      const el = document.getElementById(assistantId);
      if (el) el.remove();
      conversation.pop();
      alert('错误: ' + err.message);
    }
  }

  isStreaming = false;
  sendBtn.disabled = false;
  currentController = null;
}

function updateAssistantMessage(contentEl, reasoning, content, isStreaming) {
  if (!contentEl) return;
  let html = '';
  if (reasoning) {
    const hasContent = !!content;
    html += '<div class="reasoning-block">'
      + '<div class="reasoning-header" onclick="toggleReasoning(this)">'
      + '<span class="reasoning-arrow' + (isStreaming ? ' open' : '') + '">▸</span>'
      + (isStreaming && !hasContent ? '<span class="reasoning-spinner"></span>' : '')
      + '<span>' + (isStreaming && !hasContent ? '思考中……' : '思考过程') + '</span>'
      + '</div>'
      + '<div class="reasoning-body' + (isStreaming ? '' : ' hidden') + '">' + escapeHtml(reasoning) + '</div>'
      + '</div>';
  }
  if (content) { html += renderMarkdown(content, isStreaming); }
  if (isStreaming) { html += '<span class="typing-cursor"></span>'; }
  contentEl.innerHTML = html;
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function clearChat() {
  if (isStreaming && currentController) currentController.abort();
  conversation = [];
  newChat = true;
  messagesContainer.innerHTML = '';
  messagesContainer.appendChild(createEmptyState());
  document.getElementById('header-speed').textContent = '—';
  document.getElementById('header-time').textContent = '—';
  document.getElementById('header-thinking').textContent = '—';
  document.getElementById('live-speed').textContent = '0.00';
  document.getElementById('live-first-token').textContent = '—';
  document.getElementById('live-ttft').textContent = '—';
  document.getElementById('live-tokens-out').textContent = '0';
  document.getElementById('live-duration').textContent = '—';
  document.getElementById('live-session-tokens').textContent = sessionTokens;
  document.getElementById('progress-fill').style.width = '0%';
}

function createEmptyState() {
  const div = document.createElement('div');
  div.className = 'empty-state';
  div.id = 'empty-state';
  div.innerHTML = '<div class="empty-icon">◈</div><div class="empty-text">等待输入</div>';
  return div;
}
</script>

</body>
</html>`;
  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
