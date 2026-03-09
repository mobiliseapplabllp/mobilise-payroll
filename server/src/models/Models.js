const mongoose = require('mongoose');

// ===== ATTENDANCE =====
const attendanceSchema = new mongoose.Schema({
  empCode: { type: String, required: true },
  entity: { type: mongoose.Schema.Types.ObjectId, ref: 'Entity' },
  date: { type: Date, required: true },
  status: { type: String, enum: ['P', 'A', 'HD', 'WO', 'HO', 'L', 'OD', 'WFH', 'CO', 'LWP'], default: 'P' },
  inTime: String, outTime: String,
  totalHours: { type: Number, default: 0 },
  overtimeHours: { type: Number, default: 0 },
  lateMinutes: { type: Number, default: 0 },
  paidDayValue: { type: Number, default: 1 },
  source: { type: String, enum: ['ESSL', 'UPLOAD', 'MANUAL', 'SYSTEM'], default: 'MANUAL' },
  remarks: String,
}, { timestamps: true });
attendanceSchema.index({ empCode: 1, date: 1 }, { unique: true });

const monthlySummarySchema = new mongoose.Schema({
  empCode: { type: String, required: true },
  entity: { type: mongoose.Schema.Types.ObjectId, ref: 'Entity' },
  month: { type: Number, required: true }, year: { type: Number, required: true },
  totalDays: Number, presentDays: { type: Number, default: 0 }, absentDays: { type: Number, default: 0 },
  halfDays: { type: Number, default: 0 }, weekOffs: { type: Number, default: 0 },
  holidays: { type: Number, default: 0 }, paidLeaves: { type: Number, default: 0 },
  unpaidLeaves: { type: Number, default: 0 }, wfhDays: { type: Number, default: 0 },
  overtimeHours: { type: Number, default: 0 }, lateCount: { type: Number, default: 0 },
  paidDays: { type: Number, required: true }, lwpDays: { type: Number, default: 0 },
  isLocked: { type: Boolean, default: false },
  lockedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, lockedAt: Date,
}, { timestamps: true });
monthlySummarySchema.index({ empCode: 1, month: 1, year: 1 }, { unique: true });

// ===== PAYROLL =====
const payrollRunSchema = new mongoose.Schema({
  runId: { type: String, required: true, unique: true },
  entity: { type: mongoose.Schema.Types.ObjectId, ref: 'Entity', required: true },
  entityCode: { type: String, required: true },
  month: { type: Number, required: true }, year: { type: Number, required: true },
  status: { type: String, enum: ['DRAFT', 'PROCESSING', 'COMPUTED', 'APPROVED', 'PAID', 'REVERSED'], default: 'DRAFT' },
  totalEmployees: { type: Number, default: 0 },
  totalGross: { type: Number, default: 0 }, totalDeductions: { type: Number, default: 0 },
  totalNet: { type: Number, default: 0 },
  totalEmployerPF: { type: Number, default: 0 }, totalEmployerESI: { type: Number, default: 0 },
  errorCount: { type: Number, default: 0 },
  errors: { type: Number, default: 0 },
  // Maker-Checker
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // MAKER (HR)
  createdByName: { type: String, default: '' },
  approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // CHECKER (Finance)
  approvedByName: { type: String, default: '' },
  approvedAt: Date,
  bankFileGenerated: { type: Boolean, default: false },
}, { timestamps: true });
payrollRunSchema.index({ entity: 1, month: 1, year: 1 });

