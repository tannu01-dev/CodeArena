
const { createClient } = require("redis");

let client = null;
let connectionPromise = null;

async function connectRedis() {
  if (!process.env.REDIS_URL) {
    return {
      status: "not_configured",
      message: "REDIS_URL is not configured"
    };
  }

  if (client?.isReady) {
    return { status: "connected" };
  }

  if (connectionPromise) {
    return connectionPromise;
  }

  client = createClient({
    url: process.env.REDIS_URL,
    socket: {
      connectTimeout: 4000,
      reconnectStrategy: false
    }
  });

  // Avoid an unhandled EventEmitter error if Redis is unavailable.
  client.on("error", () => {});

  connectionPromise = client
    .connect()
    .then(() => ({ status: "connected" }))
    .catch(async (error) => {
      const failedClient = client;
      client = null;

      if (failedClient) {
        try {
          failedClient.destroy();
        } catch {}
      }

      throw error;
    })
    .finally(() => {
      connectionPromise = null;
    });

  return connectionPromise;
}

function getRedisStatus() {
  if (!process.env.REDIS_URL) return "not_configured";
  if (client?.isReady) return "connected";
  if (connectionPromise) return "connecting";
  return "disconnected";
}

async function disconnectRedis() {
  const currentClient = client;
  client = null;

  if (currentClient?.isOpen) {
    await currentClient.quit();
  }
}

module.exports = {
  connectRedis,
  getRedisStatus,
  disconnectRedis
};
