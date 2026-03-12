import { getStore } from "@netlify/blobs";

const STORE_NAME = "goalie-data";
const GAMES_KEY = "games";

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export default async (req) => {
  const store = getStore({ name: STORE_NAME, consistency: "strong" });

  if (req.method === "GET") {
    const games = await store.get(GAMES_KEY, { type: "json" });
    return jsonResponse(games || []);
  }

  if (req.method === "PUT") {
    const games = await req.json();
    if (!Array.isArray(games)) {
      return jsonResponse({ error: "Expected an array of games" }, 400);
    }
    await store.setJSON(GAMES_KEY, games);
    return jsonResponse({ ok: true });
  }

  return jsonResponse({ error: "Method not allowed" }, 405);
};
