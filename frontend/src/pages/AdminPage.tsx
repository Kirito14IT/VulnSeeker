import { useEffect, useState } from 'react';
import {
  Button, Card, Col, Form, Input, Modal, Popconfirm, Row, Select, Space, Table, Tag, Typography, message,
} from 'antd';
import { DeleteOutlined, EditOutlined, LogoutOutlined, PlusOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import type { ColumnsType } from 'antd/es/table';

import { adminApi } from '../api';
import { useAuthStore } from '../stores/authStore';
import type { User } from '../types';

const { Title, Text } = Typography;

export default function AdminPage() {
  const { user: me, logout } = useAuthStore();
  const navigate = useNavigate();

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
    } catch {
      message.error('Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadUsers();
  }, []);

  const filteredUsers = users.filter((u) => {
    if (searchText && !u.username.toLowerCase().includes(searchText.toLowerCase())) return false;
    if (roleFilter && u.role !== roleFilter) return false;
    return true;
  });

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  // ── Create ──────────────────────────────────────────────────────────────
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
    } finally {
      setSubmitting(false);
    }
  };

  // ── Update ──────────────────────────────────────────────────────────────
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
    } finally {
      setSubmitting(false);
    }
  };

  // ── Delete ──────────────────────────────────────────────────────────────
  const handleDelete = async (id: number, username: string) => {
    try {
      await adminApi.deleteUser(id);
      message.success(`User '${username}' deleted`);
      await loadUsers();
    } catch {
      message.error('Failed to delete user');
    }
  };

  const columns: ColumnsType<User> = [
    { title: 'ID', dataIndex: 'id', width: 70 },
    { title: 'Username', dataIndex: 'username', width: 160 },
    { title: 'Email', dataIndex: 'email', width: 240 },
    {
      title: 'Role', dataIndex: 'role', width: 100,
      render: (role: string) => (
        <Tag color={role === 'admin' ? 'red' : 'blue'}>{role}</Tag>
      ),
    },
    {
      title: 'Created', dataIndex: 'created_at', width: 180,
      render: (v: string) => new Date(v).toLocaleString(),
    },
    {
      title: 'Actions', width: 140,
      render: (_, record) => (
        <Space>
          <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(record)}>
            Edit
          </Button>
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
            <Title level={2} style={{ margin: 0, fontFamily: 'Georgia, serif' }}>
              Admin Dashboard
            </Title>
            <Text type="secondary">User management panel</Text>
          </Col>
          <Col>
            <Space>
              <Text type="secondary">{me?.username} (admin)</Text>
              <Button icon={<LogoutOutlined />} onClick={handleLogout}>Logout</Button>
            </Space>
          </Col>
        </Row>
      </Card>

      {/* User table */}
      <Card
        title="Users"
        extra={
          <Space wrap>
            <Input.Search
              placeholder="Search by username..."
              allowClear
              onSearch={setSearchText}
              onChange={(e) => setSearchText(e.target.value)}
              style={{ width: 200 }}
            />
            <Select
              placeholder="All roles"
              allowClear
              style={{ width: 120 }}
              onChange={(v) => setRoleFilter(v ?? null)}
            >
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
        <Table
          columns={columns}
          dataSource={filteredUsers}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 12, showSizeChanger: false, hideOnSinglePage: true }}
        />
      </Card>

      {/* Create user modal */}
      <Modal
        title="Create User"
        open={createOpen}
        onCancel={() => { setCreateOpen(false); createForm.resetFields(); }}
        onOk={() => createForm.submit()}
        confirmLoading={submitting}
      >
        <Form form={createForm} layout="vertical" onFinish={handleCreate} initialValues={{ role: 'user' }}>
          <Form.Item name="username" label="Username" rules={[{ required: true, min: 3 }]}>
            <Input />
          </Form.Item>
          <Form.Item name="email" label="Email" rules={[{ required: true, type: 'email' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="password" label="Password" rules={[{ required: true, min: 6 }]}>
            <Input.Password />
          </Form.Item>
          <Form.Item name="role" label="Role">
            <Select>
              <Select.Option value="user">user</Select.Option>
              <Select.Option value="admin">admin</Select.Option>
            </Select>
          </Form.Item>
        </Form>
      </Modal>

      {/* Edit user modal */}
      <Modal
        title={`Edit User: ${editUser?.username}`}
        open={!!editUser}
        onCancel={() => { setEditUser(null); editForm.resetFields(); }}
        onOk={() => editForm.submit()}
        confirmLoading={submitting}
      >
        <Form form={editForm} layout="vertical" onFinish={handleEdit}>
          <Form.Item name="username" label="Username" rules={[{ required: true, min: 3 }]}>
            <Input />
          </Form.Item>
          <Form.Item name="email" label="Email" rules={[{ required: true, type: 'email' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="password" label="New Password (leave blank to keep)">
            <Input.Password />
          </Form.Item>
          <Form.Item name="role" label="Role">
            <Select>
              <Select.Option value="user">user</Select.Option>
              <Select.Option value="admin">admin</Select.Option>
            </Select>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
