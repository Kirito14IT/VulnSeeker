import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import {
  Card,
  Descriptions,
  Divider,
  Empty,
  Input,
  Row,
  Col,
  Select,
  Segmented,
  Space,
  Spin,
  Table,
  Tag,
  Typography,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useTranslation } from 'react-i18next';

import type { IssueDetail, IssueSummary } from '../types';
import MarkdownSummary from './MarkdownSummary';


const { Text, Paragraph } = Typography;

const DECISION_COLORS: Record<string, string> = {
  'True Positive': 'green',
  'False Positive': 'red',
  'Uncertain': 'orange',
  'Needs More Data': 'gold',
  'Raw Match': 'blue',
  'Not Set': 'default',
};

const STATUS_COLORS: Record<string, string> = {
  true: 'green',
  false: 'red',
  more: 'gold',
  raw: 'blue',
};

const STATUS_TO_KEY: Record<string, string> = {
  true: 'truePositive',
  false: 'falsePositive',
  more: 'needsMoreData',
  raw: 'rawMatch',
};

const DECISIONS = ['True Positive', 'False Positive', 'Uncertain'] as const;
const EXPLORER_CARD_HEIGHT = 720;
const ISSUE_TABLE_HEIGHT = 630;
const DETAIL_CONTENT_HEIGHT = 626;
const ISSUE_PAGE_SIZE = 12;

type Props = {
  issues: IssueSummary[];
  loading: boolean;
  selectedIssue: IssueSummary | null;
  issueDetail: IssueDetail | null;
  detailLoading: boolean;
  onIssueSelect: (issue: IssueSummary) => void;
  onDecisionChange: (issueId: string, decision: string | null) => Promise<void> | void;
  controlsExtra?: ReactNode;
};


function extractLocationLine(detail: IssueDetail | null): number | null {
  const prompt = detail?.raw_data && typeof detail.raw_data.prompt === 'string'
    ? detail.raw_data.prompt
    : '';
  const match = prompt.match(/Location:\s*[^:]*:(\d+)/i);
  return match ? Number(match[1]) : null;
}


function CodeBlock({ content, highlightLine }: { content: string; highlightLine: number | null }) {
  const { t } = useTranslation();
  const lines = content.split('\n');

  return (
    <div
      style={{
        borderRadius: 16,
        overflow: 'hidden',
        border: '1px solid #e5e7eb',
        background:
          'linear-gradient(180deg, rgba(15,23,42,0.98) 0%, rgba(30,41,59,0.96) 100%)',
      }}
    >
      <div
        style={{
          padding: '10px 14px',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
          color: '#94a3b8',
          fontSize: 12,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
        }}
      >
        {t('issueExplorer.codeContext')}
      </div>
      <pre
        style={{
          margin: 0,
          padding: 16,
          overflowX: 'auto',
          color: '#e2e8f0',
          fontSize: 12,
          lineHeight: 1.7,
          fontFamily: 'JetBrains Mono, Fira Code, monospace',
        }}
      >
        {lines.map((line, index) => {
          const lineMatch = line.match(/^\s*(\d+):/);
          const isHighlighted = lineMatch && highlightLine !== null && Number(lineMatch[1]) === highlightLine;
          return (
            <div
              key={`${index}-${line}`}
              style={{
                background: isHighlighted ? 'rgba(239,68,68,0.16)' : 'transparent',
                color: isHighlighted ? '#fecaca' : undefined,
                borderRadius: 6,
                padding: isHighlighted ? '0 6px' : 0,
              }}
            >
              {line || ' '}
            </div>
          );
        })}
      </pre>
    </div>
  );
}


