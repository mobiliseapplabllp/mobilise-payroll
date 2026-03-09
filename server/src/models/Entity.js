const mongoose = require('mongoose');

const entitySchema = new mongoose.Schema({
  code: { type: String, required: true, unique: true, trim: true }, // MALL, MIE
  name: { type: String, required: true },
  legalName: { type: String },
  type: { type: String, enum: ['PRIVATE_LIMITED', 'LLP', 'IE_UNIT', 'PROPRIETORSHIP'], default: 'PRIVATE_LIMITED' },
  cin: String, pan: String, tan: String, gst: String,
  address: { line1: String, line2: String, city: String, state: String, pincode: String },
  phone: String, email: String, website: String,
  logo: String, // base64 or file path

  // Bank details for salary disbursement
  bankDetails: {
    bankName: { type: String, default: 'HDFC Bank' },
    accountName: String, accountNumber: String,
    ifscCode: String, branchName: String, branchAddress: String,
  },

  // Statutory registrations
  pfRegistration: String,
  esiRegistration: String,
  ptRegistration: String,
  lwfRegistration: String,

  // Payroll settings
  payDay: { type: Number, default: 7 },
  workingDaysPerMonth: { type: Number, default: 28 },

  // Signatories
  signatories: [{ name: String, designation: String, isPrimary: Boolean }],

  // Attendance config
  attendanceConfig: {
    minHoursFullDay: { type: Number, default: 8 },
    minHoursHalfDay: { type: Number, default: 4 },
    gracePeriod: { type: Number, default: 15 },
    lateRule: { type: String, default: 'COUNT_BASED' },
    lateThreshold: { type: Number, default: 3 },
    lateDeduction: { type: Number, default: 0.5 },
    overtimeEnabled: { type: Boolean, default: true },
    overtimeRate: { type: Number, default: 2 },
  },

  isActive: { type: Boolean, default: true },
}, { timestamps: true });

module.exports = mongoose.model('Entity', entitySchema);
