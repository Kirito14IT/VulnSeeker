/**
 * Registration page.
 */

import { Form, Input, Button, Card, message, Typography } from 'antd';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { authApi } from '../api';
import { useAuthStore } from '../stores/authStore';

const { Title, Text } = Typography;

export default function RegisterPage() {
  const [form] = Form.useForm();
  const navigate = useNavigate();
  const { login } = useAuthStore();
  const { t } = useTranslation();

  const handleSubmit = async (values: { username: string; email: string; password: string }) => {
    try {
      const resp = await authApi.register(values);
      login(resp.access_token, resp.user);
      message.success(t('auth.register.success', { username: resp.user.username }));
      navigate('/');
    } catch (err: unknown) {
      const e = err as { response?: { data?: { detail?: string } } };
      message.error(e.response?.data?.detail ?? t('auth.register.failed'));
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f0f2f5' }}>
      <Card style={{ width: 400, boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <Title level={3}>VulnSeeker</Title>
          <Text type="secondary">{t('auth.register.subtitle')}</Text>
        </div>
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Form.Item name="username" label={t('auth.register.username')} rules={[{ required: true }, { min: 3 }]}>
            <Input placeholder={t('auth.register.usernamePlaceholder')} />
          </Form.Item>
          <Form.Item name="email" label={t('auth.register.email')} rules={[{ required: true }, { type: 'email' }]}>
            <Input placeholder={t('auth.register.emailPlaceholder')} />
          </Form.Item>
          <Form.Item name="password" label={t('auth.register.password')} rules={[{ required: true }, { min: 6 }]}>
            <Input.Password placeholder={t('auth.register.passwordPlaceholder')} />
          </Form.Item>
          <Form.Item style={{ marginBottom: 0 }}>
            <Button type="primary" htmlType="submit" block>
              {t('auth.register.submit')}
            </Button>
          </Form.Item>
        </Form>
        <div style={{ textAlign: 'center', marginTop: 16 }}>
          <Text type="secondary">
            {t('auth.register.haveAccount')}{' '}
            <a href="/login">{t('auth.register.signInLink')}</a>
          </Text>
        </div>
      </Card>
    </div>
  );
}
