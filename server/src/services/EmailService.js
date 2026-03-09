const nodemailer = require('nodemailer');
const { logger } = require('../config/logger');

class EmailService {
  static getTransporter() {
    // If SMTP not configured, use a mock that just logs
    if (!process.env.SMTP_HOST || !process.env.SMTP_USER) {
      return {
        sendMail: async (opts) => {
          logger.info(`📧 [EMAIL MOCK] To: ${opts.to} | Subject: ${opts.subject}`);
          return { messageId: 'mock-' + Date.now() };
        }
      };
    }
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST, port: parseInt(process.env.SMTP_PORT) || 587,
      secure: false, auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
  }

  static async send(to, subject, html) {
    try {
      const transporter = this.getTransporter();
      const result = await transporter.sendMail({
        from: process.env.SMTP_FROM || 'payroll@mobiliseapps.com', to, subject, html,
      });
      logger.info(`Email sent: ${subject} -> ${to} (${result.messageId})`);
      return result;
    } catch (err) {
      logger.error(`Email failed: ${subject} -> ${to}: ${err.message}`);
      return null;
    }
  }

  // ===== LOAN NOTIFICATIONS =====
  static async loanApplied(loan, employeeEmail, hrEmail) {
    const html = `<div style="font-family:sans-serif;max-width:600px;margin:auto;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden">
      <div style="background:#0F2B46;color:#fff;padding:16px 24px"><h2 style="margin:0">Loan Application</h2></div>
      <div style="padding:24px">
        <p><strong>${loan.employeeName}</strong> (${loan.empCode}) has applied for a loan.</p>
        <table style="width:100%;border-collapse:collapse;margin:16px 0">
          <tr><td style="padding:8px;border-bottom:1px solid #e2e8f0;font-weight:600">Type</td><td style="padding:8px;border-bottom:1px solid #e2e8f0">${loan.loanType}</td></tr>
          <tr><td style="padding:8px;border-bottom:1px solid #e2e8f0;font-weight:600">Amount</td><td style="padding:8px;border-bottom:1px solid #e2e8f0">₹${loan.amount?.toLocaleString('en-IN')}</td></tr>
          <tr><td style="padding:8px;border-bottom:1px solid #e2e8f0;font-weight:600">Tenure</td><td style="padding:8px;border-bottom:1px solid #e2e8f0">${loan.tenure} months</td></tr>
          <tr><td style="padding:8px;font-weight:600">EMI</td><td style="padding:8px">₹${loan.emiAmount?.toLocaleString('en-IN')}/month</td></tr>
        </table>
        <p style="color:#64748b">Please review and take action in the payroll system.</p>
      </div>
    </div>`;
    await this.send(hrEmail || 'hr@mobiliseapps.com', `Loan Application: ${loan.employeeName} - ₹${loan.amount?.toLocaleString('en-IN')}`, html);
  }

  static async loanApproved(loan, employeeEmail) {
    const html = `<div style="font-family:sans-serif;max-width:600px;margin:auto;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden">
      <div style="background:#059669;color:#fff;padding:16px 24px"><h2 style="margin:0">✅ Loan Approved</h2></div>
      <div style="padding:24px">
        <p>Dear <strong>${loan.employeeName}</strong>,</p>
        <p>Your loan application has been <strong style="color:#059669">approved</strong>.</p>
        <table style="width:100%;border-collapse:collapse;margin:16px 0">
          <tr><td style="padding:8px;border-bottom:1px solid #e2e8f0;font-weight:600">Loan ID</td><td style="padding:8px;border-bottom:1px solid #e2e8f0">${loan.loanId}</td></tr>
          <tr><td style="padding:8px;border-bottom:1px solid #e2e8f0;font-weight:600">Amount</td><td style="padding:8px;border-bottom:1px solid #e2e8f0">₹${loan.amount?.toLocaleString('en-IN')}</td></tr>
          <tr><td style="padding:8px;font-weight:600">Monthly EMI</td><td style="padding:8px">₹${loan.emiAmount?.toLocaleString('en-IN')}</td></tr>
        </table>
        <p>The EMI deduction will start from next month's salary.</p>
      </div>
    </div>`;
    await this.send(employeeEmail, `Loan Approved: ₹${loan.amount?.toLocaleString('en-IN')} - ${loan.loanId}`, html);
  }

