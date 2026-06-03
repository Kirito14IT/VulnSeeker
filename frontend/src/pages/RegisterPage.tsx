/**
 * Registration page — matches the login page aesthetic.
 */

import { Form, Input, Button, message, Typography } from 'antd';
import { UserOutlined, MailOutlined, LockOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { authApi } from '../api';
import { useAuthStore } from '../stores/authStore';
import LanguageSwitcher from '../components/LanguageSwitcher';
import logoSvg from '../assets/logo.svg';

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
    <div className="auth-page">
      {/* Language switcher */}
      <div style={{ position: 'fixed', top: 20, right: 20, zIndex: 10 }}>
        <LanguageSwitcher />
      </div>

      <div className="auth-card" style={{ width: 420 }}>
        {/* Header */}
        <div className="auth-card-header">
          <div className="auth-card-logo">
            <img src={logoSvg} alt="VulnSeeker" />
          </div>
          <Title level={2} className="auth-card-title">VulnSeeker</Title>
          <Text className="auth-card-subtitle">{t('auth.register.subtitle')}</Text>
        </div>

        {/* Body */}
        <div className="auth-card-body">
          <Form
            form={form}
            layout="vertical"
            onFinish={handleSubmit}
            size="large"
          >
            <Form.Item
              name="username"
              label={t('auth.register.username')}
              rules={[{ required: true, min: 3, message: t('auth.register.usernamePlaceholder') }]}
            >
              <Input
                prefix={<UserOutlined style={{ color: 'var(--text-tertiary)' }} />}
                placeholder={t('auth.register.usernamePlaceholder')}
                autoFocus
              />
            </Form.Item>

            <Form.Item
              name="email"
              label={t('auth.register.email')}
              rules={[{ required: true, type: 'email', message: t('auth.register.emailPlaceholder') }]}
            >
              <Input
                prefix={<MailOutlined style={{ color: 'var(--text-tertiary)' }} />}
                placeholder={t('auth.register.emailPlaceholder')}
              />
            </Form.Item>

            <Form.Item
              name="password"
              label={t('auth.register.password')}
              rules={[{ required: true, min: 6, message: t('auth.register.passwordPlaceholder') }]}
            >
              <Input.Password
                prefix={<LockOutlined style={{ color: 'var(--text-tertiary)' }} />}
                placeholder={t('auth.register.passwordPlaceholder')}
              />
            </Form.Item>

            <Form.Item style={{ marginBottom: 0, marginTop: 24 }}>
              <Button type="primary" htmlType="submit" block size="large">
                {t('auth.register.submit')}
              </Button>
            </Form.Item>
          </Form>
        </div>

        {/* Footer */}
        <div className="auth-card-footer">
          <Text>
            {t('auth.register.haveAccount')}{' '}
            <a href="/login">{t('auth.register.signInLink')}</a>
          </Text>
        </div>
      </div>
    </div>
  );
}
