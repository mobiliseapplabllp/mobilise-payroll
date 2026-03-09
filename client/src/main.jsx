import React, { createContext, useContext, useState, useEffect, useRef, Suspense } from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { ConfigProvider, Layout, Menu, Avatar, Dropdown, Typography, Space, Button, Spin, Select, Tag, message } from 'antd';
import {
  DashboardOutlined, TeamOutlined, CalendarOutlined, DollarOutlined, BankOutlined,
  FileTextOutlined, SettingOutlined, LogoutOutlined, UserOutlined, MenuFoldOutlined,
  MenuUnfoldOutlined, MoneyCollectOutlined, SafetyCertificateOutlined,
  SwapOutlined, ClockCircleOutlined, ProfileOutlined, BarChartOutlined,
  AppstoreOutlined, SolutionOutlined, AuditOutlined, RiseOutlined, FilePdfOutlined,
  TrophyOutlined, CheckCircleOutlined, DownOutlined, BellOutlined,
} from '@ant-design/icons';
import api from './utils/api';
import './styles/index.css';

// ===== LAZY LOAD ALL PAGES =====
// Admin
// Error Boundary
class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { hasError: false, error: null }; }
  static getDerivedStateFromError(error) { return { hasError: true, error }; }
  render() {
    if (this.state.hasError) {
      return React.createElement('div', { style: { padding: 40, textAlign: 'center' } },
        React.createElement('h2', { style: { color: '#DC2626', fontFamily: 'DM Sans' } }, 'Page Load Error'),
        React.createElement('p', { style: { color: '#64748B', margin: '12px 0' } }, this.state.error?.message || 'Unknown error'),
        React.createElement('pre', { style: { background: '#F1F5F9', padding: 16, borderRadius: 8, fontSize: 11, textAlign: 'left', maxWidth: 600, margin: '0 auto', overflow: 'auto' } }, this.state.error?.stack?.substring(0, 500)),
        React.createElement('button', { onClick: () => { this.setState({ hasError: false }); window.location.reload(); }, style: { marginTop: 16, padding: '8px 24px', background: '#1A6FB5', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' } }, 'Reload Page')
      );
    }
    return this.props.children;
  }
}

const Login = React.lazy(() => import('./pages/Login'));
const Dashboard = React.lazy(() => import('./pages/admin/Dashboard'));
const Employees = React.lazy(() => import('./pages/admin/Employees'));
const EmployeeForm = React.lazy(() => import('./pages/admin/EmployeeForm'));
const EmployeeView = React.lazy(() => import('./pages/admin/EmployeeView'));
const Attendance = React.lazy(() => import('./pages/admin/Attendance'));
const Payroll = React.lazy(() => import('./pages/admin/Payroll'));
const Bank = React.lazy(() => import('./pages/admin/Bank'));
const Loans = React.lazy(() => import('./pages/admin/Loans'));
const Leaves = React.lazy(() => import('./pages/admin/Leaves'));
const CompOff = React.lazy(() => import('./pages/admin/CompOff'));
const Reports = React.lazy(() => import('./pages/admin/Reports'));
const Statutory = React.lazy(() => import('./pages/admin/Statutory'));
const Settings = React.lazy(() => import('./pages/admin/Settings'));
const FnfSettlement = React.lazy(() => import('./pages/admin/FnfSettlement'));
const SalaryRevision = React.lazy(() => import('./pages/admin/SalaryRevision'));
const MasterData = React.lazy(() => import('./pages/admin/MasterData'));
const UserManagement = React.lazy(() => import('./pages/admin/UserManagement'));
const RoleManagement = React.lazy(() => import('./pages/admin/RoleManagement'));
const AuditViewer = React.lazy(() => import('./pages/admin/AuditViewer'));
const ManagerDashboard = React.lazy(() => import('./pages/admin/ManagerDashboard'));
const Approvals = React.lazy(() => import('./pages/admin/Approvals'));
const PLIAssessment = React.lazy(() => import('./pages/admin/PLIAssessment'));
// ESS
const EssDashboard = React.lazy(() => import('./pages/ess/EssDashboard'));
const MyPayslips = React.lazy(() => import('./pages/ess/MyPayslips'));
const LoanApply = React.lazy(() => import('./pages/ess/LoanApply'));
const TaxDeclaration = React.lazy(() => import('./pages/ess/TaxDeclaration'));
const MyLeaves = React.lazy(() => import('./pages/ess/MyLeaves'));
const MyAttendance = React.lazy(() => import('./pages/ess/MyAttendance'));

const { Header, Sider, Content } = Layout;
const { Text, Title } = Typography;

// ===== AUTH CONTEXT =====
const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);

const SESSION_TIMEOUT = 30 * 60 * 1000; // 30 minutes inactivity

function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const timerRef = useRef(null);

  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    if (token) api.get('/auth/me').then(({ data }) => setUser(data.user)).catch(() => localStorage.clear()).finally(() => setLoading(false));
    else setLoading(false);
  }, []);

  // Session timeout - auto logout on inactivity
  useEffect(() => {
    if (!user) return;
    const resetTimer = () => {
      clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        message.warning('Session expired due to inactivity');
        localStorage.clear();
        setUser(null);
        window.location.href = '/login';
      }, SESSION_TIMEOUT);
    };
    const events = ['mousedown', 'keydown', 'scroll', 'touchstart'];
    events.forEach(e => window.addEventListener(e, resetTimer));
    resetTimer();
    return () => { clearTimeout(timerRef.current); events.forEach(e => window.removeEventListener(e, resetTimer)); };
  }, [user]);

  const login = async (username, password) => {
    const { data } = await api.post('/auth/login', { username, password });
    localStorage.setItem('accessToken', data.accessToken);
    localStorage.setItem('refreshToken', data.refreshToken);
    setUser(data.user);
    return data.user;
  };

  const logout = () => { clearTimeout(timerRef.current); localStorage.clear(); setUser(null); };

  const switchEntity = async (entityId) => {
    const { data } = await api.post('/auth/switch-entity', { entityId });
    setUser(data.user);
    message.success(`Switched to ${data.user.activeEntity?.name}`);
  };

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: '#F8FAFC' }}><Spin size="large" /></div>;
  return <AuthContext.Provider value={{ user, login, logout, switchEntity }}>{children}</AuthContext.Provider>;
}

