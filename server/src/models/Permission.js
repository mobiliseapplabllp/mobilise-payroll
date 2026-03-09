const mongoose = require('mongoose');

const permissionSchema = new mongoose.Schema({
  roleCode: { type: String, required: true, uppercase: true, index: true },
  module: { type: String, required: true },
  // CRUD
  create: { type: Boolean, default: false },
  read: { type: Boolean, default: false },
  update: { type: Boolean, default: false },
  delete: { type: Boolean, default: false },
  // Workflow
  approve: { type: Boolean, default: false },
  export: { type: Boolean, default: false },
  // Sensitive
  viewSalary: { type: Boolean, default: false },
  viewPII: { type: Boolean, default: false },
}, { timestamps: true });

permissionSchema.index({ roleCode: 1, module: 1 }, { unique: true });

// In-memory cache
let _cache = null;
let _cacheTime = 0;

permissionSchema.statics.getCache = async function() {
  if (_cache && Date.now() - _cacheTime < 60000) return _cache; // 60s cache
  const perms = await this.find({});
  const map = {};
  for (const p of perms) {
    if (!map[p.roleCode]) map[p.roleCode] = {};
    map[p.roleCode][p.module] = {
      create: p.create, read: p.read, update: p.update, delete: p.delete,
      approve: p.approve, export: p.export, viewSalary: p.viewSalary, viewPII: p.viewPII,
    };
  }
  _cache = map;
  _cacheTime = Date.now();
  return _cache;
};

permissionSchema.statics.clearCache = function() { _cache = null; _cacheTime = 0; };

permissionSchema.statics.check = async function(roleCode, module, action) {
  if (roleCode === 'SUPER_ADMIN') return true;
  const cache = await this.getCache();
  return cache[roleCode]?.[module]?.[action] || false;
};

module.exports = mongoose.model('Permission', permissionSchema);
