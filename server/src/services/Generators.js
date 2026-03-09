const PDFDocument = require('pdfkit');
const ExcelJS = require('exceljs');
const fs = require('fs');
const path = require('path');

// ===== FORM 16 GENERATOR =====
class Form16Generator {
  static async generate(empCode, financialYear, payrollDetails, employee, entity) {
    const dir = path.join(process.env.UPLOAD_DIR || './uploads', 'form16');
    fs.mkdirSync(dir, { recursive: true });
    const filePath = path.join(dir, `Form16_${empCode}_${financialYear}.pdf`);

    // Aggregate YTD data from payroll details (v1 + v2 compatible)
    const ytd = payrollDetails.reduce((acc, pd) => {
      // Dynamic earnings aggregation
      if (pd.version === 'v2' && pd.earnings?.length) {
        for (const e of pd.earnings) {
          acc.earningsByHead[e.headCode] = (acc.earningsByHead[e.headCode] || 0) + (e.earnedAmount || 0);
        }
      }
      return {
        ...acc,
        grossEarnings: acc.grossEarnings + pd.totalEarned,
        basicTotal: acc.basicTotal + (pd.earnings?.find(e => e.headCode === 'BASIC')?.earnedAmount || pd.basicEarned || 0),
        hraTotal: acc.hraTotal + (pd.earnings?.find(e => e.headCode === 'HRA')?.earnedAmount || pd.hraEarned || 0),
        otherTotal: acc.otherTotal + (pd.earnings?.filter(e => !['BASIC', 'HRA'].includes(e.headCode)).reduce((s, e) => s + (e.earnedAmount || 0), 0) || pd.covEarned || 0),
        pfEmployee: acc.pfEmployee + pd.pfEmployee,
        esiEmployee: acc.esiEmployee + pd.esiEmployee,
        pt: acc.pt + pd.professionalTax,
        tds: acc.tds + pd.tds,
        pfEmployer: acc.pfEmployer + pd.pfEmployer833 + pd.pfEmployer367,
      };
    }, { grossEarnings: 0, basicTotal: 0, hraTotal: 0, otherTotal: 0, pfEmployee: 0, esiEmployee: 0, pt: 0, tds: 0, pfEmployer: 0, earningsByHead: {} });

    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ size: 'A4', margins: { top: 40, bottom: 40, left: 40, right: 40 } });
      const stream = fs.createWriteStream(filePath);
      doc.pipe(stream);

      // Header
      doc.rect(40, 35, 515, 45).fill('#0F2B46');
      doc.fillColor('#fff').fontSize(14).font('Helvetica-Bold').text('FORM 16 - PART B', 50, 45, { width: 500, align: 'center' });
      doc.fontSize(9).text(`Certificate of Tax Deducted at Source on Salary`, 50, 62, { width: 500, align: 'center' });

      doc.fillColor('#333').fontSize(10).font('Helvetica');
      let y = 95;

      // Employer details
      doc.font('Helvetica-Bold').text('Employer Details', 50, y); y += 16;
      doc.font('Helvetica').fontSize(9);
      doc.text(`Name: ${entity?.name || 'Mobilise App Lab Limited'}`, 50, y); y += 14;
      doc.text(`Address: ${entity?.address ? `${entity.address.line1}, ${entity.address.city}, ${entity.address.state} - ${entity.address.pincode}` : ''}`, 50, y); y += 14;
      doc.text(`TAN: ${entity?.tan || ''}  |  PAN: ${entity?.pan || ''}`, 50, y); y += 20;

      // Employee details
      doc.font('Helvetica-Bold').fontSize(10).text('Employee Details', 50, y); y += 16;
      doc.font('Helvetica').fontSize(9);
      doc.text(`Name: ${employee?.firstName} ${employee?.lastName || ''}`, 50, y);
      doc.text(`PAN: ${employee?.pan || 'N/A'}`, 350, y); y += 14;
      doc.text(`Employee Code: ${empCode}`, 50, y);
      doc.text(`Assessment Year: ${financialYear === '2025-26' ? '2026-27' : ''}`, 350, y); y += 20;

      // Salary details table
      doc.moveTo(40, y).lineTo(555, y).stroke('#0F2B46'); y += 8;
      doc.font('Helvetica-Bold').fontSize(10).text('Details of Salary', 50, y); y += 18;

      const rows = [
        ['Gross Salary', `₹${ytd.grossEarnings.toLocaleString('en-IN')}`],
        ['  (a) Basic Salary', `₹${ytd.basicTotal.toLocaleString('en-IN')}`],
        ['  (b) House Rent Allowance', `₹${ytd.hraTotal.toLocaleString('en-IN')}`],
        ['  (c) Conveyance & Other Allowances', `₹${ytd.otherTotal.toLocaleString('en-IN')}`],
        ['Less: Standard Deduction u/s 16(ia)', '₹75,000'],
        ['Less: Professional Tax u/s 16(iii)', `₹${ytd.pt.toLocaleString('en-IN')}`],
        ['Net Salary', `₹${(ytd.grossEarnings - 75000 - ytd.pt).toLocaleString('en-IN')}`],
        ['', ''],
        ['Deductions under Chapter VI-A', ''],
        ['  PF (Employee) u/s 80C', `₹${ytd.pfEmployee.toLocaleString('en-IN')}`],
        ['', ''],
        ['Total Tax Payable', `₹${ytd.tds.toLocaleString('en-IN')}`],
        ['Tax Deducted at Source (TDS)', `₹${ytd.tds.toLocaleString('en-IN')}`],
      ];

      doc.fontSize(9).font('Helvetica');
      for (const [label, value] of rows) {
        if (label.startsWith('Gross') || label.startsWith('Net') || label.startsWith('Total') || label.startsWith('Tax Deducted')) doc.font('Helvetica-Bold');
        else doc.font('Helvetica');
        doc.text(label, 60, y, { width: 350 });
        doc.text(value, 420, y, { width: 120, align: 'right' });
        y += 15;
      }

      y += 20;
      doc.moveTo(40, y).lineTo(555, y).stroke('#ddd'); y += 10;

      // Monthly breakup
      doc.font('Helvetica-Bold').fontSize(10).text('Monthly Salary Breakup', 50, y); y += 16;
      doc.fontSize(7).font('Helvetica-Bold');
      ['Month', 'Basic', 'HRA', 'Others', 'Gross', 'PF', 'PT', 'TDS', 'Net'].forEach((h, i) => {
        doc.text(h, 50 + i * 56, y, { width: 54 });
      });
      y += 12;
      doc.font('Helvetica').fontSize(7);
      for (const pd of payrollDetails) {
        const vals = [new Date(0, pd.month - 1).toLocaleString('en', { month: 'short' }), pd.basicEarned, pd.hraEarned, pd.covEarned, pd.totalEarned, pd.pfEmployee, pd.professionalTax, pd.tds, pd.netPayable];
        vals.forEach((v, i) => doc.text(typeof v === 'number' ? v.toLocaleString('en-IN') : v, 50 + i * 56, y, { width: 54 }));
        y += 11;
        if (y > 740) { doc.addPage(); y = 50; }
      }

      y += 20;
      doc.fontSize(8).font('Helvetica').fillColor('#666');
      doc.text('This is a system-generated Form 16 (Part B). Part A to be downloaded from TRACES portal.', 50, y, { align: 'center', width: 500 });

      doc.end();
      stream.on('finish', () => resolve(filePath));
      stream.on('error', reject);
    });
  }
}