  static async loanRejected(loan, employeeEmail, reason) {
    const html = `<div style="font-family:sans-serif;max-width:600px;margin:auto;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden">
      <div style="background:#DC2626;color:#fff;padding:16px 24px"><h2 style="margin:0">❌ Loan Rejected</h2></div>
      <div style="padding:24px">
        <p>Dear <strong>${loan.employeeName}</strong>,</p>
        <p>Your loan application for ₹${loan.amount?.toLocaleString('en-IN')} has been <strong style="color:#DC2626">rejected</strong>.</p>
        ${reason ? `<p><strong>Reason:</strong> ${reason}</p>` : ''}
        <p style="color:#64748b">Please contact HR if you have questions.</p>
      </div>
    </div>`;
    await this.send(employeeEmail, `Loan Rejected: ${loan.loanId}`, html);
  }

  // ===== PAYROLL NOTIFICATIONS =====
  static async payrollProcessed(entityName, month, year, totalEmployees, totalNet, hrEmail) {
    const monthName = new Date(year, month - 1).toLocaleString('en', { month: 'long' });
    const html = `<div style="font-family:sans-serif;max-width:600px;margin:auto;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden">
      <div style="background:#1A6FB5;color:#fff;padding:16px 24px"><h2 style="margin:0">Payroll Processed</h2></div>
      <div style="padding:24px">
        <p>Payroll for <strong>${entityName}</strong> - <strong>${monthName} ${year}</strong> has been processed.</p>
        <table style="width:100%;border-collapse:collapse;margin:16px 0">
          <tr><td style="padding:8px;border-bottom:1px solid #e2e8f0;font-weight:600">Employees</td><td style="padding:8px;border-bottom:1px solid #e2e8f0">${totalEmployees}</td></tr>
          <tr><td style="padding:8px;font-weight:600">Total Net Salary</td><td style="padding:8px">₹${(totalNet / 100000).toFixed(2)} Lakhs</td></tr>
        </table>
        <p><strong>Action Required:</strong> Finance team to approve the payroll.</p>
      </div>
    </div>`;
    await this.send(hrEmail || 'finance@mobiliseapps.com', `Payroll Processed: ${entityName} - ${monthName} ${year}`, html);
  }

  static async payrollApproved(entityName, month, year, approverName) {
    const monthName = new Date(year, month - 1).toLocaleString('en', { month: 'long' });
    const html = `<div style="font-family:sans-serif;max-width:600px;margin:auto;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden">
      <div style="background:#059669;color:#fff;padding:16px 24px"><h2 style="margin:0">✅ Payroll Approved</h2></div>
      <div style="padding:24px">
        <p>Payroll for <strong>${entityName} - ${monthName} ${year}</strong> has been approved by <strong>${approverName}</strong>.</p>
        <p>Bank salary file can now be generated.</p>
      </div>
    </div>`;
    await this.send('hr@mobiliseapps.com', `Payroll Approved: ${entityName} - ${monthName} ${year}`, html);
  }

  static async payslipReady(employeeName, employeeEmail, month, year) {
    const monthName = new Date(year, month - 1).toLocaleString('en', { month: 'long' });
    const html = `<div style="font-family:sans-serif;max-width:600px;margin:auto;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden">
      <div style="background:#0F2B46;color:#fff;padding:16px 24px"><h2 style="margin:0">📄 Payslip Ready</h2></div>
      <div style="padding:24px">
        <p>Dear <strong>${employeeName}</strong>,</p>
        <p>Your payslip for <strong>${monthName} ${year}</strong> is now available.</p>
        <p>Login to the Employee Self-Service portal to view and download.</p>
      </div>
    </div>`;
    await this.send(employeeEmail, `Payslip Ready: ${monthName} ${year}`, html);
  }

  // ===== LEAVE NOTIFICATIONS =====
  static async leaveApplied(employeeName, leaveType, fromDate, toDate, managerEmail) {
    await this.send(managerEmail || 'hr@mobiliseapps.com', `Leave Application: ${employeeName}`,
      `<p><strong>${employeeName}</strong> has applied for <strong>${leaveType}</strong> from ${fromDate} to ${toDate}. Please review.</p>`);
  }

  static async leaveApproved(employeeName, employeeEmail, leaveType, fromDate, toDate) {
    await this.send(employeeEmail, `Leave Approved: ${leaveType}`,
      `<p>Dear <strong>${employeeName}</strong>, your <strong>${leaveType}</strong> from ${fromDate} to ${toDate} has been approved.</p>`);
  }
}

module.exports = EmailService;
