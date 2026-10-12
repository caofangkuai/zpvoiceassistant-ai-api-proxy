import { CORS_HEADERS } from "./cors.js";

export function handleModels(env, cors = CORS_HEADERS) {
  const created = Math.floor(Date.now() / 1000);
  const ids = ["deepseek-v3", "deepseek-r1"];
  return new Response(
    JSON.stringify({
      object: "list",
      data: ids.map((id) => ({
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
