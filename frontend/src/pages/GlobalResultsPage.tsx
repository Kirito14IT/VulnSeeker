import { useCallback, useEffect, useState } from 'react';
import { Button, Space, Typography, message } from 'antd';
import { ArrowLeftOutlined, ReloadOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

import { legacyApi } from '../api';
import IssueExplorer from '../components/IssueExplorer';
import type { IssueDetail, IssueSummary } from '../types';

const { Title, Paragraph } = Typography;

export default function GlobalResultsPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [issues, setIssues] = useState<IssueSummary[]>([]);
  const [selectedIssue, setSelectedIssue] = useState<IssueSummary | null>(null);
  const [issueDetail, setIssueDetail] = useState<IssueDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);

  const loadIssues = useCallback(async () => {
    setLoading(true);
    try {
      const data = await legacyApi.listIssues();
      setIssues(data);
    } catch {
      message.error(t('globalResults.loadFailed'));
    } finally {
      setLoading(false);
    }
  }, []);

  const loadIssueDetail = useCallback(async (issue: IssueSummary) => {
    setSelectedIssue(issue);
    setDetailLoading(true);
    try {
      const detail = await legacyApi.getIssue(issue.key);
      setIssueDetail(detail);
    } catch {
      message.error(t('globalResults.detailLoadFailed'));
    } finally {
      setDetailLoading(false);
    }
  }, []);

  const handleDecisionChange = useCallback(async (issueId: string, decision: string | null) => {
    try {
      await legacyApi.updateDecision(issueId, decision);
      setIssues((previous) => previous.map((issue) => (
        issue.key === issueId ? { ...issue, manual_decision: decision } : issue
      )));
      setSelectedIssue((previous) => (
        previous && previous.key === issueId ? { ...previous, manual_decision: decision } : previous
      ));
      setIssueDetail((previous) => (
        previous && previous.key === issueId ? { ...previous, manual_decision: decision } : previous
      ));
      message.success(decision ? t('globalResults.decisionSaved') : t('globalResults.decisionCleared'));
    } catch {
      message.error(t('globalResults.decisionSaveFailed'));
    }
  }, []);

  useEffect(() => {
    void loadIssues();
  }, [loadIssues]);

  return (
    <>
      {/* Hero */}
      <div className="hero-card" style={{ padding: '20px 28px', marginBottom: 20 }}>
        <Space direction="vertical" size={10} style={{ width: '100%' }}>
          <Space wrap style={{ justifyContent: 'space-between', width: '100%' }}>
            <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/')}>
              {t('globalResults.back')}
            </Button>
            <Button icon={<ReloadOutlined />} onClick={() => void loadIssues()}>
              {t('globalResults.reload')}
            </Button>
          </Space>
          <Title level={3} className="hero-title" style={{ margin: 0 }}>
            {t('globalResults.title')}
          </Title>
          <Paragraph className="hero-subtitle" style={{ marginBottom: 0 }}>
            {t('globalResults.description')}
          </Paragraph>
        </Space>
      </div>

      <IssueExplorer
        issues={issues}
        loading={loading}
        selectedIssue={selectedIssue}
        issueDetail={issueDetail}
        detailLoading={detailLoading}
        onIssueSelect={loadIssueDetail}
        onDecisionChange={handleDecisionChange}
      />
    </>
  );
}
