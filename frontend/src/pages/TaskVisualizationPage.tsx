import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Alert,
  Button,
  Card,
  Col,
  Divider,
  Empty,
  Progress,
  Row,
  Space,
  Spin,
  Statistic,
  Table,
  Tag,
  Typography,
  message,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  ArrowLeftOutlined,
  DownloadOutlined,
  FileSearchOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { resultsApi, tasksApi } from '../api';
import MarkdownSummary from '../components/MarkdownSummary';
import type { IssueDetail, IssueSummary, Task, WsMessage } from '../types';
import { getTaskPresentation } from '../utils/taskPresentation';


const { Title, Text, Paragraph } = Typography;

const STATUS_COLOR: Record<string, string> = {
  true: '#22c55e',
  false: '#ef4444',
  more: '#f59e0b',
  raw: '#38bdf8',
};

const STATUS_TO_KEY: Record<string, string> = {
  true: 'truePositive',
  false: 'falsePositive',
  more: 'needsMoreData',
  raw: 'rawMatch',
};

const MANUAL_COLORS: Record<string, string> = {
  'True Positive': '#16a34a',
  'False Positive': '#dc2626',
  Uncertain: '#f59e0b',
  'Not Set': '#94a3b8',
};

const DECISION_KEYS = ['true', 'false', 'more', 'raw'] as const;

type ChartDatum = {
  name: string;
  value: number;
  statusKey: string;
};

type RiskRecord = IssueSummary & {
  functionName: string;
  manualLabel: string;
  riskScore: number;
  statusCode: string | null;
  summary: string;
  snippetPreview: string;
};

type MatrixRecord = {
  issueType: string;
  true: number;
  false: number;
  more: number;
  raw: number;
  total: number;
};


function issueKey(issue: IssueSummary): string {
  return issue.key;
}


function getFunctionName(detail: IssueDetail | undefined): string {
  const currentFunction = detail?.raw_data?.current_function;
  if (currentFunction && typeof currentFunction === 'object' && 'function_name' in currentFunction) {
    return String(currentFunction.function_name).replace(/^"+|"+$/g, '') || 'N/A';
  }
  return 'N/A';
}


function extractStatusCode(summary: string | null | undefined): string | null {
  if (!summary) {
    return null;
  }
  const match = summary.match(/\b(1337|1007|7331|3713)\b/);
  return match ? match[1] : null;
}


function riskScore(issue: IssueSummary): number {
  if (issue.manual_decision === 'True Positive') return 96;
  if (issue.manual_decision === 'False Positive') return 18;
  if (issue.manual_decision === 'Uncertain') return 58;
  if (issue.status === 'true') return 88;
  if (issue.status === 'more') return 64;
  if (issue.status === 'raw') return 48;
  return 28;
}


function pct(value: number, total: number): number {
  return total === 0 ? 0 : Math.round((value / total) * 100);
}


function countBy<T extends string>(items: T[]): Record<T, number> {
  return items.reduce((acc, item) => {
    acc[item] = (acc[item] ?? 0) + 1;
    return acc;
  }, {} as Record<T, number>);
}


function buildTimeline(logs: WsMessage[]) {
  let events = 0;
  let issueDecisions = 0;
  let errors = 0;

  return logs.map((log, index) => {
    events += 1;
    if (/Issue ID:\s*\d+,\s*LLM decision:/i.test(log.content)) {
      issueDecisions += 1;
    }
    if (log.type === 'error') {
      errors += 1;
    }
    return {
      index: index + 1,
      time: new Date(log.timestamp).toLocaleTimeString(),
      events,
      issueDecisions,
      errors,
    };
  });
}


function StatusPieChart({ data }: { data: ChartDatum[] }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <PieChart>
        <Pie data={data} dataKey="value" nameKey="name" innerRadius={58} outerRadius={92} paddingAngle={4}>
          {data.map((item) => (
            <Cell key={item.name} fill={STATUS_COLOR[item.statusKey]} />
          ))}
        </Pie>
        <Tooltip />
        <Legend />
      </PieChart>
    </ResponsiveContainer>
  );
}