const payrollDetailSchema = new mongoose.Schema({
  runId: String, entity: { type: mongoose.Schema.Types.ObjectId, ref: 'Entity' },
  empCode: String, employeeName: String, department: String, designation: String, employmentType: String,
  month: Number, year: Number,
  totalDays: Number, paidDays: Number, lwpDays: { type: Number, default: 0 },
  basicFixed: { type: Number, default: 0 }, hraFixed: { type: Number, default: 0 },
  covFixed: { type: Number, default: 0 }, totalFixed: { type: Number, default: 0 },
  basicEarned: { type: Number, default: 0 }, hraEarned: { type: Number, default: 0 },
  covEarned: { type: Number, default: 0 }, totalEarned: { type: Number, default: 0 },
  pfEmployee: { type: Number, default: 0 }, esiEmployee: { type: Number, default: 0 },
  professionalTax: { type: Number, default: 0 }, tds: { type: Number, default: 0 },
  totalDeductions: { type: Number, default: 0 },
  pfEmployer833: { type: Number, default: 0 }, pfEmployer367: { type: Number, default: 0 },
  pfEmployerEDLI: { type: Number, default: 0 }, esiEmployer: { type: Number, default: 0 },
  loanDeduction: { type: Number, default: 0 },
  amountPayable: { type: Number, default: 0 }, netPayable: { type: Number, default: 0 },
  compOffEncashed: { type: Number, default: 0 }, encashedAmount: { type: Number, default: 0 },
  incentives: { type: Number, default: 0 }, totalPayout: { type: Number, default: 0 },
  pfCalcAmount: { type: Number, default: 0 },
  paymentMode: { type: String, default: 'TR' },
  status: { type: String, enum: ['COMPUTED', 'ERROR', 'HOLD', 'APPROVED', 'PAID'], default: 'COMPUTED' },
  // V2: Dynamic salary structure
  version: { type: String, enum: ['v1', 'v2'], default: 'v1' },
  earnings: [{ headCode: String, headName: String, fixedAmount: Number, earnedAmount: Number }],
  deductions: [{ type: { type: String }, amount: Number, description: String }],
}, { timestamps: true });
payrollDetailSchema.index({ runId: 1, empCode: 1 }, { unique: true });

// ===== STATUTORY CONFIG =====
const statutoryConfigSchema = new mongoose.Schema({
  type: { type: String, required: true, enum: ['PF', 'ESI', 'PT', 'LWF', 'GRATUITY', 'BONUS', 'TAX_NEW', 'TAX_OLD'] },
  name: String, state: { type: String, default: 'ALL' },
  employeeRate: Number, employerRate: Number, wageCeiling: Number,
  subRates: { epfEmployer: Number, epsEmployer: Number, edliEmployer: Number, adminCharges: Number, epsCeiling: Number },
  slabs: [{ minAmount: Number, maxAmount: Number, rate: Number, rateType: { type: String, default: 'FIXED' } }],
  fixedEmployeeAmount: Number, fixedEmployerAmount: Number,
  applicableMonths: [Number],
  standardDeduction: Number, rebateLimit: Number, rebateAmount: Number, cessRate: Number,
  effectiveFrom: { type: Date, required: true },
  isActive: { type: Boolean, default: true },
}, { timestamps: true });
statutoryConfigSchema.index({ type: 1, isActive: 1 });

// ===== LOAN =====
const loanSchema = new mongoose.Schema({
  loanId: { type: String, required: true, unique: true },
  empCode: { type: String, required: true }, employeeName: String,
  entity: { type: mongoose.Schema.Types.ObjectId, ref: 'Entity' },
  loanType: { type: String, enum: ['SALARY_ADVANCE', 'PERSONAL_LOAN', 'EMERGENCY_LOAN', 'FESTIVAL_ADVANCE'], required: true },
  amount: { type: Number, required: true }, tenure: { type: Number, required: true },
  emiAmount: { type: Number, required: true },
  outstandingBalance: { type: Number, default: 0 }, totalPaid: { type: Number, default: 0 },
  status: { type: String, enum: ['APPLIED', 'MANAGER_RECOMMENDED', 'APPROVED', 'ACTIVE', 'CLOSED', 'REJECTED'], default: 'APPLIED' },
  schedule: [{ month: Number, year: Number, emiAmount: Number, status: { type: String, default: 'PENDING' } }],
  // Workflow
  appliedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  managerRecommendedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  managerRecommendedAt: Date,
  approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // Finance
  approvedAt: Date,
  rejectedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  rejectionReason: String,
  disbursementDate: Date,
  remarks: String,
  // Loan agreement
  agreementFile: String, // file path to uploaded agreement PDF
  agreementUploadedAt: Date,
  agreementUploadedBy: String,
  // Loan statement
  lastStatementDate: Date,
}, { timestamps: true });
loanSchema.index({ empCode: 1, status: 1 });

