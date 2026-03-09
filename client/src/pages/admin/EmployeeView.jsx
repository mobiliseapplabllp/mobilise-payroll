import React, { useState, useEffect } from 'react';
import { Card, Descriptions, Typography, Button, Space, Tag, Spin, Row, Col, Divider, Tabs, Table, Statistic, Empty, message, Upload, Modal, Select, Input, Popconfirm, Badge } from 'antd';
import { ArrowLeftOutlined, EditOutlined, DownloadOutlined, FilePdfOutlined, UploadOutlined, CheckCircleOutlined, DeleteOutlined, FileOutlined, EyeOutlined } from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../main';
import api, { downloadFile } from '../../utils/api';

const { Title, Text } = Typography;

const DOC_TYPES = [
  { value: 'AADHAAR', label: 'Aadhaar Card' },
  { value: 'PAN', label: 'PAN Card' },
  { value: 'PASSPORT', label: 'Passport' },
  { value: 'EDUCATION', label: 'Education Certificate' },
  { value: 'EXPERIENCE', label: 'Experience Letter' },
  { value: 'OFFER_LETTER', label: 'Offer Letter' },
  { value: 'RELIEVING', label: 'Relieving Letter' },
  { value: 'PAYSLIP', label: 'Previous Payslip' },
  { value: 'LOAN_AGREEMENT', label: 'Loan Agreement' },
  { value: 'ADDRESS_PROOF', label: 'Address Proof' },
  { value: 'BANK_PROOF', label: 'Bank Account Proof' },
  { value: 'PHOTO', label: 'Photograph' },
  { value: 'OTHER', label: 'Other' },
];

