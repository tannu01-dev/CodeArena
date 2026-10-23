
require("dotenv").config();

const mongoose = require("mongoose");
const { pollOnce } = require("../services/judgeWorker");

async function main() {
  if (!process.env.MONGODB_URI) {
    throw new Error("MONGODB_URI is required.");
  }

  await mongoose.connect(process.env.MONGODB_URI);

  console.log(
    "CodeArena judge worker connected. Waiting for queued jobs..."
  );

  let stopping = false;

  process.on("SIGINT", () => {
    stopping = true;
  });

  process.on("SIGTERM", () => {
    stopping = true;
  });

  while (!stopping) {
    try {
      const found = await pollOnce();

      if (!found) {
        await new Promise((resolve) => setTimeout(resolve, 800));
      }
    } catch (error) {
      console.error("Judge worker error:", error.message);

      await new Promise((resolve) => setTimeout(resolve, 1500));
    }
  }

  await mongoose.disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
