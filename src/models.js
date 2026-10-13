import { CORS_HEADERS } from "./cors.js";
import { SUPPORTED_MODELS } from "./upstream.js";

export function handleModels(env, cors = CORS_HEADERS) {
  const created = Math.floor(Date.now() / 1000);
  return new Response(
    JSON.stringify({
      object: "list",
      data: SUPPORTED_MODELS.map((id) => ({
        id,
        object: "model",
        created,
        owned_by: "iot-study",
      })),
    }),
    {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        ...cors,
      },
    }
  );
}
