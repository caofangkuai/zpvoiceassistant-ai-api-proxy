// Shared CORS helpers. We reflect the Origin and the requested headers so any
// browser client (including SDKs that add custom headers) passes the CORS check.
// Credentials are supported by echoing the exact Origin, since browsers reject a
// wildcard when credentials are included.

export const DEFAULT_ALLOW_HEADERS =
  "Authorization,Content-Type,x-api-key,api-key,x-iot-token,x-iot-sn,x-iot-chat-id,x-iot-new-chat,x-iot-build-num,x-iot-build-time,x-iot-version-name,x-iot-version-code,x-iot-app-name,x-iot-rom-version,x-iot-local";

export const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Access-Control-Allow-Headers": DEFAULT_ALLOW_HEADERS,
  "Access-Control-Expose-Headers": "x-iot-chat-id",
};

export function corsFor(request) {
  const origin = request && request.headers.get("Origin");
  if (!origin) return { ...CORS_HEADERS };
  const headers = {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": DEFAULT_ALLOW_HEADERS,
    "Access-Control-Expose-Headers": "x-iot-chat-id",
    "Access-Control-Allow-Credentials": "true",
    Vary: "Origin",
  };
  const reqHeaders = request.headers.get("Access-Control-Request-Headers");
  if (reqHeaders) headers["Access-Control-Allow-Headers"] = reqHeaders;
  return headers;
}