// ===== COMP OFF =====
const compOffSchema = new mongoose.Schema({
  empCode: { type: String, required: true }, employeeName: String,
  entity: { type: mongoose.Schema.Types.ObjectId, ref: 'Entity' },
  earnedDate: { type: Date, required: true }, earnedDays: { type: Number, default: 1 },
  earnedReason: String, expiryDate: Date,
  isEncashed: { type: Boolean, default: false }, encashedDate: Date,
  encashmentAmount: { type: Number, default: 0 },
  isAvailed: { type: Boolean, default: false }, availedDate: Date,
  status: { type: String, enum: ['PENDING', 'APPROVED', 'ENCASHED', 'AVAILED', 'EXPIRED', 'REJECTED'], default: 'PENDING' },
  approvedBy: String, remarks: String,
}, { timestamps: true });
compOffSchema.index({ empCode: 1, status: 1 });

// ===== HOLIDAY =====
const holidaySchema = new mongoose.Schema({
  date: { type: Date, required: true }, name: { type: String, required: true },
  type: { type: String, enum: ['NATIONAL', 'STATE', 'COMPANY', 'RESTRICTED'], default: 'COMPANY' },
  year: Number, entity: { type: mongoose.Schema.Types.ObjectId, ref: 'Entity' },
  location: { type: String, default: 'ALL' },
}, { timestamps: true });

// ===== LEAVE BALANCE =====
const leaveBalanceSchema = new mongoose.Schema({
  empCode: String, financialYear: String, leaveType: String,
  opening: { type: Number, default: 0 }, accrued: { type: Number, default: 0 },
  availed: { type: Number, default: 0 }, lapsed: { type: Number, default: 0 },
  encashed: { type: Number, default: 0 }, closing: { type: Number, default: 0 },
}, { timestamps: true });
leaveBalanceSchema.index({ empCode: 1, financialYear: 1, leaveType: 1 }, { unique: true });

// ===== AUDIT LOG =====
const auditLogSchema = new mongoose.Schema({
  entity: { type: mongoose.Schema.Types.ObjectId, ref: 'Entity' },
  module: { type: String, required: true }, action: { type: String, required: true },
  recordId: String, recordName: String,
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  userName: String, userRole: String,
  changes: mongoose.Schema.Types.Mixed,
  ipAddress: String,
}, { timestamps: true });
auditLogSchema.index({ module: 1, createdAt: -1 });

// ===== BANK FILE =====
const bankFileSchema = new mongoose.Schema({
  fileId: { type: String, required: true, unique: true },
  runId: String, entity: { type: mongoose.Schema.Types.ObjectId, ref: 'Entity' },
  month: Number, year: Number,
  fileName: String, filePath: String,
  totalRecords: Number, totalAmount: Number,
  a2aCount: { type: Number, default: 0 }, a2aAmount: { type: Number, default: 0 },
  neftCount: { type: Number, default: 0 }, neftAmount: { type: Number, default: 0 },
  coveringLetterPath: String,
  generatedBy: String, status: { type: String, default: 'GENERATED' },
}, { timestamps: true });

