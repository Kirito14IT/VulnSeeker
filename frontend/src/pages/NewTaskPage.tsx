import { useEffect } from 'react';
import { Alert, Button, Card, Checkbox, Form, Input, Radio, Space, Typography, message } from 'antd';
import { ArrowLeftOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

import { tasksApi } from '../api';
import type { TaskCreate, TaskSource } from '../types';


const { Title, Paragraph, Text } = Typography;

const SOURCE_HELP_KEYS: Record<TaskSource, { titleKey: string; hintKey: string }> = {
  github: { titleKey: 'newTask.sourceHelp.github', hintKey: 'newTask.sourceHelp.githubHint' },
  local_db: { titleKey: 'newTask.sourceHelp.localDb', hintKey: 'newTask.sourceHelp.localDbHint' },
  local_src: { titleKey: 'newTask.sourceHelp.localSrc', hintKey: 'newTask.sourceHelp.localSrcHint' },
};

const FORCE_LABEL_KEYS: Partial<Record<TaskSource, string>> = {
  github: 'newTask.forceGithub',
  local_src: 'newTask.forceLocalSrc',
};

export default function NewTaskPage() {
  const [form] = Form.useForm();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const sourceType = Form.useWatch('source_type', form) ?? 'github';
  const forceLabelKey = FORCE_LABEL_KEYS[sourceType as TaskSource];

  useEffect(() => {
    if (sourceType === 'local_db') {
      form.setFieldValue('force', false);
    }
  }, [form, sourceType]);

  const handleCreate = async (values: any) => {
    try {
      const submitValues: TaskCreate = {
        ...values,
        language: Array.isArray(values.language) ? values.language.join(',') : values.language,
      };

      const task = await tasksApi.create(submitValues);
      message.success(t('newTask.created'));
      navigate(`/tasks/${task.id}`);
    } catch (error: unknown) {
      const response = error as { response?: { data?: { detail?: string } } };
      message.error(response.response?.data?.detail ?? t('newTask.createFailed'));
    }
  };

  const currentHelp = SOURCE_HELP_KEYS[sourceType as TaskSource];

  return (
    <div style={{ padding: 24 }}>
      <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/')}>
        {t('common.back')}
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
              {t('newTask.title')}
            </Title>
            <Paragraph type="secondary" style={{ maxWidth: 700, marginBottom: 0 }}>
              {t('newTask.description')}
            </Paragraph>
          </div>

          {currentHelp && (
            <Alert
              type="info"
              showIcon
              message={t(currentHelp.titleKey)}
              description={t(currentHelp.hintKey)}
              style={{ borderRadius: 18 }}
            />
          )}

          <Form
            form={form}
            layout="vertical"
            initialValues={{ source_type: 'github', language: ['cpp'], force: false }}
            onFinish={handleCreate}
          >
            <Form.Item name="source_type" label={t('newTask.sourceMode')}>
              <Radio.Group
                optionType="button"
                buttonStyle="solid"
                style={{ width: '100%' }}
                options={[
                  { label: t('newTask.sourceOption.github'), value: 'github' },
                  { label: t('newTask.sourceOption.localDb'), value: 'local_db' },
                  { label: t('newTask.sourceOption.localSrc'), value: 'local_src' },
                ]}
              />
            </Form.Item>

            {sourceType === 'github' ? (
              <Form.Item
                name="repo_url"
                label={t('newTask.githubRepo')}
                rules={[{ required: true, message: t('newTask.repoValidateMsg') }]}
              >
                <Input size="large" placeholder={t('newTask.repoPlaceholder')} />
              </Form.Item>
            ) : (
              <Form.Item
                name="source_path"
                label={sourceType === 'local_db' ? t('newTask.localDbPath') : t('newTask.localSrcPath')}
                rules={[{ required: true, message: t('newTask.localValidateMsg') }]}
              >
                <Input
                  size="large"
                  placeholder={sourceType === 'local_db'
                    ? t('newTask.localDbPlaceholder')
                    : t('newTask.localSrcPlaceholder')}
                />
              </Form.Item>
            )}

            <Form.Item
              name="language"
              label={t('newTask.languages')}
              rules={[{ required: true, message: t('newTask.langValidateMsg') }]}
              extra={t('newTask.langExtra')}
            >
              <Checkbox.Group
                options={[
                  { label: t('newTask.lang.cpp'), value: 'cpp' },
                  { label: t('newTask.lang.java'), value: 'java' },
                  { label: t('newTask.lang.javascript'), value: 'javascript' },
                  { label: t('newTask.lang.python'), value: 'python' },
                ]}
              />
            </Form.Item>

            {forceLabelKey && (
              <Form.Item name="force" valuePropName="checked">
                <Checkbox>
                  {t(forceLabelKey)}
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
                <Text strong>{t('newTask.executionNotes')}</Text>
                <Text type="secondary">{t('newTask.noteWorkspace')}</Text>
                <Text type="secondary">{t('newTask.noteLegacy')}</Text>
                {sourceType !== 'github' && (
                  <Text type="secondary">{t('newTask.noteLocalPath')}</Text>
                )}
                {sourceType === 'local_db' && (
                  <Text type="secondary">{t('newTask.noteLocalDb')}</Text>
                )}
                {sourceType === 'local_src' && (
                  <Text type="secondary">{t('newTask.noteLocalSrc')}</Text>
                )}
              </Space>
            </Card>

            <Form.Item style={{ marginBottom: 0 }}>
              <Button type="primary" htmlType="submit" size="large" block>
                {t('newTask.createBtn')}
              </Button>
            </Form.Item>
          </Form>
        </Space>
      </Card>
    </div>
  );
}