function DocumentsTab({ empCode, userRole }) {
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploadModal, setUploadModal] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [docType, setDocType] = useState('OTHER');
  const [docName, setDocName] = useState('');
  const [remarks, setRemarks] = useState('');
  const [fileList, setFileList] = useState([]);
  const canManage = ['HR', 'SUPER_ADMIN'].includes(userRole);

  const fetchDocs = () => {
    setLoading(true);
    api.get(`/employees/${empCode}/documents`).then(({ data }) => setDocs(data)).catch(() => setDocs([])).finally(() => setLoading(false));
  };
  useEffect(fetchDocs, [empCode]);

  const handleUpload = async () => {
    if (!fileList.length) { message.warning('Select a file'); return; }
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', fileList[0].originFileObj || fileList[0]);
      formData.append('docType', docType);
      formData.append('docName', docName || fileList[0].name);
      formData.append('remarks', remarks);
      await api.post(`/employees/${empCode}/documents`, formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      message.success('Document uploaded');
      setUploadModal(false); setFileList([]); setDocName(''); setRemarks(''); setDocType('OTHER');
      fetchDocs();
    } catch (err) { message.error(err.response?.data?.error || 'Upload failed'); }
    finally { setUploading(false); }
  };

  const verify = async (docId) => {
    try { await api.put(`/employees/${empCode}/documents/${docId}/verify`); message.success('Verified'); fetchDocs(); }
    catch { message.error('Failed'); }
  };

  const deleteDoc = async (docId) => {
    try { await api.delete(`/employees/${empCode}/documents/${docId}`); message.success('Deleted'); fetchDocs(); }
    catch { message.error('Failed'); }
  };

  const verified = docs.filter(d => d.verified).length;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Space>
          <Text strong>{docs.length} documents</Text>
          <Badge count={verified} style={{ background: '#059669' }} />
          <Text type="secondary" style={{ fontSize: 12 }}>{verified} verified</Text>
        </Space>
        {canManage && <Button type="primary" icon={<UploadOutlined />} onClick={() => setUploadModal(true)}>Upload Document</Button>}
      </div>

      <Table dataSource={docs} rowKey="_id" loading={loading} size="small" pagination={false} columns={[
        { title: 'Type', dataIndex: 'docType', width: 140, render: v => <Tag color="blue">{DOC_TYPES.find(t => t.value === v)?.label || v}</Tag> },
        { title: 'Name', dataIndex: 'docName', render: (v, r) => <Space><FileOutlined /><Text>{v || r.fileName}</Text></Space> },
        { title: 'Size', dataIndex: 'fileSize', width: 80, render: v => v ? `${(v / 1024).toFixed(0)} KB` : '-' },
        { title: 'Uploaded', dataIndex: 'uploadedAt', width: 100, render: v => v ? new Date(v).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' }) : '-' },
        { title: 'By', dataIndex: 'uploadedBy', width: 100, ellipsis: true },
        { title: 'Status', width: 90, render: (_, r) => r.verified
          ? <Tag color="success" icon={<CheckCircleOutlined />}>Verified</Tag>
          : <Tag color="warning">Pending</Tag> },
        { title: 'Actions', width: 180, render: (_, r) => (
          <Space size={4}>
            <Button size="small" type="link" icon={<DownloadOutlined />} onClick={() => downloadFile(`/employees/${empCode}/documents/${r._id}/download`)}>Download</Button>
            {canManage && !r.verified && <Button size="small" type="link" style={{ color: '#059669' }} icon={<CheckCircleOutlined />} onClick={() => verify(r._id)}>Verify</Button>}
            {canManage && <Popconfirm title="Delete this document?" onConfirm={() => deleteDoc(r._id)}><Button size="small" type="link" danger icon={<DeleteOutlined />} /></Popconfirm>}
          </Space>
        )},
      ]} />

      <Modal title="Upload Employee Document" open={uploadModal} onCancel={() => setUploadModal(false)} onOk={handleUpload} confirmLoading={uploading} okText="Upload" width={480}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <Text strong style={{ fontSize: 12 }}>Document Type *</Text>
            <Select value={docType} onChange={setDocType} style={{ width: '100%', marginTop: 4 }} options={DOC_TYPES} />
          </div>
          <div>
            <Text strong style={{ fontSize: 12 }}>Document Name</Text>
            <Input value={docName} onChange={e => setDocName(e.target.value)} placeholder="e.g. Aadhaar Front & Back" style={{ marginTop: 4 }} />
          </div>
          <div>
            <Text strong style={{ fontSize: 12 }}>File *</Text>
            <Upload fileList={fileList} onChange={({ fileList: fl }) => setFileList(fl.slice(-1))} beforeUpload={() => false} accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx" maxCount={1}>
              <Button icon={<UploadOutlined />} style={{ marginTop: 4 }}>Select File (PDF, JPG, PNG, DOC — max 10MB)</Button>
            </Upload>
          </div>
          <div>
            <Text strong style={{ fontSize: 12 }}>Remarks</Text>
            <Input.TextArea value={remarks} onChange={e => setRemarks(e.target.value)} rows={2} placeholder="Optional notes" style={{ marginTop: 4 }} />
          </div>
        </div>
      </Modal>
    </div>
  );
}

