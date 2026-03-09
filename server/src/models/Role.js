const mongoose = require('mongoose');

const roleSchema = new mongoose.Schema({
  code: { type: String, required: true, unique: true, uppercase: true },
  name: { type: String, required: true },
  description: { type: String, default: '' },
  level: { type: Number, default: 0 }, // hierarchy: 0=lowest, 100=highest
  isSystem: { type: Boolean, default: false }, // system roles cannot be deleted
  isActive: { type: Boolean, default: true },
  color: { type: String, default: '#64748B' }, // UI badge color
}, { timestamps: true });

module.exports = mongoose.model('Role', roleSchema);
