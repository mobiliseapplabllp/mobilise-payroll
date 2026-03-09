import React, { useState, useEffect } from 'react';
import { Card, Typography, Button, Select, Space, Table, Tag, message, Row, Col, Statistic } from 'antd';
import { DownloadOutlined, FileExcelOutlined, FilePdfOutlined, BankOutlined, BarChartOutlined} from '@ant-design/icons';
import api, { downloadFile } from '../../utils/api';
const { Title, Text } = Typography;

const REPORT_TYPES = [
  { label: 'Salary Register', value: 'salary-register', icon: '📊' },
  { label: 'PF Register', value: 'pf-register', icon: '🏛️' },
  { label: 'ESI Register', value: 'esi-register', icon: '🏥' },
  { label: 'TDS Report', value: 'tds-report', icon: '💰' },
];

const REPORT_COLUMNS = {
  'salary-register': [
    { title: 'Code', dataIndex: 'empCode', width: 80, fixed: 'left' },
    { title: 'Name', dataIndex: 'employeeName', width: 150, fixed: 'left' },
    { title: 'Days', dataIndex: 'paidDays', width: 50 },
    { title: 'Basic(E)', dataIndex: 'basicEarned', width: 85, render: v => `₹${(v||0).toLocaleString('en-IN')}` },
    { title: 'HRA(E)', dataIndex: 'hraEarned', width: 80, render: v => `₹${(v||0).toLocaleString('en-IN')}` },
    { title: 'Conv(E)', dataIndex: 'covEarned', width: 80, render: v => `₹${(v||0).toLocaleString('en-IN')}` },
    { title: 'Gross', dataIndex: 'totalEarned', width: 90, render: v => <Text strong>₹{(v||0).toLocaleString('en-IN')}</Text> },
    { title: 'PF', dataIndex: 'pfEmployee', width: 65, render: v => v > 0 ? `₹${v}` : '-' },
    { title: 'ESI', dataIndex: 'esiEmployee', width: 55, render: v => v > 0 ? `₹${v}` : '-' },
    { title: 'TDS', dataIndex: 'tds', width: 70, render: v => v > 0 ? `₹${v.toLocaleString('en-IN')}` : '-' },
    { title: 'Loan', dataIndex: 'loanDeduction', width: 70, render: v => v > 0 ? `₹${v.toLocaleString('en-IN')}` : '-' },
    { title: 'Net Payable', dataIndex: 'netPayable', width: 100, render: v => <Text strong style={{ color: '#1A6FB5' }}>₹{(v||0).toLocaleString('en-IN')}</Text> },
    { title: 'Mode', dataIndex: 'paymentMode', width: 55 },
  ],
  'pf-register': [
    { title: 'Code', dataIndex: 'empCode', width: 80 },
    { title: 'Name', dataIndex: 'employeeName', width: 180 },
    { title: 'Basic Earned', dataIndex: 'basicEarned', width: 100, render: v => `₹${(v||0).toLocaleString('en-IN')}` },
    { title: 'PF Wage', dataIndex: 'pfCalcAmount', width: 90, render: v => `₹${(v||0).toLocaleString('en-IN')}` },
    { title: 'EE PF (12%)', dataIndex: 'pfEmployee', width: 90, render: v => `₹${(v||0).toLocaleString('en-IN')}` },
    { title: 'ER EPS (8.33%)', dataIndex: 'pfEmployer833', width: 100, render: v => `₹${(v||0).toLocaleString('en-IN')}` },
    { title: 'ER EPF (3.67%)', dataIndex: 'pfEmployer367', width: 100, render: v => `₹${(v||0).toLocaleString('en-IN')}` },
    { title: 'EDLI', dataIndex: 'pfEmployerEDLI', width: 70, render: v => `₹${(v||0).toLocaleString('en-IN')}` },
  ],
  'esi-register': [
    { title: 'Code', dataIndex: 'empCode', width: 80 },
    { title: 'Name', dataIndex: 'employeeName', width: 180 },
    { title: 'Gross', dataIndex: 'totalEarned', width: 100, render: v => `₹${(v||0).toLocaleString('en-IN')}` },
    { title: 'EE ESI (0.75%)', dataIndex: 'esiEmployee', width: 100, render: v => `₹${(v||0).toLocaleString('en-IN')}` },
    { title: 'ER ESI (3.25%)', dataIndex: 'esiEmployer', width: 100, render: v => `₹${(v||0).toLocaleString('en-IN')}` },
  ],
  'tds-report': [
    { title: 'Code', dataIndex: 'empCode', width: 80 },
    { title: 'Name', dataIndex: 'employeeName', width: 180 },
    { title: 'Gross Earned', dataIndex: 'totalEarned', width: 110, render: v => `₹${(v||0).toLocaleString('en-IN')}` },
    { title: 'Monthly TDS', dataIndex: 'tds', width: 100, render: v => <Text strong style={{ color: '#DC2626' }}>₹{(v||0).toLocaleString('en-IN')}</Text> },
  ],
};

