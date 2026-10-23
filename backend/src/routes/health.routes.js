
const express = require("express");
const mongoose = require("mongoose");
const {
  connectDatabase,
  getDatabaseStatus
} = require("../config/database");
const {
  connectRedis,
  getRedisStatus
} = require("../config/redis");

const router = express.Router();

router.get("/", async (req, res) => {
  const services = {
    mongodb: await getDatabaseStatus(),
    redis: getRedisStatus()
  };

  // Attempt connections when a service is configured.
  if (process.env.MONGODB_URI && services.mongodb !== "connected") {
    try {
      const result = await connectDatabase();
      services.mongodb = result.status;
    } catch {
      services.mongodb = await getDatabaseStatus();
    }
  }

  if (process.env.REDIS_URL && services.redis !== "connected") {
    try {
      const result = await connectRedis();
      services.redis = result.status;
    } catch {
      services.redis = getRedisStatus();
    }
  }

  const databaseRequired = Boolean(process.env.MONGODB_URI);
  const redisRequired = Boolean(process.env.REDIS_URL);

  const databaseHealthy =
    !databaseRequired || services.mongodb === "connected";
  const redisHealthy =
    !redisRequired || services.redis === "connected";

  const healthy = databaseHealthy && redisHealthy;

  res.status(healthy ? 200 : 503).json({
    success: healthy,
    service: "CodeArena API",
    status: healthy ? "healthy" : "degraded",
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime()),
    services
  });
});

router.get("/live", (req, res) => {
  res.status(200).json({
    success: true,
    status: "alive",
    timestamp: new Date().toISOString()
  });
});

module.exports = router;
