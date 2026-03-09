import React, { useState, useEffect } from 'react';
import { Card, Typography, Table, Tag, Button, Spin, Empty } from 'antd';
import { DownloadOutlined, FilePdfOutlined } from '@ant-design/icons';
import { useAuth } from '../../main';
import api, { downloadFile } from '../../utils/api';
const { Title, Text } = Typography;

export default function MyPayslips() {
  const { user } = useAuth();
  const [runs, setRuns] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/payroll/runs').then(({ data }) => setRuns(data.filter(r => ['APPROVED', 'PAID'].includes(r.status)))).catch(console.error).finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <div className="page-header"><Title level={3} style={{ margin: 0, fontFamily: 'DM Sans' }}><FilePdfOutlined style={{ color: '#059669' }} /> My Payslips</Title></div>
      <Card bordered={false}>
        {loading ? <Spin /> : runs.length === 0 ? <Empty description="No payslips available yet" /> :
          <Table dataSource={runs} rowKey="runId" columns={[
            { title: 'Month', render: (_, r) => <Text strong>{new Date(0, r.month - 1).toLocaleString('en', { month: 'long' })} {r.year}</Text>, width: 200 },
            { title: 'Entity', dataIndex: 'entityCode', width: 100, render: v => <Tag>{v}</Tag> },
            { title: 'Status', dataIndex: 'status', width: 100, render: v => <Tag color="green">{v}</Tag> },
            { title: 'Processed', dataIndex: 'createdAt', width: 150, render: d => new Date(d).toLocaleDateString('en-IN') },
            { title: 'Download', width: 120, render: (_, r) => (
              <Button type="primary" icon={<FilePdfOutlined />} onClick={() => downloadFile(`/reports/payslip-pdf/${r.runId}/${user.empCode}`)}>
                Download PDF
              </Button>
            )},
          ]} />
        }
      </Card>
    </div>
  );
}
