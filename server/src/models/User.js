const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true, lowercase: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true, minlength: 8 },
  firstName: { type: String, required: true },
  lastName: { type: String, default: '' },

  // RBAC: 4 roles
  role: {
    type: String,
    enum: ['SUPER_ADMIN', 'EMPLOYEE', 'MANAGER', 'HR', 'FINANCE'],
    required: true,
    default: 'EMPLOYEE',
  },

  // Multi-entity: which entities this user can access
  entities: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Entity' }],
  // Current active entity (for session)
  activeEntity: { type: mongoose.Schema.Types.ObjectId, ref: 'Entity' },

  // Link to employee record (for EMPLOYEE and MANAGER roles)
  employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },
  empCode: { type: String },

  isActive: { type: Boolean, default: true },
  lastLogin: Date,
  failedAttempts: { type: Number, default: 0 },
  lockedUntil: Date,
  refreshToken: String,
  passwordChangedAt: Date,
  mustChangePassword: { type: Boolean, default: false },
}, { timestamps: true });

userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  this.passwordChangedAt = new Date();
  next();
});

userSchema.methods.comparePassword = async function(candidate) {
  return bcrypt.compare(candidate, this.password);
};

userSchema.methods.isLocked = function() {
  return this.lockedUntil && this.lockedUntil > new Date();
};

// Permissions matrix
userSchema.methods.can = function(action, module) {
  // SUPER_ADMIN bypasses all checks
  if (this.role === 'SUPER_ADMIN') return true;
  const perms = {
    EMPLOYEE: {
      'payslips': ['read_own'], 'loans': ['read_own', 'create'], 'profile': ['read_own'],
      'attendance': ['read_own'], 'tax': ['read_own', 'update_own'], 'compoff': ['read_own'],
    },
    MANAGER: {
      'payslips': ['read_own', 'read_team'], 'loans': ['read_own', 'create', 'recommend'],
      'profile': ['read_own'], 'attendance': ['read_own', 'read_team', 'approve'],
      'compoff': ['read_own', 'read_team', 'approve'], 'employees': ['read_team'],
      'tax': ['read_own', 'update_own'],
    },
    HR: {
      'employees': ['read', 'create', 'update', 'delete'], 'attendance': ['read', 'create', 'update', 'lock'],
      'payroll': ['read', 'create'], // MAKER - can create but not approve
      'payslips': ['read', 'generate'], 'loans': ['read', 'recommend'],
      'compoff': ['read', 'create', 'approve'], 'leaves': ['read', 'create', 'update'],
      'reports': ['read', 'export'], 'config': ['read'], 'salary_revision': ['create'],
      'bank': ['read', 'generate'], 'tax': ['read'],
    },
    FINANCE: {
      'payroll': ['read', 'approve'], // CHECKER - can approve but not create
      'bank': ['read', 'generate', 'approve', 'download'],
      'loans': ['read', 'approve', 'reject'], 'reports': ['read', 'export'],
      'config': ['read', 'update'], 'statutory': ['read', 'update'],
      'salary_revision': ['approve'], 'employees': ['read'],
      'tax': ['read'], 'payslips': ['read'],
    },
  };
  const rolePerms = perms[this.role];
  if (!rolePerms || !rolePerms[module]) return false;
  return rolePerms[module].includes(action);
};

module.exports = mongoose.model('User', userSchema);
