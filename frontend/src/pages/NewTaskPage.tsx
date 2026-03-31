import { useEffect } from 'react';
import { Alert, Button, Card, Checkbox, Form, Input, Radio, Space, Typography, message } from 'antd';
import { ArrowLeftOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';

import { tasksApi } from '../api';
import type { TaskCreate, TaskSource } from '../types';


const { Title, Paragraph, Text } = Typography;

const SOURCE_HELP: Record<TaskSource, { title: string; hint: string }> = {
  github: {
    title: 'GitHub prebuilt database',
    hint: 'Use the classic org/repo flow and pull the published CodeQL database from GitHub.',
  },
  local_db: {
    title: 'Existing local CodeQL database',
    hint: 'Point to a server-local CodeQL database directory. Absolute paths work, and relative paths are resolved from the VulnSeeker repo root. Example: output/databases/c/redis or /mnt/e/.../output/databases/c/redis/cpp. This mode reuses the DB directly and does not support rebuild.',
  },
  local_src: {
    title: 'Local source tree',
    hint: 'Point to a source repository directory, not a single .c file. Put local projects under local_repos/ and enter a folder path such as local_repos/demo_c_project or an absolute path to that folder.',
  },
};

const FORCE_LABEL: Partial<Record<TaskSource, string>> = {
  github: 'Force re-download the GitHub CodeQL database even if a cached copy already exists',
  local_src: 'Force rebuild the local CodeQL database even if a cached database already exists for this source tree',
};


export default function NewTaskPage() {
  const [form] = Form.useForm<TaskCreate>();
  const navigate = useNavigate();
  const sourceType = Form.useWatch('source_type', form) ?? 'github';
  const forceLabel = FORCE_LABEL[sourceType];

  useEffect(() => {
    if (sourceType === 'local_db') {
      form.setFieldValue('force', false);
    }
  }, [form, sourceType]);

  const handleCreate = async (values: TaskCreate) => {
    try {
      const task = await tasksApi.create(values);
      message.success('Task created');
      navigate(`/tasks/${task.id}`);
    } catch (error: unknown) {
      const response = error as { response?: { data?: { detail?: string } } };
      message.error(response.response?.data?.detail ?? 'Failed to create task');
    }
  };

  const currentHelp = SOURCE_HELP[sourceType];

  return (
    <div style={{ padding: 24 }}>
      <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/')}>
        Back
      </Button>

      <Card
        style={{
          maxWidth: 920,
          margin: '24px auto',
          borderRadius: 30,
          border: '1px solid #dbe7f4',
          background:
            'linear-gradient(135deg, rgba(255,255,255,0.98) 0%, rgba(237,246,255,0.96) 42%, rgba(248,250,252,0.98) 100%)',
          boxShadow: '0 24px 60px rgba(15, 23, 42, 0.08)',
        }}
      >
        <Space direction="vertical" size={20} style={{ width: '100%' }}>
          <div>
            <Title level={2} style={{ marginBottom: 8, fontFamily: 'Georgia, serif' }}>
              Create Analysis Task
            </Title>
            <Paragraph type="secondary" style={{ maxWidth: 700, marginBottom: 0 }}>
              The web runner now covers the full legacy CLI analysis flow. Choose whether this task
              should fetch from GitHub, reuse an existing local database, or build from a local source tree.
            </Paragraph>
          </div>

          <Alert
            type="info"
            showIcon
            message={currentHelp.title}
            description={currentHelp.hint}
            style={{ borderRadius: 18 }}
          />

          <Form<TaskCreate>
            form={form}
            layout="vertical"
            initialValues={{ source_type: 'github', language: 'c', force: false }}
            onFinish={handleCreate}
          >
            <Form.Item name="source_type" label="Source Mode">
              <Radio.Group
                optionType="button"
                buttonStyle="solid"
                style={{ width: '100%' }}
                options={[
                  { label: 'GitHub DB', value: 'github' },
                  { label: 'Local DB', value: 'local_db' },
                  { label: 'Local Source', value: 'local_src' },
                ]}
              />
            </Form.Item>

            {sourceType === 'github' ? (
              <Form.Item
                name="repo_url"
                label="GitHub Repository"
                rules={[{ required: true, message: 'Enter org/repo, for example redis/redis' }]}
              >
                <Input size="large" placeholder="redis/redis" />
              </Form.Item>
            ) : (
              <Form.Item
                name="source_path"
                label={sourceType === 'local_db' ? 'Local Database Path' : 'Local Source Path'}
                rules={[{ required: true, message: 'Enter a server-local filesystem path' }]}
              >
                <Input
                  size="large"
                  placeholder={sourceType === 'local_db'
                    ? 'output/databases/c/redis or /mnt/e/.../output/databases/c/redis/cpp'
                    : 'local_repos/demo_c_project or /mnt/e/.../local_repos/demo_c_project'}
                />
              </Form.Item>
            )}

            <Form.Item
              name="language"
              label="Language"
              rules={[{ required: true }]}
              extra="The legacy query pack in this repository currently supports the C/C++ query set used by VulnSeeker."
            >
              <Radio.Group
                options={[
                  { label: 'C', value: 'c' },
                ]}
              />
            </Form.Item>

            {forceLabel && (
              <Form.Item name="force" valuePropName="checked">
                <Checkbox>
                  {forceLabel}
                </Checkbox>
              </Form.Item>
            )}

            <Card
              size="small"
              style={{
                marginBottom: 24,
                borderRadius: 18,
                background: 'rgba(255,255,255,0.72)',
              }}
            >
              <Space direction="vertical" size={4}>
                <Text strong>Execution Notes</Text>
                <Text type="secondary">
                  Each web task runs inside its own isolated workspace snapshot under `output/web_tasks/`.
                </Text>
                <Text type="secondary">
                  Legacy CLI results under the repo root remain untouched and continue to work as before.
                </Text>
                {sourceType !== 'github' && (
                  <Text type="secondary">
                    For local paths, prefer folder paths. `local_db` accepts either a single DB directory or a parent directory that contains one.
                  </Text>
                )}
                {sourceType === 'local_db' && (
                  <Text type="secondary">
                    `Local DB` reuses the path you provide as-is. There is no download or rebuild step in this mode.
                  </Text>
                )}
                {sourceType === 'local_src' && (
                  <Text type="secondary">
                    Recommended convention: place local source repositories under `local_repos/` at the project root, then enter paths like `local_repos/demo_c_project`.
                  </Text>
                )}
              </Space>
            </Card>

            <Form.Item style={{ marginBottom: 0 }}>
              <Button type="primary" htmlType="submit" size="large" block>
                Create Task
              </Button>
            </Form.Item>
          </Form>
        </Space>
      </Card>
    </div>
  );
}