// ===== ADMIN SIDEBAR =====
function getAdminMenu(role) {
  const items = [];

  // ===== SUPER_ADMIN — sees everything =====
  if (role === 'SUPER_ADMIN') {
    items.push({ type: 'group', label: 'OVERVIEW', children: [
      { key: '/', icon: <DashboardOutlined />, label: 'Dashboard' },
    ]});
    items.push({ type: 'group', label: 'PEOPLE', children: [
      { key: '/employees', icon: <TeamOutlined />, label: 'Employees' },
      { key: '/attendance', icon: <CalendarOutlined />, label: 'Attendance' },
      { key: '/leaves', icon: <ProfileOutlined />, label: 'Leaves' },
      { key: '/compoff', icon: <ClockCircleOutlined />, label: 'Comp-Off' },
    ]});
    items.push({ type: 'group', label: 'PAYROLL', children: [
      { key: '/payroll', icon: <DollarOutlined />, label: 'Salary Processing' },
      { key: '/salary-revision', icon: <RiseOutlined />, label: 'Salary Revision' },
      { key: '/fnf', icon: <SolutionOutlined />, label: 'F&F Settlement' },
    ]});
    items.push({ type: 'group', label: 'FINANCE', children: [
      { key: '/bank', icon: <BankOutlined />, label: 'Bank Transfer' },
      { key: '/loans', icon: <MoneyCollectOutlined />, label: 'Loans' },
    ]});
    items.push({ type: 'group', label: 'COMPLIANCE', children: [
      { key: '/statutory', icon: <SafetyCertificateOutlined />, label: 'Statutory Config' },
      { key: '/reports', icon: <BarChartOutlined />, label: 'Reports' },
    ]});
    items.push({ type: 'group', label: 'ADMINISTRATION', children: [
      { key: '/user-management', icon: <UserOutlined />, label: 'User Management' },
      { key: '/role-management', icon: <SafetyCertificateOutlined />, label: 'Roles & Permissions' },
      { key: '/audit-logs', icon: <FileTextOutlined />, label: 'Audit Trail' },
      { key: '/master-data', icon: <AppstoreOutlined />, label: 'Master Data' },
      { key: '/settings', icon: <SettingOutlined />, label: 'Settings' },
    ]});
    return items;
  }

  // ===== OVERVIEW — All admin roles =====
  items.push({ type: 'group', label: 'OVERVIEW', children: [
    { key: '/', icon: <DashboardOutlined />, label: 'Dashboard' },
  ]});

  // ===== PEOPLE — HR: full, MANAGER: team view, FINANCE: read-only =====
  const peopleItems = [];
  if (role === 'HR') {
    peopleItems.push({ key: '/employees', icon: <TeamOutlined />, label: 'Employees' });
    peopleItems.push({ key: '/attendance', icon: <CalendarOutlined />, label: 'Attendance' });
    peopleItems.push({ key: '/leaves', icon: <ProfileOutlined />, label: 'Leaves' });
    peopleItems.push({ key: '/compoff', icon: <ClockCircleOutlined />, label: 'Comp-Off' });
  } else if (role === 'MANAGER') {
    peopleItems.push({ key: '/employees', icon: <TeamOutlined />, label: 'My Team' });
    peopleItems.push({ key: '/approvals', icon: <CheckCircleOutlined />, label: 'Approvals' });
    peopleItems.push({ key: '/attendance', icon: <CalendarOutlined />, label: 'Team Attendance' });
    peopleItems.push({ key: '/leaves', icon: <ProfileOutlined />, label: 'Leave Approvals' });
    peopleItems.push({ key: '/compoff', icon: <ClockCircleOutlined />, label: 'Comp-Off Approvals' });
    peopleItems.push({ key: '/pli', icon: <TrophyOutlined />, label: 'PLI Assessment' });
  } else if (role === 'FINANCE') {
    peopleItems.push({ key: '/employees', icon: <TeamOutlined />, label: 'Employees' });
  }
  if (peopleItems.length) items.push({ type: 'group', label: 'PEOPLE', children: peopleItems });

  // ===== PAYROLL — HR: process + revision + F&F, FINANCE: approve only =====
  if (role === 'HR') {
    items.push({ type: 'group', label: 'PAYROLL', children: [
      { key: '/payroll', icon: <DollarOutlined />, label: 'Process Salary' },
      { key: '/salary-revision', icon: <RiseOutlined />, label: 'Salary Revision' },
      { key: '/pli', icon: <TrophyOutlined />, label: 'PLI Assessment' },
      { key: '/fnf', icon: <SolutionOutlined />, label: 'F&F Settlement' },
    ]});
  } else if (role === 'FINANCE') {
    items.push({ type: 'group', label: 'PAYROLL', children: [
      { key: '/payroll', icon: <DollarOutlined />, label: 'Approve Salary' },
    ]});
  }

  // ===== FINANCE — HR: generate, FINANCE: approve + download, MANAGER: view loans =====
  if (role === 'HR') {
    items.push({ type: 'group', label: 'FINANCE', children: [
      { key: '/bank', icon: <BankOutlined />, label: 'Bank Transfer' },
      { key: '/loans', icon: <MoneyCollectOutlined />, label: 'Loans' },
    ]});
  } else if (role === 'FINANCE') {
    items.push({ type: 'group', label: 'FINANCE', children: [
      { key: '/bank', icon: <BankOutlined />, label: 'Bank Transfer' },
      { key: '/loans', icon: <MoneyCollectOutlined />, label: 'Loan Approvals' },
    ]});
  } else if (role === 'MANAGER') {
    // Manager uses Approvals page for loan recommendations
  }

  // ===== COMPLIANCE — FINANCE only (statutory rates/config) =====
  if (role === 'FINANCE') {
    items.push({ type: 'group', label: 'COMPLIANCE', children: [
      { key: '/statutory', icon: <SafetyCertificateOutlined />, label: 'Statutory Config' },
    ]});
  }

  // ===== REPORTS — HR + FINANCE =====
  if (['HR', 'FINANCE'].includes(role)) {
    items.push({ type: 'group', label: 'REPORTS', children: [
      { key: '/reports', icon: <BarChartOutlined />, label: 'Reports' },
    ]});
  }

  // ===== SETTINGS — HR: company + holidays + masters, FINANCE: statutory =====
  if (role === 'HR') {
    items.push({ type: 'group', label: 'SETTINGS', children: [
      { key: '/settings', icon: <SettingOutlined />, label: 'Company Settings' },
      { key: '/master-data', icon: <AppstoreOutlined />, label: 'Master Data' },
    ]});
  } else if (role === 'FINANCE') {
    items.push({ type: 'group', label: 'SETTINGS', children: [
      { key: '/settings', icon: <SettingOutlined />, label: 'Settings' },
    ]});
  }

  return items;
}

