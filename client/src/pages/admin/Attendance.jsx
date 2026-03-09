import React, { useState, useEffect } from 'react';
import { Card, Typography, Button, Space, Select, Table, Tag, Upload, message, Statistic, Row, Col, Modal, Form, Input, DatePicker } from 'antd';
import { UploadOutlined, LockOutlined, DownloadOutlined, PlayCircleOutlined, PlusOutlined, CalendarOutlined} from '@ant-design/icons';
import EmployeeSelect from '../../components/common/EmployeeSelect';
import api from '../../utils/api';
const { Title, Text } = Typography;

export default function Attendance() {
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());
  const [summaries, setSummaries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [entryModal, setEntryModal] = useState(false);
  const [entryForm] = Form.useForm();

  const fetchSummaries = async () => {
    setLoading(true);
    try { const { data } = await api.get(`/attendance/summary/${year}/${month}`); setSummaries(data); }
    catch { message.error('Failed to load'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchSummaries(); }, [month, year]);

  const columns = [
    { title: 'Emp Code', dataIndex: 'empCode', width: 90 },
    { title: 'Total Days', dataIndex: 'totalDays', width: 80 },
    { title: 'Present', dataIndex: 'presentDays', width: 70, render: v => <Tag color="green">{v}</Tag> },
    { title: 'Absent', dataIndex: 'absentDays', width: 70, render: v => v > 0 ? <Tag color="red">{v}</Tag> : 0 },
    { title: 'Half Days', dataIndex: 'halfDays', width: 70 },
    { title: 'Week Off', dataIndex: 'weekOffs', width: 70 },
    { title: 'Holiday', dataIndex: 'holidays', width: 70 },
    { title: 'WFH', dataIndex: 'wfhDays', width: 60 },
    { title: 'OT Hours', dataIndex: 'overtimeHours', width: 70 },
    { title: 'Paid Days', dataIndex: 'paidDays', width: 80, render: v => <Text strong>{v}</Text> },
    { title: 'LWP', dataIndex: 'lwpDays', width: 60, render: v => v > 0 ? <Tag color="red">{v}</Tag> : 0 },
    { title: 'Locked', dataIndex: 'isLocked', width: 70, render: v => v ? <Tag color="green">Yes</Tag> : <Tag>No</Tag> },
  ];

  const addEntry = async (values) => {
    try {
      await api.post('/attendance/entry', { empCode: values.empCode, date: values.date.toISOString(), status: values.status, inTime: values.inTime, outTime: values.outTime, remarks: values.remarks });
      message.success('Entry saved'); setEntryModal(false); entryForm.resetFields();
    } catch (err) { message.error(err.response?.data?.error || 'Failed'); }
  };

  return (
    <div>
      <div className="page-header">
        <Title level={3} style={{ margin: 0 }}><CalendarOutlined style={{ color: '#D97706' }} /> Attendance Management</Title>
        <Space wrap>
          <Select value={month} onChange={setMonth} style={{ width: 120 }} options={Array.from({ length: 12 }, (_, i) => ({ label: new Date(2026, i).toLocaleString('en', { month: 'long' }), value: i + 1 }))} />
          <Select value={year} onChange={setYear} style={{ width: 90 }} options={[2025, 2026, 2027].map(y => ({ label: y, value: y }))} />
          <Button icon={<PlusOutlined />} onClick={() => setEntryModal(true)}>Manual Entry</Button>
          <Upload accept=".csv" showUploadList={false} customRequest={async ({ file }) => {
            const fd = new FormData(); fd.append('file', file);
            try { const { data } = await api.post('/attendance/upload', fd); message.success(`Upload: ${data.success} success, ${data.failed} failed`); fetchSummaries(); }
            catch { message.error('Upload failed'); }
          }}><Button icon={<UploadOutlined />}>Upload CSV</Button></Upload>
          <Button icon={<PlayCircleOutlined />} onClick={async () => {
            try { const { data } = await api.post(`/attendance/process/${year}/${month}`); message.success(`Processed ${data.processed} employees`); fetchSummaries(); }
            catch { message.error('Failed'); }
          }}>Process Monthly</Button>
          <Button type="primary" danger icon={<LockOutlined />} onClick={async () => {
            try { await api.post(`/attendance/lock/${year}/${month}`); message.success('Locked!'); fetchSummaries(); }
            catch { message.error('Failed'); }
          }}>Lock for Payroll</Button>
        </Space>
      </div>

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}><Card className="stat-card"><Statistic title="Records" value={summaries.length} /></Card></Col>
        <Col span={6}><Card className="stat-card"><Statistic title="Locked" value={summaries.filter(s => s.isLocked).length} valueStyle={{ color: '#27ae60' }} /></Card></Col>
        <Col span={6}><Card className="stat-card"><Statistic title="Avg Paid Days" value={summaries.length ? (summaries.reduce((s, r) => s + r.paidDays, 0) / summaries.length).toFixed(1) : 0} /></Card></Col>
        <Col span={6}><Card className="stat-card"><Statistic title="Total OT Hours" value={summaries.reduce((s, r) => s + (r.overtimeHours || 0), 0).toFixed(1)} /></Card></Col>
      </Row>

      <Card bordered={false}>
        <Table dataSource={summaries} columns={columns} loading={loading} rowKey={r => r.empCode + r.month + r.year} size="small" pagination={{ pageSize: 100 }} />
      </Card>

      <Modal title="Manual Attendance Entry" open={entryModal} onCancel={() => setEntryModal(false)} onOk={() => entryForm.submit()}>
        <Form form={entryForm} layout="vertical" onFinish={addEntry}>
          <Form.Item name="empCode" label="Employee" rules={[{ required: true }]}><EmployeeSelect /></Form.Item>
          <Form.Item name="date" label="Date" rules={[{ required: true }]}><DatePicker style={{ width: '100%' }} /></Form.Item>
          <Form.Item name="status" label="Status" rules={[{ required: true }]}><Select options={[{ label: 'Present', value: 'P' }, { label: 'Absent', value: 'A' }, { label: 'Half Day', value: 'HD' }, { label: 'Week Off', value: 'WO' }, { label: 'Holiday', value: 'HO' }, { label: 'Leave', value: 'L' }, { label: 'WFH', value: 'WFH' }, { label: 'LWP', value: 'LWP' }]} /></Form.Item>
          <Form.Item name="inTime" label="In Time"><Input placeholder="09:30" /></Form.Item>
          <Form.Item name="outTime" label="Out Time"><Input placeholder="18:30" /></Form.Item>
          <Form.Item name="remarks" label="Remarks"><Input.TextArea /></Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
