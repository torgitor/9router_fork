/**
 * Strip MiniMax M3  thinking... response tags from OpenAI-format responses.
 * MiniMax embeds thinking as XML tags inside the content field in its
 * native OpenAI endpoint — we strip them here so clients see clean output.
 */

// Non-streaming: simple regex (everything in one JSON blob)
export function stripThinkFromResponse(responseBody) {
  if (!responseBody?.choices) return responseBody;
  for (const choice of responseBody.choices) {
    const msg = choice?.message || choice?.delta;
    if (msg?.content && typeof msg.content === "string") {
      msg.content = stripThinkTags(msg.content);
    }
  }
  return responseBody;
}

// Apply to a raw SSE data string (used in passthrough streaming)
export function stripThinkFromSSEChunk(dataStr) {
  try {
    const parsed = JSON.parse(dataStr);
    const delta = parsed?.choices?.[0]?.delta;
    if (delta?.content && typeof delta.content === "string") {
      delta.content = stripThinkTags(delta.content);
    }
    return JSON.stringify(parsed);
  } catch {
    return dataStr;
  }
}

// Core: strip  thinking... response (with optional newlines) from text.
// Handles multi-line thinking blocks via the `s` flag (dot matches newlines).
// Also strips leading whitespace that follows a  response tag.
export function stripThinkTags(text) {
  if (typeof text !== "string") return text;
  return text
    .replace(/ thinking[\s\S]*?<\/think>\s*/g, "")
    .trimStart();
}

// Stream-safe version: strips  thinking tags across chunks using a state object.
// Returns the stripped content string. Mutates state.
export function stripThinkFromDelta(deltaContent, state) {
  if (typeof deltaContent !== "string" || !deltaContent) return deltaContent;

  let s = deltaContent;
  if (state.inside) {
    const ei = s.indexOf(" response");
    if (ei >= 0) {
      state.inside = false;
      s = s.slice(ei + 8).trimStart();
    } else {
      return "";
    }
  }
  if (!state.inside) {
    const si = s.indexOf(" thinking");
    if (si >= 0) {
      const after = s.slice(si + 7);
      const ei = after.indexOf(" response");
      if (ei >= 0) {
        s = s.slice(0, si) + after.slice(ei + 8).trimStart();
      } else {
        state.inside = true;
        s = s.slice(0, si);
      }
    }
  }
  return s || "";
}