// ===== F&F SETTLEMENT CALCULATOR =====
class FnFCalculator {
  static calculate(employee, lastPayroll, leaveBalance, loans, compOffs) {
    const basicDaily = (employee.basicSalary || 0) / 30;
    const totalDaily = (employee.totalMonthlySalary || 0) / 30;

    // Days worked in last month (pro-rata)
    const lastDay = employee.lastWorkingDay ? new Date(employee.lastWorkingDay) : new Date();
    const monthStart = new Date(lastDay.getFullYear(), lastDay.getMonth(), 1);
    const daysWorked = lastDay.getDate();
    const totalDaysInMonth = new Date(lastDay.getFullYear(), lastDay.getMonth() + 1, 0).getDate();

    // Pro-rata salary for last month
    const proRataSalary = Math.round(employee.totalMonthlySalary * daysWorked / totalDaysInMonth);

    // Leave encashment (EL balance * Basic/26)
    const elBalance = leaveBalance?.find(l => l.leaveType === 'EL')?.closing || 0;
    const leaveEncashment = Math.round(elBalance * employee.basicSalary / 26);

    // Comp-off encashment
    const pendingCompOffs = compOffs?.filter(c => c.status === 'APPROVED') || [];
    const compOffDays = pendingCompOffs.reduce((s, c) => s + c.earnedDays, 0);
    const compOffEncashment = Math.round(compOffDays * totalDaily);

    // Gratuity (if >= 5 years)
    const doj = new Date(employee.dateOfJoining);
    const yearsOfService = (lastDay - doj) / (365.25 * 24 * 60 * 60 * 1000);
    let gratuity = 0;
    if (yearsOfService >= 5) {
      gratuity = Math.round(employee.basicSalary * 15 / 26 * Math.round(yearsOfService));
      gratuity = Math.min(gratuity, 2000000); // Max 20L
    }

    // Notice period recovery (if not served)
    const noticeDays = 30; // Default
    let noticeRecovery = 0; // Deduction if not served
    if (employee.separationReason === 'ABSCONDING') {
      noticeRecovery = Math.round(totalDaily * noticeDays);
    }

    // Outstanding loan recovery
    const loanRecovery = loans?.filter(l => l.status === 'ACTIVE').reduce((s, l) => s + l.outstandingBalance, 0) || 0;

    // PF/ESI for last month
    const pfDeduction = employee.pfApplicable ? Math.round(Math.min(employee.basicSalary, 15000) * 0.12 * daysWorked / totalDaysInMonth) : 0;
    const tds = employee.tdsAmount || 0;

    const totalEarnings = proRataSalary + leaveEncashment + compOffEncashment + gratuity;
    const totalDeductions = pfDeduction + tds + noticeRecovery + loanRecovery;
    const netPayable = totalEarnings - totalDeductions;

    return {
      employee: { empCode: employee.empCode, name: employee.fullName, doj: employee.dateOfJoining, lastDay: employee.lastWorkingDay, yearsOfService: Math.round(yearsOfService * 10) / 10 },
      earnings: {
        proRataSalary, daysWorked, totalDaysInMonth,
        leaveEncashment, elBalance,
        compOffEncashment, compOffDays,
        gratuity, gratuityEligible: yearsOfService >= 5,
        totalEarnings,
      },
      deductions: { pfDeduction, tds, noticeRecovery, loanRecovery, totalDeductions },
      netPayable,
    };
  }
}

