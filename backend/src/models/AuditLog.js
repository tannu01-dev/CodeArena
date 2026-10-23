const mongoose = require("mongoose");
const auditLogSchema = new mongoose.Schema({
  actorId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null, index: true },
  action: { type: String, required: true, maxlength: 120, index: true },
  entityType: { type: String, default: "system", maxlength: 80 },
  entityId: { type: String, default: "", maxlength: 120 },
  metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  ip: { type: String, default: "", maxlength: 80 },
  userAgent: { type: String, default: "", maxlength: 500 },
  createdAt: { type: Date, default: Date.now, index: true }
}, { versionKey: false });
module.exports = mongoose.models.AuditLog || mongoose.model("AuditLog", auditLogSchema);
