import React, { useState, useEffect } from 'react';
import { Card, Typography, Table, Tag, Space, Button, Tabs, Badge, message, Popconfirm, Input, Empty, Spin } from 'antd';
import { CheckCircleOutlined, CloseCircleOutlined, ClockCircleOutlined, CalendarOutlined, FileTextOutlined, MoneyCollectOutlined, SafetyCertificateOutlined } from '@ant-design/icons';
import api from '../../utils/api';
const { Title, Text } = Typography;

export default function Approvals() {
  const [data, setData] = useState({ leaves: [], compoffs: [], attRegs: [], loans: [], total: 0 });
  const [loading, setLoading] = useState(true);
  const [rejectReason, setRejectReason] = useState('');

  const fetch = () => {
    setLoading(true);
    api.get('/manager/pending').then(({ data }) => setData(data)).catch(() => {}).finally(() => setLoading(false));
  };
  useEffect(fetch, []);

  const approveLeave = async (id) => { try { await api.post(`/leaves/${id}/approve`); message.success('Leave approved'); fetch(); } catch (err) { message.error(err.response?.data?.error || 'Failed'); } };
  const rejectLeave = async (id) => { try { await api.post(`/leaves/${id}/reject`, { reason: rejectReason }); message.success('Rejected'); fetch(); setRejectReason(''); } catch (err) { message.error('Failed'); } };
  const approveCompOff = async (id) => { try { await api.post(`/compoff/${id}/approve`); message.success('Comp-Off approved'); fetch(); } catch (err) { message.error('Failed'); } };
  const rejectCompOff = async (id) => { try { await api.post(`/compoff/${id}/reject`); message.success('Rejected'); fetch(); } catch (err) { message.error('Failed'); } };
  const approveAttReg = async (id) => { try { await api.post(`/manager/attendance-reg/${id}/approve`); message.success('Approved'); fetch(); } catch (err) { message.error('Failed'); } };
  const rejectAttReg = async (id) => { try { await api.post(`/manager/attendance-reg/${id}/reject`, { reason: rejectReason }); message.success('Rejected'); fetch(); setRejectReason(''); } catch (err) { message.error('Failed'); } };
  const bulkApproveAttReg = async () => { try { await api.post('/manager/attendance-reg/bulk-approve', {}); message.success('All pending regularizations approved'); fetch(); } catch { message.error('Failed'); } };
  const recommendLoan = async (id) => { try { await api.post(`/loans/${id}/recommend`); message.success('Recommended'); fetch(); } catch (err) { message.error(err.response?.data?.error || 'Failed'); } };

  if (loading) return <div style={{ textAlign: 'center', padding: 80 }}><Spin size="large" /></div>;

  const tabs = [
    { key: 'leaves', label: <Badge count={data.leaves?.length || 0} size="small" offset={[8, 0]}><Space><CalendarOutlined />Leaves</Space></Badge>, children: (
      <Table dataSource={data.leaves || []} rowKey="_id" size="small" pagination={false}
        locale={{ emptyText: <Empty description="No pending leave requests" /> }}
        columns={[
          { title: 'Employee', render: (_, r) => <Text strong>{r.employeeName} ({r.empCode})</Text> },
          { title: 'Type', dataIndex: 'leaveType', width: 60, render: v => <Tag>{v}</Tag> },
          { title: 'From', dataIndex: 'fromDate', width: 90, render: v => new Date(v).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) },
          { title: 'To', dataIndex: 'toDate', width: 90, render: v => new Date(v).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) },
          { title: 'Days', dataIndex: 'days', width: 50 },
          { title: 'Reason', dataIndex: 'reason', ellipsis: true },
          { title: 'Actions', width: 160, render: (_, r) => (
            <Space size={4}>
              <Button size="small" type="primary" icon={<CheckCircleOutlined />} onClick={() => approveLeave(r._id)}>Approve</Button>
              <Popconfirm title={<><Text>Reason:</Text><Input.TextArea rows={2} value={rejectReason} onChange={e => setRejectReason(e.target.value)} /></>} onConfirm={() => rejectLeave(r._id)}>
                <Button size="small" danger icon={<CloseCircleOutlined />}>Reject</Button>
              </Popconfirm>
            </Space>
          )},
        ]} />
    )},
    { key: 'compoffs', label: <Badge count={data.compoffs?.length || 0} size="small" offset={[8, 0]}><Space><FileTextOutlined />Comp-Offs</Space></Badge>, children: (
      <Table dataSource={data.compoffs || []} rowKey="_id" size="small" pagination={false}
        locale={{ emptyText: <Empty description="No pending comp-off requests" /> }}
        columns={[
          { title: 'Employee', render: (_, r) => <Text strong>{r.employeeName} ({r.empCode})</Text> },
          { title: 'Date Earned', dataIndex: 'earnedDate', width: 100, render: v => new Date(v).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) },
          { title: 'Days', dataIndex: 'earnedDays', width: 50 },
          { title: 'Reason', dataIndex: 'earnedReason', ellipsis: true },
          { title: 'Actions', width: 160, render: (_, r) => (
            <Space size={4}>
              <Button size="small" type="primary" icon={<CheckCircleOutlined />} onClick={() => approveCompOff(r._id)}>Approve</Button>
              <Button size="small" danger icon={<CloseCircleOutlined />} onClick={() => rejectCompOff(r._id)}>Reject</Button>
            </Space>
          )},
        ]} />
    )},
    { key: 'attreg', label: <Badge count={data.attRegs?.length || 0} size="small" offset={[8, 0]}><Space><SafetyCertificateOutlined />Attendance Reg</Space></Badge>, children: (
      <div>
        {(data.attRegs?.length || 0) > 1 && <div style={{ marginBottom: 12, textAlign: 'right' }}><Button type="primary" style={{ background: '#059669' }} icon={<CheckCircleOutlined />} onClick={bulkApproveAttReg}>Approve All ({data.attRegs?.length})</Button></div>}
      <Table dataSource={data.attRegs || []} rowKey="_id" size="small" pagination={false}
        locale={{ emptyText: <Empty description="No pending regularizations" /> }}
        columns={[
          { title: 'Employee', render: (_, r) => <Text strong>{r.employeeName} ({r.empCode})</Text> },
          { title: 'Date', dataIndex: 'date', width: 100, render: v => new Date(v).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' }) },
          { title: 'Requested', dataIndex: 'requestedStatus', width: 90, render: v => <Tag color="blue">{v}</Tag> },
          { title: 'Time', render: (_, r) => <Text type="secondary" style={{ fontSize: 11 }}>{r.punchIn || '-'} – {r.punchOut || '-'}</Text>, width: 120 },
          { title: 'Reason', dataIndex: 'reason', ellipsis: true },
          { title: 'Actions', width: 160, render: (_, r) => (
            <Space size={4}>
              <Button size="small" type="primary" icon={<CheckCircleOutlined />} onClick={() => approveAttReg(r._id)}>Approve</Button>
              <Popconfirm title={<><Text>Reason:</Text><Input.TextArea rows={2} value={rejectReason} onChange={e => setRejectReason(e.target.value)} /></>} onConfirm={() => rejectAttReg(r._id)}>
                <Button size="small" danger icon={<CloseCircleOutlined />}>Reject</Button>
              </Popconfirm>
            </Space>
          )},
        ]} />
      </div>
    )},
    { key: 'loans', label: <Badge count={data.loans?.length || 0} size="small" offset={[8, 0]}><Space><MoneyCollectOutlined />Loan Requests</Space></Badge>, children: (
      <Table dataSource={data.loans || []} rowKey="_id" size="small" pagination={false}
        locale={{ emptyText: <Empty description="No pending loan requests" /> }}
        columns={[
          { title: 'Employee', render: (_, r) => <Text strong>{r.employeeName} ({r.empCode})</Text> },
          { title: 'Loan ID', dataIndex: 'loanId', width: 120 },
          { title: 'Type', dataIndex: 'loanType', width: 100, render: v => <Tag>{v?.replace(/_/g, ' ')}</Tag> },
          { title: 'Amount', dataIndex: 'amount', width: 100, render: v => `₹${(v || 0).toLocaleString('en-IN')}` },
          { title: 'EMI', dataIndex: 'emiAmount', width: 80, render: v => `₹${(v || 0).toLocaleString('en-IN')}` },
          { title: 'Tenure', dataIndex: 'tenure', width: 60, render: v => `${v}m` },
          { title: 'Actions', width: 120, render: (_, r) => (
            <Button size="small" type="primary" icon={<CheckCircleOutlined />} onClick={() => recommendLoan(r._id)}>Recommend</Button>
          )},
        ]} />
    )},
  ];

  return (
    <div>
      <div className="page-header">
        <div>
          <Title level={3} style={{ margin: 0, fontFamily: 'DM Sans' }}><CheckCircleOutlined style={{ color: '#059669' }} /> Approvals</Title>
          <Text type="secondary">{data.total} pending items across all categories</Text>
        </div>
      </div>
      <Card bordered={false}><Tabs items={tabs} /></Card>
    </div>
  );
}
