import React, { useState, useEffect } from 'react';
import { Card, Typography, Select, Space, Row, Col, Statistic, Tag, Table, Spin, Button, Modal, Form, Input, DatePicker, Tabs, Empty, Badge, message } from 'antd';
import { CalendarOutlined, PlusOutlined, CheckCircleOutlined, ClockCircleOutlined, CloseCircleOutlined } from '@ant-design/icons';
import { useAuth } from '../../main';
import api from '../../utils/api';
import dayjs from 'dayjs';
const { Title, Text } = Typography;

const REG_STATUS_COLOR = { PENDING: 'orange', APPROVED: 'green', REJECTED: 'red' };

export default function MyAttendance() {
  const { user } = useAuth();
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [regModal, setRegModal] = useState(false);
  const [regLoading, setRegLoading] = useState(false);
  const [regs, setRegs] = useState([]);
  const [regsLoading, setRegsLoading] = useState(true);
  const [form] = Form.useForm();

  useEffect(() => {
    setLoading(true);
    api.get(`/attendance/summary/${year}/${month}`).then(({ data }) => {
      setSummary(data.find(s => s.empCode === user?.empCode) || null);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [month, year, user]);

  const fetchRegs = () => {
    setRegsLoading(true);
    api.get('/manager/attendance-reg').then(({ data }) => setRegs(data)).catch(() => setRegs([])).finally(() => setRegsLoading(false));
  };
  useEffect(fetchRegs, []);

  const applyReg = async (values) => {
    setRegLoading(true);
    try {
      await api.post('/manager/attendance-reg', {
        date: values.date.format('YYYY-MM-DD'),
        requestedStatus: values.requestedStatus,
        reason: values.reason,
        punchIn: values.punchIn || '',
        punchOut: values.punchOut || '',
      });
      message.success('Regularization request submitted');
      setRegModal(false); form.resetFields(); fetchRegs();
    } catch (err) { message.error(err.response?.data?.error || 'Failed to submit'); }
    finally { setRegLoading(false); }
  };

  const pendingCount = regs.filter(r => r.status === 'PENDING').length;

  return (
    <div>
      <div className="page-header">
        <Title level={3} style={{ margin: 0, fontFamily: 'DM Sans' }}><CalendarOutlined style={{ color: '#D97706' }} /> My Attendance</Title>
        <Space>
          <Select value={month} onChange={setMonth} style={{ width: 130 }} options={Array.from({ length: 12 }, (_, i) => ({ label: new Date(2026, i).toLocaleString('en', { month: 'long' }), value: i + 1 }))} />
          <Select value={year} onChange={setYear} style={{ width: 90 }} options={[2025, 2026, 2027].map(y => ({ label: y, value: y }))} />
        </Space>
      </div>

      <Tabs items={[
        { key: 'summary', label: <Space><CalendarOutlined />Attendance Summary</Space>, children: (
          loading ? <Spin size="large" style={{ display: 'block', margin: '80px auto' }} /> : summary ? (
            <>
              <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
                <Col xs={12} sm={6}><Card className="stat-card"><Statistic title="Total Days" value={summary.totalDays} prefix={<CalendarOutlined />} /></Card></Col>
                <Col xs={12} sm={6}><Card className="stat-card"><Statistic title="Present" value={summary.presentDays} valueStyle={{ color: '#059669' }} /></Card></Col>
                <Col xs={12} sm={6}><Card className="stat-card"><Statistic title="Paid Days" value={summary.paidDays} valueStyle={{ color: '#1A6FB5', fontWeight: 700 }} /></Card></Col>
                <Col xs={12} sm={6}><Card className="stat-card"><Statistic title="LWP" value={summary.lwpDays} valueStyle={{ color: summary.lwpDays > 0 ? '#DC2626' : '#059669' }} /></Card></Col>
              </Row>
              <Card title="Attendance Breakup" bordered={false}>
                <Table pagination={false} size="small" dataSource={[
                  { key: 'present', label: 'Present Days', value: summary.presentDays, tag: 'green' },
                  { key: 'wfh', label: 'Work From Home', value: summary.wfhDays, tag: 'cyan' },
                  { key: 'weekoff', label: 'Week Offs', value: summary.weekOffs, tag: 'default' },
                  { key: 'holiday', label: 'Holidays', value: summary.holidays, tag: 'blue' },
                  { key: 'paidleave', label: 'Paid Leaves', value: summary.paidLeaves, tag: 'green' },
                  { key: 'halfday', label: 'Half Days', value: summary.halfDays, tag: 'orange' },
                  { key: 'absent', label: 'Absent', value: summary.absentDays, tag: 'red' },
                  { key: 'lwp', label: 'Leave Without Pay', value: summary.unpaidLeaves || 0, tag: 'red' },
                  { key: 'ot', label: 'Overtime Hours', value: summary.overtimeHours, tag: 'purple' },
                  { key: 'late', label: 'Late Count', value: summary.lateCount, tag: 'orange' },
                ]} columns={[
                  { title: 'Category', dataIndex: 'label' },
                  { title: 'Days/Hours', dataIndex: 'value', render: (v, r) => <Tag color={r.tag}>{v}</Tag> },
                ]} />
              </Card>
            </>
          ) : (
            <Card bordered={false} style={{ textAlign: 'center', padding: 60 }}>
              <Text type="secondary">No attendance data for this month.</Text>
            </Card>
          )
        )},
        { key: 'regularize', label: <Badge count={pendingCount} size="small" offset={[8, 0]}><Space><ClockCircleOutlined />Regularization</Space></Badge>, children: (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <Text type="secondary">Apply for attendance regularization if you missed a punch or were on duty.</Text>
              <Button type="primary" icon={<PlusOutlined />} onClick={() => setRegModal(true)}>Apply Regularization</Button>
            </div>
            <Table dataSource={regs} loading={regsLoading} rowKey="_id" size="small" pagination={{ pageSize: 10 }} columns={[
              { title: 'Date', dataIndex: 'date', width: 100, render: v => new Date(v).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' }) },
              { title: 'Requested', dataIndex: 'requestedStatus', width: 90, render: v => <Tag color="blue">{v}</Tag> },
              { title: 'Punch In', dataIndex: 'punchIn', width: 80 },
              { title: 'Punch Out', dataIndex: 'punchOut', width: 80 },
              { title: 'Reason', dataIndex: 'reason', ellipsis: true },
              { title: 'Status', dataIndex: 'status', width: 90, render: v => (
                <Tag color={REG_STATUS_COLOR[v]} icon={v === 'APPROVED' ? <CheckCircleOutlined /> : v === 'REJECTED' ? <CloseCircleOutlined /> : <ClockCircleOutlined />}>{v}</Tag>
              )},
              { title: 'Approved By', dataIndex: 'approverName', width: 120 },
              { title: 'Applied', dataIndex: 'createdAt', width: 100, render: v => new Date(v).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) },
            ]} locale={{ emptyText: <Empty description="No regularization requests yet" /> }} />
          </div>
        )},
      ]} />

      <Modal title="Apply Attendance Regularization" open={regModal} onCancel={() => setRegModal(false)} onOk={() => form.submit()} confirmLoading={regLoading} okText="Submit Request" width={480}>
        <Form form={form} layout="vertical" onFinish={applyReg}>
          <Form.Item name="date" label="Date" rules={[{ required: true, message: 'Select date' }]}>
            <DatePicker style={{ width: '100%' }} disabledDate={d => d && d > dayjs()} format="DD/MM/YYYY" />
          </Form.Item>
          <Form.Item name="requestedStatus" label="Requested Status" rules={[{ required: true, message: 'Select status' }]}>
            <Select options={[
              { label: 'Present (Full Day)', value: 'PRESENT' },
              { label: 'Half Day', value: 'HALF_DAY' },
              { label: 'Work From Home', value: 'WFH' },
              { label: 'On Duty / Client Visit', value: 'ON_DUTY' },
            ]} />
          </Form.Item>
          <Row gutter={16}>
            <Col span={12}><Form.Item name="punchIn" label="Punch In Time"><Input placeholder="09:30 AM" /></Form.Item></Col>
            <Col span={12}><Form.Item name="punchOut" label="Punch Out Time"><Input placeholder="06:30 PM" /></Form.Item></Col>
          </Row>
          <Form.Item name="reason" label="Reason" rules={[{ required: true, message: 'Provide reason' }]}>
            <Input.TextArea rows={3} placeholder="e.g., Forgot to punch in, was present in office from 9:30 AM to 6:30 PM" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
