import { useEffect, useState } from 'react';
import { Button, Card, Col, Popconfirm, Row, Space, Table, Tag, Typography, message } from 'antd';
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
  const { user, logout } = useAuthStore();
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
          {record.status !== 'pending' ? (
            <Button size="small" icon={<EyeOutlined />} onClick={() => navigate(`/tasks/${record.id}`)}>
              {t('dashboard.open')}
            </Button>
          ) : null}
          <Popconfirm title={t('dashboard.deleteConfirm')} onConfirm={() => handleDelete(record.id)}>
            <Button danger size="small" icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <Card
        style={{
          marginBottom: 16,
          borderRadius: 30,
          border: '1px solid #dbe7f4',
          background:
            'radial-gradient(circle at top left, rgba(255,255,255,0.98), rgba(232,244,255,0.96) 42%, rgba(248,250,252,0.98) 100%)',
          boxShadow: '0 24px 60px rgba(15, 23, 42, 0.08)',
        }}
      >
        <Row justify="space-between" gutter={[16, 16]} align="middle">
          <Col xs={24} lg={14}>
            <Title level={2} style={{ marginBottom: 8, fontFamily: 'Georgia, serif' }}>
              {t('dashboard.title')}
            </Title>
            <Paragraph type="secondary" style={{ maxWidth: 720, marginBottom: 16 }}>
              {t('dashboard.description')}
            </Paragraph>
          </Col>
          <Col>
            <Space wrap>
              <Text type="secondary">
                {t('dashboard.signedInAs', { username: user?.username })}
              </Text>
              <Button onClick={logout}>{t('common.logout')}</Button>
            </Space>
          </Col>
        </Row>
      </Card>

      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} md={8}>
          <Card
            hoverable
            onClick={() => navigate('/tasks/new')}
            style={{ borderRadius: 24, minHeight: 150 }}
          >
            <Space direction="vertical" size={8}>
              <Tag color="blue">{t('dashboard.runAnalysis')}</Tag>
              <Title level={4} style={{ margin: 0 }}>{t('dashboard.cardCreateTask')}</Title>
              <Text type="secondary">{t('dashboard.cardCreateDesc')}</Text>
            </Space>
          </Card>
        </Col>
        <Col xs={24} md={8}>
          <Card
            hoverable
            onClick={() => navigate('/result/results')}
            style={{ borderRadius: 24, minHeight: 150 }}
          >
            <Space direction="vertical" size={8}>
              <Tag color="geekblue">{t('dashboard.legacyUi')}</Tag>
              <Title level={4} style={{ margin: 0 }}>{t('dashboard.cardGlobalResults')}</Title>
              <Text type="secondary">{t('dashboard.cardGlobalDesc')}</Text>
            </Space>
          </Card>
        </Col>
      </Row>

      <Card
        title={t('dashboard.taskHistory')}
        extra={
          <Space>
            <Button onClick={() => void loadTasks()}>{t('common.refresh')}</Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/tasks/new')}>
              {t('dashboard.newTask')}
            </Button>
          </Space>
        }
        style={{ borderRadius: 24, border: '1px solid #e5e7eb' }}
      >
        <Table
          columns={columns}
          dataSource={tasks}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 12, showSizeChanger: false, hideOnSinglePage: true }}
        />
      </Card>
    </div>
  );
}
