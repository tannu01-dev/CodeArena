require("dotenv").config();

const http = require("http");
const app = require("./app");
const { connectDatabase } = require("./config/database");
const { attachCodeArenaSocket } = require("./sockets/codearenaSocket");
const { startJudgeWorkerRunner, stopJudgeWorkerRunner } = require("./services/judgeWorkerRunner");

async function startServer() {
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
    throw new Error("Set a JWT_SECRET of at least 32 characters in backend/.env");
  }

  await connectDatabase();
  // Start the queue consumer with the API so evaluations do not silently remain queued
  // because a second terminal/worker process was never started.
  startJudgeWorkerRunner();

  const port = Number(process.env.PORT) || 5000;
  const httpServer = http.createServer(app);
  attachCodeArenaSocket(httpServer, {});
  httpServer.listen(port, () => {
    console.log(`CodeArena API running at http://localhost:${port}`);
    console.log(`Authentication: http://localhost:${port}/api/auth`);
  });

  function shutdown() {
    stopJudgeWorkerRunner();
    httpServer.close(() => {
      require("mongoose").disconnect().finally(() => process.exit(0));
    });
  }
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

startServer().catch((error) => {
  console.error("Failed to start CodeArena:", error.message);
  process.exit(1);
});
