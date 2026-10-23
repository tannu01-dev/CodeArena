const AuditLog = require("../models/AuditLog");
async function audit(req, action, entityType = "system", entityId = "", metadata = {}) {
  try {
    await AuditLog.create({ actorId: req.user?.id || null, action, entityType, entityId: String(entityId || ""), metadata, ip: req.ip || "", userAgent: req.get?.("user-agent") || "" });
  } catch (error) {
    // Auditing must not break the business request, but the failure remains visible in server logs.
    console.error("CodeArena audit write failed:", error.message);
  }
}
module.exports = { audit };
