// Helpers for talking to the iot-study assistant upstream and translating
// between the OpenAI chat format and the upstream SSE format.
//
// Reverse-engineered from the Android APK (com.zuoyebang.iot.pad.zpvoiceassistant),
// verified against two live traffic captures (chat + chatList) whose sigs both
// reproduce exactly.
//
// Signing pipeline (com.zuoyebang.iot.http.interceptor.CommonParams.intercept):
//   1. finalQueryParams = URL query params (HashMap)
//   2. formParams       = top-level JSON keys of the request body, parsed by
//                         OneLevelJSonParse. String values are unquoted; numeric,
//                         array and object values are kept as raw substrings.
//                         `data` and `ev` keys are dropped.
//   3. finalQueryParams.putAll(formParams)      // body params enter the query map
//   4. addCommonParams(...) -> applyCommonParams -> PadCommonParamsMaker.make():
//        - registered common params are added (sn, token, local, buildNum, ...)
//        - `stamp` = System.currentTimeMillis() is added
//        - sig = SignGenerateImpl.generate(finalQueryParams, secret)
//        - finalQueryParams.put("sig", sig)
//   5. Keys that are NOT registered common params are removed from the final map
//      (this strips the body params back out of the URL) and the request is sent.
//
// SignGenerateImpl.generate:
//   md5( concat( sorted(map)["k=v&"] ) + "secret=" + secret )  // lowercase hex
//
// The secret is android.os.Build.getZybSecretKey() (a device-native value); it is
// not present anywhere in the APK. As this is a public proxy, it (and the other
// device params) are supplied by the caller inside the base64 API-key credential.

import { computeSig } from "./md5.js";

// Top-level JSON body params that the app strips from the signed map before it
// writes the final query (these keys are never registered as common params).
const PARAM_DATA = "data";
const PARAM_EV = "ev";
const PARAM_SECRET = "secret";

// Registered common params (populated by PadCommonParamsMaker.init + FundamentalApplication).
// Any body key matching one of these is overwritten by the registered value and is
// NOT treated as a body param.
const REGISTERED = new Set([
  "sn",
  "token",
  "secret",
  "local",
  "buildNum",
  "buildTime",
  "versionName",
  "versionCode",
  "appName",
  "cuid",
  "romVersion",
  "childId",
  "__tips__",
]);

// Emulate OneLevelJSonParse: return a Map of top-level key -> value where string
// values are unquoted and other JSON values are kept verbatim (raw substring).
// This is intentionally a light-weight parser that mirrors the app's behaviour:
// it splits on ':' and ',' at bracket depth zero.
export function parseOneLevelJson(src) {
  const out = {};
  const s = src.trim();
  if (s.length < 2) return out;
  const body = s.slice(1, s.length - 1); // strip outer { }

  let i = 0;
  while (i < body.length) {
    // key
    while (i < body.length && (body[i] === " " || body[i] === "\n" || body[i] === "\r" || body[i] === ",")) i++;
    if (i >= body.length) break;
    const colon = body.indexOf(":", i);
    if (colon === -1) break;
    let key = body.slice(i, colon).trim();
    if (key.startsWith('"') && key.endsWith('"')) key = key.slice(1, -1);

    // value: scan until a comma at depth 0, honouring strings and brackets
    let j = colon + 1;
    let depth = 0;
    let inStr = false;
    let esc = false;
    for (; j < body.length; j++) {
      const c = body[j];
      if (inStr) {
        if (esc) esc = false;
        else if (c === "\\") esc = true;
        else if (c === '"') inStr = false;
        continue;
      }
      if (c === '"') inStr = true;
      else if (c === "[" || c === "{") depth++;
      else if (c === "]" || c === "}") depth--;
      else if (c === "," && depth === 0) break;
    }
    let raw = body.slice(colon + 1, j).trim();
    let value;
    if (raw.startsWith('"') && raw.endsWith('"')) {
      value = raw.slice(1, -1);
    } else {
      value = raw; // number / array / object kept verbatim
    }
    out[key] = value;
    i = j + 1;
  }
  return out;
}

// Extract the signed body params from a JSON body string (top-level keys, minus
// data/ev, and excluding any that collide with registered common params).
export function bodyParams(bodyStr) {
  const parsed = parseOneLevelJson(bodyStr);
  const out = {};
  for (const [k, v] of Object.entries(parsed)) {
    if (k === PARAM_DATA || k === PARAM_EV || k === PARAM_SECRET) continue;
    if (REGISTERED.has(k)) continue;
    if (v === undefined || v === null || v === "") continue;
    out[k] = String(v);
  }
  return out;
}

