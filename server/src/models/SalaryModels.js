const mongoose = require('mongoose');

// ===== SALARY HEAD =====
const salaryHeadSchema = new mongoose.Schema({
  code: { type: String, required: true, unique: true, uppercase: true },
  name: { type: String, required: true },
  type: { type: String, enum: ['EARNING', 'DEDUCTION', 'REIMBURSEMENT'], required: true },
  isTaxable: { type: Boolean, default: true },
  isPFApplicable: { type: Boolean, default: false },
  isESIApplicable: { type: Boolean, default: false },
  isPartOfGross: { type: Boolean, default: true },
  isPartOfCTC: { type: Boolean, default: true },
  isStatutory: { type: Boolean, default: false }, // system-defined (PF, ESI, PT, TDS)
  calculationType: { type: String, enum: ['FIXED', 'PERCENTAGE', 'FORMULA'], default: 'FIXED' },
  percentageOf: { type: String, default: '' }, // head code ref, e.g. 'BASIC' for HRA
  defaultPercentage: { type: Number, default: 0 }, // e.g. 40 for HRA=40% of Basic
  sortOrder: { type: Number, default: 0 },
  isActive: { type: Boolean, default: true },
  description: { type: String, default: '' },
}, { timestamps: true });

// ===== SALARY TEMPLATE =====
const salaryTemplateSchema = new mongoose.Schema({
  name: { type: String, required: true },
  code: { type: String, required: true, unique: true, uppercase: true },
  entity: { type: mongoose.Schema.Types.ObjectId, ref: 'Entity' },
  description: { type: String, default: '' },
  heads: [{
    headId: { type: mongoose.Schema.Types.ObjectId, ref: 'SalaryHead' },
    headCode: String,
    headName: String,
    headType: String,
    defaultPercentage: { type: Number, default: 0 },
    defaultAmount: { type: Number, default: 0 },
    isRequired: { type: Boolean, default: false },
    sortOrder: { type: Number, default: 0 },
  }],
  isDefault: { type: Boolean, default: false },
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

// ===== EMPLOYEE SALARY (replaces hardcoded Basic/HRA/Conv) =====
const employeeSalarySchema = new mongoose.Schema({
  empCode: { type: String, required: true, index: true },
  entity: { type: mongoose.Schema.Types.ObjectId, ref: 'Entity' },
  templateId: { type: mongoose.Schema.Types.ObjectId, ref: 'SalaryTemplate' },
  templateCode: String,
  components: [{
    headId: { type: mongoose.Schema.Types.ObjectId, ref: 'SalaryHead' },
    headCode: String,
    headName: String,
    headType: String,
    amount: { type: Number, default: 0 },
    isTaxable: Boolean,
    isPFApplicable: Boolean,
    isESIApplicable: Boolean,
    isPartOfGross: Boolean,
  }],
  totalMonthly: { type: Number, default: 0 },
  totalAnnual: { type: Number, default: 0 },
  pfWage: { type: Number, default: 0 }, // sum of PF-applicable heads
  esiWage: { type: Number, default: 0 }, // sum of ESI-applicable heads
  grossSalary: { type: Number, default: 0 }, // sum of gross-applicable heads
  // Encrypted blob of component amounts (DBA cannot read individual amounts)
  encryptedComponents: { type: String, default: '' },
  effectiveFrom: { type: Date, required: true },
  effectiveTo: { type: Date },
  isActive: { type: Boolean, default: true },
  revisionReason: String,
}, { timestamps: true });
employeeSalarySchema.index({ empCode: 1, effectiveFrom: -1 });
employeeSalarySchema.index({ empCode: 1, isActive: 1 });

// ===== MINIMUM WAGE =====
const minimumWageSchema = new mongoose.Schema({
  stateCode: { type: String, required: true, index: true },
  stateName: String,
  category: { type: String, enum: ['UNSKILLED', 'SEMI_SKILLED', 'SKILLED', 'HIGHLY_SKILLED', 'CLERICAL'], required: true },
  zone: { type: String, enum: ['A', 'B', 'C'], default: 'A' },
  minimumMonthly: { type: Number, required: true },
  basicComponent: { type: Number, default: 0 },
  vdaComponent: { type: Number, default: 0 },
  hraComponent: { type: Number, default: 0 },
  effectiveFrom: { type: Date, required: true },
  isActive: { type: Boolean, default: true },
  notificationNumber: String,
}, { timestamps: true });
minimumWageSchema.index({ stateCode: 1, category: 1, zone: 1, effectiveFrom: -1 });

// ===== GEO STATE =====
const geoStateSchema = new mongoose.Schema({
  code: { type: String, required: true, unique: true, uppercase: true },
  name: { type: String, required: true },
  country: { type: String, default: 'IN' },
  ptApplicable: { type: Boolean, default: false },
  lwfApplicable: { type: Boolean, default: false },
  isUT: { type: Boolean, default: false },
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

// ===== GEO CITY =====
const geoCitySchema = new mongoose.Schema({
  name: { type: String, required: true },
  stateCode: { type: String, required: true, index: true },
  stateName: String,
  zone: { type: String, enum: ['A', 'B', 'C'], default: 'A' }, // for min wage zone
  isMetro: { type: Boolean, default: false },
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

module.exports = {
  SalaryHead: mongoose.model('SalaryHead', salaryHeadSchema),
  SalaryTemplate: mongoose.model('SalaryTemplate', salaryTemplateSchema),
  EmployeeSalary: mongoose.model('EmployeeSalary', employeeSalarySchema),
  MinimumWage: mongoose.model('MinimumWage', minimumWageSchema),
  GeoState: mongoose.model('GeoState', geoStateSchema),
  GeoCity: mongoose.model('GeoCity', geoCitySchema),
};
