import {
  deriveChatId,
  generateChatId,
  login,
  parseUpstreamSSE,
  resolveCommonParams,
  resolveSecret,
  resolveUpstreamModel,
  sendChatTurn,
} from "./upstream.js";
import {
  backfillHistory,
  estimateTokens,
  addUsage,
  getCachedToken,
  setCachedToken,
} from "./history.js";
import { CORS_HEADERS, corsFor } from "./cors.js";

// Injected as a prefix on the first turn of a brand-new conversation. Empty by
// default (no persona/system prompt is sent). Set a non-empty string to inject
// one.
const FIRST_TURN_SYSTEM_PROMPT = "";

function err(message, type, code, status, cors = CORS_HEADERS) {
  return new Response(
    JSON.stringify({ error: { message, type, param: null, code } }),
    { status, headers: { "Content-Type": "application/json; charset=utf-8", ...cors } }
  );
}

// Convert an upstream error payload into an OpenAI-style error response.
function upstreamErrorResponse(data, cors = CORS_HEADERS) {
  const msg = (data && (data.message || data.errMsg || data.errstr)) || "upstream error";
  const code = (data && data.errno) || "upstream_error";
  return err(`Upstream: ${msg}`, "api_error", code, 502, cors);
}

function lastUserContent(messages) {
  if (!Array.isArray(messages)) return "";
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m && m.role === "user") {
      if (typeof m.content === "string") return m.content;
      if (Array.isArray(m.content)) {
        return m.content
          .map((p) => (typeof p === "string" ? p : p && p.text ? p.text : ""))
          .join("");
      }
    }
  }
  return "";
}

