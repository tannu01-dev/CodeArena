const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const cookieParser = require("cookie-parser");

const app = express();

// Core routes
const authRoutes = require("./routes/auth.routes");
const profileRoutes = require("./routes/profile.routes");
const dashboardRoutes = require("./routes/dashboard.routes");

// Assessment and coding workspace routes (Phases 4-10)
const problemRoutes = require("./routes/problem.routes");
const assessmentRoutes = require("./routes/assessment.routes");
const attemptRoutes = require("./routes/attempt.routes");
const workspaceRoutes = require("./routes/workspace.routes");
const judgeRoutes = require("./routes/judge.routes");
const integrityRoutes = require("./routes/integrity.routes");

// Reporting, talent, hiring and administration routes (Phases 11-14)
const resultsRoutes = require("./routes/results.routes");
const talentRoutes = require("./routes/talent.routes");
const hiringRoutes = require("./routes/hiring.routes");
const adminRoutes = require("./routes/admin.routes");

app.disable("x-powered-by");
app.use(helmet());
app.use(cors({
  origin: (process.env.FRONTEND_URL || "http://localhost:3000").split(",").map((value) => value.trim()),
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
}));
app.use(express.json({ limit: "1mb" }));
app.use(cookieParser());

app.get("/", (req, res) => {
  res.json({ success: true, name: "CodeArena API", version: "2.0.0" });
});

app.get("/api/health/live", (req, res) => {
  res.json({ success: true, status: "alive", timestamp: new Date().toISOString() });
});

app.get("/api/health", (req, res) => {
  const connected = require("mongoose").connection.readyState === 1;
  res.status(connected ? 200 : 503).json({
    success: connected,
    status: connected ? "healthy" : "degraded",
    services: { mongodb: connected ? "connected" : "disconnected" },
  });
});

app.use("/api/auth", authRoutes);
app.use("/api/profile", profileRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/problems", problemRoutes);
app.use("/api/assessments", assessmentRoutes);
app.use("/api/attempts", attemptRoutes);
app.use("/api/workspace", workspaceRoutes);
app.use("/api/judge", judgeRoutes);
app.use("/api/integrity", integrityRoutes);
app.use("/api/results", resultsRoutes);
app.use("/api/talent", talentRoutes);
app.use("/api/hiring", hiringRoutes);
app.use("/api/admin", adminRoutes);

app.use("/api", (req, res) => {
  res.status(404).json({ success: false, message: "API route not found" });
});

app.use((err, req, res, next) => {
  if (res.headersSent) return next(err);
  console.error(err);
  res.status(err.status || 500).json({
    success: false,
    message: err.status && err.status < 500 ? err.message : "An unexpected server error occurred",
  });
});

module.exports = app;
