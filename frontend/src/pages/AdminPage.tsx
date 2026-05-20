import { Typography, Card, Button, Space } from 'antd';
import { useNavigate } from 'react-router-dom';
import { LogoutOutlined } from '@ant-design/icons';
import { useAuthStore } from '../stores/authStore';

const { Title, Paragraph } = Typography;

export default function AdminPage() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div style={{ padding: 24 }}>
      <Space style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <Title level={3} style={{ margin: 0 }}>Admin Dashboard</Title>
        <Space>
          <Button icon={<LogoutOutlined />} onClick={handleLogout}>
            Logout
          </Button>
        </Space>
      </Space>
      <Card>
        <Paragraph>
          Welcome, <strong>{user?.username}</strong>. This is the admin panel.
        </Paragraph>
      </Card>
    </div>
  );
}
