import React, { useState } from 'react';
import { Form, Input, Button, Typography, Space, message, Modal, Alert } from 'antd';
import { LockOutlined, UserOutlined, SafetyCertificateOutlined, SecurityScanOutlined, TeamOutlined, DollarOutlined, BarChartOutlined, CheckCircleOutlined } from '@ant-design/icons';
import { useAuth } from '../main';
import { useNavigate } from 'react-router-dom';
const { Title, Text, Paragraph } = Typography;

export default function Login() {
  const { login, user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [forgotModal, setForgotModal] = useState(false);
  const [attempts, setAttempts] = useState(0);

  // If already logged in, redirect to home
  if (user) { navigate('/', { replace: true }); return null; }

  const onFinish = async (values) => {
    if (attempts >= 5) { setError('Too many failed attempts. Please wait 15 minutes.'); return; }
    setLoading(true); setError('');
    try {
      await login(values.username.toLowerCase().trim(), values.password);
      navigate('/', { replace: true });
    } catch (err) {
      const msg = err.response?.data?.error || 'Login failed';
      setError(msg);
      setAttempts(prev => prev + 1);
      if (attempts >= 3) setError(`${msg}. ${5 - attempts - 1} attempts remaining before lockout.`);
    }
    finally { setLoading(false); }
  };

  const features = [
    { icon: <TeamOutlined style={{ fontSize: 20 }} />, title: 'Multi-Entity Management', desc: 'Manage payroll across multiple entities with a single login' },
    { icon: <DollarOutlined style={{ fontSize: 20 }} />, title: 'Dynamic Salary Structure', desc: 'Configurable salary heads, templates, and minimum wage compliance' },
    { icon: <SafetyCertificateOutlined style={{ fontSize: 20 }} />, title: 'Enterprise Security', desc: 'AES-256 encryption, RBAC, maker-checker, GDPR compliant' },
    { icon: <BarChartOutlined style={{ fontSize: 20 }} />, title: 'Comprehensive Reporting', desc: 'Payslips, Form 16, ECR, salary register, Tally GL export' },
  ];

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      {/* LEFT PANEL — Info */}
      <div style={{ flex: 1, background: 'linear-gradient(135deg, #0F2B46 0%, #1A4A6E 50%, #1A6FB5 100%)', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '60px 50px', color: '#fff', position: 'relative', overflow: 'hidden' }}>
        {/* Decorative circles */}
        <div style={{ position: 'absolute', top: -80, right: -80, width: 250, height: 250, borderRadius: '50%', background: 'rgba(255,255,255,0.03)' }} />
        <div style={{ position: 'absolute', bottom: -120, left: -60, width: 350, height: 350, borderRadius: '50%', background: 'rgba(255,255,255,0.02)' }} />

        <div style={{ position: 'relative', zIndex: 1, maxWidth: 420 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 40 }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <DollarOutlined style={{ color: '#fff', fontSize: 18 }} />
            </div>
            <span style={{ fontSize: 18, fontFamily: 'DM Sans', fontWeight: 700, letterSpacing: '-0.3px' }}>Mobilise Payroll</span>
          </div>

          <Title level={2} style={{ color: '#fff', fontFamily: 'DM Sans', fontWeight: 700, marginBottom: 12, lineHeight: 1.3 }}>
            Enterprise Payroll Management System
          </Title>
          <Paragraph style={{ color: 'rgba(255,255,255,0.7)', fontSize: 14, lineHeight: 1.7, marginBottom: 40 }}>
            Process salary for your entire organization with compliance, security, and automation built in.
          </Paragraph>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {features.map((f, i) => (
              <div key={i} style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                <div style={{ width: 38, height: 38, borderRadius: 8, background: 'rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: 'rgba(255,255,255,0.8)' }}>
                  {f.icon}
                </div>
                <div>
                  <Text strong style={{ color: '#fff', fontSize: 13, display: 'block' }}>{f.title}</Text>
                  <Text style={{ color: 'rgba(255,255,255,0.55)', fontSize: 12 }}>{f.desc}</Text>
                </div>
              </div>
            ))}
          </div>

          <div style={{ marginTop: 50, paddingTop: 20, borderTop: '1px solid rgba(255,255,255,0.1)' }}>
            <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11 }}>Mobilise App Lab Limited • Faridabad, Haryana</Text>
          </div>
        </div>
      </div>

      {/* RIGHT PANEL — Login Form */}
      <div style={{ width: 480, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '40px 50px', background: '#FFFFFF' }}>
        <div style={{ maxWidth: 360, width: '100%', margin: '0 auto' }}>
          <div style={{ marginBottom: 32 }}>
            <Title level={3} style={{ fontFamily: 'DM Sans', margin: 0, color: '#0F172A' }}>Welcome back</Title>
            <Text type="secondary" style={{ fontSize: 13 }}>Sign in to access the payroll system</Text>
          </div>

          {error && <Alert message={error} type="error" showIcon style={{ marginBottom: 16, borderRadius: 8 }} closable onClose={() => setError('')} />}

          <Form layout="vertical" onFinish={onFinish} autoComplete="off" requiredMark={false}>
            <Form.Item name="username" label={<Text strong style={{ fontSize: 12 }}>Username</Text>} rules={[{ required: true, message: 'Enter your username' }, { min: 2, message: 'Min 2 characters' }]}>
              <Input prefix={<UserOutlined style={{ color: '#94A3B8' }} />} placeholder="Enter your username" size="large"
                style={{ borderRadius: 8, height: 44 }} autoFocus autoComplete="off" />
            </Form.Item>

            <Form.Item name="password" label={<Text strong style={{ fontSize: 12 }}>Password</Text>} rules={[{ required: true, message: 'Enter your password' }, { min: 6, message: 'Min 6 characters' }]}>
              <Input.Password prefix={<LockOutlined style={{ color: '#94A3B8' }} />} placeholder="Enter your password" size="large"
                style={{ borderRadius: 8, height: 44 }} autoComplete="off" />
            </Form.Item>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 20 }}>
              <Button type="link" size="small" style={{ padding: 0, fontSize: 12, color: '#1A6FB5' }} onClick={() => setForgotModal(true)}>
                Forgot password?
              </Button>
            </div>

            <Form.Item>
              <Button type="primary" htmlType="submit" loading={loading} block size="large"
                style={{ borderRadius: 8, height: 46, fontWeight: 600, fontSize: 14, boxShadow: '0 2px 8px rgba(26,111,181,0.3)' }}
                disabled={attempts >= 5}>
                {loading ? 'Signing in...' : 'Sign In'}
              </Button>
            </Form.Item>
          </Form>

          <div style={{ marginTop: 24, padding: 16, background: '#F8FAFC', borderRadius: 8, border: '1px solid #E2E8F0' }}>
            <Space size={6}>
              <SecurityScanOutlined style={{ color: '#059669', fontSize: 14 }} />
              <Text style={{ fontSize: 11, color: '#64748B' }}>256-bit encrypted • Session timeout 30 min • Account lockout after 5 attempts</Text>
            </Space>
          </div>

          <div style={{ textAlign: 'center', marginTop: 20 }}>
            <Text style={{ fontSize: 11, color: '#94A3B8' }}>v4.0 • Mobilise App Lab Limited</Text>
          </div>
        </div>
      </div>

      {/* Forgot Password Modal */}
      <Modal title="Reset Password" open={forgotModal} onCancel={() => setForgotModal(false)} footer={null} width={400}>
        <Paragraph type="secondary" style={{ marginBottom: 16 }}>Contact your administrator to reset your password. For security, password resets must be performed by a Super Admin.</Paragraph>
        <div style={{ padding: 14, background: '#F8FAFC', borderRadius: 8, border: '1px solid #E2E8F0' }}>
          <Space direction="vertical" size={4}>
            <Text strong style={{ fontSize: 12 }}>How to reset:</Text>
            <Text style={{ fontSize: 12 }}>1. Contact your HR or IT administrator</Text>
            <Text style={{ fontSize: 12 }}>2. They will reset your password via User Management</Text>
            <Text style={{ fontSize: 12 }}>3. You'll receive a temporary password</Text>
            <Text style={{ fontSize: 12 }}>4. Change it on your first login</Text>
          </Space>
        </div>
        <Button type="primary" block style={{ marginTop: 16, borderRadius: 8 }} onClick={() => setForgotModal(false)}>Got it</Button>
      </Modal>
    </div>
  );
}
