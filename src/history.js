// Conversation history backfill.
//
// The upstream assistant keeps conversation state keyed by chatId. When a client
// sends the FULL OpenAI message history in a single request (e.g. after a page
// reload), the proxy must replay the earlier turns into the upstream thread so
// the model can "remember" them. Replaying is done one turn at a time (the
// upstream ignores extra messages in a multi-message body).
//
// To avoid re-replaying turns that were already sent, we track how many
// non-system messages of a given (sn, chatId) conversation have been replayed in
// a KV namespace. Without a KV binding, backfill is skipped.

import { sendChatTurn } from "./upstream.js";

const PREFIX = "hist:";
const TOKEN_PREFIX = "tok:";

function key(sn, chatId) {
  return `${PREFIX}${sn}:${chatId}`;
}

// Cache a freshly-logged-in token keyed by sn + secret fingerprint so we don't
// hit the login endpoint on every request, and so different secrets with the
// same sn never share a token. Tokens are JWTs with their own expiry; we keep a
// short TTL.
export async function getCachedToken(env, sn, secret) {
  if (!env.HISTORY || !sn) return "";
  try {
    return (await env.HISTORY.get(`${TOKEN_PREFIX}${sn}:${secretKey(secret)}`)) || "";
  } catch {
    return "";
  }
}

export async function setCachedToken(env, sn, secret, token) {
  if (!env.HISTORY || !sn || !token) return;
  try {
    await env.HISTORY.put(`${TOKEN_PREFIX}${sn}:${secretKey(secret)}`, token, {
      expirationTtl: 60 * 60 * 12,
    });
  } catch {
    // best-effort
  }
}

// Short non-cryptographic fingerprint of the secret, for the token cache key.
function secretKey(secret) {
  let h = 5381;
  const s = String(secret || "");
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return h.toString(16);
}

const USAGE_PREFIX = "usage:";
const USAGE_TTL = 60 * 60 * 24 * 30; // 30 days

// Rough token estimate. The upstream never reports usage, so we approximate with
// a chars/4 heuristic (common for mixed CJK/Latin). Good enough for accounting.
export function estimateTokens(text) {
  if (!text) return 0;
  const s = typeof text === "string" ? text : String(text);
  return Math.max(1, Math.ceil(s.length / 4));
}

// Per-sn cumulative usage record stored in KV. Returns the record (or a zeroed
// one). KV is eventually consistent, so counts are best-effort.
export async function getUsage(env, sn) {
  const empty = { requests: 0, prompt_tokens: 0, completion_tokens: 0, updated: 0 };
  if (!env.HISTORY || !sn) return empty;
  try {
    const v = await env.HISTORY.get(`${USAGE_PREFIX}${sn}`, "json");
    return v && typeof v === "object" ? { ...empty, ...v } : empty;
  } catch {
    return empty;
  }
}

// Accumulate a usage delta onto the per-sn record.
export async function addUsage(env, sn, delta) {
  if (!env.HISTORY || !sn || !delta) return;
  try {
    const cur = await getUsage(env, sn);
    const next = {
      requests: (cur.requests || 0) + 1,
      prompt_tokens: (cur.prompt_tokens || 0) + (delta.prompt_tokens || 0),
      completion_tokens: (cur.completion_tokens || 0) + (delta.completion_tokens || 0),
      updated: Date.now(),
    };
    await env.HISTORY.put(`${USAGE_PREFIX}${sn}`, JSON.stringify(next), {
      expirationTtl: USAGE_TTL,
    });
  } catch {
    // best-effort
  }
}

// Read the number of already-replayed non-system messages for this conversation.
export async function getReplayedCount(env, sn, chatId) {
  if (!env.HISTORY) return 0;
  try {
    const v = await env.HISTORY.get(key(sn, chatId));
    const n = parseInt(v || "0", 10);
    return Number.isFinite(n) && n > 0 ? n : 0;
  } catch {
    return 0;
  }
}

// Persist the number of replayed non-system messages for this conversation.
export async function setReplayedCount(env, sn, chatId, count) {
  if (!env.HISTORY) return;
  try {
    await env.HISTORY.put(key(sn, chatId), String(count), {
      expirationTtl: 60 * 60 * 24 * 7,
    });
  } catch {
    // best-effort; ignore
  }
}

function contentToString(m) {
  if (!m) return "";
  if (typeof m.content === "string") return m.content;
  if (Array.isArray(m.content)) {
    return m.content
      .map((p) => (typeof p === "string" ? p : p && p.text ? p.text : ""))
      .join("");
  }
  return "";
}

// Replay the history prefix (all non-system messages except the final one) into
// the upstream thread, then return the final message so the caller can send it as
// the live turn. Returns { final, replayedTo, firstTurnDone }.
//
// `messages` is the raw OpenAI messages array (may include system messages).
// `firstTurnPrefix` is prepended to the very first turn sent into a brand-new
// thread (index 0), so a fresh conversation starts with the injected system
// instruction.
export async function backfillHistory(
  env,
  commonParams,
  secret,
  chatId,
  messages,
  model,
  kind,
  firstTurnPrefix = ""
) {
  const nonSystem = messages.filter((m) => m && m.role !== "system");
  // The last non-system message is the live turn (sent by the caller).
  const history = nonSystem.slice(0, -1);
  const final = nonSystem[nonSystem.length - 1];

  if (!env.HISTORY || history.length === 0) {
    return { final, replayedTo: history.length, firstTurnDone: false };
  }

  const already = await getReplayedCount(env, commonParams.sn, chatId);
  // Replay from `already` up to history.length (exclusive). Replaying an
  // assistant turn returns an empty stream but still records it in the thread.
  for (let i = already; i < history.length; i++) {
    const m = history[i];
    const role = m.role === "assistant" ? "assistant" : "user";
    let content = contentToString(m);
    if (!content) continue;
    if (i === 0 && firstTurnPrefix) {
      content = `${firstTurnPrefix}\n\n${content}`;
    }
    try {
      const res = await sendChatTurn(env, commonParams, secret, {
        chatId,
        content,
        model,
        role,
        kind,
      });
      // Drain the body so the request completes and the upstream records it.
      await res.text();
    } catch {
      // If a replay fails, stop and don't advance the counter past it.
      await setReplayedCount(env, commonParams.sn, chatId, i);
      return { final, replayedTo: i, firstTurnDone: already > 0 };
    }
  }

  await setReplayedCount(env, commonParams.sn, chatId, history.length);
  return { final, replayedTo: history.length, firstTurnDone: already > 0 };
}