function ManualStackChart({ data }: { data: Array<Record<string, number | string>> }) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data} layout="vertical" margin={{ left: 12, right: 18, top: 16, bottom: 16 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#dbeafe" />
        <XAxis type="number" allowDecimals={false} />
        <YAxis type="category" dataKey="name" width={98} />
        <Tooltip />
        <Legend />
        <Bar dataKey="True Positive" stackId="a" fill={MANUAL_COLORS['True Positive']} />
        <Bar dataKey="False Positive" stackId="a" fill={MANUAL_COLORS['False Positive']} />
        <Bar dataKey="Uncertain" stackId="a" fill={MANUAL_COLORS.Uncertain} />
        <Bar dataKey="Not Set" stackId="a" fill={MANUAL_COLORS['Not Set']} />
      </BarChart>
    </ResponsiveContainer>
  );
}


function FileRiskChart({ data }: { data: Array<{ file: string; risk: number; count: number }> }) {
  const { t } = useTranslation();
  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data} layout="vertical" margin={{ left: 8, right: 24, top: 12, bottom: 12 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#dbeafe" />
        <XAxis type="number" allowDecimals={false} />
        <YAxis type="category" dataKey="file" width={160} tick={{ fontSize: 11 }} />
        <Tooltip formatter={(value, name) => [value, name === 'risk' ? t('visualization.riskScoreTooltip') : name]} />
        <Bar dataKey="risk" fill="#0f766e" radius={[0, 8, 8, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}


function LogTimelineChart({ data }: { data: ReturnType<typeof buildTimeline> }) {
  const { t } = useTranslation();
  return (
    <ResponsiveContainer width="100%" height={260}>
      <LineChart data={data} margin={{ left: 8, right: 24, top: 12, bottom: 12 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#dbeafe" />
        <XAxis dataKey="index" tick={{ fontSize: 11 }} />
        <YAxis allowDecimals={false} />
        <Tooltip labelFormatter={(index) => t('visualization.eventFormat', { index })} />
        <Legend />
        <Line type="monotone" dataKey="events" stroke="#2563eb" strokeWidth={2} dot={false} />
        <Line type="monotone" dataKey="issueDecisions" stroke="#16a34a" strokeWidth={2} dot={false} />
        <Line type="monotone" dataKey="errors" stroke="#dc2626" strokeWidth={2} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}


export default function TaskVisualizationPage() {
  const { taskId } = useParams<{ taskId: string }>();
  const navigate = useNavigate();
  const tid = Number(taskId);
  const reportRef = useRef<HTMLDivElement>(null);
  const { t } = useTranslation();

  const [task, setTask] = useState<Task | null>(null);
  const [issues, setIssues] = useState<IssueSummary[]>([]);
  const [details, setDetails] = useState<Record<string, IssueDetail>>({});
  const [logs, setLogs] = useState<WsMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);

  const loadData = useCallback(async () => {
    if (!Number.isFinite(tid)) {
      return;
    }
    setLoading(true);
    try {
      const [taskData, logData] = await Promise.all([
        tasksApi.get(tid),
        tasksApi.logs(tid),
      ]);
      setTask(taskData);
      setLogs(logData.lines);

      if (!taskData.result_path) {
        setIssues([]);
        setDetails({});
        return;
      }

      const issueData = await resultsApi.listIssues(tid);
      setIssues(issueData);
      const detailResults = await Promise.allSettled(
        issueData.map(async (issue) => {
          const detail = await resultsApi.getIssue(tid, issue.key);
          return [issueKey(issue), detail] as const;
        }),
      );
      const nextDetails: Record<string, IssueDetail> = {};
      let failedDetails = 0;
      detailResults.forEach((result) => {
        if (result.status === 'fulfilled') {
          const [key, detail] = result.value;
          nextDetails[key] = detail;
        } else {
          failedDetails += 1;
        }
      });
      setDetails(nextDetails);
      if (failedDetails > 0) {
        message.warning(t('visualization.loadWarning', { count: failedDetails }));
      }
    } catch {
      message.error(t('visualization.loadError'));
    } finally {
      setLoading(false);
    }
  }, [tid]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const records = useMemo<RiskRecord[]>(() => (
    issues.map((issue) => {
      const detail = details[issueKey(issue)];
      const summary = detail?.summary ?? t('visualization.noSummary');
      return {
        ...issue,
        functionName: getFunctionName(detail),
        manualLabel: issue.manual_decision ?? 'Not Set',
        riskScore: riskScore(issue),
        statusCode: extractStatusCode(summary),
        summary,
        snippetPreview: detail?.snippets?.[0]?.content?.split('\n').slice(0, 8).join('\n') ?? t('visualization.noCodeContext'),
      };
    }).sort((a, b) => b.riskScore - a.riskScore || Number(a.id) - Number(b.id))
  ), [details, issues, t]);

  const total = issues.length;
  const statusCounts = useMemo(() => countBy(issues.map((issue) => issue.status)), [issues]);
  const manualCounts = useMemo(() => countBy(issues.map((issue) => issue.manual_decision ?? 'Not Set')), [issues]);
  const finalizedCount = useMemo(() => issues.filter((issue) => issue.finalized).length, [issues]);
  const manualCoverage = pct(issues.filter((issue) => issue.manual_decision).length, total);
  const finalizedRate = pct(finalizedCount, total);

  const statusPieData = useMemo<ChartDatum[]>(() => (
    DECISION_KEYS
      .map((key) => ({ name: t('decision.' + STATUS_TO_KEY[key]), value: statusCounts[key] ?? 0, statusKey: key }))
      .filter((item) => item.value > 0)
  ), [statusCounts, t]);

  const manualStackData = useMemo(() => ([{
    name: 'Manual review',
    'True Positive': manualCounts['True Positive'] ?? 0,
    'False Positive': manualCounts['False Positive'] ?? 0,
    Uncertain: manualCounts.Uncertain ?? 0,
    'Not Set': manualCounts['Not Set'] ?? 0,
  }]), [manualCounts]);

  const matrixRows = useMemo<MatrixRecord[]>(() => {
    const grouped = new Map<string, MatrixRecord>();
    issues.forEach((issue) => {
      const row = grouped.get(issue.issue_type) ?? {
        issueType: issue.issue_type,
        true: 0,
        false: 0,
        more: 0,
        raw: 0,
        total: 0,
      };
      row[issue.status] += 1;
      row.total += 1;
      grouped.set(issue.issue_type, row);
    });
    return Array.from(grouped.values()).sort((a, b) => b.total - a.total);
  }, [issues]);

  const topFiles = useMemo(() => {
    const grouped = new Map<string, { file: string; risk: number; count: number }>();
    records.forEach((record) => {
      const row = grouped.get(record.file) ?? { file: record.file, risk: 0, count: 0 };
      row.risk += record.riskScore;
      row.count += 1;
      grouped.set(record.file, row);
    });
    return Array.from(grouped.values()).sort((a, b) => b.risk - a.risk).slice(0, 8);
  }, [records]);

  const timelineData = useMemo(() => buildTimeline(logs), [logs]);
  const taskPresentation = task ? getTaskPresentation(task) : null;
  const sourceText = task ? `${t(`source.${task.source_type}`)} · ${task.repo_url}` : '';

  const matrixColumns: ColumnsType<MatrixRecord> = [
    { title: t('visualization.issueType'), dataIndex: 'issueType', render: (value: string) => <Text code>{value}</Text> },
    { title: t('visualization.matrixTP'), dataIndex: 'true', width: 80 },
    { title: t('visualization.matrixFP'), dataIndex: 'false', width: 80 },
    { title: t('visualization.matrixMore'), dataIndex: 'more', width: 90 },
    { title: t('visualization.matrixRaw'), dataIndex: 'raw', width: 80 },
    { title: t('visualization.matrixTotal'), dataIndex: 'total', width: 90 },
  ];

  const issueColumns: ColumnsType<RiskRecord> = [
    {
      title: t('table.id'),
      dataIndex: 'id',
      width: 70,
      sorter: (a, b) => Number(a.id) - Number(b.id),
    },
    {
      title: t('table.llmDecision'),
      dataIndex: 'status',
      width: 145,
      render: (status: string) => <Tag color={STATUS_COLOR[status]}>{t('decision.' + STATUS_TO_KEY[status])}</Tag>,
    },
    {
      title: t('table.manual'),
      dataIndex: 'manualLabel',
      width: 135,
      render: (value: string) => <Tag color={MANUAL_COLORS[value]}>{value}</Tag>,
    },
    {
      title: t('table.issueType'),
      dataIndex: 'issue_type',
      ellipsis: true,
      render: (value: string) => <Text code>{value}</Text>,
    },
    {
      title: t('table.fileLine'),
      width: 210,
      render: (_, record) => <Text code>{record.file}:{record.line}</Text>,
    },
    {
      title: t('table.function'),
      dataIndex: 'functionName',
      width: 190,
      ellipsis: true,
      render: (value: string) => <Text code>{value}</Text>,
    },
    {
      title: t('table.riskScore'),
      dataIndex: 'riskScore',
      width: 115,
      sorter: (a, b) => a.riskScore - b.riskScore,
      render: (value: number) => <Progress percent={value} size="small" showInfo strokeColor="#0f766e" />,
    },
  ];

  const exportPdf = useCallback(async () => {
    if (!reportRef.current) {
      message.error(t('visualization.containerNotReady'));
      return;
    }
    setExporting(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 160));
      const canvas = await html2canvas(reportRef.current, {
        backgroundColor: '#ffffff',
        scale: 2,
        useCORS: true,
        logging: false,
      });
      const imageData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const imageHeight = (canvas.height * pageWidth) / canvas.width;
      let heightLeft = imageHeight;
      let position = 0;

      pdf.addImage(imageData, 'PNG', 0, position, pageWidth, imageHeight);
      heightLeft -= pageHeight;

      while (heightLeft > 0) {
        position = heightLeft - imageHeight;
        pdf.addPage();
        pdf.addImage(imageData, 'PNG', 0, position, pageWidth, imageHeight);
        heightLeft -= pageHeight;
      }

      pdf.save(`vulnseeker-task-${tid}-analysis-report.pdf`);
      message.success(t('visualization.pdfExported'));
    } catch {
      message.error(t('visualization.pdfExportFailed'));
    } finally {
      setExporting(false);
    }
  }, [tid]);

  if (!task || loading) {
    return (
      <div style={{ minHeight: '50vh', display: 'grid', placeItems: 'center' }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div className="visualization-page">
      <Card className="visualization-hero">
        <Row justify="space-between" align="middle" gutter={[16, 16]}>
          <Col xs={24} lg={14}>
            <Space direction="vertical" size={10}>
              <Space wrap>
                <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(`/tasks/${tid}`)}>
                  {t('visualization.backToResults')}
                </Button>
                {taskPresentation && <Tag color={taskPresentation.color}>{t(`status.${taskPresentation.statusLabelKey}`)}</Tag>}
              </Space>
              <Title level={2} className="visualization-title">{t('visualization.title', { id: task.id })}</Title>
              <Paragraph className="visualization-subtitle">{sourceText}</Paragraph>
            </Space>
          </Col>
          <Col>
            <Space wrap>
              <Button icon={<ReloadOutlined />} onClick={() => void loadData()}>
                {t('visualization.reload')}
              </Button>
              <Button
                type="primary"
                icon={<DownloadOutlined />}
                loading={exporting}
                disabled={!task.result_path || total === 0}
                onClick={() => void exportPdf()}
              >
                {t('visualization.exportPdf')}
              </Button>
            </Space>
          </Col>
        </Row>
      </Card>

      {!task.result_path ? (
        <Card style={{ borderRadius: 24 }}>
          <Empty description={t('visualization.noResultSnapshot')} />
        </Card>
      ) : total === 0 ? (
        <Alert type="warning" showIcon message={t('visualization.noIssues')} />
      ) : (
        <>
          <Row gutter={[16, 16]} className="visualization-kpi-row">
            <Col xs={24} md={8} xl={4}>
              <Card className="kpi-card"><Statistic title={t('visualization.totalIssues')} value={total} /></Card>
            </Col>
            <Col xs={24} md={8} xl={4}>
              <Card className="kpi-card kpi-green"><Statistic title={t('visualization.truePositive')} value={statusCounts.true ?? 0} /></Card>
            </Col>
            <Col xs={24} md={8} xl={4}>
              <Card className="kpi-card kpi-red"><Statistic title={t('visualization.falsePositive')} value={statusCounts.false ?? 0} /></Card>
            </Col>
            <Col xs={24} md={8} xl={4}>
              <Card className="kpi-card kpi-amber"><Statistic title={t('visualization.needsMoreData')} value={statusCounts.more ?? 0} /></Card>
            </Col>
            <Col xs={24} md={8} xl={4}>
              <Card className="kpi-card"><Statistic title={t('visualization.manualCoverage')} value={manualCoverage} suffix="%" /></Card>
            </Col>
            <Col xs={24} md={8} xl={4}>
              <Card className="kpi-card"><Statistic title={t('visualization.finalizedRate')} value={finalizedRate} suffix="%" /></Card>
            </Col>
          </Row>

          <Row gutter={[16, 16]}>
            <Col xs={24} xl={8}>
              <Card className="visual-panel" title={t('visualization.llmDistribution')}>
                <StatusPieChart data={statusPieData} />
              </Card>
            </Col>
            <Col xs={24} xl={8}>
              <Card className="visual-panel" title={t('visualization.manualReviewStack')}>
                <ManualStackChart data={manualStackData} />
              </Card>
            </Col>
            <Col xs={24} xl={8}>
              <Card className="visual-panel" title={t('visualization.reviewMaturity')}>
                <Space direction="vertical" size={16} style={{ width: '100%' }}>
                  <div>
                    <Text strong>{t('visualization.manualReviewCoverage')}</Text>
                    <Progress percent={manualCoverage} strokeColor="#0f766e" />
                  </div>
                  <div>
                    <Text strong>{t('visualization.finalizedLlmAnalysis')}</Text>
                    <Progress percent={finalizedRate} strokeColor="#2563eb" />
                  </div>
                  <div className="maturity-note">
                    <FileSearchOutlined />
                    <Text>{t('visualization.maturityNote')}</Text>
                  </div>
                </Space>
              </Card>
            </Col>
          </Row>

          <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
            <Col xs={24} xl={12}>
              <Card className="visual-panel" title={t('visualization.topRiskFiles')}>
                <FileRiskChart data={topFiles} />
              </Card>
            </Col>
            <Col xs={24} xl={12}>
              <Card className="visual-panel" title={t('visualization.analysisLogTimeline')}>
                <LogTimelineChart data={timelineData} />
              </Card>
            </Col>
          </Row>

          <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
            <Col xs={24} xl={10}>
              <Card className="visual-panel" title={t('visualization.issueTypeMatrix')}>
                <Table
                  size="small"
                  columns={matrixColumns}
                  dataSource={matrixRows}
                  rowKey="issueType"
                  pagination={false}
                />
              </Card>
            </Col>
            <Col xs={24} xl={14}>
              <Card className="visual-panel" title={t('visualization.riskRankedTable')}>
                <Table
                  className="issue-explorer-table"
                  size="small"
                  columns={issueColumns}
                  dataSource={records}
                  rowKey={(record) => `${record.issue_type}-${record.id}`}
                  pagination={{ pageSize: 8, showSizeChanger: false }}
                  scroll={{ x: 980 }}
                />
              </Card>
            </Col>
          </Row>

          <Card className="visual-panel issue-narrative-panel" title={t('visualization.issueNarrativeEvidence')} style={{ marginTop: 16 }}>
            <Space direction="vertical" size={18} style={{ width: '100%' }}>
              {records.map((record) => (
                <div className="issue-narrative-card" key={`${record.issue_type}-${record.id}`}>
                  <Space wrap style={{ marginBottom: 8 }}>
                    <Tag color={STATUS_COLOR[record.status]}>{t('decision.' + STATUS_TO_KEY[record.status])}</Tag>
                    <Tag color={MANUAL_COLORS[record.manualLabel]}>{record.manualLabel}</Tag>
                    {record.statusCode && <Tag color="geekblue">{t('visualization.statusTag', { code: record.statusCode })}</Tag>}
                    <Text strong>Issue #{record.id}</Text>
                    <Text code>{record.file}:{record.line}</Text>
                    <Text code>{record.functionName}</Text>
                  </Space>
                  <MarkdownSummary content={record.summary} compact />
                </div>
              ))}
            </Space>
          </Card>
        </>
      )}

      <div className="pdf-report-stage" aria-hidden="true">
        <div className="pdf-report" ref={reportRef}>
          <div className="pdf-report-header">
            <Text className="pdf-eyebrow">{t('visualization.pdfReportTitle')}</Text>
            <Title level={1}>{t('visualization.pdfReportSubtitle', { id: task.id })}</Title>
            <Paragraph>{sourceText}</Paragraph>
            <Text type="secondary">{t('visualization.pdfGeneratedAt', { date: new Date().toLocaleString() })}</Text>
          </div>

          <Row gutter={[12, 12]} className="pdf-kpi-grid">
            <Col span={4}><Card><Statistic title={t('visualization.pdfTotal')} value={total} /></Card></Col>
            <Col span={4}><Card><Statistic title={t('visualization.pdfTP')} value={statusCounts.true ?? 0} /></Card></Col>
            <Col span={4}><Card><Statistic title={t('visualization.pdfFP')} value={statusCounts.false ?? 0} /></Card></Col>
            <Col span={4}><Card><Statistic title={t('visualization.pdfMore')} value={statusCounts.more ?? 0} /></Card></Col>
            <Col span={4}><Card><Statistic title={t('visualization.pdfManualPct')} value={manualCoverage} suffix="%" /></Card></Col>
            <Col span={4}><Card><Statistic title={t('visualization.pdfFinalPct')} value={finalizedRate} suffix="%" /></Card></Col>
          </Row>

          <Row gutter={[16, 16]} style={{ marginTop: 18 }}>
            <Col span={12}>
              <Card title={t('visualization.pdfLlmDistribution')}><StatusPieChart data={statusPieData} /></Card>
            </Col>
            <Col span={12}>
              <Card title={t('visualization.pdfTopRiskFiles')}><FileRiskChart data={topFiles} /></Card>
            </Col>
          </Row>

          <Card title={t('visualization.pdfRiskTable')} style={{ marginTop: 18 }}>
            <Table
              size="small"
              columns={issueColumns.filter((column) => column.title !== t('table.function'))}
              dataSource={records}
              rowKey={(record) => `${record.issue_type}-${record.id}`}
              pagination={false}
            />
          </Card>

          <Divider />
          <Title level={2}>{t('visualization.pdfEvidence')}</Title>
          {records.map((record) => (
            <div className="pdf-issue-block" key={`${record.issue_type}-${record.id}`}>
              <Space wrap style={{ marginBottom: 8 }}>
                <Tag color={STATUS_COLOR[record.status]}>{t('decision.' + STATUS_TO_KEY[record.status])}</Tag>
                <Tag color={MANUAL_COLORS[record.manualLabel]}>{record.manualLabel}</Tag>
                {record.statusCode && <Tag color="geekblue">{t('visualization.statusTag', { code: record.statusCode })}</Tag>}
                <Text strong>Issue #{record.id}</Text>
                <Text code>{record.issue_type}</Text>
                <Text code>{record.file}:{record.line}</Text>
                <Text code>{record.functionName}</Text>
              </Space>
              <MarkdownSummary content={record.summary} compact />
              <pre className="pdf-code-preview">{record.snippetPreview}</pre>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
