import { useCallback, useEffect, useState } from 'react';
import { Alert, Button, Card, Col, Row, Space, Statistic, Table, Tag, Typography, message } from 'antd';
import { ArrowLeftOutlined, ReloadOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { ColumnsType } from 'antd/es/table';

import { legacyApi, systemApi } from '../api';
import type { ConfigValidationResponse, RepoStat } from '../types';


const { Title, Paragraph, Text } = Typography;


export default function LegacySupportPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [stats, setStats] = useState<RepoStat[]>([]);
  const [validation, setValidation] = useState<ConfigValidationResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [fetchingDeps, setFetchingDeps] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [statsResponse, validationResponse] = await Promise.all([
        legacyApi.stats(),
        systemApi.validate(),
      ]);
      setStats(statsResponse);
      setValidation(validationResponse);
    } catch {
      message.error(t('legacySupport.loadFailed'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const handleFetchDeps = async () => {
    setFetchingDeps(true);
    try {
      await systemApi.fetchQLDeps();
      message.success(t('legacySupport.depsFetched'));
    } catch {
      message.error(t('legacySupport.depsFetchFailed'));
    } finally {
      setFetchingDeps(false);
    }
  };

  const columns: ColumnsType<RepoStat> = [
    {
      title: t('legacySupport.repoColumn'),
      dataIndex: 'repo',
      render: (value: string) => <Text code>{value}</Text>,
    },
    { title: t('legacySupport.totalColumn'), dataIndex: 'total', width: 100 },
    { title: t('legacySupport.trueColumn'), dataIndex: 'true_count', width: 100 },
    { title: t('legacySupport.falseColumn'), dataIndex: 'false_count', width: 100 },
    { title: t('legacySupport.moreColumn'), dataIndex: 'more_count', width: 160 },
  ];

  return (
    <div style={{ padding: 24 }}>
      <Card
        style={{
          marginBottom: 16,
          borderRadius: 28,
          border: '1px solid #dbe7f4',
          boxShadow: '0 24px 60px rgba(15, 23, 42, 0.08)',
        }}
      >
        <Space direction="vertical" size={10} style={{ width: '100%' }}>
          <Space wrap style={{ justifyContent: 'space-between', width: '100%' }}>
            <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/admin')}>
              {t('legacySupport.back')}
            </Button>
            <Space>
              <Button loading={fetchingDeps} onClick={handleFetchDeps}>
                {t('legacySupport.getQlDeps')}
              </Button>
              <Button icon={<ReloadOutlined />} onClick={() => void loadData()}>
                {t('legacySupport.refresh')}
              </Button>
            </Space>
          </Space>
          <Title level={3} style={{ margin: 0, fontFamily: 'Georgia, serif' }}>
            {t('legacySupport.title')}
          </Title>
          <Paragraph type="secondary" style={{ marginBottom: 0 }}>
            {t('legacySupport.description')}
          </Paragraph>
        </Space>
      </Card>

      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} lg={8}>
          <Card loading={loading} style={{ borderRadius: 22 }}>
            <Statistic title={t('legacySupport.reposWithResults')} value={stats.length} />
          </Card>
        </Col>
        <Col xs={24} lg={8}>
          <Card loading={loading} style={{ borderRadius: 22 }}>
            <Statistic title={t('legacySupport.totalIndexedIssues')} value={stats.reduce((sum, item) => sum + item.total, 0)} />
          </Card>
        </Col>
        <Col xs={24} lg={8}>
          <Card loading={loading} style={{ borderRadius: 22 }}>
            <Statistic title={t('legacySupport.configStatus')} value={validation?.valid ? t('legacySupport.configValid') : t('legacySupport.configNeedsAttention')} />
          </Card>
        </Col>
      </Row>

      <Card title={t('legacySupport.configValidation')} style={{ marginBottom: 16, borderRadius: 24 }}>
        {validation && (
          validation.valid ? (
            <Alert type="success" showIcon message={t('legacySupport.configPassed')} />
          ) : (
            <Alert
              type="error"
              showIcon
              message={t('legacySupport.configFailed')}
              description={
                <Space direction="vertical" size={6}>
                  {validation.errors.map((error) => (
                    <Text key={error} type="danger">{error}</Text>
                  ))}
                </Space>
              }
            />
          )
        )}
      </Card>

      <Card
        title={t('legacySupport.repoStatistics')}
        extra={<Tag color="blue">{t('legacySupport.reposCount', { count: stats.length })}</Tag>}
        style={{ borderRadius: 24 }}
      >
        <Table
          columns={columns}
          dataSource={stats}
          rowKey="repo"
          loading={loading}
          pagination={{ pageSize: 12, showSizeChanger: false, hideOnSinglePage: true }}
        />
      </Card>
    </div>
  );
}