// Resolve the registered common params for a request. This is a PUBLIC proxy, so
// every device-specific value comes from the client-supplied credential
// (base64 API key); headers may override. Nothing device specific is read from
// env. `buildNum`/`buildTime` etc. are optional overrides with safe app defaults.
export function resolveCommonParams(cred, request) {
  const c = cred || {};
  const h = (name) => request.headers.get(name) || "";
  const v = (key, headerName, fallback = "") =>
    h(headerName) || (c[key] !== undefined && c[key] !== null && c[key] !== "" ? String(c[key]) : fallback);

  return {
    token: v("token", "x-iot-token"),
    sn: v("sn", "x-iot-sn"),
    buildNum: v("buildNum", "x-iot-build-num", "163"),
    buildTime: v("buildTime", "x-iot-build-time", "2512151629"),
    versionName: v("versionName", "x-iot-version-name", "4.3.14"),
    versionCode: v("versionCode", "x-iot-version-code", "4030014"),
    appName: v("appName", "x-iot-app-name", "com.zuoyebang.iot.pad.zpvoiceassistant"),
    romVersion: v("romVersion", "x-iot-rom-version", "4.3.0"),
    local: v("local", "x-iot-local", "zh-CN"),
    __tips__: "1",
  };
}

// The signing secret comes only from the client credential (public proxy).
export function resolveSecret(cred) {
  return cred && cred.secret ? String(cred.secret) : "";
}

// Build the signed query string for a request. `commonParams` is the output of
// resolveCommonParams. `bodyStr` is the exact JSON body that will be sent (its
// top-level keys participate in the signature).
export function buildSignedQuery(commonParams, secret, bodyStr, extra = {}) {
  // Sign map = body params (not registered) + registered params + extras + stamp.
  const signMap = {};
  Object.assign(signMap, bodyParams(bodyStr));
  for (const [k, v] of Object.entries(commonParams)) {
    if (v !== undefined && v !== null && v !== "") signMap[k] = String(v);
  }
  for (const [k, v] of Object.entries(extra)) {
    if (v !== undefined && v !== null && v !== "") signMap[k] = String(v);
  }
  signMap.stamp = String(Date.now());

  const sig = computeSig(signMap, secret);

  // Final URL query = registered params + extras + stamp + sig. Body params are
  // stripped (they were only used for the signature).
  const query = {};
  for (const [k, v] of Object.entries(commonParams)) {
    if (v !== undefined && v !== null && v !== "") query[k] = String(v);
  }
  for (const [k, v] of Object.entries(extra)) {
    if (v !== undefined && v !== null && v !== "") query[k] = String(v);
  }
  query.stamp = signMap.stamp;
  query.sig = sig;

  return new URLSearchParams(query).toString();
}

// Fetch the recent message list. Used to discover an existing chatId so the
// conversation thread upstream stays consistent across OpenAI requests.
export async function fetchChatList(env, commonParams, secret) {
  const bodyStr = JSON.stringify({ kind: "8", page: 1, size: 50 });
  const url = `${env.UPSTREAM_BASE}/chatList?${buildSignedQuery(commonParams, secret, bodyStr)}`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json; charset=UTF-8",
      "User-Agent": "okhttp/4.11.0",
    },
    body: bodyStr,
  });
  if (!res.ok) {
    throw new Error(`chatList HTTP ${res.status}`);
  }
  const data = await res.json();
  const list = (data && data.data && data.data.chat) || [];
  return list;
}

export function latestChatId(list) {
  if (!Array.isArray(list) || list.length === 0) return null;
  return list[0].chatId || null;
}

// Generate a fresh chatId in the same shape the APK uses for "clear context":
//   takeLast(sn, 13) + "-" + UUID
// (see ChatExtKt.generateChatId). Upstream accepts a client-provided chatId and
// starts a new thread when it has not been seen before.
export function generateChatId(sn) {
  const tail = String(sn || "").slice(-13);
  return `${tail}-${crypto.randomUUID()}`;
}