// ===== ESS SIDEBAR =====
function getEssMenu() {
  return [
    { type: 'group', label: 'MY PORTAL', children: [
      { key: '/', icon: <AppstoreOutlined />, label: 'Dashboard' },
      { key: '/payslips', icon: <FilePdfOutlined />, label: 'My Payslips' },
      { key: '/tax', icon: <FileTextOutlined />, label: 'Tax Summary' },
    ]},
    { type: 'group', label: 'FINANCE', children: [
      { key: '/loans', icon: <MoneyCollectOutlined />, label: 'My Loans' },
      { key: '/loan-apply', icon: <MoneyCollectOutlined />, label: 'Apply for Loan' },
    ]},
    { type: 'group', label: 'ATTENDANCE', children: [
      { key: '/my-attendance', icon: <CalendarOutlined />, label: 'My Attendance' },
      { key: '/my-leaves', icon: <ProfileOutlined />, label: 'My Leaves' },
      { key: '/compoff', icon: <ClockCircleOutlined />, label: 'Comp-Off' },
    ]},
  ];
}

// ===== LAYOUT =====
function AppLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const { user, logout, switchEntity } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const isEss = user?.role === 'EMPLOYEE';
  const menuItems = isEss ? getEssMenu() : getAdminMenu(user?.role);

  const selectedKey = (() => {
    if (location.pathname.startsWith('/employees')) return '/employees';
    return location.pathname;
  })();

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider trigger={null} collapsible collapsed={collapsed} width={235} style={{ background: '#FFFFFF', position: 'fixed', height: '100vh', left: 0, zIndex: 10, borderRight: '2px solid #E2E8F0', display: 'flex', flexDirection: 'column', boxShadow: '2px 0 8px rgba(0,0,0,0.04)' }}>
        <div style={{ height: 52, display: 'flex', alignItems: 'center', padding: '0 16px', borderBottom: '1px solid #E2E8F0', flexShrink: 0 }}>
          <div style={{ width: 28, height: 28, borderRadius: 6, background: '#0F2B46', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <DollarOutlined style={{ color: '#fff', fontSize: 13 }} />
          </div>
          {!collapsed && <span style={{ color: '#0F172A', marginLeft: 10, fontSize: 13, fontFamily: 'DM Sans', fontWeight: 600, whiteSpace: 'nowrap' }}>{isEss ? 'Employee Portal' : 'Mobilise Payroll'}</span>}
        </div>
        <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden' }}>
          <Menu mode="inline" selectedKeys={[selectedKey]} items={menuItems} onClick={({ key }) => navigate(key)} style={{ background: 'transparent', border: 'none', marginTop: 4, fontFamily: 'IBM Plex Sans' }} />
        </div>
      </Sider>

      <Layout style={{ marginLeft: collapsed ? 80 : 235, transition: 'all 0.2s' }}>
        <Header style={{ padding: '0 20px', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'space-between', boxShadow: '0 1px 2px rgba(0,0,0,0.03)', position: 'sticky', top: 0, zIndex: 5, height: 50, borderBottom: '1px solid #E2E8F0' }}>
          <Space>
            <Button type="text" icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />} onClick={() => setCollapsed(!collapsed)} style={{ color: '#64748B' }} />
            {!isEss && user?.entities?.length > 0 && (
              <Select value={user?.activeEntity?._id} onChange={switchEntity} style={{ width: 220 }} size="small" suffixIcon={<SwapOutlined />}
                options={user.entities.map(e => ({ label: e.name || e.code, value: e._id }))} />
            )}
          </Space>
          <Space size="middle">
            {!isEss && <Tag color="blue" style={{ margin: 0, fontSize: 11 }}>{user?.activeEntity?.name}</Tag>}
            <span className={`role-badge ${user?.role}`}>{user?.role}</span>
            <Dropdown menu={{ items: [
              { key: 'info', label: <Text type="secondary" style={{ fontSize: 11 }}>{user?.email} • {user?.role}</Text>, disabled: true },
              { type: 'divider' },
              { key: 'logout', icon: <LogoutOutlined />, label: 'Sign Out', danger: true, onClick: () => { logout(); navigate('/login'); } },
            ] }}>
              <Space style={{ cursor: 'pointer' }}>
                <Avatar size={28} style={{ background: '#1A6FB5', fontSize: 12 }}>{user?.firstName?.[0]}{user?.lastName?.[0]}</Avatar>
                <Text strong style={{ fontSize: 13 }}>{user?.firstName}</Text>
              </Space>
            </Dropdown>
          </Space>
        </Header>

        <Content style={{ margin: 20, minHeight: 280 }}>
          <ErrorBoundary>
          <Suspense fallback={<div style={{ textAlign: 'center', padding: 80 }}><Spin size="large" /></div>}>
            <Routes>
              {/* Admin + ESS Dashboard */}
              <Route path="/" element={isEss ? <EssDashboard /> : (user?.role === 'MANAGER' ? <ManagerDashboard /> : <Dashboard />)} />

              {/* Admin routes */}
              <Route path="/employees" element={<Employees />} />
              <Route path="/employees/new" element={<EmployeeForm />} />
              <Route path="/employees/edit/:id" element={<EmployeeForm />} />
              <Route path="/employees/view/:id" element={<EmployeeView />} />
              <Route path="/attendance" element={<Attendance />} />
              <Route path="/payroll" element={<Payroll />} />
              <Route path="/bank" element={<Bank />} />
              <Route path="/loans" element={isEss ? <LoanApply /> : <Loans />} />
              <Route path="/leaves" element={isEss ? <MyLeaves /> : <Leaves />} />
              <Route path="/compoff" element={<CompOff />} />
              <Route path="/reports" element={<Reports />} />
              <Route path="/statutory" element={<Statutory />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/fnf" element={<FnfSettlement />} />
              <Route path="/salary-revision" element={<SalaryRevision />} />
              <Route path="/master-data" element={<MasterData />} />
              <Route path="/user-management" element={<UserManagement />} />
              <Route path="/role-management" element={<RoleManagement />} />
              <Route path="/audit-logs" element={<AuditViewer />} />
              <Route path="/approvals" element={<Approvals />} />
              <Route path="/pli" element={<PLIAssessment />} />

              {/* ESS routes */}
              <Route path="/payslips" element={<MyPayslips />} />
              <Route path="/loan-apply" element={<LoanApply />} />
              <Route path="/tax" element={<TaxDeclaration />} />
              <Route path="/my-leaves" element={<MyLeaves />} />
              <Route path="/my-attendance" element={<MyAttendance />} />
            </Routes>
          </Suspense>
          </ErrorBoundary>
        </Content>
      </Layout>
    </Layout>
  );
}

