const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");
const Attempt = require("../models/Attempt");
const Assessment = require("../models/Assessment");

function extractToken(socket) {
  const authToken = socket.handshake.auth?.token;
  if (authToken) return authToken;
  const header = socket.handshake.headers?.authorization || "";
  if (header.startsWith("Bearer ")) return header.slice(7);
  const cookieHeader = socket.handshake.headers?.cookie || "";
  const tokenPair = cookieHeader.split(";").map((x) => x.trim()).find((x) => x.startsWith("token="));
  return tokenPair ? decodeURIComponent(tokenPair.slice(6)) : null;
}
function attachCodeArenaSocket(httpServer, options = {}) {
  const io = new Server(httpServer, { cors: { origin: (process.env.CLIENT_URL || "http://localhost:3000").split(",").map((x) => x.trim()), credentials: true }, ...options });
  io.use((socket, next) => {
    try { const token = extractToken(socket); if (!token) return next(new Error("Authentication required")); const decoded = jwt.verify(token, process.env.JWT_SECRET); const id = decoded.id || decoded.userId || decoded._id || decoded.sub; if (!id) return next(new Error("Invalid token")); socket.user = { id: String(id), role: decoded.role || "candidate" }; next(); }
    catch (e) { next(new Error("Invalid or expired session")); }
  });
  io.on("connection", (socket) => {
    socket.join(`user:${socket.user.id}`);
    if (socket.user.role === "admin") socket.join("admins");
    socket.on("attempt:watch", async ({ attemptId } = {}) => {
      try {
        if (!attemptId) return socket.emit("realtime:error", { message: "attemptId required" });
        const attempt = await Attempt.findById(attemptId).select("_id userId assessmentId status deadlineAt submittedAt endedReason").lean();
        if (!attempt) return socket.emit("realtime:error", { message: "Attempt not found" });
        let allowed = socket.user.role === "admin" || String(attempt.userId) === socket.user.id;
        if (!allowed && socket.user.role === "recruiter") { const assessment = await Assessment.findById(attempt.assessmentId).select("createdBy").lean(); allowed = Boolean(assessment && String(assessment.createdBy) === socket.user.id); }
        if (!allowed) return socket.emit("realtime:error", { message: "Not allowed to watch this attempt" });
        socket.join(`attempt:${attempt._id}`);
        socket.emit("attempt:state", { attemptId: String(attempt._id), status: attempt.status, deadlineAt: attempt.deadlineAt, submittedAt: attempt.submittedAt, endedReason: attempt.endedReason || "", serverTime: new Date().toISOString() });
      } catch (e) { socket.emit("realtime:error", { message: "Could not watch attempt" }); }
    });
    socket.on("disconnect", () => {});
  });
  const timer = setInterval(async () => {
    try {
      const now = new Date();
      const due = await Attempt.find({ status: "in_progress", deadlineAt: { $ne: null, $lte: now } }).select("_id userId assessmentId deadlineAt").limit(100).lean();
      for (const a of due) io.to(`attempt:${a._id}`).emit("attempt:deadline", { attemptId: String(a._id), deadlineAt: a.deadlineAt, serverTime: now.toISOString() });
      if (due.length) io.to("admins").emit("system:attempt-deadlines", { dueCount: due.length, checkedAt: now.toISOString() });
    } catch (e) { console.error("Realtime deadline monitor failed:", e.message); }
  }, Math.max(5000, Number(process.env.REALTIME_POLL_MS) || 15000));
  if (typeof timer.unref === "function") timer.unref();
  io.on("close", () => clearInterval(timer));
  return io;
}
module.exports = { attachCodeArenaSocket };
