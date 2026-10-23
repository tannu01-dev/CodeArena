const { pollOnce } = require("./judgeWorker");

let started = false;
let stopping = false;

function sleep(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }

function startJudgeWorkerRunner() {
  if (started) return;
  started = true;
  stopping = false;
  console.log("CodeArena judge worker started inside API process.");
  (async function loop() {
    while (!stopping) {
      try {
        const found = await pollOnce();
        if (!found) await sleep(800);
      } catch (error) {
        console.error("Judge worker loop error:", error.message);
        await sleep(1500);
      }
    }
  })();
}

function stopJudgeWorkerRunner() { stopping = true; }
module.exports = { startJudgeWorkerRunner, stopJudgeWorkerRunner };
