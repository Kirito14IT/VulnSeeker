import { useCallback, useEffect, useState } from 'react';
import { Button, Card, Space, Typography, message } from 'antd';
import { ArrowLeftOutlined, ReloadOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';

import { legacyApi } from '../api';
import IssueExplorer from '../components/IssueExplorer';
import type { IssueDetail, IssueSummary } from '../types';


const { Title, Paragraph } = Typography;


export default function GlobalResultsPage() {
  const navigate = useNavigate();
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
      message.error('Failed to load legacy results');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadIssueDetail = useCallback(async (issue: IssueSummary) => {
    setSelectedIssue(issue);
    setDetailLoading(true);
    try {
      const detail = await legacyApi.getIssue(issue.id);
      setIssueDetail(detail);
    } catch {
      message.error('Failed to load issue detail');
    } finally {
      setDetailLoading(false);
    }
  }, []);

  const handleDecisionChange = useCallback(async (issueId: string, decision: string | null) => {
    try {
      await legacyApi.updateDecision(issueId, decision);
      setIssues((previous) => previous.map((issue) => (
        issue.id === issueId ? { ...issue, manual_decision: decision } : issue
      )));
      setSelectedIssue((previous) => (
        previous && previous.id === issueId ? { ...previous, manual_decision: decision } : previous
      ));
      setIssueDetail((previous) => (
        previous && previous.id === issueId ? { ...previous, manual_decision: decision } : previous
      ));
      message.success(decision ? 'Decision saved' : 'Decision cleared');
    } catch {
      message.error('Failed to save decision');
    }
  }, []);

  useEffect(() => {
    void loadIssues();
  }, [loadIssues]);

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
            <Button icon={<ReloadOutlined />} onClick={() => void loadIssues()}>
              Reload
            </Button>
          </Space>
          <Title level={3} style={{ margin: 0, fontFamily: 'Georgia, serif' }}>
            Legacy Global Results
          </Title>
          <Paragraph type="secondary" style={{ marginBottom: 0 }}>
            Web version of the old `vulnhalla-ui` browser, backed by the shared root `output/results`.
          </Paragraph>
        </Space>
      </Card>

      <IssueExplorer
        issues={issues}
        loading={loading}
        selectedIssue={selectedIssue}
        issueDetail={issueDetail}
        detailLoading={detailLoading}
        onIssueSelect={loadIssueDetail}
        onDecisionChange={handleDecisionChange}
      />
    </div>
  );
}
