const KEY = "sunday-circle-state-v1";

const emptyState = {
  responses: [],
  brackets: {},
  groupRules: {},
  imageSettings: {},
  comparisonMode: "off",
  updatedAt: null,
  audit: []
};

module.exports = async function handler(request, response) {
  response.setHeader("Cache-Control", "no-store");
  response.setHeader("Content-Type", "application/json");

  if (!process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN) {
    response.statusCode = request.method === "GET" ? 200 : 503;
    response.end(JSON.stringify({
      ok: request.method === "GET",
      setupRequired: true,
      message: "Connect Vercel KV/Redis to enable shared employee pilot data.",
      state: null
    }));
    return;
  }

  try {
    if (request.method === "GET") {
      const state = await kvCommand(["GET", KEY]);
      response.end(JSON.stringify({
        ok: true,
        setupRequired: false,
        state: state ? JSON.parse(state) : emptyState
      }));
      return;
    }

    if (request.method === "POST") {
      const body = await readJson(request);
      const state = {
        ...emptyState,
        ...(body.state || {}),
        updatedAt: new Date().toISOString()
      };
      await kvCommand(["SET", KEY, JSON.stringify(state)]);
      response.end(JSON.stringify({ ok: true, state }));
      return;
    }

    response.statusCode = 405;
    response.end(JSON.stringify({ ok: false, message: "Method not allowed" }));
  } catch (error) {
    response.statusCode = 500;
    response.end(JSON.stringify({ ok: false, message: "State API failed" }));
  }
};

async function kvCommand(command) {
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

function readJson(request) {
  return new Promise((resolve, reject) => {
    let data = "";
    request.on("data", (chunk) => {
      data += chunk;
      if (data.length > 4_000_000) {
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
