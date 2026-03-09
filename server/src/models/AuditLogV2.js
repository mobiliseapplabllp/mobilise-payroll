const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema({
  entity: { type: mongoose.Schema.Types.ObjectId, ref: 'Entity' },
  module: { type: String, required: true, index: true },
  action: { type: String, required: true, index: true },
  // CREATE, READ, UPDATE, DELETE, APPROVE, REJECT, LOGIN, LOGOUT,
  // LOGIN_FAILED, EXPORT, DOWNLOAD, SWITCH_ENTITY, PROCESS, LOCK, UNLOCK
  actionDetail: { type: String, default: '' },
  recordId: String,
  recordName: String,
  beforeValue: mongoose.Schema.Types.Mixed,
  afterValue: mongoose.Schema.Types.Mixed,
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  userName: String,
  userRole: String,
  ipAddress: String,
  browserInfo: String,
  sessionId: String,
  durationMs: Number,
}, { timestamps: true });

auditLogSchema.index({ createdAt: -1 });
auditLogSchema.index({ module: 1, action: 1, createdAt: -1 });
auditLogSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model('AuditLogV2', auditLogSchema);