export default function IssueExplorer({
  issues,
  loading,
  selectedIssue,
  issueDetail,
  detailLoading,
  onIssueSelect,
  onDecisionChange,
  controlsExtra,
}: Props) {
  const { t } = useTranslation();
  const [search, setSearch] = useState('');
  const [llmFilter, setLlmFilter] = useState<string>('All');
  const [decisionFilter, setDecisionFilter] = useState<string>('All');
  const [summaryMode, setSummaryMode] = useState<'rendered' | 'raw'>('rendered');

  const filteredIssues = useMemo(() => (
    issues.filter((issue) => {
      const query = search.trim().toLowerCase();
      const statusLabel = t('decision.' + STATUS_TO_KEY[issue.status]);
      const manual = issue.manual_decision ?? t('decision.notSet');
      const matchesSearch = !query
        || issue.id.toLowerCase().includes(query)
        || issue.name.toLowerCase().includes(query)
        || issue.file.toLowerCase().includes(query)
        || issue.repo.toLowerCase().includes(query)
        || statusLabel.toLowerCase().includes(query)
        || manual.toLowerCase().includes(query);

      const matchesLlm = llmFilter === 'All' || issue.status === llmFilter;
      const matchesDecision = decisionFilter === 'All'
        || (decisionFilter === 'Not Set' && !issue.manual_decision)
        || issue.manual_decision === decisionFilter;

      return matchesSearch && matchesLlm && matchesDecision;
    })
  ), [decisionFilter, issues, llmFilter, search, t]);

  const columns: ColumnsType<IssueSummary> = [
    {
      title: t('table.id'),
      dataIndex: 'id',
      width: 80,
      ellipsis: true,
      sorter: (a, b) => Number(a.id) - Number(b.id),
    },
    {
      title: t('table.llmDecision'),
      dataIndex: 'status',
      width: 150,
      render: (value: string) => {
        const label = t('decision.' + STATUS_TO_KEY[value]);
        return <Tag color={STATUS_COLORS[value]}>{label}</Tag>;
      },
    },
    {
      title: t('table.manual'),
      dataIndex: 'manual_decision',
      width: 150,
      render: (value: string | null) => {
        const label = value ?? t('decision.notSet');
        return <Tag color={value ? DECISION_COLORS[value] : 'default'}>{label}</Tag>;
      },
    },
    {
      title: t('table.repo'),
      dataIndex: 'repo',
      width: 180,
      ellipsis: true,
      render: (value: string) => <Text code style={{ fontSize: 12, display: 'block' }} title={value}>{value}</Text>,
    },
    {
      title: t('table.issueName'),
      dataIndex: 'name',
      ellipsis: true,
    },
    {
      title: t('table.file'),
      dataIndex: 'file',
      width: 190,
      ellipsis: true,
      render: (value: string) => <Text code style={{ fontSize: 12, display: 'block' }} title={value}>{value}</Text>,
    },
  ];

  const highlightLine = extractLocationLine(issueDetail);
  const functionName = issueDetail?.raw_data
    && typeof issueDetail.raw_data.current_function === 'object'
    && issueDetail.raw_data.current_function !== null
    && 'function_name' in issueDetail.raw_data.current_function
    ? String(issueDetail.raw_data.current_function.function_name).replace(/^"+|"+$/g, '')
    : null;
  const selectedIssueFinalized = issueDetail?.finalized ?? selectedIssue?.finalized ?? false;

  return (
    <>
      <Card
        size="small"
        style={{
          marginBottom: 12,
          borderRadius: 20,
          border: '1px solid #e5e7eb',
          boxShadow: '0 12px 32px rgba(15, 23, 42, 0.06)',
        }}
      >
        <Space wrap size={[12, 12]} style={{ width: '100%', justifyContent: 'space-between' }}>
          <Space wrap>
            <Input.Search
              placeholder={t('issueExplorer.searchPlaceholder')}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              style={{ width: 280 }}
              allowClear
            />
            <Select value={llmFilter} onChange={setLlmFilter} style={{ width: 170 }}>
              <Select.Option value="All">{t('issueExplorer.allLlmDecisions')}</Select.Option>
              <Select.Option value="true">{t('decision.truePositive')}</Select.Option>
              <Select.Option value="false">{t('decision.falsePositive')}</Select.Option>
              <Select.Option value="more">{t('decision.needsMoreData')}</Select.Option>
              <Select.Option value="raw">{t('decision.rawMatch')}</Select.Option>
            </Select>
            <Select value={decisionFilter} onChange={setDecisionFilter} style={{ width: 180 }}>
              <Select.Option value="All">{t('issueExplorer.allManualDecisions')}</Select.Option>
              <Select.Option value="True Positive">{t('decision.truePositive')}</Select.Option>
              <Select.Option value="False Positive">{t('decision.falsePositive')}</Select.Option>
              <Select.Option value="Uncertain">{t('decision.uncertain')}</Select.Option>
              <Select.Option value="Not Set">{t('decision.notSet')}</Select.Option>
            </Select>
          </Space>
          <Space wrap>
            <Text type="secondary">{t('issueExplorer.showing', { count: filteredIssues.length, total: issues.length })}</Text>
            {controlsExtra}
          </Space>
        </Space>
      </Card>

      <Row gutter={16} align="top">
        <Col xs={24} xl={11}>
          <Card
            size="small"
            title={t('issueExplorer.issues')}
            style={{
              borderRadius: 24,
              height: EXPLORER_CARD_HEIGHT,
              border: '1px solid #e5e7eb',
              boxShadow: '0 18px 40px rgba(15, 23, 42, 0.06)',
            }}
            bodyStyle={{ padding: 0, height: EXPLORER_CARD_HEIGHT - 56, overflow: 'hidden' }}
          >
            {filteredIssues.length === 0 && !loading ? (
              <Empty description={t('issueExplorer.noFilterResults')} style={{ margin: '56px 0' }} />
            ) : (
              <Table
                className="issue-explorer-table"
                columns={columns}
                dataSource={filteredIssues}
                rowKey={(record) => `${record.issue_type}-${record.id}`}
                size="small"
                tableLayout="fixed"
                loading={loading}
                pagination={{ pageSize: ISSUE_PAGE_SIZE, showSizeChanger: false, hideOnSinglePage: true }}
                scroll={{ y: ISSUE_TABLE_HEIGHT }}
                onRow={(record) => ({
                  onClick: () => onIssueSelect(record),
                  style: {
                    cursor: 'pointer',
                    background: selectedIssue?.id === record.id && selectedIssue.issue_type === record.issue_type
                      ? '#eef6ff'
                      : undefined,
                  },
                })}
              />
            )}
          </Card>
        </Col>

        <Col xs={24} xl={13}>
          <Card
            size="small"
            title={selectedIssue ? t('issueExplorer.issueLabel', { id: selectedIssue.id }) : t('issueExplorer.issueDetail')}
            style={{
              borderRadius: 24,
              border: '1px solid #e5e7eb',
              height: EXPLORER_CARD_HEIGHT,
              boxShadow: '0 18px 40px rgba(15, 23, 42, 0.06)',
            }}
            bodyStyle={{ height: EXPLORER_CARD_HEIGHT - 56, overflow: 'hidden' }}
            extra={selectedIssue && selectedIssue.finalized ? (
              <Space>
                <Text type="secondary">{t('issueExplorer.manualDecision')}</Text>
                <Select
                  value={selectedIssue.manual_decision ?? t('decision.notSet')}
                  onChange={(value) => onDecisionChange(selectedIssue.id, value === t('decision.notSet') ? null : value)}
                  style={{ width: 170 }}
                >
                  {DECISIONS.map((decision) => (
                    <Select.Option key={decision} value={decision}>
                      {t('decision.' + {
                        'True Positive': 'truePositive',
                        'False Positive': 'falsePositive',
                        'Uncertain': 'uncertain',
                      }[decision])}
                    </Select.Option>
                  ))}
                  <Select.Option value={t('decision.notSet')}>{t('decision.notSet')}</Select.Option>
                </Select>
              </Space>
            ) : selectedIssue ? (
              <Text type="secondary">{t('issueExplorer.llmNotFinalized')}</Text>
            ) : null}
          >
            {!selectedIssue ? (
              <div style={{ height: '100%', display: 'grid', placeItems: 'center' }}>
                <Empty description={t('issueExplorer.noSelection')} />
              </div>
            ) : detailLoading || !issueDetail ? (
              <div style={{ height: '100%', display: 'grid', placeItems: 'center' }}>
                <Spin size="large" />
              </div>
            ) : (
              <div style={{ height: DETAIL_CONTENT_HEIGHT, overflowY: 'auto', paddingRight: 6 }}>
                <Space wrap style={{ marginBottom: 12 }}>
                  <Tag color={STATUS_COLORS[issueDetail.status]}>
                    {t('decision.' + STATUS_TO_KEY[issueDetail.status])}
                  </Tag>
                  {!issueDetail.finalized && <Tag color="blue">{t('issueExplorer.rawOnly')}</Tag>}
                  <Text strong>{issueDetail.name}</Text>
                </Space>

                <Descriptions column={2} size="small" bordered>
                  <Descriptions.Item label={t('issueExplorer.repository')}>{issueDetail.repo}</Descriptions.Item>
                  <Descriptions.Item label={t('issueExplorer.issueType')}>{issueDetail.issue_type}</Descriptions.Item>
                  <Descriptions.Item label={t('issueExplorer.file')}>{issueDetail.file}:{issueDetail.line}</Descriptions.Item>
                  <Descriptions.Item label={t('issueExplorer.function')}>{functionName ?? t('issueExplorer.nA')}</Descriptions.Item>
                </Descriptions>

                {issueDetail.snippets.length > 0 && (
                  <>
                    <Divider />
                    <Space direction="vertical" size={16} style={{ width: '100%' }}>
                      {issueDetail.snippets.map((snippet) => (
                        <div key={`${snippet.label}-${snippet.content.slice(0, 12)}`}>
                          <Text type="secondary" style={{ display: 'block', marginBottom: 8 }}>
                            {snippet.label}
                          </Text>
                          <CodeBlock content={snippet.content} highlightLine={highlightLine} />
                        </div>
                      ))}
                    </Space>
                  </>
                )}

                <Divider />
                <Space wrap style={{ width: '100%', justifyContent: 'space-between', marginBottom: 8 }}>
                <Text strong>{selectedIssueFinalized ? t('issueExplorer.llmFinalAnswer') : t('issueExplorer.rawMatchSummary')}</Text>
                  <Segmented
                    size="small"
                    value={summaryMode}
                    onChange={(value) => setSummaryMode(value as 'rendered' | 'raw')}
                    options={[
                      { label: t('issueExplorer.rendered'), value: 'rendered' },
                      { label: t('issueExplorer.raw'), value: 'raw' },
                    ]}
                  />
                </Space>
                {summaryMode === 'rendered' ? (
                  <MarkdownSummary content={issueDetail.summary || t('issueExplorer.noSummary')} />
                ) : (
                  <Paragraph style={{ marginTop: 8, whiteSpace: 'pre-wrap', fontSize: 13 }}>
                    {issueDetail.summary || t('issueExplorer.noSummary')}
                  </Paragraph>
                )}
              </div>
            )}
          </Card>
        </Col>
      </Row>
    </>
  );
}