// ===== SALARY REVISION ENGINE =====
class SalaryRevisionEngine {
  static calculateArrears(employee, newSalary, effectiveFrom, currentMonth, currentYear) {
    const effDate = new Date(effectiveFrom);
    const arrearMonths = [];
    let totalArrear = 0;

    // Calculate arrear for each month from effective date to current
    let m = effDate.getMonth() + 1;
    let y = effDate.getFullYear();

    while (y < currentYear || (y === currentYear && m <= currentMonth)) {
      const oldTotal = employee.totalMonthlySalary;
      const newTotal = (newSalary.basicSalary || 0) + (newSalary.hra || 0) + (newSalary.conveyanceAndOthers || 0);
      const diff = newTotal - oldTotal;

      if (diff > 0) {
        arrearMonths.push({ month: m, year: y, oldSalary: oldTotal, newSalary: newTotal, arrear: diff });
        totalArrear += diff;
      }
      m++;
      if (m > 12) { m = 1; y++; }
    }

    return { arrearMonths, totalArrear, effectiveFrom, monthsCount: arrearMonths.length };
  }
}

// ===== ECR FILE GENERATOR (EPFO format) =====
class ECRGenerator {
  static async generate(payrollDetails, entity) {
    // ECR format: UAN#Member Name#Gross Wages#EPF Wages#EPS Wages#EDLI Wages#EPF Contribution(EE)#EPS Contribution(ER)#EPF Contribution(ER)#NCP Days#Refund
    let ecr = '';
    for (const pd of payrollDetails) {
      if (pd.pfEmployee <= 0) continue;
      const emp = await require('../models/Employee').findOne({ empCode: pd.empCode });
      const uan = emp?.uan || '';
      const pfWage = Math.min(pd.basicEarned, 15000);
      ecr += `${uan}#${pd.employeeName}#${pd.totalEarned}#${pfWage}#${pfWage}#${pfWage}#${pd.pfEmployee}#${pd.pfEmployer833}#${pd.pfEmployer367}#${pd.lwpDays || 0}#0\n`;
    }

    const dir = path.join(process.env.UPLOAD_DIR || './uploads', 'compliance');
    fs.mkdirSync(dir, { recursive: true });
    const filePath = path.join(dir, `ECR_${payrollDetails[0]?.runId || 'unknown'}.txt`);
    fs.writeFileSync(filePath, ecr);
    return filePath;
  }
}

