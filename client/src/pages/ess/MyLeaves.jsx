import React, { useState, useEffect } from 'react';
import { Card, Typography, Table, Tag, Button, Modal, Form, Select, DatePicker, Input, message, Row, Col, Statistic, Space } from 'antd';
import { PlusOutlined, CalendarOutlined , ScheduleOutlined} from '@ant-design/icons';
import { useAuth } from '../../main';
import api from '../../utils/api';
const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

export default function MyLeaves() {
  const { user } = useAuth();
  const [leaves, setLeaves] = useState([]);
  const [balances, setBalances] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [form] = Form.useForm();

  const fetch = () => {
    Promise.all([
      api.get('/leaves'),
      api.get('/config/leave-balance'),
    ]).then(([lv, bal]) => { setLeaves(lv.data); setBalances(bal.data); }).catch(console.error).finally(() => setLoading(false));
  };
  useEffect(fetch, []);

  const apply = async (values) => {
    try {
      const [from, to] = values.dateRange;
      const days = Math.ceil((to.toDate() - from.toDate()) / (1000 * 60 * 60 * 24)) + 1;
      await api.post('/leaves', { leaveType: values.leaveType, fromDate: from.toISOString(), toDate: to.toISOString(), days, reason: values.reason });
      message.success('Leave applied successfully!');
      setModal(false); form.resetFields(); fetch();
    } catch (err) { message.error(err.response?.data?.error || 'Failed'); }
  };

  const getBalance = (type) => balances.find(b => b.leaveType === type)?.closing || 0;

  return (
    <div>
      <div className="page-header">
        <Title level={3} style={{ margin: 0, fontFamily: 'DM Sans' }}><ScheduleOutlined style={{ color: '#16A34A' }} /> My Leaves</Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setModal(true)}>Apply Leave</Button>
      </div>

      <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
        {[{ type: 'CL', label: 'Casual Leave', color: '#1A6FB5' }, { type: 'SL', label: 'Sick Leave', color: '#D97706' }, { type: 'EL', label: 'Earned Leave', color: '#059669' }].map(lt => (
          <Col xs={24} sm={8} key={lt.type}>
            <Card className="stat-card">
              <Statistic title={lt.label} value={getBalance(lt.type)} suffix="days" valueStyle={{ color: lt.color }} prefix={<CalendarOutlined />} />
            </Card>
          </Col>
        ))}
      </Row>

      <Card title="Leave Applications" bordered={false}>
        <Table dataSource={leaves} rowKey="_id" size="small" loading={loading} columns={[
          { title: 'Type', dataIndex: 'leaveType', width: 60, render: v => <Tag color="blue">{v}</Tag> },
          { title: 'From', dataIndex: 'fromDate', width: 100, render: d => new Date(d).toLocaleDateString('en-IN') },
          { title: 'To', dataIndex: 'toDate', width: 100, render: d => new Date(d).toLocaleDateString('en-IN') },
          { title: 'Days', dataIndex: 'days', width: 50 },
          { title: 'Reason', dataIndex: 'reason', ellipsis: true },
          { title: 'Status', dataIndex: 'status', width: 100, render: v => <Tag color={v === 'APPROVED' ? 'green' : v === 'REJECTED' ? 'red' : 'orange'}>{v}</Tag> },
          { title: 'Applied', dataIndex: 'createdAt', width: 100, render: d => new Date(d).toLocaleDateString('en-IN') },
        ]} />
      </Card>

      <Modal title="Apply for Leave" open={modal} onCancel={() => setModal(false)} onOk={() => form.submit()} okText="Submit">
        <Form form={form} layout="vertical" onFinish={apply}>
          <Form.Item name="leaveType" label="Leave Type" rules={[{ required: true }]}>
            <Select options={[
              { label: `Casual Leave (Balance: ${getBalance('CL')})`, value: 'CL' },
              { label: `Sick Leave (Balance: ${getBalance('SL')})`, value: 'SL' },
              { label: `Earned Leave (Balance: ${getBalance('EL')})`, value: 'EL' },
              { label: 'Comp Off', value: 'CO' },
              { label: 'Leave Without Pay', value: 'LWP' },
            ]} />
          </Form.Item>
          <Form.Item name="dateRange" label="Date Range" rules={[{ required: true }]}><RangePicker style={{ width: '100%' }} /></Form.Item>
          <Form.Item name="reason" label="Reason" rules={[{ required: true }]}><Input.TextArea rows={3} placeholder="Reason for leave" /></Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