// ===== ATTENDANCE REGULARIZATION =====
const attendanceRegSchema = new mongoose.Schema({
  empCode: { type: String, required: true },
  employeeName: String,
  entity: { type: mongoose.Schema.Types.ObjectId, ref: 'Entity' },
  date: { type: Date, required: true },
  originalStatus: { type: String, default: 'ABSENT' }, // what system recorded
  requestedStatus: { type: String, enum: ['PRESENT', 'HALF_DAY', 'WFH', 'ON_DUTY'], required: true },
  reason: { type: String, required: true },
  punchIn: String, // claimed punch-in time
  punchOut: String, // claimed punch-out time
  status: { type: String, enum: ['PENDING', 'APPROVED', 'REJECTED'], default: 'PENDING' },
  appliedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  approverName: String,
  approvedAt: Date,
  rejectionReason: String,
}, { timestamps: true });
attendanceRegSchema.index({ empCode: 1, date: 1 });
attendanceRegSchema.index({ entity: 1, status: 1 });

// ===== PLI ASSESSMENT =====
const pliConfigSchema = new mongoose.Schema({
  entity: { type: mongoose.Schema.Types.ObjectId, ref: 'Entity' },
  quarter: { type: String, required: true }, // Q1, Q2, Q3, Q4
  year: { type: Number, required: true },
  startMonth: Number, endMonth: Number,
  maxPercentage: { type: Number, default: 100 }, // max PLI %
  calculationBase: { type: String, enum: ['BASIC', 'GROSS', 'CTC'], default: 'BASIC' },
  isActive: { type: Boolean, default: true },
  ratingScale: [{
    rating: Number, // 1-5
    label: String, // Outstanding, Excellent, Good, Average, Below Average
    pliPercentage: Number, // % of base
  }],
  assessmentDeadline: Date,
  disburseInMonth: Number, // month number when PLI is added to salary
  disburseInYear: Number,
}, { timestamps: true });
pliConfigSchema.index({ entity: 1, quarter: 1, year: 1 }, { unique: true });

const pliAssessmentSchema = new mongoose.Schema({
  entity: { type: mongoose.Schema.Types.ObjectId, ref: 'Entity' },
  empCode: { type: String, required: true },
  employeeName: String,
  department: String,
  designation: String,
  quarter: { type: String, required: true },
  year: { type: Number, required: true },
  // Assessment
  rating: { type: Number, min: 1, max: 5 },
  ratingLabel: String,
  pliPercentage: { type: Number, default: 0 }, // derived from rating
  // Calculation
  calculationBase: String, // BASIC / GROSS
  baseAmount: { type: Number, default: 0 }, // monthly base × 3 months
  pliAmount: { type: Number, default: 0 }, // baseAmount × pliPercentage / 100
  // Workflow
  status: { type: String, enum: ['PENDING', 'ASSESSED', 'APPROVED', 'DISBURSED', 'REJECTED'], default: 'PENDING' },
  assessedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  assessedByName: String,
  assessedAt: Date,
  managerRemarks: String,
  approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  approvedByName: String,
  approvedAt: Date,
  disbursedInRunId: String,
}, { timestamps: true });
pliAssessmentSchema.index({ entity: 1, quarter: 1, year: 1, empCode: 1 }, { unique: true });
pliAssessmentSchema.index({ empCode: 1, year: 1 });

module.exports = {
  Attendance: mongoose.model('Attendance', attendanceSchema),
  MonthlySummary: mongoose.model('MonthlySummary', monthlySummarySchema),
  PayrollRun: mongoose.model('PayrollRun', payrollRunSchema),
  PayrollDetail: mongoose.model('PayrollDetail', payrollDetailSchema),
  StatutoryConfig: mongoose.model('StatutoryConfig', statutoryConfigSchema),
  Loan: mongoose.model('Loan', loanSchema),
  CompOff: mongoose.model('CompOff', compOffSchema),
  Holiday: mongoose.model('Holiday', holidaySchema),
  LeaveBalance: mongoose.model('LeaveBalance', leaveBalanceSchema),
  AuditLog: mongoose.model('AuditLog', auditLogSchema),
  BankFile: mongoose.model('BankFile', bankFileSchema),
  AttendanceReg: mongoose.model('AttendanceReg', attendanceRegSchema),
  PLIConfig: mongoose.model('PLIConfig', pliConfigSchema),
  PLIAssessment: mongoose.model('PLIAssessment', pliAssessmentSchema),
};
