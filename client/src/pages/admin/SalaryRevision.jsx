import React, { useState } from 'react';
import { Card, Typography, Form, Input, InputNumber, DatePicker, Button, Row, Col, message, Table, Tag, Statistic, Space, Divider } from 'antd';
import { SaveOutlined, CalculatorOutlined, SearchOutlined, FundOutlined} from '@ant-design/icons';
import EmployeeSelect from '../../components/common/EmployeeSelect';
import api from '../../utils/api';
const { Title, Text } = Typography;

export default function SalaryRevision() {
  const [form] = Form.useForm();
  const [empCode, setEmpCode] = useState('');
  const [currentEmp, setCurrentEmp] = useState(null);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const loadEmployee = async () => {
    if (!empCode) return;
    try {
      const { data } = await api.get(`/employees`, { params: { search: empCode } });
      const emp = data.data?.find(e => e.empCode === empCode);
      if (emp) { setCurrentEmp(emp); form.setFieldsValue({ newBasic: emp.basicSalary, newHra: emp.hra, newCov: emp.conveyanceAndOthers }); }
      else message.error('Employee not found');
    } catch { message.error('Failed to load'); }
  };

  const newBasic = Form.useWatch('newBasic', form) || 0;
  const newHra = Form.useWatch('newHra', form) || 0;
  const newCov = Form.useWatch('newCov', form) || 0;
  const newTotal = newBasic + newHra + newCov;
  const diff = currentEmp ? newTotal - currentEmp.totalMonthlySalary : 0;

  const onSubmit = async (values) => {
    setLoading(true);
    try {
      const { data } = await api.post('/reports/salary-revision', {
        empCode, newBasic: values.newBasic, newHra: values.newHra, newCov: values.newCov,
        effectiveFrom: values.effectiveFrom.toISOString(),
      });
      setResult(data);
      message.success(`Salary revised! Arrear: ₹${data.arrears.totalArrear.toLocaleString('en-IN')} for ${data.arrears.monthsCount} months`);
    } catch (err) { message.error(err.response?.data?.error || 'Failed'); }
    finally { setLoading(false); }
  };

  return (
    <div>
      <div className="page-header"><Title level={3} style={{ margin: 0, fontFamily: 'DM Sans' }}><FundOutlined style={{ color: '#059669' }} /> Salary Revision</Title></div>

      <Card bordered={false} style={{ marginBottom: 16 }}>
        <Space size="middle" style={{ width: 400 }}>
          <EmployeeSelect value={empCode} onChange={(val) => { setEmpCode(val); }} style={{ width: 350 }} />
          <Button type="primary" icon={<SearchOutlined />} onClick={loadEmployee}>Load</Button>
        </Space>
      </Card>

      {currentEmp && (
        <Row gutter={16}>
          <Col xs={24} lg={14}>
            <Card title={`Revise: ${currentEmp.firstName} ${currentEmp.lastName || ''} (${currentEmp.empCode})`} bordered={false}>
              <div style={{ background: '#F8FAFC', padding: 12, borderRadius: 6, marginBottom: 16 }}>
                <Text type="secondary">Current Salary: </Text>
                <Text strong>Basic ₹{currentEmp.basicSalary.toLocaleString('en-IN')} + HRA ₹{currentEmp.hra.toLocaleString('en-IN')} + Conv ₹{currentEmp.conveyanceAndOthers.toLocaleString('en-IN')} = <Tag color="blue">₹{currentEmp.totalMonthlySalary.toLocaleString('en-IN')}</Tag></Text>
              </div>

              <Form form={form} layout="vertical" onFinish={onSubmit}>
                <Row gutter={16}>
                  <Col span={6}><Form.Item name="newBasic" label="New Basic" rules={[{ required: true }]}><InputNumber style={{ width: '100%' }} min={0} /></Form.Item></Col>
                  <Col span={6}><Form.Item name="newHra" label="New HRA" rules={[{ required: true }]}><InputNumber style={{ width: '100%' }} min={0} /></Form.Item></Col>
                  <Col span={6}><Form.Item name="newCov" label="New Conv & Others" rules={[{ required: true }]}><InputNumber style={{ width: '100%' }} min={0} /></Form.Item></Col>
                  <Col span={6}><Form.Item label="New Total"><InputNumber value={newTotal} disabled style={{ width: '100%', fontWeight: 'bold' }} /></Form.Item></Col>
                </Row>
                <Form.Item name="effectiveFrom" label="Effective From" rules={[{ required: true }]}><DatePicker style={{ width: '100%' }} picker="month" /></Form.Item>

                {diff !== 0 && (
                  <div style={{ background: diff > 0 ? '#F0FFF4' : '#FFF5F5', padding: 12, borderRadius: 6, marginBottom: 16 }}>
                    <Text strong style={{ color: diff > 0 ? '#059669' : '#DC2626' }}>
                      {diff > 0 ? '↑' : '↓'} Monthly change: ₹{Math.abs(diff).toLocaleString('en-IN')} ({diff > 0 ? 'increment' : 'reduction'})
                    </Text>
                  </div>
                )}

                <Button type="primary" htmlType="submit" icon={<SaveOutlined />} loading={loading} size="large">Apply Revision & Calculate Arrears</Button>
              </Form>
            </Card>
          </Col>
          <Col xs={24} lg={10}>
            {result?.arrears && (
              <Card title="Arrear Calculation" bordered={false} style={{ borderTop: '3px solid #059669' }}>
                <Statistic title="Total Arrear" value={result.arrears.totalArrear} prefix="₹" formatter={v => v.toLocaleString('en-IN')} valueStyle={{ color: '#059669', fontSize: 24 }} />
                <Text type="secondary">{result.arrears.monthsCount} month(s) of arrears</Text>
                <Divider />
                <Table dataSource={result.arrears.arrearMonths} rowKey={r => `${r.month}-${r.year}`} size="small" pagination={false} columns={[
                  { title: 'Month', render: (_, r) => `${new Date(0, r.month - 1).toLocaleString('en', { month: 'short' })} ${r.year}` },
                  { title: 'Old', dataIndex: 'oldSalary', render: v => `₹${v.toLocaleString('en-IN')}` },
                  { title: 'New', dataIndex: 'newSalary', render: v => `₹${v.toLocaleString('en-IN')}` },
                  { title: 'Arrear', dataIndex: 'arrear', render: v => <Tag color="green">₹{v.toLocaleString('en-IN')}</Tag> },
                ]} />
              </Card>
            )}
          </Col>
        </Row>
      )}
    </div>
  );
}
