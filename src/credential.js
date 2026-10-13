// API-key credential handling.
//
// The client supplies a compact API key. Two forms are accepted:
//
//   1. "secret;sn"          (preferred, simplest)
//   2. base64(JSON)         (legacy / advanced, may carry extra overrides)
//
// In form 2 the JSON may hold any of:
//   {
//     "secret":   "********************************",
//     "sn":       "*************",
//     "token":    "<jwt>",                               // optional
//     "buildNum": "163", "buildTime": "2512151629",      // optional overrides
//     "versionName": "4.3.14", "versionCode": "4030014",
//     "appName": "com.zuoyebang.iot.pad.zpvoiceassistant",
//     "romVersion": "4.3.0", "local": "zh-CN"
//   }
//
// `secret` and `sn` are required. `token` is optional: when absent the proxy
// obtains one automatically via the device login endpoint (see upstream.login).
// Everything else has an app-level default in upstream.js or may be overridden
// per request via headers. This is a PUBLIC proxy, so nothing device-specific is
// read from the worker env.

function base64ToBytes(b64) {
  const normalized = b64.replace(/-/g, "+").replace(/_/g, "/").replace(/\s+/g, "");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function validate(obj) {
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) {
    throw new Error("api key payload must be a JSON object");
  }
  // `secret` is required: it signs both the login and chat requests.
  if (!obj.secret || typeof obj.secret !== "string") {
    throw new Error("api key is missing 'secret'");
  }
  // `sn` is required by the upstream (it returns error.sn.null without it) and is
  // also the prefix used to build chatIds.
  if (!obj.sn || typeof obj.sn !== "string") {
    throw new Error("api key is missing 'sn'");
  }
  if (obj.token !== undefined && typeof obj.token !== "string") {
    throw new Error("api key 'token' must be a string");
  }
  return obj;
}

// Decode an API key into a credential object. Throws on malformed input.
export function decodeCredential(apiKey) {
  if (!apiKey || typeof apiKey !== "string") {
    throw new Error("missing api key");
  }
  const raw = apiKey.trim();

  // Form 1: "secret;sn" (also tolerate "secret;sn;token").
  if (raw.includes(";") && !raw.includes("{")) {
    const parts = raw.split(";");
    const secret = (parts[0] || "").trim();
    const sn = (parts[1] || "").trim();
    const token = (parts[2] || "").trim();
    const obj = { secret, sn };
    if (token) obj.token = token;
    return validate(obj);
  }

  // Form 2: base64(JSON).
  let json;
  try {
    json = new TextDecoder().decode(base64ToBytes(raw));
  } catch {
    throw new Error("api key is not valid base64 or 'secret;sn'");
  }
  let obj;
  try {
    obj = JSON.parse(json);
  } catch {
    throw new Error("api key payload is not valid JSON");
  }
  return validate(obj);
}

// Pull the API key from the usual OpenAI / generic header locations.
export function extractApiKey(request) {
  const auth = request.headers.get("authorization") || "";
  if (auth.toLowerCase().startsWith("bearer ")) return auth.slice(7).trim();
  return (
    request.headers.get("x-api-key") ||
    request.headers.get("api-key") ||
    ""
  );
}
