import { useCallback, useEffect, useState } from 'react';
import { Alert, Button, Card, Col, Row, Space, Statistic, Table, Tag, Typography, message } from 'antd';
import { ArrowLeftOutlined, ReloadOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import type { ColumnsType } from 'antd/es/table';

import { legacyApi, systemApi } from '../api';
import type { ConfigValidationResponse, RepoStat } from '../types';


const { Title, Paragraph, Text } = Typography;


export default function LegacySupportPage() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<RepoStat[]>([]);
  const [validation, setValidation] = useState<ConfigValidationResponse | null>(null);
  const [loading, setLoading] = useState(false);

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
      message.error('Failed to load legacy helper data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const columns: ColumnsType<RepoStat> = [
    {
      title: 'Repository',
      dataIndex: 'repo',
      render: (value: string) => <Text code>{value}</Text>,
    },
    { title: 'Total', dataIndex: 'total', width: 100 },
    { title: 'True', dataIndex: 'true_count', width: 100 },
    { title: 'False', dataIndex: 'false_count', width: 100 },
    { title: 'Needs More Data', dataIndex: 'more_count', width: 160 },
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
            <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/')}>
              Back
            </Button>
            <Button icon={<ReloadOutlined />} onClick={() => void loadData()}>
              Refresh
            </Button>
          </Space>
          <Title level={3} style={{ margin: 0, fontFamily: 'Georgia, serif' }}>
            Legacy Helper Commands
          </Title>
          <Paragraph type="secondary" style={{ marginBottom: 0 }}>
            Web equivalents of `vulnseeker-list` and `vulnseeker-validate`.
          </Paragraph>
        </Space>
      </Card>

      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} lg={8}>
          <Card loading={loading} style={{ borderRadius: 22 }}>
            <Statistic title="Repositories With Results" value={stats.length} />
          </Card>
        </Col>
        <Col xs={24} lg={8}>
          <Card loading={loading} style={{ borderRadius: 22 }}>
            <Statistic title="Total Indexed Issues" value={stats.reduce((sum, item) => sum + item.total, 0)} />
          </Card>
        </Col>
        <Col xs={24} lg={8}>
          <Card loading={loading} style={{ borderRadius: 22 }}>
            <Statistic title="Configuration Status" value={validation?.valid ? 'Valid' : 'Needs Attention'} />
          </Card>
        </Col>
      </Row>

      <Card title="Configuration Validation" style={{ marginBottom: 16, borderRadius: 24 }}>
        {validation && (
          validation.valid ? (
            <Alert type="success" showIcon message="All configuration checks passed." />
          ) : (
            <Alert
              type="error"
              showIcon
              message="Configuration validation failed"
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
        title="Repository Statistics"
        extra={<Tag color="blue">{stats.length} repos</Tag>}
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
