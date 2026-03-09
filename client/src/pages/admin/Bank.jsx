import React, { useState, useEffect } from 'react';
import { Card, Typography, Button, Table, Tag, message, Row, Col, Space } from 'antd';
import { BankOutlined, FileTextOutlined, DownloadOutlined } from '@ant-design/icons';
import api, { downloadFile } from '../../utils/api';
const { Title, Text } = Typography;

export default function Bank() {
  const [runs, setRuns] = useState([]);
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get('/payroll/runs').then(({ data }) => setRuns(data.filter(r => ['COMPUTED', 'APPROVED', 'PAID'].includes(r.status)))),
      api.get('/bank/files').then(({ data }) => setFiles(data)).catch(() => {}),
    ]).finally(() => setLoading(false));
  }, []);

  const generateFile = async (runId) => {
    try { const { data } = await api.post(`/bank/generate-file/${runId}`); message.success(`Generated: ${data.totalRecords} records, ₹${(data.totalAmount / 100000).toFixed(2)}L`); api.get('/bank/files').then(({ data }) => setFiles(data)); }
    catch (err) { message.error(err.response?.data?.error || 'Failed'); }
  };

  const generateLetter = async (runId) => {
    try { await api.post(`/bank/generate-letter/${runId}`); message.success('Letter generated!'); }
    catch (err) { message.error(err.response?.data?.error || 'Failed'); }
  };

  return (
    <div>
      <div className="page-header"><Title level={3} style={{ margin: 0 }}><BankOutlined style={{ color: '#0891B2' }} /> HDFC Bank Transfer</Title></div>
      <Card title="Generate Bank Files" bordered={false} style={{ marginBottom: 16 }}>
        <Table dataSource={runs} loading={loading} rowKey="runId" size="small" pagination={false} columns={[
          { title: 'Run', dataIndex: 'runId' },
          { title: 'Period', render: (_, r) => `${new Date(0, r.month - 1).toLocaleString('en', { month: 'short' })} ${r.year}` },
          { title: 'Employees', dataIndex: 'totalEmployees' },
          { title: 'Net Amount', dataIndex: 'totalNet', render: v => `₹${(v / 100000).toFixed(2)}L` },
          { title: 'Status', dataIndex: 'status', render: v => <Tag color={v === 'APPROVED' ? 'green' : 'blue'}>{v}</Tag> },
          { title: 'Bank File', dataIndex: 'bankFileGenerated', render: v => v ? <Tag color="green">Generated</Tag> : <Tag>Pending</Tag> },
          { title: 'Actions', render: (_, r) => (
            <Space>
              <Button size="small" icon={<BankOutlined />} onClick={() => generateFile(r.runId)}>Generate CSV</Button>
              <Button size="small" icon={<FileTextOutlined />} onClick={() => generateLetter(r.runId)}>Cover Letter</Button>
            </Space>
          )},
        ]} />
      </Card>
      <Card title="Generated Files" bordered={false}>
        <Table dataSource={files} rowKey="fileId" size="small" columns={[
          { title: 'File ID', dataIndex: 'fileId' },
          { title: 'Month', render: (_, r) => `${r.month}/${r.year}` },
          { title: 'Records', dataIndex: 'totalRecords' },
          { title: 'Amount', dataIndex: 'totalAmount', render: v => `₹${(v / 100000).toFixed(2)}L` },
          { title: 'TR', dataIndex: 'a2aCount' }, { title: 'NEFT', dataIndex: 'neftCount' },
          { title: 'Status', dataIndex: 'status', render: v => <Tag color="green">{v}</Tag> },
          { title: 'Download', render: (_, r) => <Button size="small" type="primary" ghost icon={<DownloadOutlined />} onClick={() => downloadFile(`/bank/download/${r.fileId}`)}>CSV</Button> },
        ]} />
      </Card>
    </div>
  );
}
