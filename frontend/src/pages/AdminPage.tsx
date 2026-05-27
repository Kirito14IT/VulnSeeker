import { useEffect, useState } from 'react';
import {
  Button, Card, Col, Form, Input, Modal, Popconfirm, Row, Select, Space,
  Table, Tabs, Tag, Typography, message,
} from 'antd';
import {
  DeleteOutlined, EditOutlined, LogoutOutlined, PlusOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { ColumnsType } from 'antd/es/table';

import { adminApi } from '../api';
import { useAuthStore } from '../stores/authStore';
import type { User, TaskWithUser, TaskSource } from '../types';
import { getTaskPresentation } from '../utils/taskPresentation';

const { Title, Text } = Typography;

// ── Users tab ────────────────────────────────────────────────────────────────

function UsersTab({ me }: { me: User | null }) {
  const { t } = useTranslation();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [roleFilter, setRoleFilter] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [editUser, setEditUser] = useState<User | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [createForm] = Form.useForm();
  const [editForm] = Form.useForm();

  const loadUsers = async () => {
    setLoading(true);
    try {
      const data = await adminApi.listUsers();
      setUsers(data);
    } catch { message.error(t('admin.users.loadFailed')) }
    finally { setLoading(false) }
  };

  useEffect(() => { void loadUsers(); }, []);

  const filteredUsers = users.filter((u) => {
    if (searchText && !u.username.toLowerCase().includes(searchText.toLowerCase())) return false;
    if (roleFilter && u.role !== roleFilter) return false;
    return true;
  });

  const handleCreate = async (values: { username: string; email: string; password: string; role: string }) => {
    setSubmitting(true);
    try {
      await adminApi.createUser(values);
      message.success(t('admin.users.created', { username: values.username }));
      setCreateOpen(false);
      createForm.resetFields();
      await loadUsers();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { detail?: string } } };
      message.error(e.response?.data?.detail ?? t('admin.users.createFailed'));
    } finally { setSubmitting(false) }
  };

  const openEdit = (u: User) => {
    setEditUser(u);
    editForm.setFieldsValue({ username: u.username, email: u.email, role: u.role });
  };

  const handleEdit = async (values: { username: string; email: string; role: string; password?: string }) => {
    if (!editUser) return;
    setSubmitting(true);
    try {
      const payload: Record<string, string> = { username: values.username, email: values.email, role: values.role };
      if (values.password) payload.password = values.password;
      await adminApi.updateUser(editUser.id, payload);
      message.success(t('admin.users.updated'));
      setEditUser(null);
      editForm.resetFields();
      await loadUsers();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { detail?: string } } };
      message.error(e.response?.data?.detail ?? t('admin.users.updateFailed'));
    } finally { setSubmitting(false) }
  };

  const handleDelete = async (id: number, username: string) => {
    try {
      await adminApi.deleteUser(id);
      message.success(t('admin.users.deleted', { username }));
      await loadUsers();
    } catch { message.error(t('admin.users.deleteFailed')) }
  };

  const columns: ColumnsType<User> = [
    { title: t('table.id'), dataIndex: 'id', width: 70 },
    { title: t('table.username'), dataIndex: 'username', width: 160 },
    { title: t('table.email'), dataIndex: 'email', width: 240 },
    {
      title: t('table.role'), dataIndex: 'role', width: 100,
      render: (role: string) => <Tag color={role === 'admin' ? 'red' : 'blue'}>{role}</Tag>,
    },
    {
      title: t('table.created'), dataIndex: 'created_at', width: 180,
      render: (v: string) => new Date(v).toLocaleString(),
    },
    {
      title: t('table.actions'), width: 140,
      render: (_, record) => (
        <Space>
          <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(record)}>{t('common.edit')}</Button>
          {record.id !== me?.id && (
            <Popconfirm title={t('admin.users.deleteConfirm')} onConfirm={() => handleDelete(record.id, record.username)}>
              <Button danger size="small" icon={<DeleteOutlined />} />
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  return (
    <>
      <Card
        extra={
          <Space wrap>
            <Input.Search
              placeholder={t('admin.users.searchPlaceholder')}
              allowClear
              onSearch={setSearchText}
              onChange={(e) => setSearchText(e.target.value)}
              style={{ width: 200 }}
            />
            <Select placeholder={t('admin.users.allRoles')} allowClear style={{ width: 120 }}
              onChange={(v) => setRoleFilter(v ?? null)}>
              <Select.Option value="user">{t('admin.users.roleUser')}</Select.Option>
              <Select.Option value="admin">{t('admin.users.roleAdmin')}</Select.Option>
            </Select>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateOpen(true)}>
              {t('admin.users.createUser')}
            </Button>
          </Space>
        }
        style={{ borderRadius: 24, border: '1px solid #e5e7eb' }}
      >
        <Table columns={columns} dataSource={filteredUsers} rowKey="id" loading={loading}
          pagination={{ pageSize: 12, showSizeChanger: false, hideOnSinglePage: true }} />
      </Card>

      <Modal title={t('admin.users.createUser')} open={createOpen}
        onCancel={() => { setCreateOpen(false); createForm.resetFields(); }}
        onOk={() => createForm.submit()} confirmLoading={submitting}>
        <Form form={createForm} layout="vertical" onFinish={handleCreate} initialValues={{ role: 'user' }}>
          <Form.Item name="username" label={t('admin.form.username')} rules={[{ required: true, min: 3 }]}><Input /></Form.Item>
          <Form.Item name="email" label={t('admin.form.email')} rules={[{ required: true, type: 'email' }]}><Input /></Form.Item>
          <Form.Item name="password" label={t('admin.form.password')} rules={[{ required: true, min: 6 }]}><Input.Password /></Form.Item>
          <Form.Item name="role" label={t('admin.form.role')}>
            <Select><Select.Option value="user">{t('admin.users.roleUser')}</Select.Option><Select.Option value="admin">{t('admin.users.roleAdmin')}</Select.Option></Select>
          </Form.Item>
        </Form>
      </Modal>

      <Modal title={t('admin.users.editUser', { username: editUser?.username })} open={!!editUser}
        onCancel={() => { setEditUser(null); editForm.resetFields(); }}
        onOk={() => editForm.submit()} confirmLoading={submitting}>
        <Form form={editForm} layout="vertical" onFinish={handleEdit}>
          <Form.Item name="username" label={t('admin.form.username')} rules={[{ required: true, min: 3 }]}><Input /></Form.Item>
          <Form.Item name="email" label={t('admin.form.email')} rules={[{ required: true, type: 'email' }]}><Input /></Form.Item>
          <Form.Item name="password" label={t('admin.form.newPassword')}><Input.Password /></Form.Item>
          <Form.Item name="role" label={t('admin.form.role')}>
            <Select><Select.Option value="user">{t('admin.users.roleUser')}</Select.Option><Select.Option value="admin">{t('admin.users.roleAdmin')}</Select.Option></Select>
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}

// ── Tasks tab ────────────────────────────────────────────────────────────────

function TasksTab() {
  const { t } = useTranslation();
  const [tasks, setTasks] = useState<TaskWithUser[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [editTask, setEditTask] = useState<TaskWithUser | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [createForm] = Form.useForm();
  const [editForm] = Form.useForm();

  const loadTasks = async () => {
    setLoading(true);
    try {
      const [taskData, userData] = await Promise.all([adminApi.listTasks(), adminApi.listUsers()]);
      setTasks(taskData);
      setUsers(userData);
    } catch { message.error(t('admin.tasks.loadFailed')) }
    finally { setLoading(false) }
  };

  useEffect(() => { void loadTasks(); }, []);

  const filteredTasks = tasks.filter((t) => {
    if (searchText) {
      const q = searchText.toLowerCase();
      if (!t.repo_url.toLowerCase().includes(q) && !t.username.toLowerCase().includes(q)) return false;
    }
    if (statusFilter && t.status !== statusFilter) return false;
    return true;
  });

  // ── Create ──────────────────────────────────────────────────────────
  const handleCreate = async (values: { user_id: number; repo_url: string; language: string; source_type: string }) => {
    setSubmitting(true);
    try {
      await adminApi.createTask({ ...values, source_type: values.source_type as TaskSource });
      message.success(t('admin.tasks.created'));
      setCreateOpen(false);
      createForm.resetFields();
      await loadTasks();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { detail?: string } } };
      message.error(e.response?.data?.detail ?? t('admin.tasks.createFailed'));
    } finally { setSubmitting(false) }
  };

  // ── Update ──────────────────────────────────────────────────────────
  const openEdit = (t: TaskWithUser) => {
    setEditTask(t);
    editForm.setFieldsValue({
      repo_url: t.repo_url,
      language: t.language,
      source_type: t.source_type,
      status: t.status,
      user_id: t.user_id,
    });
  };

  const handleEdit = async (values: { repo_url: string; language: string; source_type: string; status: string; user_id: number }) => {
    if (!editTask) return;
    setSubmitting(true);
    try {
      await adminApi.updateTask(editTask.id, { ...values, source_type: values.source_type as TaskSource });
      message.success(t('admin.tasks.updated'));
      setEditTask(null);
      editForm.resetFields();
      await loadTasks();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { detail?: string } } };
      message.error(e.response?.data?.detail ?? t('admin.tasks.updateFailed'));
    } finally { setSubmitting(false) }
  };

  // ── Delete ──────────────────────────────────────────────────────────
  const handleDelete = async (id: number) => {
    try {
      await adminApi.deleteTask(id);
      message.success(t('admin.tasks.deleted'));
      await loadTasks();
    } catch { message.error(t('admin.tasks.deleteFailed')) }
  };

  const columns: ColumnsType<TaskWithUser> = [
    { title: t('table.id'), dataIndex: 'id', width: 60 },
    { title: t('table.user'), dataIndex: 'username', width: 120 },
    {
      title: t('table.target'), dataIndex: 'repo_url', ellipsis: true,
      render: (v: string) => <Text code>{v}</Text>,
    },
    {
      title: t('table.source'), dataIndex: 'source_type', width: 110,
      render: (v: string) => <Tag>{t(`source.${v}`)}</Tag>,
    },
    { title: t('table.language'), dataIndex: 'language', width: 100 },
    {
      title: t('table.status'), dataIndex: 'status', width: 110,
      render: (_: string, record: TaskWithUser) => {
        const p = getTaskPresentation(record);
        return <Tag color={p.color}>{t(`status.${p.statusLabelKey}`)}</Tag>;
      },
    },
    {
      title: t('table.created'), dataIndex: 'created_at', width: 170,
      render: (v: string) => new Date(v).toLocaleString(),
    },
    {
      title: t('table.actions'), width: 130,
      render: (_, record) => (
        <Space>
          <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(record)}>{t('common.edit')}</Button>
          <Popconfirm title={t('admin.tasks.deleteConfirm')} onConfirm={() => handleDelete(record.id)}>
            <Button danger size="small" icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <>
      <Card
        extra={
          <Space wrap>
            <Input.Search
              placeholder={t('admin.tasks.searchPlaceholder')}
              allowClear
              onSearch={setSearchText}
              onChange={(e) => setSearchText(e.target.value)}
              style={{ width: 220 }}
            />
            <Select placeholder={t('admin.tasks.allStatuses')} allowClear style={{ width: 130 }}
              onChange={(v) => setStatusFilter(v ?? null)}>
              <Select.Option value="pending">{t('admin.tasks.statusPending')}</Select.Option>
              <Select.Option value="running">{t('admin.tasks.statusRunning')}</Select.Option>
              <Select.Option value="completed">{t('admin.tasks.statusCompleted')}</Select.Option>
              <Select.Option value="failed">{t('admin.tasks.statusFailed')}</Select.Option>
            </Select>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateOpen(true)}>
              {t('admin.tasks.createTask')}
            </Button>
          </Space>
        }
        style={{ borderRadius: 24, border: '1px solid #e5e7eb' }}
      >
        <Table columns={columns} dataSource={filteredTasks} rowKey="id" loading={loading}
          pagination={{ pageSize: 12, showSizeChanger: false, hideOnSinglePage: true }} />
      </Card>

      {/* Create task modal */}
      <Modal title={t('admin.tasks.createTask')} open={createOpen}
        onCancel={() => { setCreateOpen(false); createForm.resetFields(); }}
        onOk={() => createForm.submit()} confirmLoading={submitting}>
        <Form form={createForm} layout="vertical" onFinish={handleCreate} initialValues={{ source_type: 'github', language: 'cpp' }}>
          <Form.Item name="user_id" label={t('admin.form.user')} rules={[{ required: true }]}>
            <Select showSearch placeholder={t('admin.tasks.selectUser')} optionFilterProp="children">
              {users.map((u) => (
                <Select.Option key={u.id} value={u.id}>{u.username} ({u.id})</Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="repo_url" label={t('admin.form.repoUrl')} rules={[{ required: true }]}>
            <Input placeholder={t('admin.tasks.repoPlaceholder')} />
          </Form.Item>
          <Form.Item name="language" label={t('admin.form.language')}>
            <Select>
              <Select.Option value="cpp">{t('newTask.lang.cpp')}</Select.Option>
              <Select.Option value="java">{t('newTask.lang.java')}</Select.Option>
              <Select.Option value="python">{t('newTask.lang.python')}</Select.Option>
              <Select.Option value="javascript">{t('newTask.lang.javascript')}</Select.Option>
              <Select.Option value="go">{t('newTask.lang.go')}</Select.Option>
              <Select.Option value="ruby">{t('newTask.lang.ruby')}</Select.Option>
              <Select.Option value="csharp">{t('newTask.lang.csharp')}</Select.Option>
              <Select.Option value="swift">{t('newTask.lang.swift')}</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item name="source_type" label={t('admin.form.sourceType')}>
            <Select>
              <Select.Option value="github">{t('source.github')}</Select.Option>
              <Select.Option value="local_db">{t('source.local_db')}</Select.Option>
              <Select.Option value="local_src">{t('source.local_src')}</Select.Option>
            </Select>
          </Form.Item>
        </Form>
      </Modal>

      {/* Edit task modal */}
      <Modal title={t('admin.tasks.editTask', { id: editTask?.id })} open={!!editTask}
        onCancel={() => { setEditTask(null); editForm.resetFields(); }}
        onOk={() => editForm.submit()} confirmLoading={submitting}>
        <Form form={editForm} layout="vertical" onFinish={handleEdit}>
          <Form.Item name="user_id" label={t('admin.form.user')} rules={[{ required: true }]}>
            <Select showSearch optionFilterProp="children">
              {users.map((u) => (
                <Select.Option key={u.id} value={u.id}>{u.username} ({u.id})</Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="repo_url" label={t('admin.form.repoUrl')} rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="language" label={t('admin.form.language')}>
            <Select>
              <Select.Option value="cpp">{t('newTask.lang.cpp')}</Select.Option>
              <Select.Option value="java">{t('newTask.lang.java')}</Select.Option>
              <Select.Option value="python">{t('newTask.lang.python')}</Select.Option>
              <Select.Option value="javascript">{t('newTask.lang.javascript')}</Select.Option>
              <Select.Option value="go">{t('newTask.lang.go')}</Select.Option>
              <Select.Option value="ruby">{t('newTask.lang.ruby')}</Select.Option>
              <Select.Option value="csharp">{t('newTask.lang.csharp')}</Select.Option>
              <Select.Option value="swift">{t('newTask.lang.swift')}</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item name="source_type" label={t('admin.form.sourceType')}>
            <Select>
              <Select.Option value="github">{t('source.github')}</Select.Option>
              <Select.Option value="local_db">{t('source.local_db')}</Select.Option>
              <Select.Option value="local_src">{t('source.local_src')}</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item name="status" label={t('admin.form.status')}>
            <Select>
              <Select.Option value="pending">{t('admin.tasks.statusPending')}</Select.Option>
              <Select.Option value="running">{t('admin.tasks.statusRunning')}</Select.Option>
              <Select.Option value="completed">{t('admin.tasks.statusCompleted')}</Select.Option>
              <Select.Option value="failed">{t('admin.tasks.statusFailed')}</Select.Option>
            </Select>
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}

// ── Tools tab ────────────────────────────────────────────────────────────────

function ToolsTab() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  return (
    <Row gutter={[16, 16]}>
      <Col xs={24} md={8}>
        <Card
          hoverable
          onClick={() => navigate('/legacy/stats')}
          style={{ borderRadius: 24, minHeight: 150 }}
        >
          <Space direction="vertical" size={8}>
            <Tag color="cyan">{t('admin.tools.cliHelpers')}</Tag>
            <Title level={4} style={{ margin: 0 }}>{t('admin.tools.statsValidation')}</Title>
            <Text type="secondary">{t('admin.tools.statsValidationDesc')}</Text>
          </Space>
        </Card>
      </Col>
    </Row>
  );
}

// ── Main AdminPage ───────────────────────────────────────────────────────────

export default function AdminPage() {
  const { t } = useTranslation();
  const { user: me, logout } = useAuthStore();
  const navigate = useNavigate();

  const handleLogout = () => { logout(); navigate('/login'); };

  return (
    <div style={{ padding: 24 }}>
      {/* Header */}
      <Card
        style={{
          marginBottom: 16, borderRadius: 30,
          border: '1px solid #dbe7f4',
          background: 'radial-gradient(circle at top left, rgba(255,255,255,0.98), rgba(232,244,255,0.96) 42%, rgba(248,250,252,0.98) 100%)',
          boxShadow: '0 24px 60px rgba(15, 23, 42, 0.08)',
        }}
      >
        <Row justify="space-between" align="middle">
          <Col>
            <Title level={2} style={{ margin: 0, fontFamily: 'Georgia, serif' }}>{t('admin.title')}</Title>
            <Text type="secondary">{t('admin.subtitle')}</Text>
          </Col>
          <Col>
            <Space>
              <Text type="secondary">{t('admin.signedInAs', { username: me?.username })}</Text>
              <Button icon={<LogoutOutlined />} onClick={handleLogout}>{t('admin.logout')}</Button>
            </Space>
          </Col>
        </Row>
      </Card>

      {/* Tabs */}
      <Tabs
        items={[
          { key: 'users', label: t('admin.tabs.users'), children: <UsersTab me={me} /> },
          { key: 'tasks', label: t('admin.tabs.tasks'), children: <TasksTab /> },
          { key: 'tools', label: t('admin.tabs.tools'), children: <ToolsTab /> },
        ]}
      />
    </div>
  );
}