export default function Reports() {
  const [runs, setRuns] = useState([]);
  const [selectedRun, setSelectedRun] = useState(null);
  const [reportType, setReportType] = useState('salary-register');
  const [reportData, setReportData] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => { api.get('/payroll/runs').then(({ data }) => { setRuns(data); if (data[0]) setSelectedRun(data[0].runId); }); }, []);

  useEffect(() => {
    if (!selectedRun) return;
    setLoading(true);
    api.get(`/reports/${reportType}/${selectedRun}`).then(({ data }) => setReportData(data)).catch(() => setReportData([])).finally(() => setLoading(false));
  }, [selectedRun, reportType]);

  const totalNet = reportData.reduce((s, d) => s + (d.netPayable || 0), 0);
  const totalPF = reportData.reduce((s, d) => s + (d.pfEmployee || 0), 0);

  return (
    <div>
      <div className="page-header">
        <Title level={3} style={{ margin: 0, fontFamily: 'DM Sans' }}><BarChartOutlined style={{ color: '#2563EB' }} /> Reports</Title>
        <Space wrap>
          <Select value={reportType} onChange={setReportType} style={{ width: 180 }} options={REPORT_TYPES} />
          <Select value={selectedRun} onChange={setSelectedRun} style={{ width: 300 }} placeholder="Select payroll run"
            options={runs.map(r => ({ label: `${r.runId} (${new Date(0, r.month - 1).toLocaleString('en', { month: 'short' })} ${r.year}) - ${r.entityCode}`, value: r.runId }))} />
          {selectedRun && <>
            <Button icon={<FileExcelOutlined />} onClick={() => downloadFile(`/reports/salary-register-excel/${selectedRun}`)}>Excel</Button>
            <Button icon={<BankOutlined />} onClick={() => downloadFile(`/reports/ecr/${selectedRun}`)}>ECR (PF)</Button>
            <Button icon={<DownloadOutlined />} onClick={() => downloadFile(`/reports/tally-export/${selectedRun}`)}>Tally GL</Button>
          </>}
        </Space>
      </div>

      {reportData.length > 0 && (
        <Row gutter={16} style={{ marginBottom: 16 }}>
          <Col span={6}><Card size="small"><Statistic title="Records" value={reportData.length} /></Card></Col>
          <Col span={6}><Card size="small"><Statistic title="Total Gross" value={reportData.reduce((s, d) => s + (d.totalEarned || 0), 0)} formatter={v => `₹${(v / 100000).toFixed(2)}L`} /></Card></Col>
          <Col span={6}><Card size="small"><Statistic title="Total PF (EE)" value={totalPF} formatter={v => `₹${v.toLocaleString('en-IN')}`} /></Card></Col>
          <Col span={6}><Card size="small"><Statistic title="Total Net" value={totalNet} formatter={v => `₹${(v / 100000).toFixed(2)}L`} valueStyle={{ color: '#1A6FB5' }} /></Card></Col>
        </Row>
      )}

      <Card bordered={false}>
        <Table dataSource={reportData} loading={loading} rowKey={(r, i) => r.empCode || i} size="small"
          scroll={{ x: 1200 }} pagination={{ pageSize: 100, showTotal: t => `${t} records` }}
          columns={REPORT_COLUMNS[reportType] || []} />
      </Card>
    </div>
  );
}
