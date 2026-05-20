import { useEffect, useState } from 'react';
import {
  Button, Card, Col, Form, Input, Modal, Popconfirm, Row, Select, Space,
  Table, Tabs, Tag, Typography, message,
} from 'antd';
import {
  DeleteOutlined, EditOutlined, LogoutOutlined, PlusOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import type { ColumnsType } from 'antd/es/table';

import { adminApi } from '../api';
import { useAuthStore } from '../stores/authStore';
import type { User, TaskWithUser, TaskSource } from '../types';
import { getTaskPresentation } from '../utils/taskPresentation';

const { Title, Text } = Typography;
const SOURCE_LABEL: Record<string, string> = {
  github: 'GitHub DB',
  local_db: 'Local DB',
  local_src: 'Local Source',
};

// ── Users tab ────────────────────────────────────────────────────────────────

function UsersTab({ me }: { me: User | null }) {
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
    } catch { message.error('Failed to load users') }
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
      message.success(`User '${values.username}' created`);
      setCreateOpen(false);
      createForm.resetFields();
      await loadUsers();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { detail?: string } } };
      message.error(e.response?.data?.detail ?? 'Failed to create user');
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
      message.success('User updated');
      setEditUser(null);
      editForm.resetFields();
      await loadUsers();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { detail?: string } } };
      message.error(e.response?.data?.detail ?? 'Failed to update user');
    } finally { setSubmitting(false) }
  };

  const handleDelete = async (id: number, username: string) => {
    try {
      await adminApi.deleteUser(id);
      message.success(`User '${username}' deleted`);
      await loadUsers();
    } catch { message.error('Failed to delete user') }
  };

  const columns: ColumnsType<User> = [
    { title: 'ID', dataIndex: 'id', width: 70 },
    { title: 'Username', dataIndex: 'username', width: 160 },
    { title: 'Email', dataIndex: 'email', width: 240 },
    {
      title: 'Role', dataIndex: 'role', width: 100,
      render: (role: string) => <Tag color={role === 'admin' ? 'red' : 'blue'}>{role}</Tag>,
    },
    {
      title: 'Created', dataIndex: 'created_at', width: 180,
      render: (v: string) => new Date(v).toLocaleString(),
    },
    {
      title: 'Actions', width: 140,
      render: (_, record) => (
        <Space>
          <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(record)}>Edit</Button>
          {record.id !== me?.id && (
            <Popconfirm title="Delete this user?" onConfirm={() => handleDelete(record.id, record.username)}>
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
              placeholder="Search by username..."
              allowClear
              onSearch={setSearchText}
              onChange={(e) => setSearchText(e.target.value)}
              style={{ width: 200 }}
            />
            <Select placeholder="All roles" allowClear style={{ width: 120 }}
              onChange={(v) => setRoleFilter(v ?? null)}>
              <Select.Option value="user">user</Select.Option>
              <Select.Option value="admin">admin</Select.Option>
            </Select>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateOpen(true)}>
              Create User
            </Button>
          </Space>
        }
        style={{ borderRadius: 24, border: '1px solid #e5e7eb' }}
      >
        <Table columns={columns} dataSource={filteredUsers} rowKey="id" loading={loading}
          pagination={{ pageSize: 12, showSizeChanger: false, hideOnSinglePage: true }} />
      </Card>

      <Modal title="Create User" open={createOpen}
        onCancel={() => { setCreateOpen(false); createForm.resetFields(); }}
        onOk={() => createForm.submit()} confirmLoading={submitting}>
        <Form form={createForm} layout="vertical" onFinish={handleCreate} initialValues={{ role: 'user' }}>
          <Form.Item name="username" label="Username" rules={[{ required: true, min: 3 }]}><Input /></Form.Item>
          <Form.Item name="email" label="Email" rules={[{ required: true, type: 'email' }]}><Input /></Form.Item>
          <Form.Item name="password" label="Password" rules={[{ required: true, min: 6 }]}><Input.Password /></Form.Item>
          <Form.Item name="role" label="Role">
            <Select><Select.Option value="user">user</Select.Option><Select.Option value="admin">admin</Select.Option></Select>
          </Form.Item>
        </Form>
      </Modal>

      <Modal title={`Edit User: ${editUser?.username}`} open={!!editUser}
        onCancel={() => { setEditUser(null); editForm.resetFields(); }}
        onOk={() => editForm.submit()} confirmLoading={submitting}>
        <Form form={editForm} layout="vertical" onFinish={handleEdit}>
          <Form.Item name="username" label="Username" rules={[{ required: true, min: 3 }]}><Input /></Form.Item>
          <Form.Item name="email" label="Email" rules={[{ required: true, type: 'email' }]}><Input /></Form.Item>
          <Form.Item name="password" label="New Password (leave blank to keep)"><Input.Password /></Form.Item>
          <Form.Item name="role" label="Role">
            <Select><Select.Option value="user">user</Select.Option><Select.Option value="admin">admin</Select.Option></Select>
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}

// ── Tasks tab ────────────────────────────────────────────────────────────────

function TasksTab() {
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
    } catch { message.error('Failed to load tasks') }
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
      message.success('Task created');
      setCreateOpen(false);
      createForm.resetFields();
      await loadTasks();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { detail?: string } } };
      message.error(e.response?.data?.detail ?? 'Failed to create task');
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
      message.success('Task updated');
      setEditTask(null);
      editForm.resetFields();
      await loadTasks();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { detail?: string } } };
      message.error(e.response?.data?.detail ?? 'Failed to update task');
    } finally { setSubmitting(false) }
  };

  // ── Delete ──────────────────────────────────────────────────────────
  const handleDelete = async (id: number) => {
    try {
      await adminApi.deleteTask(id);
      message.success('Task deleted');
      await loadTasks();
    } catch { message.error('Failed to delete task') }
  };

  const columns: ColumnsType<TaskWithUser> = [
    { title: 'ID', dataIndex: 'id', width: 60 },
    { title: 'User', dataIndex: 'username', width: 120 },
    {
      title: 'Target', dataIndex: 'repo_url', ellipsis: true,
      render: (v: string) => <Text code>{v}</Text>,
    },
    {
      title: 'Source', dataIndex: 'source_type', width: 110,
      render: (v: string) => <Tag>{SOURCE_LABEL[v] ?? v}</Tag>,
    },
    { title: 'Language', dataIndex: 'language', width: 100 },
    {
      title: 'Status', dataIndex: 'status', width: 110,
      render: (_: string, record: TaskWithUser) => {
        const p = getTaskPresentation(record);
        return <Tag color={p.color}>{p.statusLabel}</Tag>;
      },
    },
    {
      title: 'Created', dataIndex: 'created_at', width: 170,
      render: (v: string) => new Date(v).toLocaleString(),
    },
    {
      title: 'Actions', width: 130,
      render: (_, record) => (
        <Space>
          <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(record)}>Edit</Button>
          <Popconfirm title="Delete this task?" onConfirm={() => handleDelete(record.id)}>
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
              placeholder="Search repo or user..."
              allowClear
              onSearch={setSearchText}
              onChange={(e) => setSearchText(e.target.value)}
              style={{ width: 220 }}
            />
            <Select placeholder="All statuses" allowClear style={{ width: 130 }}
              onChange={(v) => setStatusFilter(v ?? null)}>
              <Select.Option value="pending">pending</Select.Option>
              <Select.Option value="running">running</Select.Option>
              <Select.Option value="completed">completed</Select.Option>
              <Select.Option value="failed">failed</Select.Option>
            </Select>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateOpen(true)}>
              Create Task
            </Button>
          </Space>
        }
        style={{ borderRadius: 24, border: '1px solid #e5e7eb' }}
      >
        <Table columns={columns} dataSource={filteredTasks} rowKey="id" loading={loading}
          pagination={{ pageSize: 12, showSizeChanger: false, hideOnSinglePage: true }} />
      </Card>

      {/* Create task modal */}
      <Modal title="Create Task" open={createOpen}
        onCancel={() => { setCreateOpen(false); createForm.resetFields(); }}
        onOk={() => createForm.submit()} confirmLoading={submitting}>
        <Form form={createForm} layout="vertical" onFinish={handleCreate} initialValues={{ source_type: 'github', language: 'cpp' }}>
          <Form.Item name="user_id" label="User" rules={[{ required: true }]}>
            <Select showSearch placeholder="Select user" optionFilterProp="children">
              {users.map((u) => (
                <Select.Option key={u.id} value={u.id}>{u.username} ({u.id})</Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="repo_url" label="Repo URL" rules={[{ required: true }]}>
            <Input placeholder="org/repo or full GitHub URL" />
          </Form.Item>
          <Form.Item name="language" label="Language">
            <Select>
              <Select.Option value="cpp">C/C++</Select.Option>
              <Select.Option value="java">Java/Kotlin</Select.Option>
              <Select.Option value="python">Python</Select.Option>
              <Select.Option value="javascript">JavaScript/TypeScript</Select.Option>
              <Select.Option value="go">Go</Select.Option>
              <Select.Option value="ruby">Ruby</Select.Option>
              <Select.Option value="csharp">C#</Select.Option>
              <Select.Option value="swift">Swift</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item name="source_type" label="Source Type">
            <Select>
              <Select.Option value="github">GitHub DB</Select.Option>
              <Select.Option value="local_db">Local DB</Select.Option>
              <Select.Option value="local_src">Local Source</Select.Option>
            </Select>
          </Form.Item>
        </Form>
      </Modal>

      {/* Edit task modal */}
      <Modal title={`Edit Task #${editTask?.id}`} open={!!editTask}
        onCancel={() => { setEditTask(null); editForm.resetFields(); }}
        onOk={() => editForm.submit()} confirmLoading={submitting}>
        <Form form={editForm} layout="vertical" onFinish={handleEdit}>
          <Form.Item name="user_id" label="User" rules={[{ required: true }]}>
            <Select showSearch optionFilterProp="children">
              {users.map((u) => (
                <Select.Option key={u.id} value={u.id}>{u.username} ({u.id})</Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="repo_url" label="Repo URL" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="language" label="Language">
            <Select>
              <Select.Option value="cpp">C/C++</Select.Option>
              <Select.Option value="java">Java/Kotlin</Select.Option>
              <Select.Option value="python">Python</Select.Option>
              <Select.Option value="javascript">JavaScript/TypeScript</Select.Option>
              <Select.Option value="go">Go</Select.Option>
              <Select.Option value="ruby">Ruby</Select.Option>
              <Select.Option value="csharp">C#</Select.Option>
              <Select.Option value="swift">Swift</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item name="source_type" label="Source Type">
            <Select>
              <Select.Option value="github">GitHub DB</Select.Option>
              <Select.Option value="local_db">Local DB</Select.Option>
              <Select.Option value="local_src">Local Source</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item name="status" label="Status">
            <Select>
              <Select.Option value="pending">pending</Select.Option>
              <Select.Option value="running">running</Select.Option>
              <Select.Option value="completed">completed</Select.Option>
              <Select.Option value="failed">failed</Select.Option>
            </Select>
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}

// ── Main AdminPage ───────────────────────────────────────────────────────────

export default function AdminPage() {
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
            <Title level={2} style={{ margin: 0, fontFamily: 'Georgia, serif' }}>Admin Dashboard</Title>
            <Text type="secondary">User & task management panel</Text>
          </Col>
          <Col>
            <Space>
              <Text type="secondary">{me?.username} (admin)</Text>
              <Button icon={<LogoutOutlined />} onClick={handleLogout}>Logout</Button>
            </Space>
          </Col>
        </Row>
      </Card>

      {/* Tabs */}
      <Tabs
        items={[
          { key: 'users', label: 'Users', children: <UsersTab me={me} /> },
          { key: 'tasks', label: 'Tasks', children: <TasksTab /> },
        ]}
      />
    </div>
  );
}
