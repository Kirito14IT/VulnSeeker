import { useEffect, useState } from 'react';
import { Button, Col, Popconfirm, Row, Space, Table, Tag, Typography, message } from 'antd';
import { DeleteOutlined, EyeOutlined, PlayCircleOutlined, PlusOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { ColumnsType } from 'antd/es/table';

import { tasksApi } from '../api';
import { useAuthStore } from '../stores/authStore';
import type { Task } from '../types';
import { getTaskPresentation } from '../utils/taskPresentation';

const { Title, Paragraph, Text } = Typography;

export default function DashboardPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { logout } = useAuthStore();
  const { t } = useTranslation();

  const loadTasks = async () => {
    setLoading(true);
    try {
      const data = await tasksApi.list();
      setTasks(data);
    } catch {
      message.error(t('dashboard.loadFailed'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadTasks();
  }, []);

  const handleDelete = async (id: number) => {
    try {
      await tasksApi.delete(id);
      setTasks((previous) => previous.filter((task) => task.id !== id));
      message.success(t('dashboard.deleteSuccess'));
    } catch (error: unknown) {
      const response = error as { response?: { data?: { detail?: string } } };
      message.error(response.response?.data?.detail ?? t('dashboard.deleteFailed'));
    }
  };

  const handleStart = async (task: Task) => {
    try {
      await tasksApi.start(task.id);
      message.success(t('dashboard.startSuccess'));
      navigate(`/tasks/${task.id}`);
    } catch (error: unknown) {
      const response = error as { response?: { data?: { detail?: string } } };
      message.error(response.response?.data?.detail ?? t('dashboard.startFailed'));
    }
  };

  const columns: ColumnsType<Task> = [
    {
      title: t('table.id'),
      dataIndex: 'id',
      width: 70,
    },
    {
      title: t('table.source'),
      width: 150,
      render: (_, record) => <Tag>{t(`source.${record.source_type}`)}</Tag>,
    },
    {
      title: t('table.target'),
      dataIndex: 'repo_url',
      render: (value) => <Text code>{value}</Text>,
    },
    {
      title: t('table.status'),
      dataIndex: 'status',
      width: 120,
      render: (_value: string, record) => {
        const presentation = getTaskPresentation(record);
        return <Tag color={presentation.color}>{t(`status.${presentation.statusLabelKey}`)}</Tag>;
      },
    },
    {
      title: t('table.created'),
      dataIndex: 'created_at',
      width: 190,
      render: (value) => new Date(value).toLocaleString(),
    },
    {
      title: t('table.actions'),
      width: 210,
      render: (_, record) => (
        <Space>
          {record.status === 'pending' || record.status === 'failed' ? (
            <Button type="primary" size="small" icon={<PlayCircleOutlined />} onClick={() => handleStart(record)}>
              {record.status === 'failed' ? t('dashboard.retry') : t('dashboard.run')}
            </Button>
          ) : null}
          <Button size="small" icon={<EyeOutlined />} onClick={() => navigate(`/tasks/${record.id}`)}>
            {t('dashboard.open')}
          </Button>
          <Popconfirm title={t('dashboard.deleteConfirm')} onConfirm={() => handleDelete(record.id)}>
            <Button danger size="small" icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <>
      {/* Hero */}
      <div className="hero-card" style={{ padding: '24px 28px', marginBottom: 20 }}>
        <Row justify="space-between" gutter={[16, 16]} align="middle">
          <Col xs={24} lg={14}>
            <Title level={2} className="hero-title" style={{ marginBottom: 8 }}>
              {t('dashboard.title')}
            </Title>
            <Paragraph className="hero-subtitle" style={{ marginBottom: 0 }}>
              {t('dashboard.description')}
            </Paragraph>
          </Col>
          <Col>
            <Space wrap>
              <Text type="secondary">
                {t('dashboard.signedInAs', { username: '' })} {/* username shown in sidebar */}
              </Text>
              <Button onClick={logout}>{t('common.logout')}</Button>
            </Space>
          </Col>
        </Row>
      </div>

      {/* Quick actions */}
      <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
        <Col xs={24} md={12}>
          <div className="nav-card" onClick={() => navigate('/tasks/new')} style={{ padding: '20px 24px' }}>
            <Space direction="vertical" size={8}>
              <Tag color="blue" className="nav-card-tag">{t('dashboard.runAnalysis')}</Tag>
              <Title level={4} style={{ margin: 0, fontFamily: 'var(--font-heading)' }}>{t('dashboard.cardCreateTask')}</Title>
              <Text type="secondary">{t('dashboard.cardCreateDesc')}</Text>
            </Space>
          </div>
        </Col>
      </Row>

      {/* Task table */}
      <div className="content-card" style={{ padding: 0 }}>
        <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <Title level={5} style={{ margin: 0, fontFamily: 'var(--font-heading)' }}>{t('dashboard.taskHistory')}</Title>
          <Space>
            <Button onClick={() => void loadTasks()}>{t('common.refresh')}</Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/tasks/new')}>
              {t('dashboard.newTask')}
            </Button>
          </Space>
        </div>
        <Table
          columns={columns}
          dataSource={tasks}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 12, showSizeChanger: false, hideOnSinglePage: true }}
          style={{ padding: '0 8px' }}
        />
      </div>
    </>
  );
}
