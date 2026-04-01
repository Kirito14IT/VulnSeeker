import { useEffect, useState } from 'react';
import { Button, Card, Col, Popconfirm, Row, Space, Table, Tag, Typography, message } from 'antd';
import { DeleteOutlined, PlayCircleOutlined, PlusOutlined, ReadOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import type { ColumnsType } from 'antd/es/table';

import { tasksApi } from '../api';
import { useAuthStore } from '../stores/authStore';
import type { Task } from '../types';
import { getTaskPresentation } from '../utils/taskPresentation';


const { Title, Paragraph, Text } = Typography;
const SOURCE_LABEL: Record<string, string> = {
  github: 'GitHub DB',
  local_db: 'Local DB',
  local_src: 'Local Source',
};


export default function DashboardPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();

  const loadTasks = async () => {
    setLoading(true);
    try {
      const data = await tasksApi.list();
      setTasks(data);
    } catch {
      message.error('Failed to load tasks');
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
      message.success('Task deleted');
    } catch {
      message.error('Failed to delete task');
    }
  };

  const handleStart = async (task: Task) => {
    try {
      await tasksApi.start(task.id);
      message.success('Analysis started');
      navigate(`/tasks/${task.id}`);
    } catch (error: unknown) {
      const response = error as { response?: { data?: { detail?: string } } };
      message.error(response.response?.data?.detail ?? 'Failed to start task');
    }
  };

  const columns: ColumnsType<Task> = [
    {
      title: 'ID',
      dataIndex: 'id',
      width: 70,
    },
    {
      title: 'Source',
      width: 150,
      render: (_, record) => <Tag>{SOURCE_LABEL[record.source_type] ?? record.source_type}</Tag>,
    },
    {
      title: 'Target',
      dataIndex: 'repo_url',
      render: (value) => <Text code>{value}</Text>,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      width: 120,
      render: (_value: string, record) => {
        const presentation = getTaskPresentation(record);
        return <Tag color={presentation.color}>{presentation.statusLabel}</Tag>;
      },
    },
    {
      title: 'Created',
      dataIndex: 'created_at',
      width: 190,
      render: (value) => new Date(value).toLocaleString(),
    },
    {
      title: 'Actions',
      width: 210,
      render: (_, record) => (
        <Space>
          {record.status === 'pending' || record.status === 'failed' ? (
            <Button type="primary" size="small" icon={<PlayCircleOutlined />} onClick={() => handleStart(record)}>
              {record.status === 'failed' ? 'Retry' : 'Run'}
            </Button>
          ) : (
            <Button size="small" onClick={() => navigate(`/tasks/${record.id}`)}>
              Open
            </Button>
          )}
          <Popconfirm title="Delete this task?" onConfirm={() => handleDelete(record.id)}>
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
              VulnSeeker Web Console
            </Title>
            <Paragraph type="secondary" style={{ maxWidth: 720, marginBottom: 16 }}>
              Unified access to the legacy VulnSeeker pipeline: create isolated web tasks,
              browse legacy disk results, inspect repo-level statistics, and validate runtime configuration.
            </Paragraph>
            <Space direction="vertical" size={8} style={{ maxWidth: 420 }}>
              <Tag color="magenta" style={{ width: 'fit-content', marginInlineEnd: 0 }}>
                Research Track
              </Tag>
              <Button
                icon={<ReadOutlined />}
                size="large"
                onClick={() => navigate('/research/secure-coding-eval')}
                style={{ width: 'fit-content' }}
              >
                Open Secure Coding LLM Eval
              </Button>
              <Text type="secondary">
                Evaluating large language models for secure coding.
              </Text>
            </Space>
          </Col>
          <Col>
            <Space wrap>
              <Text type="secondary">Signed in as {user?.username}</Text>
              <Button onClick={logout}>Logout</Button>
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
              <Tag color="blue">Run Analysis</Tag>
              <Title level={4} style={{ margin: 0 }}>Create New Task</Title>
              <Text type="secondary">GitHub DB, existing CodeQL DB, and local source tree modes are all supported.</Text>
            </Space>
          </Card>
        </Col>
        <Col xs={24} md={8}>
          <Card
            hoverable
            onClick={() => navigate('/legacy/results')}
            style={{ borderRadius: 24, minHeight: 150 }}
          >
            <Space direction="vertical" size={8}>
              <Tag color="geekblue">Legacy UI</Tag>
              <Title level={4} style={{ margin: 0 }}>Global Results Browser</Title>
              <Text type="secondary">Browse the shared root `output/results` view just like the old CLI UI.</Text>
            </Space>
          </Card>
        </Col>
        <Col xs={24} md={8}>
          <Card
            hoverable
            onClick={() => navigate('/legacy/stats')}
            style={{ borderRadius: 24, minHeight: 150 }}
          >
            <Space direction="vertical" size={8}>
              <Tag color="cyan">CLI Helpers</Tag>
              <Title level={4} style={{ margin: 0 }}>Stats & Validation</Title>
              <Text type="secondary">Use the web equivalents of `vulnseeker-list` and `vulnseeker-validate`.</Text>
            </Space>
          </Card>
        </Col>
      </Row>

      <Card
        title="Task History"
        extra={
          <Space>
            <Button onClick={() => void loadTasks()}>Refresh</Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/tasks/new')}>
              New Task
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
