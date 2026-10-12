// API-key credential handling.
//
// Rather than hard-coding per-device parameters (token / sn / secret) into
// wrangler.toml, the client supplies a single base64-encoded API key that decodes
// to a JSON object holding everything the upstream signature needs. This keeps
// the worker deployment minimal and lets each caller carry their own device
// identity.
//
// The key is a URL-safe base64 encoding (padding optional) of JSON like:
//   {
//     "token":    "<jwt>",
//     "sn":       "*************",
//     "secret":   "********************************",
//     "buildNum": "163", "buildTime": "2512151629",       // optional overrides
//     "versionName": "4.3.14", "versionCode": "4030014",
//     "appName": "com.zuoyebang.iot.pad.zpvoiceassistant",
//     "romVersion": "4.3.0", "local": "zh-CN"
//   }
//
// Only `token` and `sn` are required; everything else has an app-level default in
// upstream.js or may be overridden per request via headers. This is a PUBLIC
// proxy, so nothing device-specific is read from the worker env.

function base64ToBytes(b64) {
  const normalized = b64.replace(/-/g, "+").replace(/_/g, "/").replace(/\s+/g, "");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

// Decode a base64 API key into a credential object. Throws on malformed input.
export function decodeCredential(apiKey) {
  if (!apiKey || typeof apiKey !== "string") {
    throw new Error("missing api key");
  }
  let json;
  try {
    json = new TextDecoder().decode(base64ToBytes(apiKey));
  } catch {
    throw new Error("api key is not valid base64");
  }
  let obj;
  try {
    obj = JSON.parse(json);
  } catch {
    throw new Error("api key payload is not valid JSON");
  }
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) {
    throw new Error("api key payload must be a JSON object");
  }
  if (!obj.token || typeof obj.token !== "string") {
    throw new Error("api key payload is missing 'token'");
  }
  // `sn` is required by the upstream (it returns error.sn.null without it) and is
  // also the prefix used to build chatIds.
  if (!obj.sn || typeof obj.sn !== "string") {
    throw new Error("api key payload is missing 'sn'");
  }
  return obj;
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