export default function EmployeeView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [emp, setEmp] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tabData, setTabData] = useState({});
  const [activeTab, setActiveTab] = useState('profile');

  useEffect(() => {
    api.get(`/employees/${id}`).then(({ data }) => setEmp(data)).catch(() => {}).finally(() => setLoading(false));
  }, [id]);

  // Load tab data lazily
  useEffect(() => {
    if (!emp?.empCode) return;
    const code = emp.empCode;
    const loaders = {
      attendance: () => api.get(`/attendance/summary/${new Date().getFullYear()}/${new Date().getMonth() + 1}`).then(r => r.data.find(s => s.empCode === code) || null),
      leaves: () => api.get('/leaves', { params: { empCode: code } }).then(r => r.data),
      compoffs: () => api.get('/compoff', { params: { empCode: code } }).then(r => r.data),
      loans: () => api.get('/loans', { params: { empCode: code } }).then(r => r.data),
      payslips: () => api.get('/payroll/runs').then(r => r.data.filter(run => ['APPROVED', 'PAID'].includes(run.status))),
    };
    if (loaders[activeTab] && !tabData[activeTab]) {
      loaders[activeTab]().then(data => setTabData(prev => ({ ...prev, [activeTab]: data }))).catch(() => {});
    }
  }, [activeTab, emp]);

  if (loading) return <Spin size="large" style={{ display: 'block', margin: '100px auto' }} />;
  if (!emp) return <Text>Employee not found</Text>;

  const fmt = v => v ? `₹${v.toLocaleString('en-IN')}` : '₹0';
  const fmtDate = d => d ? new Date(d).toLocaleDateString('en-IN') : '-';
  const code = emp.empCode;

  const tabItems = [
    { key: 'profile', label: 'Profile', children: (
      <Row gutter={16}>
        <Col span={16}>
          <Card title="Personal Information" bordered={false} size="small" style={{ marginBottom: 12 }}>
            <Descriptions column={3} size="small">
              <Descriptions.Item label="Code"><Text strong>{emp.empCode}</Text></Descriptions.Item>
              <Descriptions.Item label="Name"><Text strong>{emp.firstName} {emp.lastName}</Text></Descriptions.Item>
              <Descriptions.Item label="Gender">{emp.gender || '-'}</Descriptions.Item>
              <Descriptions.Item label="DOB">{fmtDate(emp.dateOfBirth)}</Descriptions.Item>
              <Descriptions.Item label="Father's Name">{emp.fatherName || '-'}</Descriptions.Item>
              <Descriptions.Item label="Marital Status">{emp.maritalStatus || '-'}</Descriptions.Item>
              <Descriptions.Item label="Email">{emp.email || '-'}</Descriptions.Item>
              <Descriptions.Item label="Mobile">{emp.mobile || '-'}</Descriptions.Item>
              <Descriptions.Item label="PAN">{emp.pan || '-'}</Descriptions.Item>
              <Descriptions.Item label="Aadhaar">{emp.aadhaar || '-'}</Descriptions.Item>
            </Descriptions>
          </Card>
          <Card title="Employment" bordered={false} size="small" style={{ marginBottom: 12 }}>
            <Descriptions column={3} size="small">
              <Descriptions.Item label="DOJ">{fmtDate(emp.dateOfJoining)}</Descriptions.Item>
              <Descriptions.Item label="Department">{emp.department}</Descriptions.Item>
              <Descriptions.Item label="Designation">{emp.designation || '-'}</Descriptions.Item>
              <Descriptions.Item label="Grade"><Tag color="blue">{emp.grade || '-'}</Tag></Descriptions.Item>
              <Descriptions.Item label="Role">{emp.role || '-'}</Descriptions.Item>
              <Descriptions.Item label="Type"><Tag color={emp.employmentType === 'Intern' ? 'orange' : 'blue'}>{emp.employmentType}</Tag></Descriptions.Item>
              <Descriptions.Item label="Location">{emp.workLocation}</Descriptions.Item>
              <Descriptions.Item label="Status"><Tag color={emp.status === 'Active' ? 'green' : 'red'}>{emp.status}</Tag></Descriptions.Item>
              <Descriptions.Item label="Reporting To">{emp.reportingManager || '-'}</Descriptions.Item>
            </Descriptions>
          </Card>
          <Card title="Bank Details" bordered={false} size="small">
            <Descriptions column={3} size="small">
              <Descriptions.Item label="Bank">{emp.bankName || 'HDFC'}</Descriptions.Item>
              <Descriptions.Item label="Account">{emp.accountNumber || '-'}</Descriptions.Item>
              <Descriptions.Item label="IFSC">{emp.ifscCode || '-'}</Descriptions.Item>
              <Descriptions.Item label="Mode"><Tag>{emp.paymentMode}</Tag></Descriptions.Item>
            </Descriptions>
          </Card>
        </Col>
        <Col span={8}>
          <Card title="Salary" bordered={false} size="small" style={{ marginBottom: 12 }}>
            <Space direction="vertical" style={{ width: '100%' }} size={4}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><Text>Basic</Text><Text strong>{fmt(emp.basicSalary)}</Text></div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><Text>HRA</Text><Text strong>{fmt(emp.hra)}</Text></div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><Text>Conv & Others</Text><Text strong>{fmt(emp.conveyanceAndOthers)}</Text></div>
              <Divider style={{ margin: '6px 0' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><Text strong>Monthly</Text><Text strong style={{ color: '#1A6FB5', fontSize: 15 }}>{fmt(emp.totalMonthlySalary)}</Text></div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><Text type="secondary">Annual CTC</Text><Text type="secondary">{fmt(emp.totalMonthlySalary * 12)}</Text></div>
            </Space>
          </Card>
          <Card title="Statutory" bordered={false} size="small">
            <Space direction="vertical" style={{ width: '100%' }} size={4}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><Text>PF</Text>{emp.pfApplicable ? <Tag color="green">Yes</Tag> : <Tag>No</Tag>}</div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><Text>ESI</Text>{emp.esiApplicable ? <Tag color="green">Yes</Tag> : <Tag>No</Tag>}</div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><Text>TDS/month</Text><Text>{fmt(emp.tdsAmount)}</Text></div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><Text>Regime</Text><Tag>{emp.taxRegime}</Tag></div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><Text>UAN</Text><Text>{emp.uan || '-'}</Text></div>
            </Space>
          </Card>
        </Col>
      </Row>
    )},

    { key: 'attendance', label: 'Attendance', children: (() => {
      const s = tabData.attendance;
      if (!s) return <Empty description="No attendance data for current month. Process attendance from Attendance page." />;
      return (
        <Row gutter={[16, 16]}>
          <Col span={6}><Card size="small"><Statistic title="Paid Days" value={s.paidDays} valueStyle={{ color: '#1A6FB5' }} /></Card></Col>
          <Col span={6}><Card size="small"><Statistic title="Present" value={s.presentDays} valueStyle={{ color: '#059669' }} /></Card></Col>
          <Col span={6}><Card size="small"><Statistic title="Absent/LWP" value={(s.absentDays || 0) + (s.unpaidLeaves || 0)} valueStyle={{ color: '#DC2626' }} /></Card></Col>
          <Col span={6}><Card size="small"><Statistic title="OT Hours" value={s.overtimeHours || 0} /></Card></Col>
          <Col span={24}>
            <Table size="small" pagination={false} dataSource={[
              { key: '1', item: 'Total Days', val: s.totalDays }, { key: '2', item: 'Present', val: s.presentDays },
              { key: '3', item: 'WFH', val: s.wfhDays }, { key: '4', item: 'Week Offs', val: s.weekOffs },
              { key: '5', item: 'Holidays', val: s.holidays }, { key: '6', item: 'Paid Leaves', val: s.paidLeaves },
              { key: '7', item: 'Half Days', val: s.halfDays }, { key: '8', item: 'Absent', val: s.absentDays },
              { key: '9', item: 'Late Count', val: s.lateCount },
            ]} columns={[
              { title: 'Category', dataIndex: 'item' },
              { title: 'Value', dataIndex: 'val', render: v => <Tag>{v || 0}</Tag> },
            ]} />
          </Col>
        </Row>
      );
    })()},

    { key: 'leaves', label: 'Leaves', children: (
      <Table size="small" dataSource={tabData.leaves || []} rowKey="_id" pagination={{ pageSize: 10 }}
        locale={{ emptyText: 'No leave applications' }}
        columns={[
          { title: 'Type', dataIndex: 'leaveType', width: 60, render: v => <Tag color="blue">{v}</Tag> },
          { title: 'From', dataIndex: 'fromDate', render: d => fmtDate(d) },
          { title: 'To', dataIndex: 'toDate', render: d => fmtDate(d) },
          { title: 'Days', dataIndex: 'days', width: 50 },
          { title: 'Reason', dataIndex: 'reason', ellipsis: true },
          { title: 'Status', dataIndex: 'status', render: v => <Tag color={v === 'APPROVED' ? 'green' : v === 'REJECTED' ? 'red' : 'orange'}>{v}</Tag> },
        ]}
      />
    )},

    { key: 'compoffs', label: 'Comp-Offs', children: (
      <Table size="small" dataSource={tabData.compoffs || []} rowKey="_id" pagination={{ pageSize: 10 }}
        locale={{ emptyText: 'No comp-off records' }}
        columns={[
          { title: 'Earned Date', dataIndex: 'earnedDate', render: d => fmtDate(d) },
          { title: 'Days', dataIndex: 'earnedDays', width: 50 },
          { title: 'Reason', dataIndex: 'earnedReason', ellipsis: true },
          { title: 'Encashment', dataIndex: 'encashmentAmount', render: v => v > 0 ? fmt(v) : '-' },
          { title: 'Status', dataIndex: 'status', render: v => {
            const c = { PENDING: 'orange', APPROVED: 'blue', ENCASHED: 'green', AVAILED: 'cyan', EXPIRED: 'red' };
            return <Tag color={c[v] || 'default'}>{v}</Tag>;
          }},
        ]}
      />
    )},

    { key: 'loans', label: 'Loans', children: (
      <Table size="small" dataSource={tabData.loans || []} rowKey="_id" pagination={false}
        locale={{ emptyText: 'No loans' }}
        columns={[
          { title: 'ID', dataIndex: 'loanId', width: 120 },
          { title: 'Type', dataIndex: 'loanType', render: v => <Tag>{v}</Tag> },
          { title: 'Amount', dataIndex: 'amount', render: v => fmt(v) },
          { title: 'EMI', dataIndex: 'emiAmount', render: v => fmt(v) },
          { title: 'Outstanding', dataIndex: 'outstandingBalance', render: v => <Text strong>{fmt(v)}</Text> },
          { title: 'Status', dataIndex: 'status', render: v => <Tag color={v === 'ACTIVE' ? 'green' : v === 'CLOSED' ? 'default' : 'blue'}>{v}</Tag> },
        ]}
      />
    )},

    { key: 'payslips', label: 'Salary Slips', children: (
      <Table size="small" dataSource={tabData.payslips || []} rowKey="runId" pagination={false}
        locale={{ emptyText: 'No payslips available. Process payroll first.' }}
        columns={[
          { title: 'Period', render: (_, r) => <Text strong>{new Date(0, r.month - 1).toLocaleString('en', { month: 'long' })} {r.year}</Text> },
          { title: 'Entity', dataIndex: 'entityCode', render: v => <Tag>{v}</Tag> },
          { title: 'Status', dataIndex: 'status', render: v => <Tag color="green">{v}</Tag> },
          { title: 'Download', render: (_, r) => (
            <Button type="primary" size="small" ghost icon={<FilePdfOutlined />}
              onClick={() => downloadFile(`/reports/payslip-pdf/${r.runId}/${code}`)}>
              Download PDF
            </Button>
          )},
        ]}
      />
    )},

    { key: 'form16', label: 'Form 16', children: (
      <Card bordered={false}>
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          <Text>Download Form 16 (Part B) for the selected financial year:</Text>
          <Space>
            <Button type="primary" icon={<DownloadOutlined />} onClick={() => downloadFile(`/reports/form16/${code}/2025-26`)}>
              FY 2025-26
            </Button>
            <Button icon={<DownloadOutlined />} onClick={() => downloadFile(`/reports/form16/${code}/2024-25`)}>
              FY 2024-25
            </Button>
          </Space>
          <Text type="secondary" style={{ fontSize: 12 }}>Form 16 Part A must be downloaded from TRACES portal by your employer.</Text>
        </Space>
      </Card>
    )},

    { key: 'tax', label: 'Tax Calculation', children: (() => {
      const annual = (emp.totalMonthlySalary || 0) * 12;
      const pfAnnual = emp.pfApplicable ? Math.min(emp.basicSalary, 15000) * 0.12 * 12 : 0;
      const stdDed = 75000;
      const taxable = annual - stdDed - pfAnnual;
      // FY 2025-26 New Tax Regime (Union Budget 2025)
      let tax = 0, rem = Math.max(taxable, 0), prev = 0;
      for (const { limit, rate } of [
        { limit: 400000, rate: 0 },
        { limit: 800000, rate: 5 },
        { limit: 1200000, rate: 10 },
        { limit: 1600000, rate: 15 },
        { limit: 2000000, rate: 20 },
        { limit: 2400000, rate: 25 },
        { limit: Infinity, rate: 30 },
      ]) {
        const t = Math.min(rem, limit - prev); tax += t * rate / 100; rem -= t; prev = limit; if (rem <= 0) break;
      }
      // Rebate u/s 87A: If taxable income ≤ 12L, tax = 0
      // Marginal relief: If taxable 12L-12.75L, tax = excess over 12L
      if (taxable <= 1200000) tax = 0;
      else if (taxable <= 1275000) tax = Math.min(tax, taxable - 1200000);
      const cess = Math.round(tax * 0.04);
      return (
        <Row gutter={16}>
          <Col span={8}><Card size="small"><Statistic title="Annual CTC" value={annual} prefix="₹" formatter={v => `${(v / 100000).toFixed(1)}L`} /></Card></Col>
          <Col span={8}><Card size="small"><Statistic title="Taxable Income" value={Math.max(taxable, 0)} prefix="₹" formatter={v => `${(v / 100000).toFixed(1)}L`} /></Card></Col>
          <Col span={8}><Card size="small"><Statistic title="Tax + Cess" value={Math.round(tax + cess)} prefix="₹" formatter={v => v.toLocaleString('en-IN')} valueStyle={{ color: tax > 0 ? '#DC2626' : '#059669' }} /></Card></Col>
          <Col span={24} style={{ marginTop: 12 }}>
            <Table size="small" pagination={false} dataSource={[
              { key: '1', item: 'Gross Salary (Annual)', val: fmt(annual) },
              { key: '2', item: 'Less: Standard Deduction (Sec 16)', val: `(${fmt(stdDed)})` },
              { key: '3', item: 'Less: PF Employee (Sec 80C)', val: `(${fmt(Math.round(pfAnnual))})` },
              { key: '4', item: 'Taxable Income', val: fmt(Math.max(taxable, 0)), bold: true },
              { key: '5', item: 'Tax on Income (New Regime FY25-26)', val: fmt(Math.round(tax)) },
              { key: '6', item: 'Rebate u/s 87A (≤₹12L)', val: taxable <= 1200000 ? `(${fmt(Math.round(tax))})` : '₹0' },
              { key: '7', item: 'Cess (4%)', val: fmt(cess) },
              { key: '8', item: 'Total Tax', val: fmt(Math.round(tax + cess)), bold: true },
              { key: '9', item: `Monthly TDS (current)`, val: fmt(emp.tdsAmount || 0) },
            ]} columns={[
              { title: 'Item', dataIndex: 'item', render: (v, r) => r.bold ? <Text strong>{v}</Text> : v },
              { title: 'Amount', dataIndex: 'val', align: 'right', render: (v, r) => r.bold ? <Text strong>{v}</Text> : v },
            ]} />
          </Col>
        </Row>
      );
    })()},

    { key: 'documents', label: 'Documents', children: <DocumentsTab empCode={code} userRole={user?.role} /> },
  ];

  return (
    <div>
      <div className="page-header">
        <Space>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/employees')} />
          <div>
            <Title level={4} style={{ margin: 0, fontFamily: 'DM Sans' }}>{emp.empCode} — {emp.firstName} {emp.lastName}</Title>
            <Space size={4}>
              <Tag color={emp.status === 'Active' ? 'green' : 'red'}>{emp.status}</Tag>
              <Tag color="blue">{emp.grade || emp.employmentType}</Tag>
              <Text type="secondary">{emp.department} • {emp.designation}</Text>
            </Space>
          </div>
        </Space>
        <Button type="primary" icon={<EditOutlined />} onClick={() => navigate(`/employees/edit/${id}`)}>Edit Employee</Button>
      </div>

      <Card bordered={false}>
        <Tabs activeKey={activeTab} onChange={setActiveTab} items={tabItems} size="small" />
      </Card>
    </div>
  );
}