// Derive a stable chatId for a multi-turn conversation from a seed (typically the
// first non-system message). The same conversation always maps to the same
// upstream thread, so clients that resend the full OpenAI message history get
// consistent multi-turn behaviour without pinning a chatId themselves.
export function deriveChatId(sn, seed) {
  const tail = String(sn || "").slice(-13);
  const digest = computeSig({ seed: String(seed || ""), sn: String(sn || "") }, "");
  // Shape as a UUID-like suffix for compatibility with generateChatId.
  const hyphens = `${digest.slice(0, 8)}-${digest.slice(8, 12)}-${digest.slice(12, 16)}-${digest.slice(16, 20)}-${digest.slice(20, 32)}`;
  return `${tail}-${hyphens}`;
}

// Map an OpenAI-facing model name to the upstream model + reasoning flag.
// Upstream uses ChatKind "8" (DEEPSEEK). Reasoning ("deep search") is expressed
// purely via the model field: deepseek-r1 enables it, deepseek-v3 does not.
// See GetChatModelUseCase in the APK.
export function resolveUpstreamModel(model) {
  const m = (model || "").toLowerCase();
  if (m.includes("r1") || m.includes("reason") || m.includes("think") || m.includes("search")) {
    return { model: "deepseek-r1", reasoning: true };
  }
  return { model: "deepseek-v3", reasoning: false };
}

// Build the upstream /chat request body from the last user message and an
// optional existing chatId. `childId` is not required by upstream (0 works).
// `role` may be "user" or "assistant" (used when replaying history).
export function buildChatBody({ chatId, content, model, role = "user" }) {
  const now = Date.now();
  return {
    chatId: chatId || "",
    from: 0,
    kind: "8",
    message: [
      {
        chatId: chatId || "",
        childId: 0,
        content,
        createTime: now,
        reqId: crypto.randomUUID(),
        kind: "8",
        msgId: 0,
        reasonContent: "",
        role,
        status: role === "assistant" ? 2 : 0,
      },
    ],
    model: model || "deepseek-v3",
  };
}

// Send a single turn (user or assistant) to the upstream /chat endpoint and
// return the fetch Response. Used both for the live request and for replaying
// prior history into a thread (backfill).
export async function sendChatTurn(env, commonParams, secret, { chatId, content, model, role }) {
  const bodyStr = JSON.stringify(buildChatBody({ chatId, content, model, role }));
  const url = `${env.UPSTREAM_BASE}/chat?${buildSignedQuery(commonParams, secret, bodyStr)}`;
  return fetch(url, {
    method: "POST",
    headers: {
      Accept: "text/event-stream",
      "Content-Type": "application/json; charset=utf-8",
      "User-Agent": "okhttp/4.11.0",
    },
    body: bodyStr,
  });
}

// Parse the upstream text/event-stream. Upstream emits blocks like:
//   event: message
//   data: {"id":"...","role":"assistant","content":"...","reasonContent":"","event":""}
//
//   event: done
//   data: {"action":"","chatId":"...",...}
//
//   event: error / event: notAllow
export async function* parseUpstreamSSE(response) {
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let idx;
    while ((idx = buffer.indexOf("\n\n")) !== -1) {
      const rawEvent = buffer.slice(0, idx);
      buffer = buffer.slice(idx + 2);
      const parsed = parseEventBlock(rawEvent);
      if (parsed) yield parsed;
    }
  }
  const parsed = parseEventBlock(buffer);
  if (parsed) yield parsed;
}

function parseEventBlock(block) {
  if (!block || !block.trim()) return null;
  const lines = block.split(/\r?\n/);
  let event = "";
  const dataLines = [];
  for (const line of lines) {
    if (line.startsWith("event:")) event = line.slice(6).trim();
    else if (line.startsWith("data:")) dataLines.push(line.slice(5).trim());
  }
  const dataStr = dataLines.join("\n");

  // Bare JSON body (no SSE framing), used by upstream for some errors such as
  // {"errno":20600012,...,"message":"error.sn.null"}.
  if (!event && !dataStr) {
    const trimmed = block.trim();
    if (trimmed.startsWith("{")) {
      try {
        return { event: "error", data: JSON.parse(trimmed) };
      } catch {
        return null;
      }
    }
    return null;
  }

  let data = null;
  if (dataStr) {
    try {
      data = JSON.parse(dataStr);
    } catch {
      data = { raw: dataStr };
    }
  }
  return { event, data };
}
