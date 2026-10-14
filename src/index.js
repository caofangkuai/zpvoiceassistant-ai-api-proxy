import { handleChatCompletions } from "./openai.js";
import { handleModels } from "./models.js";
import { decodeCredential, extractApiKey } from "./credential.js";
import { corsFor } from "./cors.js";
import { renderHome } from "./ui.js";
import { getUsage } from "./history.js";

function json(data, status = 200, request = null) {
  const cors = request ? corsFor(request) : { "Access-Control-Allow-Origin": "*" };
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...cors },
  });
}

function errorBody(message, type = "invalid_request_error", code = null) {
  return { error: { message, type, param: null, code } };
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const { pathname } = url;

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsFor(request) });
    }

    // Health check (no auth) so the worker is easily probeable.
    if (pathname === "/health") {
      return json({ status: "ok", service: "iot-ai-proxy" }, 200, request);
    }

    // Home page: build an API key and chat for debugging.
    if ((pathname === "/" || pathname === "/ui") && (request.method === "GET" || request.method === "HEAD")) {
      return renderHome(request.headers.get("x-mount-base") || "");
    }

    // Public model list for OpenAI-compatible clients.
    if (pathname === "/v1/models" && request.method === "GET") {
      return handleModels(env, corsFor(request));
    }

    // Token usage accounting for the caller's sn (requires the API key).
    if (pathname === "/v1/usage" && request.method === "GET") {
      const apiKey = extractApiKey(request);
      if (!apiKey) {
        return json(
          errorBody("Missing API key.", "authentication_error", "invalid_api_key"),
          401,
          request
        );
      }
      let cred;
      try {
        cred = decodeCredential(apiKey);
      } catch (e) {
        return json(errorBody(`Invalid API key: ${e.message}`, "authentication_error", "invalid_api_key"), 401, request);
      }
      const usage = await getUsage(env, cred.sn);
      return json({ object: "usage", sn: cred.sn, ...usage }, 200, request);
    }

    if (pathname === "/v1/chat/completions") {
      if (request.method !== "POST") {
        return json(errorBody("Method not allowed", "invalid_request_error"), 405, request);
      }

      // This is a public proxy: the API key IS the credential. It must be a
      // "secret-sn" string (or base64-encoded JSON) carrying the caller's
      // device params.
      const apiKey = extractApiKey(request);
      if (!apiKey) {
        return json(
          errorBody("Missing API key. Provide a 'secret-sn' credential as the Bearer token.", "authentication_error", "invalid_api_key"),
          401,
          request
        );
      }
      let cred;
      try {
        cred = decodeCredential(apiKey);
      } catch (e) {
        return json(errorBody(`Invalid API key: ${e.message}`, "authentication_error", "invalid_api_key"), 401, request);
      }

      try {
        return await handleChatCompletions(request, env, cred);
      } catch (err) {
        return json(errorBody(`Upstream error: ${err.message}`, "api_error"), 502, request);
      }
    }

    return json(errorBody(`Unknown route: ${pathname}`, "invalid_request_error", "not_found"), 404, request);
  },
};