// ===== TALLY GL EXPORT =====
class TallyExporter {
  static async generateGLPosting(payrollRun, payrollDetails, entity) {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('GL Posting');

    const monthName = new Date(payrollRun.year, payrollRun.month - 1).toLocaleString('en', { month: 'long' });
    const voucherDate = `${payrollRun.year}-${String(payrollRun.month).padStart(2, '0')}-${String(entity?.payDay || 7).padStart(2, '0')}`;

    ws.addRow(['Tally GL Posting - Salary', `${monthName} ${payrollRun.year}`, entity?.name || '']);
    ws.addRow([]);
    ws.addRow(['Voucher Date', 'Voucher Type', 'Ledger Name', 'Debit', 'Credit', 'Narration']);
    ws.getRow(3).font = { bold: true };

    // Aggregate totals
    const totals = payrollDetails.reduce((acc, pd) => ({
      gross: acc.gross + pd.totalEarned,
      pf_ee: acc.pf_ee + pd.pfEmployee,
      pf_er: acc.pf_er + pd.pfEmployer833 + pd.pfEmployer367 + pd.pfEmployerEDLI,
      esi_ee: acc.esi_ee + pd.esiEmployee,
      esi_er: acc.esi_er + pd.esiEmployer,
      pt: acc.pt + pd.professionalTax,
      tds: acc.tds + pd.tds,
      loan: acc.loan + pd.loanDeduction,
      net: acc.net + pd.netPayable,
    }), { gross: 0, pf_ee: 0, pf_er: 0, esi_ee: 0, esi_er: 0, pt: 0, tds: 0, loan: 0, net: 0 });

    const narration = `Salary for ${monthName} ${payrollRun.year}`;

    // Debit entries
    ws.addRow([voucherDate, 'Journal', 'Salary & Wages A/c', totals.gross, '', narration]);
    if (totals.pf_er > 0) ws.addRow([voucherDate, 'Journal', 'PF Employer Contribution A/c', totals.pf_er, '', narration]);
    if (totals.esi_er > 0) ws.addRow([voucherDate, 'Journal', 'ESI Employer Contribution A/c', totals.esi_er, '', narration]);

    // Credit entries
    if (totals.pf_ee > 0) ws.addRow([voucherDate, 'Journal', 'PF Payable A/c (Employee)', '', totals.pf_ee, narration]);
    if (totals.pf_er > 0) ws.addRow([voucherDate, 'Journal', 'PF Payable A/c (Employer)', '', totals.pf_er, narration]);
    if (totals.esi_ee > 0) ws.addRow([voucherDate, 'Journal', 'ESI Payable A/c (Employee)', '', totals.esi_ee, narration]);
    if (totals.esi_er > 0) ws.addRow([voucherDate, 'Journal', 'ESI Payable A/c (Employer)', '', totals.esi_er, narration]);
    if (totals.pt > 0) ws.addRow([voucherDate, 'Journal', 'Professional Tax Payable A/c', '', totals.pt, narration]);
    if (totals.tds > 0) ws.addRow([voucherDate, 'Journal', 'TDS Payable A/c', '', totals.tds, narration]);
    if (totals.loan > 0) ws.addRow([voucherDate, 'Journal', 'Loan Recovery A/c', '', totals.loan, narration]);
    ws.addRow([voucherDate, 'Journal', `${entity?.bankDetails?.bankName || 'HDFC Bank'} A/c`, '', totals.net, narration]);

    ws.columns.forEach(c => { c.width = 25; });

    const dir = path.join(process.env.UPLOAD_DIR || './uploads', 'exports');
    fs.mkdirSync(dir, { recursive: true });
    const filePath = path.join(dir, `TallyGL_${payrollRun.runId}.xlsx`);
    await wb.xlsx.writeFile(filePath);
    return filePath;
  }
}

module.exports = { Form16Generator, FnFCalculator, SalaryRevisionEngine, ECRGenerator, TallyExporter };
