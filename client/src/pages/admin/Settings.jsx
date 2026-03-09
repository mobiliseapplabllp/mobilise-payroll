import React, { useState, useEffect } from 'react';
import { Card, Typography, Form, Input, InputNumber, Button, Row, Col, message, Tabs, Table, Space, Modal, DatePicker, Select, Descriptions, Tag, Divider } from 'antd';
import { SaveOutlined, PlusOutlined, DeleteOutlined, SettingOutlined} from '@ant-design/icons';
import api from '../../utils/api';
const { Title, Text } = Typography;

export default function Settings() {
  const [companyForm] = Form.useForm();
  const [config, setConfig] = useState(null);
  const [holidays, setHolidays] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [holidayModal, setHolidayModal] = useState(false);
  const [holidayForm] = Form.useForm();
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get('/config/company').then(({ data }) => { setConfig(data); companyForm.setFieldsValue({ companyName: data.companyName, legalName: data.legalName, phone: data.phone, email: data.email, cin: data.cin, pan: data.pan, tan: data.tan, gst: data.gst, pfRegistration: data.pfRegistration, esiRegistration: data.esiRegistration, 'address.line1': data.address?.line1, 'address.city': data.address?.city, 'address.state': data.address?.state, 'address.pincode': data.address?.pincode, 'bankDetails.bankName': data.bankDetails?.bankName, 'bankDetails.accountName': data.bankDetails?.accountName, 'bankDetails.accountNumber': data.bankDetails?.accountNumber, 'bankDetails.ifscCode': data.bankDetails?.ifscCode, 'bankDetails.branchName': data.bankDetails?.branchName, payDay: data.payDay, workingDaysInMonth: data.workingDaysInMonth }); });
    api.get('/config/holidays', { params: { year: 2026 } }).then(({ data }) => setHolidays(data));
    api.get('/config/audit', { params: { limit: 50 } }).then(({ data }) => setAuditLogs(data));
  }, []);

  const saveCompany = async (values) => {
    setSaving(true);
    try {
      const data = { ...values, address: { line1: values['address.line1'], city: values['address.city'], state: values['address.state'], pincode: values['address.pincode'] }, bankDetails: { bankName: values['bankDetails.bankName'], accountName: values['bankDetails.accountName'], accountNumber: values['bankDetails.accountNumber'], ifscCode: values['bankDetails.ifscCode'], branchName: values['bankDetails.branchName'] } };
      await api.put('/config/company', data); message.success('Settings saved!');
    } catch { message.error('Failed to save'); }
    finally { setSaving(false); }
  };

  const addHoliday = async (values) => {
    try { await api.post('/config/holidays', { ...values, date: values.date.toISOString() }); message.success('Holiday added'); setHolidayModal(false); holidayForm.resetFields(); api.get('/config/holidays', { params: { year: 2026 } }).then(({ data }) => setHolidays(data)); }
    catch { message.error('Failed'); }
  };

  const deleteHoliday = async (id) => {
    try { await api.delete(`/config/holidays/${id}`); setHolidays(h => h.filter(x => x._id !== id)); message.success('Deleted'); }
    catch { message.error('Failed'); }
  };

  const tabs = [
    { key: 'company', label: 'Company', children: (
      <Form form={companyForm} layout="vertical" onFinish={saveCompany}>
        <Row gutter={16}>
          <Col span={8}><Form.Item name="companyName" label="Company Name"><Input /></Form.Item></Col>
          <Col span={8}><Form.Item name="legalName" label="Legal Name"><Input /></Form.Item></Col>
          <Col span={8}><Form.Item name="phone" label="Phone"><Input /></Form.Item></Col>
          <Col span={8}><Form.Item name="email" label="Email"><Input /></Form.Item></Col>
          <Col span={8}><Form.Item name="cin" label="CIN"><Input /></Form.Item></Col>
          <Col span={8}><Form.Item name="pan" label="PAN"><Input /></Form.Item></Col>
          <Col span={8}><Form.Item name="tan" label="TAN"><Input /></Form.Item></Col>
          <Col span={8}><Form.Item name="gst" label="GST"><Input /></Form.Item></Col>
          <Col span={8}><Form.Item name="pfRegistration" label="PF Registration"><Input /></Form.Item></Col>
          <Col span={8}><Form.Item name="esiRegistration" label="ESI Registration"><Input /></Form.Item></Col>
          <Col span={8}><Form.Item name="address.line1" label="Address"><Input /></Form.Item></Col>
          <Col span={4}><Form.Item name="address.city" label="City"><Input /></Form.Item></Col>
          <Col span={4}><Form.Item name="address.state" label="State"><Input /></Form.Item></Col>
          <Col span={4}><Form.Item name="address.pincode" label="Pincode"><Input /></Form.Item></Col>
        </Row>
        <Divider>Bank Details (for salary disbursement)</Divider>
        <Row gutter={16}>
          <Col span={6}><Form.Item name="bankDetails.bankName" label="Bank"><Input /></Form.Item></Col>
          <Col span={6}><Form.Item name="bankDetails.accountName" label="Account Name"><Input /></Form.Item></Col>
          <Col span={6}><Form.Item name="bankDetails.accountNumber" label="Account No"><Input /></Form.Item></Col>
          <Col span={6}><Form.Item name="bankDetails.ifscCode" label="IFSC"><Input /></Form.Item></Col>
          <Col span={6}><Form.Item name="bankDetails.branchName" label="Branch"><Input /></Form.Item></Col>
          <Col span={6}><Form.Item name="payDay" label="Pay Day"><InputNumber style={{ width: '100%' }} min={1} max={28} /></Form.Item></Col>
          <Col span={6}><Form.Item name="workingDaysInMonth" label="Working Days/Month"><InputNumber style={{ width: '100%' }} min={20} max={31} /></Form.Item></Col>
        </Row>
        <Button type="primary" htmlType="submit" icon={<SaveOutlined />} loading={saving}>Save Settings</Button>
      </Form>
    )},
    { key: 'holidays', label: 'Holidays', children: (
      <div>
        <Space style={{ marginBottom: 16 }}><Button type="primary" icon={<PlusOutlined />} onClick={() => setHolidayModal(true)}>Add Holiday</Button></Space>
        <Table dataSource={holidays} rowKey="_id" size="small" columns={[
          { title: 'Date', dataIndex: 'date', render: d => new Date(d).toLocaleDateString('en-IN') },
          { title: 'Name', dataIndex: 'name' },
          { title: 'Type', dataIndex: 'type', render: v => <Tag color={v === 'NATIONAL' ? 'red' : 'blue'}>{v}</Tag> },
          { title: '', render: (_, r) => <Button size="small" danger icon={<DeleteOutlined />} onClick={() => deleteHoliday(r._id)} /> },
        ]} />
        <Modal title="Add Holiday" open={holidayModal} onCancel={() => setHolidayModal(false)} onOk={() => holidayForm.submit()}>
          <Form form={holidayForm} layout="vertical" onFinish={addHoliday}>
            <Form.Item name="name" label="Holiday Name" rules={[{ required: true }]}><Input /></Form.Item>
            <Form.Item name="date" label="Date" rules={[{ required: true }]}><DatePicker style={{ width: '100%' }} /></Form.Item>
            <Form.Item name="type" label="Type" initialValue="COMPANY"><Select options={['NATIONAL', 'STATE', 'COMPANY', 'RESTRICTED'].map(t => ({ label: t, value: t }))} /></Form.Item>
          </Form>
        </Modal>
      </div>
    )},
    { key: 'audit', label: 'Audit Log', children: (
      <Table dataSource={auditLogs} rowKey="_id" size="small" columns={[
        { title: 'Time', dataIndex: 'createdAt', render: d => new Date(d).toLocaleString('en-IN'), width: 160 },
        { title: 'Module', dataIndex: 'module', render: v => <Tag>{v}</Tag> },
        { title: 'Action', dataIndex: 'action', render: v => <Tag color={v === 'CREATE' ? 'green' : v === 'DELETE' ? 'red' : 'blue'}>{v}</Tag> },
        { title: 'Record', dataIndex: 'recordName' },
        { title: 'By', dataIndex: 'changedBy' },
      ]} />
    )},
  ];

  return (
    <div>
      <div className="page-header"><Title level={3} style={{ margin: 0 }}><SettingOutlined style={{ color: '#64748B' }} /> Settings</Title></div>
      <Card bordered={false}><Tabs items={tabs} /></Card>
    </div>
  );
}
