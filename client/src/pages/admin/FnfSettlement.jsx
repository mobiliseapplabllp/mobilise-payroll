import React, { useState } from 'react';
import { Card, Typography, Input, Button, Row, Col, Statistic, Descriptions, Tag, Space, message, Divider, Spin } from 'antd';
import { SearchOutlined, DollarOutlined, UserOutlined, AuditOutlined} from '@ant-design/icons';
import EmployeeSelect from '../../components/common/EmployeeSelect';
import api from '../../utils/api';
const { Title, Text } = Typography;

export default function FnFSettlement() {
  const [empCode, setEmpCode] = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const calculate = async () => {
    if (!empCode) return message.warning('Enter employee code');
    setLoading(true);
    try {
      const { data } = await api.post(`/reports/fnf/${empCode}`);
      setResult(data);
    } catch (err) { message.error(err.response?.data?.error || 'Failed to calculate'); }
    finally { setLoading(false); }
  };

  const fmt = v => `₹${(v || 0).toLocaleString('en-IN')}`;

  return (
    <div>
      <div className="page-header">
        <Title level={3} style={{ margin: 0, fontFamily: 'DM Sans' }}><AuditOutlined style={{ color: '#B45309' }} /> Full & Final Settlement</Title>
      </div>

      <Card bordered={false} style={{ marginBottom: 16 }}>
        <Space size="middle" style={{ width: 450 }}>
          <EmployeeSelect value={empCode} onChange={setEmpCode} style={{ width: 350 }} status="all" />
          <Button type="primary" icon={<SearchOutlined />} loading={loading} onClick={calculate}>Calculate F&F</Button>
        </Space>
      </Card>

      {result && (
        <>
          <Card title={<Space><UserOutlined /> Employee Details</Space>} bordered={false} style={{ marginBottom: 16 }}>
            <Descriptions column={4} size="small">
              <Descriptions.Item label="Code"><Text strong>{result.employee.empCode}</Text></Descriptions.Item>
              <Descriptions.Item label="Name"><Text strong>{result.employee.name}</Text></Descriptions.Item>
              <Descriptions.Item label="DOJ">{result.employee.doj ? new Date(result.employee.doj).toLocaleDateString('en-IN') : '-'}</Descriptions.Item>
              <Descriptions.Item label="Last Working Day">{result.employee.lastDay ? new Date(result.employee.lastDay).toLocaleDateString('en-IN') : <Tag color="orange">Not set</Tag>}</Descriptions.Item>
              <Descriptions.Item label="Years of Service"><Text strong>{result.employee.yearsOfService} years</Text></Descriptions.Item>
              <Descriptions.Item label="Gratuity Eligible">{result.earnings.gratuityEligible ? <Tag color="green">Yes (≥5 years)</Tag> : <Tag color="red">No (&lt;5 years)</Tag>}</Descriptions.Item>
            </Descriptions>
          </Card>

          <Row gutter={16} style={{ marginBottom: 16 }}>
            <Col span={8}>
              <Card title="Earnings" bordered={false} style={{ borderTop: '3px solid #059669' }}>
                <Space direction="vertical" style={{ width: '100%' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}><Text>Pro-rata Salary ({result.earnings.daysWorked}/{result.earnings.totalDaysInMonth} days)</Text><Text strong>{fmt(result.earnings.proRataSalary)}</Text></div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}><Text>Leave Encashment ({result.earnings.elBalance} EL days)</Text><Text strong>{fmt(result.earnings.leaveEncashment)}</Text></div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}><Text>Comp-Off Encashment ({result.earnings.compOffDays} days)</Text><Text strong>{fmt(result.earnings.compOffEncashment)}</Text></div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}><Text>Gratuity</Text><Text strong style={{ color: '#059669' }}>{fmt(result.earnings.gratuity)}</Text></div>
                  <Divider style={{ margin: '8px 0' }} />
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}><Text strong>Total Earnings</Text><Text strong style={{ fontSize: 16, color: '#059669' }}>{fmt(result.earnings.totalEarnings)}</Text></div>
                </Space>
              </Card>
            </Col>
            <Col span={8}>
              <Card title="Deductions" bordered={false} style={{ borderTop: '3px solid #DC2626' }}>
                <Space direction="vertical" style={{ width: '100%' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}><Text>PF Deduction</Text><Text strong>{fmt(result.deductions.pfDeduction)}</Text></div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}><Text>TDS</Text><Text strong>{fmt(result.deductions.tds)}</Text></div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}><Text>Notice Period Recovery</Text><Text strong>{fmt(result.deductions.noticeRecovery)}</Text></div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}><Text>Loan Recovery</Text><Text strong style={{ color: '#DC2626' }}>{fmt(result.deductions.loanRecovery)}</Text></div>
                  <Divider style={{ margin: '8px 0' }} />
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}><Text strong>Total Deductions</Text><Text strong style={{ fontSize: 16, color: '#DC2626' }}>{fmt(result.deductions.totalDeductions)}</Text></div>
                </Space>
              </Card>
            </Col>
            <Col span={8}>
              <Card bordered={false} style={{ borderTop: '3px solid #1A6FB5', background: '#F0F9FF' }}>
                <Statistic title="NET F&F PAYABLE" value={result.netPayable} prefix="₹" formatter={v => v.toLocaleString('en-IN')} valueStyle={{ fontSize: 28, color: result.netPayable >= 0 ? '#1A6FB5' : '#DC2626', fontWeight: 700 }} />
                <Text type="secondary" style={{ fontSize: 11 }}>This is the final amount payable to the employee after all adjustments.</Text>
              </Card>
            </Col>
          </Row>
        </>
      )}
    </div>
  );
}