function App() {
  return (
    <ConfigProvider theme={{
      token: {
        colorPrimary: '#1A6FB5', borderRadius: 10, fontFamily: "'IBM Plex Sans', -apple-system, sans-serif",
        colorBgContainer: '#FFFFFF', colorBgLayout: '#F1F5F9',
        colorBorder: '#E2E8F0', colorBorderSecondary: '#F1F5F9',
        colorText: '#0F172A', colorTextSecondary: '#64748B',
        colorSuccess: '#059669', colorWarning: '#D97706', colorError: '#DC2626',
        controlHeight: 36, fontSize: 13.5,
      },
      components: {
        Button: { borderRadius: 6, fontWeight: 500, controlHeight: 36 },
        Card: { borderRadiusLG: 10, paddingLG: 20 },
        Table: { borderRadiusLG: 10, headerBg: '#F1F5F9' },
        Input: { borderRadius: 6, controlHeight: 36 },
        Select: { borderRadius: 6, controlHeight: 36 },
        Modal: { borderRadiusLG: 14 },
        Tabs: { cardBorderRadius: 8 },
        Tag: { borderRadiusSM: 20 },
      },
    }}>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Suspense fallback={<Spin />}><Login /></Suspense>} />
            <Route path="/*" element={<ProtectedRoute><AppLayout /></ProtectedRoute>} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ConfigProvider>
  );
}

function ProtectedRoute({ children }) {
  const { user } = useAuth();
  return user ? children : <Navigate to="/login" replace />;
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
