const KEY = "sunday-showroom-state-v2";
let redisClientPromise = null;

module.exports = async function handler(request, response) {
  response.setHeader("Cache-Control", "no-store");
  response.setHeader("Content-Type", "application/json");

  if (!hasRedisConfig()) {
    response.statusCode = request.method === "GET" ? 200 : 503;
    response.end(JSON.stringify({
      ok: request.method === "GET",
      setupRequired: true,
      message: "Connect Redis in Vercel so REDIS_URL, or KV_REST_API_URL and KV_REST_API_TOKEN, are available.",
      state: null
    }));
    return;
  }

  try {
    if (request.method === "GET") {
      const saved = await kvCommand(["GET", KEY]);
      response.end(JSON.stringify({
        ok: true,
        setupRequired: false,
        state: saved ? JSON.parse(saved) : null
      }));
      return;
    }

    if (request.method === "POST") {
      const body = await readJson(request);
      const incoming = body.state || {};
      const previous = await kvCommand(["GET", KEY]);
      const state = mergeState(previous ? JSON.parse(previous) : null, incoming, body.mode);
      state.remoteUpdatedAt = new Date().toISOString();
      await kvCommand(["SET", KEY, JSON.stringify(state)]);
      response.end(JSON.stringify({ ok: true, setupRequired: false, state }));
      return;
    }

    response.statusCode = 405;
    response.end(JSON.stringify({ ok: false, message: "Method not allowed" }));
  } catch (error) {
    response.statusCode = 500;
    response.end(JSON.stringify({ ok: false, message: "State API failed" }));
  }
};

function mergeState(previous, incoming, mode) {
  if (!previous) return incoming;
  const responses = mode === "replaceResponses"
    ? incoming.responses || []
    : mergeResponses(previous.responses || [], incoming.responses || []);
  return {
    ...previous,
    ...incoming,
    responses
  };
}

function mergeResponses(previous, incoming) {
  const seen = new Set();
  return [...previous, ...incoming].filter((response) => {
    const key = response.completedAt || JSON.stringify(response);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function kvCommand(command) {
  if (process.env.REDIS_URL) return redisUrlCommand(command);

  const result = await fetch(`${process.env.KV_REST_API_URL}/pipeline`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.KV_REST_API_TOKEN}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify([command])
  });

  if (!result.ok) throw new Error("KV command failed");
  const payload = await result.json();
  if (payload[0]?.error) throw new Error(payload[0].error);
  return payload[0]?.result;
}

function hasRedisConfig() {
  return Boolean(process.env.REDIS_URL || (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN));
}

async function redisUrlCommand(command) {
  const client = await getRedisClient();
  const [operation, key, value] = command;
  if (operation === "GET") return client.get(key);
  if (operation === "SET") {
    await client.set(key, value);
    return "OK";
  }
  throw new Error(`Unsupported Redis operation: ${operation}`);
}

async function getRedisClient() {
  if (!redisClientPromise) {
    redisClientPromise = import("redis").then(async ({ createClient }) => {
      const client = createClient({ url: process.env.REDIS_URL });
      client.on("error", () => {});
      await client.connect();
      return client;
    });
  }
  return redisClientPromise;
}

function readJson(request) {
  return new Promise((resolve, reject) => {
    let data = "";
    request.on("data", (chunk) => {
      data += chunk;
      if (data.length > 8_000_000) {
        reject(new Error("Payload too large"));
        request.destroy();
      }
    });
    request.on("end", () => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch (error) {
        reject(error);
      }
    });
    request.on("error", reject);
  });
}
