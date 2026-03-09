import React, { useState, useEffect } from 'react';
import { Card, Typography, Form, Input, InputNumber, Select, Button, message, Row, Col, Statistic, Table, Tag, Space, Divider } from 'antd';
import { MoneyCollectOutlined, CalculatorOutlined, SendOutlined } from '@ant-design/icons';
import { useAuth } from '../../main';
import api from '../../utils/api';
const { Title, Text } = Typography;

export default function LoanApply() {
  const { user } = useAuth();
  const [form] = Form.useForm();
  const [loans, setLoans] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [emiPreview, setEmiPreview] = useState(null);

  useEffect(() => { api.get('/loans').then(({ data }) => setLoans(data)); }, []);

  const amount = Form.useWatch('amount', form);
  const tenure = Form.useWatch('tenure', form);

  useEffect(() => {
    if (amount > 0 && tenure > 0) {
      const emi = Math.ceil(amount / tenure);
      setEmiPreview({ emi, total: emi * tenure, months: tenure });
    } else { setEmiPreview(null); }
  }, [amount, tenure]);

  const onSubmit = async (values) => {
    setSubmitting(true);
    try {
      await api.post('/loans', { loanType: values.loanType, amount: values.amount, tenure: values.tenure, remarks: values.remarks });
      message.success('Loan application submitted! It will be reviewed by your manager and finance team.');
      form.resetFields(); setEmiPreview(null);
      const { data } = await api.get('/loans'); setLoans(data);
    } catch (err) { message.error(err.response?.data?.error || 'Failed to submit'); }
    finally { setSubmitting(false); }
  };

  return (
    <div>
      <div className="page-header"><Title level={3} style={{ margin: 0, fontFamily: 'DM Sans' }}><MoneyCollectOutlined style={{ color: '#EA580C' }} /> Apply for Loan</Title></div>

      <Row gutter={16}>
        <Col xs={24} lg={14}>
          <Card title="Loan Application" bordered={false}>
            <Form form={form} layout="vertical" onFinish={onSubmit}>
              <Form.Item name="loanType" label="Loan Type" rules={[{ required: true, message: 'Select type' }]}>
                <Select placeholder="Select loan type" options={[
                  { label: 'Salary Advance', value: 'SALARY_ADVANCE' },
                  { label: 'Personal Loan', value: 'PERSONAL_LOAN' },
                  { label: 'Emergency Loan', value: 'EMERGENCY_LOAN' },
                  { label: 'Festival Advance', value: 'FESTIVAL_ADVANCE' },
                ]} />
              </Form.Item>
              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item name="amount" label="Loan Amount (₹)" rules={[{ required: true, message: 'Enter amount' }]}>
                    <InputNumber style={{ width: '100%' }} min={1000} max={1000000} step={1000} formatter={v => `₹ ${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')} parser={v => v.replace(/₹\s?|(,*)/g, '')} />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name="tenure" label="Tenure (Months)" rules={[{ required: true, message: 'Enter tenure' }]}>
                    <InputNumber style={{ width: '100%' }} min={1} max={36} />
                  </Form.Item>
                </Col>
              </Row>
              <Form.Item name="remarks" label="Reason / Remarks"><Input.TextArea rows={3} placeholder="Why do you need this loan?" /></Form.Item>

              {emiPreview && (
                <Card size="small" style={{ marginBottom: 16, background: '#F0FFF4', border: '1px solid #BBF7D0' }}>
                  <Row gutter={16}>
                    <Col span={8}><Statistic title="Monthly EMI" value={emiPreview.emi} prefix="₹" valueStyle={{ color: '#059669', fontSize: 20 }} /></Col>
                    <Col span={8}><Statistic title="Total Repayable" value={emiPreview.total} prefix="₹" valueStyle={{ fontSize: 16 }} /></Col>
                    <Col span={8}><Statistic title="Duration" value={emiPreview.months} suffix="months" valueStyle={{ fontSize: 16 }} /></Col>
                  </Row>
                </Card>
              )}

              <Button type="primary" htmlType="submit" loading={submitting} icon={<SendOutlined />} size="large" block>Submit Application</Button>
            </Form>

            <Divider />
            <Text type="secondary" style={{ fontSize: 12 }}>
              <strong>Approval Process:</strong> Your application → Manager recommends → Finance approves → EMI starts from next month salary.
              You will receive an email notification at each stage.
            </Text>
          </Card>
        </Col>
        <Col xs={24} lg={10}>
          <Card title="My Loan History" bordered={false}>
            <Table dataSource={loans} rowKey="_id" size="small" pagination={false} columns={[
              { title: 'ID', dataIndex: 'loanId', width: 100, ellipsis: true },
              { title: 'Amount', dataIndex: 'amount', render: v => `₹${v?.toLocaleString('en-IN')}` },
              { title: 'EMI', dataIndex: 'emiAmount', render: v => `₹${v?.toLocaleString('en-IN')}` },
              { title: 'Status', dataIndex: 'status', render: v => {
                const c = { APPLIED: 'blue', MANAGER_RECOMMENDED: 'orange', ACTIVE: 'green', CLOSED: 'default', REJECTED: 'red' };
                return <Tag color={c[v] || 'default'}>{v}</Tag>;
              }},
            ]} />
          </Card>
        </Col>
      </Row>
    </div>
  );
}