export async function handleChatCompletions(request, env, cred) {
  const cors = corsFor(request);
  let body;
  try {
    body = await request.json();
  } catch {
    return err("Invalid JSON body", "invalid_request_error", null, 400, cors);
  }

  const messages = body.messages;
  if (!Array.isArray(messages) || messages.length === 0) {
    return err("'messages' must be a non-empty array", "invalid_request_error", null, 400, cors);
  }

  const content = lastUserContent(messages);
  if (!content) {
    return err("No user message content found", "invalid_request_error", null, 400, cors);
  }

  const requestedModel = body.model || env.DEFAULT_MODEL || "deepseek-v3";
  const resolvedModel = resolveUpstreamModel(requestedModel);
  if (!resolvedModel) {
    return err(
      `The model '${requestedModel}' does not exist or is not supported. Supported models: deepseek-v3, deepseek-r1, baike.`,
      "invalid_request_error",
      "model_not_found",
      404,
      cors
    );
  }
  const { model, reasoning, kind } = resolvedModel;
  const stream = body.stream === true; // OpenAI default: non-streaming unless explicitly requested

  // Resolve the auth token. The API key may carry one directly; otherwise we log
  // in with the client's sn + secret (cached per sn in KV) to obtain one.
  if (!request.headers.get("x-iot-token") && (!cred.token || typeof cred.token !== "string")) {
    const cached = await getCachedToken(env, cred.sn, cred.secret);
    if (cached) {
      cred.token = cached;
    } else {
      try {
        cred.token = await login(env, cred);
        await setCachedToken(env, cred.sn, cred.secret, cred.token);
      } catch (e) {
        return err(
          `Login failed: ${e.message}. Provide a valid 'secret-sn' or include a token.`,
          "authentication_error",
          "login_failed",
          401,
          cors
        );
      }
    }
  }

  // All device-specific params come from the client credential (public proxy).
  const commonParams = resolveCommonParams(cred, request);
  const secret = resolveSecret(cred);

  // Clear-context / new-chat signal. Upstream keeps conversation state keyed by
  // chatId, so "clearing" means starting a fresh chatId (see the APK's
  // clearContext). A new chat is chosen when any of these hold:
  //   - header x-iot-new-chat: true
  //   - a system message contains the marker [new_chat]
  //   - the request carries at most one non-system message (a lone user/assistant
  //     turn with no history) -> mirrors OpenAI's "stateless single message"
  //     mental model.
  const newChatHeader = (request.headers.get("x-iot-new-chat") || "").toLowerCase();
  const nonSystemCount = messages.filter((m) => m && m.role !== "system").length;
  const wantsNewChat =
    newChatHeader === "1" ||
    newChatHeader === "true" ||
    nonSystemCount <= 1 ||
    messages.some(
      (m) => m && m.role === "system" && typeof m.content === "string" && m.content.includes("[new_chat]")
    );

  // Determine the chat session. Priority:
  //   1. explicit x-iot-chat-id header (client owns the session)
  //   2. new-chat signal -> fresh chatId (clear context)
  //   3. multi-turn history -> a chatId derived from the conversation's first
  //      non-system message, so the same history reuses the same upstream thread
  //   4. otherwise -> most recent upstream thread
  let chatId = request.headers.get("x-iot-chat-id") || "";
  const pinnedChatId = chatId;
  if (!chatId && wantsNewChat) {
    chatId = generateChatId(commonParams.sn);
  }
  if (!chatId) {
    const firstNonSystem = messages.find((m) => m && m.role !== "system");
    const seedContent = firstNonSystem
      ? typeof firstNonSystem.content === "string"
        ? firstNonSystem.content
        : JSON.stringify(firstNonSystem.content)
      : content;
    chatId = deriveChatId(commonParams.sn, seedContent);
  }

  // Backfill: if this is a multi-turn request (history carries earlier turns),
  // replay the prefix into the upstream thread so the model remembers it. The
  // last user message is then sent as the live turn below. Backfill is a no-op
  // for single-message requests or when no HISTORY KV binding is configured.
  //
  // The first turn of a brand-new thread carries the injected system prompt
  // (see FIRST_TURN_SYSTEM_PROMPT). The first turn is either the live turn (new
  // chat / no backfill) or backfill's index-0 replay.
  const canBackfill = !pinnedChatId && !wantsNewChat;
  let liveContent = content;
  let isFirstTurn = !pinnedChatId;
  if (canBackfill) {
    const { final, replayedTo, firstTurnDone } = await backfillHistory(
      env,
      commonParams,
      secret,
      chatId,
      messages,
      model,
      kind,
      FIRST_TURN_SYSTEM_PROMPT
    );
    if (final && final.role === "user") {
      liveContent = lastUserContent([final]) || content;
    }
    // If any history was replayed, backfill already put the prompt on turn 0, so
    // the live turn is not the first. If the KV entry pre-existed (firstTurnDone),
    // the thread was already started earlier either way.
    isFirstTurn = !(firstTurnDone || replayedTo > 0);
  }

  if (isFirstTurn && FIRST_TURN_SYSTEM_PROMPT) {
    liveContent = `${FIRST_TURN_SYSTEM_PROMPT}\n\n${liveContent}`;
  }

  const upstream = await sendChatTurn(env, commonParams, secret, {
    chatId,
    content: liveContent,
    model,
    role: "user",
    kind,
  });

  if (!upstream.ok) {
    const text = await upstream.text().catch(() => "");
    return err(
      `Upstream HTTP ${upstream.status}: ${text.slice(0, 300)}`,
      "api_error",
      "upstream_error",
      502,
      cors
    );
  }

  const created = Math.floor(Date.now() / 1000);
  const id = `chatcmpl-${crypto.randomUUID().replace(/-/g, "")}`;
  const promptTokens = estimateTokens(
    messages.map((m) => (typeof m.content === "string" ? m.content : JSON.stringify(m.content))).join("\n")
  );
  const meta = {
    id,
    created,
    model: requestedModel,
    reasoning,
    promptTokens,
    sn: commonParams.sn,
    env,
    // If the client didn't pin a chatId, echo the upstream chatId back via a
    // response header once we learn it (from the "done" event) so callers can
    // persist the thread. `sessionHolder` is filled by the parsers below.
    pinnedChatId,
  };

  if (!stream) {
    return aggregate(upstream, meta, cors);
  }

  return streamResponse(upstream, meta, cors);
}

