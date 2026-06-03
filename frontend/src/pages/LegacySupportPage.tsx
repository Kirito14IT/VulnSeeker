import { useCallback, useEffect, useState } from 'react';
import { Alert, Button, Col, Row, Space, Statistic, Table, Tag, Typography, message } from 'antd';
import { ArrowLeftOutlined, ReloadOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { ColumnsType } from 'antd/es/table';

import { systemApi } from '../api';
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
        systemApi.stats(),
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
    <>
      {/* Hero */}
      <div className="hero-card" style={{ padding: '20px 28px', marginBottom: 20 }}>
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
          <Title level={3} className="hero-title" style={{ margin: 0 }}>
            {t('legacySupport.title')}
          </Title>
          <Paragraph className="hero-subtitle" style={{ marginBottom: 0 }}>
            {t('legacySupport.description')}
          </Paragraph>
        </Space>
      </div>

      {/* KPI row */}
      <Row gutter={[16, 16]} style={{ marginBottom: 20 }} className="stagger-children">
        <Col xs={24} lg={8}>
          <div className="kpi-card" style={{ padding: '20px 24px' }}>
            <Statistic title={t('legacySupport.reposWithResults')} value={stats.length} loading={loading} />
          </div>
        </Col>
        <Col xs={24} lg={8}>
          <div className="kpi-card" style={{ padding: '20px 24px' }}>
            <Statistic title={t('legacySupport.totalIndexedIssues')} value={stats.reduce((sum, item) => sum + item.total, 0)} loading={loading} />
          </div>
        </Col>
        <Col xs={24} lg={8}>
          <div className="kpi-card" style={{ padding: '20px 24px' }}>
            <Statistic title={t('legacySupport.configStatus')} value={validation?.valid ? t('legacySupport.configValid') : t('legacySupport.configNeedsAttention')} />
          </div>
        </Col>
      </Row>

      {/* Config validation */}
      <div className="content-card" style={{ padding: '16px 24px', marginBottom: 20 }}>
        <Title level={5} style={{ margin: '0 0 12px', fontFamily: 'var(--font-heading)' }}>{t('legacySupport.configValidation')}</Title>
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
      </div>

      {/* Repo stats table */}
      <div className="content-card" style={{ padding: 0 }}>
        <div style={{ padding: '14px 24px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Title level={5} style={{ margin: 0, fontFamily: 'var(--font-heading)' }}>{t('legacySupport.repoStatistics')}</Title>
          <Tag color="blue">{t('legacySupport.reposCount', { count: stats.length })}</Tag>
        </div>
        <Table
          columns={columns}
          dataSource={stats}
          rowKey="repo"
          loading={loading}
          pagination={{ pageSize: 12, showSizeChanger: false, hideOnSinglePage: true }}
        />
      </div>
    </>
  );
}
