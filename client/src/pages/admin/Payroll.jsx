import React, { useState, useEffect } from 'react';
import { Card, Typography, Button, Space, Select, Steps, Table, Tag, message, Statistic, Row, Col, Alert, Popconfirm, Result, Divider } from 'antd';
import { PlayCircleOutlined, CheckCircleOutlined, DeleteOutlined, FilePdfOutlined, BankOutlined, CalendarOutlined, CalculatorOutlined, AuditOutlined, LockOutlined, DownloadOutlined, ArrowRightOutlined, DollarOutlined} from '@ant-design/icons';
import { useAuth } from '../../main';
import api, { downloadFile } from '../../utils/api';
const { Title, Text } = Typography;

export default function Payroll() {
  const { user } = useAuth();
  const [step, setStep] = useState(0);
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());
  const [runs, setRuns] = useState([]);
  const [currentRun, setCurrentRun] = useState(null);
  const [details, setDetails] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [processing, setProcessing] = useState(false);
  const [loading, setLoading] = useState(false);

  const isHR = ['HR', 'SUPER_ADMIN'].includes(user?.role);
  const isFinance = ['FINANCE', 'SUPER_ADMIN'].includes(user?.role);
  const entityName = user?.activeEntity?.name || 'Entity';
  const monthName = new Date(year, month - 1).toLocaleString('en', { month: 'long' });

  const fetchRuns = () => api.get('/payroll/runs').then(({ data }) => {
    setRuns(data);
    const existing = data.find(r => r.month === month && r.year === year);
    if (existing) {
      setCurrentRun(existing);
      if (existing.status === 'APPROVED' || existing.status === 'PAID') setStep(4);
      else if (existing.status === 'COMPUTED') setStep(3);
    }
  });

  useEffect(() => { fetchRuns(); }, [user?.activeEntity]);

  const loadAttendance = async () => {
    setLoading(true);
    try { const { data } = await api.get(`/attendance/summary/${year}/${month}`); setAttendance(data); }
    catch { setAttendance([]); }
    finally { setLoading(false); }
  };

  const processPayroll = async () => {
    setProcessing(true);
    try {
      const { data } = await api.post('/payroll/process', { month, year });
      message.success(`Processed ${data.totalEmployees} employees!`);
      await fetchRuns();
      const { data: det } = await api.get(`/payroll/details/${data.runId}`);
      setDetails(det); setCurrentRun(runs.find(r => r.runId === data.runId) || { ...data, status: 'COMPUTED' });
      setStep(3);
    } catch (err) { message.error(err.response?.data?.error || 'Processing failed'); }
    finally { setProcessing(false); }
  };

  const approvePayroll = async () => {
    if (!currentRun) return;
    try {
      await api.post(`/payroll/approve/${currentRun.runId}`);
      message.success('Payroll approved!');
      await fetchRuns(); setStep(4);
    } catch (err) { message.error(err.response?.data?.error || 'Approval failed'); }
  };

  const deleteRun = async () => {
    if (!currentRun) return;
    try {
      await api.delete(`/payroll/runs/${currentRun.runId}`);
      message.success('Deleted'); setCurrentRun(null); setDetails([]); setStep(0); await fetchRuns();
    } catch (err) { message.error(err.response?.data?.error || 'Failed'); }
  };

  const generateBankFile = async () => {
    if (!currentRun) return;
    try {
      const { data } = await api.post(`/bank/generate-file/${currentRun.runId}`);
      message.success(`Bank file generated: ${data.totalRecords} records, ₹${(data.totalAmount / 100000).toFixed(2)}L`);
    } catch (err) { message.error(err.response?.data?.error || 'Failed'); }
  };

  const steps = [
    { title: 'Select Period', icon: <CalendarOutlined />, description: 'Choose month & year' },
    { title: 'Verify Attendance', icon: <AuditOutlined />, description: 'Check attendance data' },
    { title: 'Process Salary', icon: <CalculatorOutlined />, description: 'Run payroll computation' },
    { title: 'Review & Approve', icon: <CheckCircleOutlined />, description: 'Finance approval' },
    { title: 'Bank File', icon: <BankOutlined />, description: 'Generate bank transfer' },
  ];

  return (
    <div>
      <div className="page-header">
        <div><Title level={3} style={{ margin: 0, fontFamily: 'DM Sans' }}><DollarOutlined style={{ color: '#059669' }} /> Salary Processing</Title><Text type="secondary">{entityName}</Text></div>
        {currentRun && <Tag color={currentRun.status === 'APPROVED' ? 'success' : currentRun.status === 'COMPUTED' ? 'processing' : 'default'} style={{ fontSize: 12, padding: '4px 14px' }}>{currentRun.status} — {currentRun.runId}</Tag>}
      </div>

      <Card bordered={false} style={{ marginBottom: 20 }}>
        <Steps current={step} items={steps} size="small" />
      </Card>

      {/* STEP 0: SELECT PERIOD */}
      {step === 0 && (
        <Card bordered={false}>
          <div style={{ textAlign: 'center', padding: '40px 0' }}>
            <CalendarOutlined style={{ fontSize: 48, color: 'var(--accent)', marginBottom: 16 }} />
            <Title level={4} style={{ fontFamily: 'DM Sans' }}>Select Payroll Period</Title>
            <Text type="secondary" style={{ display: 'block', marginBottom: 24 }}>Choose the month and year for salary processing</Text>
            <Space size="middle">
              <Select value={month} onChange={setMonth} style={{ width: 160 }} size="large"
                options={Array.from({ length: 12 }, (_, i) => ({ label: new Date(2026, i).toLocaleString('en', { month: 'long' }), value: i + 1 }))} />
              <Select value={year} onChange={setYear} style={{ width: 100 }} size="large"
                options={[2025, 2026, 2027].map(y => ({ label: y, value: y }))} />
              <Button type="primary" size="large" icon={<ArrowRightOutlined />} onClick={() => { loadAttendance(); setStep(1); }}>
                Next: Verify Attendance
              </Button>
            </Space>
            {runs.length > 0 && (
              <div style={{ marginTop: 32 }}>
                <Divider><Text type="secondary">Previous Runs</Text></Divider>
                <Table dataSource={runs.slice(0, 5)} rowKey="runId" size="small" pagination={false} style={{ maxWidth: 700, margin: '0 auto' }} columns={[
                  { title: 'Period', render: (_, r) => `${new Date(0, r.month - 1).toLocaleString('en', { month: 'short' })} ${r.year}` },
                  { title: 'Entity', dataIndex: 'entityCode', render: v => <Tag>{v}</Tag> },
                  { title: 'Employees', dataIndex: 'totalEmployees' },
                  { title: 'Net', dataIndex: 'totalNet', render: v => `₹${(v / 100000).toFixed(2)}L` },
                  { title: 'Status', dataIndex: 'status', render: v => <Tag color={v === 'APPROVED' ? 'success' : v === 'PAID' ? 'cyan' : 'processing'}>{v}</Tag> },
                  { title: '', render: (_, r) => (
                    <Button size="small" type="link" onClick={() => {
                      setCurrentRun(r); setMonth(r.month); setYear(r.year);
                      api.get(`/payroll/details/${r.runId}`).then(({ data }) => setDetails(data));
                      setStep(r.status === 'APPROVED' || r.status === 'PAID' ? 4 : 3);
                    }}>View</Button>
                  )},
                ]} />
              </div>
            )}
          </div>
        </Card>
      )}

      {/* STEP 1: VERIFY ATTENDANCE */}
      {step === 1 && (
        <Card bordered={false} title={<Space><AuditOutlined /> Attendance Summary — {monthName} {year}</Space>}>
          {attendance.length === 0 ? (
            <Alert type="warning" showIcon message="No attendance data found for this period." description="Process attendance from the Attendance page first, or continue anyway (all employees will be marked as full month)." style={{ marginBottom: 16 }} />
          ) : (
            <Alert type="success" showIcon message={`${attendance.length} attendance records found`} style={{ marginBottom: 16 }} />
          )}
          {attendance.length > 0 && (
            <Table dataSource={attendance.slice(0, 10)} rowKey={r => r.empCode} size="small" pagination={false} columns={[
              { title: 'Emp Code', dataIndex: 'empCode', width: 90 },
              { title: 'Paid Days', dataIndex: 'paidDays', render: v => <Text strong>{v}</Text> },
              { title: 'Present', dataIndex: 'presentDays' },
              { title: 'Absent', dataIndex: 'absentDays', render: v => v > 0 ? <Tag color="error">{v}</Tag> : 0 },
              { title: 'LWP', dataIndex: 'lwpDays', render: v => v > 0 ? <Tag color="error">{v}</Tag> : 0 },
              { title: 'Locked', dataIndex: 'isLocked', render: v => v ? <Tag color="success">Yes</Tag> : <Tag color="warning">No</Tag> },
            ]} />
          )}
          {attendance.length > 10 && <Text type="secondary" style={{ display: 'block', marginTop: 8 }}>Showing first 10 of {attendance.length} records</Text>}
          <div style={{ marginTop: 20, display: 'flex', gap: 12 }}>
            <Button onClick={() => setStep(0)}>Back</Button>
            <Button type="primary" size="large" icon={<ArrowRightOutlined />} onClick={() => setStep(2)}>
              Next: Process Salary
            </Button>
          </div>
        </Card>
      )}

      {/* STEP 2: PROCESS */}
      {step === 2 && (
        <Card bordered={false}>
          <div style={{ textAlign: 'center', padding: '40px 0' }}>
            <CalculatorOutlined style={{ fontSize: 48, color: 'var(--accent)', marginBottom: 16 }} />
            <Title level={4} style={{ fontFamily: 'DM Sans' }}>Process Salary — {monthName} {year}</Title>
            <Text type="secondary" style={{ display: 'block', marginBottom: 8 }}>Entity: {entityName}</Text>
            <Text type="secondary" style={{ display: 'block', marginBottom: 24 }}>This will compute salary for all active employees including pro-rata, PF, ESI, TDS, and loan deductions.</Text>
            {!isHR && <Alert type="warning" message="Only HR role can process payroll" style={{ maxWidth: 400, margin: '0 auto 20px' }} />}
            <Space size="middle">
              <Button onClick={() => setStep(1)}>Back</Button>
              <Button type="primary" size="large" icon={<PlayCircleOutlined />} loading={processing} disabled={!isHR} onClick={processPayroll} style={{ minWidth: 200, height: 48 }}>
                {processing ? 'Processing...' : 'Process Payroll'}
              </Button>
            </Space>
          </div>
        </Card>
      )}

      {/* STEP 3: REVIEW & APPROVE */}
      {step === 3 && (
        <div>
          <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
            <Col span={6}><Card className="stat-card"><Statistic title="Employees" value={details.length} /></Card></Col>
            <Col span={6}><Card className="stat-card"><Statistic title="Total Gross" value={details.reduce((s, d) => s + d.totalEarned, 0)} formatter={v => `₹${(v / 100000).toFixed(2)}L`} /></Card></Col>
            <Col span={6}><Card className="stat-card"><Statistic title="Total Deductions" value={details.reduce((s, d) => s + d.totalDeductions + d.loanDeduction, 0)} formatter={v => `₹${(v / 1000).toFixed(1)}K`} valueStyle={{ color: 'var(--danger)' }} /></Card></Col>
            <Col span={6}><Card className="stat-card"><Statistic title="Net Payable" value={details.reduce((s, d) => s + d.netPayable, 0)} formatter={v => `₹${(v / 100000).toFixed(2)}L`} valueStyle={{ color: 'var(--accent)', fontWeight: 700 }} /></Card></Col>
          </Row>

          <Card bordered={false} title={<Space><AuditOutlined /> Salary Details — {monthName} {year}</Space>}
            extra={<Space>
              {currentRun?.status === 'COMPUTED' && isFinance && <Button type="primary" icon={<CheckCircleOutlined />} onClick={approvePayroll}>Approve Payroll</Button>}
              {currentRun?.status === 'COMPUTED' && isHR && <Popconfirm title="Delete this run?" onConfirm={deleteRun}><Button danger icon={<DeleteOutlined />}>Delete</Button></Popconfirm>}
              <Button icon={<FilePdfOutlined />} onClick={() => currentRun && api.post(`/reports/payslips-bulk/${currentRun.runId}`).then(() => message.success('Payslips generated'))}>Generate Payslips</Button>
            </Space>}>
            {currentRun?.status === 'COMPUTED' && !isFinance && (
              <Alert type="info" showIcon message="Waiting for Finance approval. The payroll has been computed and is ready for review." style={{ marginBottom: 16 }} />
            )}
            <Table dataSource={details} loading={loading} rowKey={r => r.empCode} size="small" scroll={{ x: 1300 }} pagination={{ pageSize: 100 }} columns={[
              { title: 'Code', dataIndex: 'empCode', width: 75, fixed: 'left' },
              { title: 'Name', dataIndex: 'employeeName', width: 150, fixed: 'left', render: v => <Text strong>{v}</Text> },
              { title: 'Days', dataIndex: 'paidDays', width: 45 },
              { title: 'Basic', dataIndex: 'basicEarned', width: 80, render: v => `₹${(v||0).toLocaleString('en-IN')}` },
              { title: 'HRA', dataIndex: 'hraEarned', width: 70, render: v => `₹${(v||0).toLocaleString('en-IN')}` },
              { title: 'Conv', dataIndex: 'covEarned', width: 70, render: v => `₹${(v||0).toLocaleString('en-IN')}` },
              { title: 'Gross', dataIndex: 'totalEarned', width: 90, render: v => <Text strong>₹{(v||0).toLocaleString('en-IN')}</Text> },
              { title: 'PF', dataIndex: 'pfEmployee', width: 55, render: v => v > 0 ? `₹${v}` : '-' },
              { title: 'ESI', dataIndex: 'esiEmployee', width: 45, render: v => v > 0 ? `₹${v}` : '-' },
              { title: 'TDS', dataIndex: 'tds', width: 65, render: v => v > 0 ? `₹${v.toLocaleString('en-IN')}` : '-' },
              { title: 'Loan', dataIndex: 'loanDeduction', width: 65, render: v => v > 0 ? `₹${v.toLocaleString('en-IN')}` : '-' },
              { title: 'Net', dataIndex: 'netPayable', width: 100, render: v => <Text strong style={{ color: 'var(--accent)' }}>₹{(v||0).toLocaleString('en-IN')}</Text> },
              { title: '', width: 45, render: (_, r) => <Button size="small" type="text" icon={<FilePdfOutlined />} onClick={() => downloadFile(`/reports/payslip-pdf/${r.runId}/${r.empCode}`)} /> },
            ]} />
          </Card>
        </div>
      )}

      {/* STEP 4: BANK FILE */}
      {step === 4 && (
        <Card bordered={false}>
          <Result status="success" title={`Payroll Approved — ${monthName} ${year}`}
            subTitle={`${currentRun?.totalEmployees} employees, Net: ₹${((currentRun?.totalNet || 0) / 100000).toFixed(2)} Lakhs`}
            extra={[
              <Button key="bank" type="primary" size="large" icon={<BankOutlined />} onClick={generateBankFile}>Generate HDFC Bank File</Button>,
              <Button key="excel" icon={<DownloadOutlined />} onClick={() => downloadFile(`/reports/salary-register-excel/${currentRun?.runId}`)}>Download Excel</Button>,
              <Button key="ecr" icon={<DownloadOutlined />} onClick={() => downloadFile(`/reports/ecr/${currentRun?.runId}`)}>Download ECR (PF)</Button>,
              <Button key="tally" icon={<DownloadOutlined />} onClick={() => downloadFile(`/reports/tally-export/${currentRun?.runId}`)}>Tally GL Export</Button>,
              <Button key="payslips" icon={<FilePdfOutlined />} onClick={() => api.post(`/reports/payslips-bulk/${currentRun?.runId}`).then(() => message.success('All payslips generated'))}>Generate All Payslips</Button>,
              <Button key="new" onClick={() => { setStep(0); setCurrentRun(null); setDetails([]); }}>Process Another Month</Button>,
            ]}
          />
        </Card>
      )}
    </div>
  );
}