// Non-streaming: collect all upstream chunks and emit a single JSON response.
async function aggregate(upstream, meta, cors) {
  let text = "";
  let reason = "";
  let upstreamChatId = "";
  let upstreamError = null;
  for await (const evt of parseUpstreamSSE(upstream)) {
    if (evt.event === "message" && evt.data) {
      if (typeof evt.data.content === "string") text += evt.data.content;
      if (typeof evt.data.reasonContent === "string") reason += evt.data.reasonContent;
    } else if (evt.event === "done" && evt.data && evt.data.chatId) {
      upstreamChatId = evt.data.chatId;
    } else if ((evt.event === "error" || evt.event === "notAllow") && evt.data) {
      upstreamError = evt.data;
    } else if (evt.data && typeof evt.data === "object" && evt.data.errno) {
      // Upstream sometimes replies with a bare JSON error object (no SSE frame),
      // e.g. {"errno":20600012,...,"message":"error.sn.null"}.
      upstreamError = evt.data;
    }
  }
  if (upstreamError && !text) {
    return upstreamErrorResponse(upstreamError, cors);
  }
  const message = { role: "assistant", content: text };
  if (reason) message.reasoning_content = reason;
  const completionTokens = estimateTokens(text + reason);
  const promptTokens = meta.promptTokens || 0;
  await addUsage(meta.env, meta.sn, {
    prompt_tokens: promptTokens,
    completion_tokens: completionTokens,
  });
  const payload = {
    id: meta.id,
    object: "chat.completion",
    created: meta.created,
    model: meta.model,
    choices: [
      {
        index: 0,
        message,
        finish_reason: "stop",
      },
    ],
    usage: {
      prompt_tokens: promptTokens,
      completion_tokens: completionTokens,
      total_tokens: promptTokens + completionTokens,
    },
  };
  const headers = { "Content-Type": "application/json; charset=utf-8", ...cors };
  if (upstreamChatId) headers["x-iot-chat-id"] = upstreamChatId;
  return new Response(JSON.stringify(payload), { headers });
}

// Streaming: translate upstream SSE events to OpenAI chat.completion.chunk frames.
function streamResponse(upstream, meta, cors) {
  const { readable, writable } = new TransformStream();
  const writer = writable.getWriter();
  const encoder = new TextEncoder();

  const send = (obj) =>
    writer.write(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));

  const frame = (delta, finish = null) => ({
    id: meta.id,
    object: "chat.completion.chunk",
    created: meta.created,
    model: meta.model,
    choices: [{ index: 0, delta, finish_reason: finish }],
  });

  // Signal an X-IoT-Chat-Id response header. With a streamed body the status
  // line is already sent, so we expose the chatId as a first SSE comment and in
  // a custom chunk-less header is not possible; instead we emit it as a
  // non-standard field on the final [DONE]-adjacent frame meta is not sent.
  // Simpler: clients should pin chatId via x-iot-chat-id, but we still surface
  // it as a comment line for observability.
  let chatIdCommentSent = false;

  (async () => {
    let sawError = null;
    let sawText = false;
    let completionText = "";
    try {
      // Initial role frame.
      await send(frame({ role: "assistant", content: "" }));

      for await (const evt of parseUpstreamSSE(upstream)) {
        if (evt.event === "message" && evt.data) {
          const reason = evt.data.reasonContent;
          if (typeof reason === "string" && reason.length > 0) {
            completionText += reason;
            await send(frame({ reasoning_content: reason }));
          }
          const piece = evt.data.content;
          if (typeof piece === "string" && piece.length > 0) {
            sawText = true;
            completionText += piece;
            await send(frame({ content: piece }));
          }
        } else if (evt.event === "done") {
          if (evt.data && evt.data.chatId && !chatIdCommentSent) {
            chatIdCommentSent = true;
            await writer.write(encoder.encode(`: x-iot-chat-id ${evt.data.chatId}\n\n`));
          }
        } else if ((evt.event === "error" || evt.event === "notAllow") && evt.data) {
          sawError = evt.data;
        }
      }

      if (sawError && !sawText) {
        const msg = sawError.message || sawError.errMsg || sawError.errstr || "upstream error";
        await send(frame({ content: `[upstream error: ${msg}]` }, "stop"));
      } else {
        await send(frame({}, "stop"));
      }
      // Final usage frame (OpenAI sends usage on the last chunk when enabled).
      const promptTokens = meta.promptTokens || 0;
      const completionTokens = estimateTokens(completionText);
      await send({
        id: meta.id,
        object: "chat.completion.chunk",
        created: meta.created,
        model: meta.model,
        choices: [],
        usage: {
          prompt_tokens: promptTokens,
          completion_tokens: completionTokens,
          total_tokens: promptTokens + completionTokens,
        },
      });
      await addUsage(meta.env, meta.sn, {
        prompt_tokens: promptTokens,
        completion_tokens: completionTokens,
      });
      await writer.write(encoder.encode("data: [DONE]\n\n"));
    } catch (e) {
      await send(frame({ content: `\n[proxy error: ${e.message}]` }, "stop"));
      await writer.write(encoder.encode("data: [DONE]\n\n"));
    } finally {
      await writer.close();
    }
  })();

  return new Response(readable, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      ...cors,
    },
  });
}
