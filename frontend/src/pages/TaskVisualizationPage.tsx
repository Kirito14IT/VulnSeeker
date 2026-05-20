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

const SOURCE_LABEL: Record<string, string> = {
  github: 'GitHub DB',
  local_db: 'Local CodeQL DB',
  local_src: 'Local Source',
};

const STATUS_LABEL: Record<string, string> = {
  true: 'True Positive',
  false: 'False Positive',
  more: 'Needs More Data',
  raw: 'Raw Match',
};

const STATUS_COLOR: Record<string, string> = {
  true: '#22c55e',
  false: '#ef4444',
  more: '#f59e0b',
  raw: '#38bdf8',
};

const MANUAL_COLORS: Record<string, string> = {
  'True Positive': '#16a34a',
  'False Positive': '#dc2626',
  Uncertain: '#f59e0b',
  'Not Set': '#94a3b8',
};

type ChartDatum = {
  name: string;
  value: number;
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
  return `${issue.issue_type}:${issue.id}`;
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
          {data.map((item) => {
            const status = Object.entries(STATUS_LABEL).find(([, label]) => label === item.name)?.[0] ?? 'raw';
            return <Cell key={item.name} fill={STATUS_COLOR[status]} />;
          })}
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
  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data} layout="vertical" margin={{ left: 8, right: 24, top: 12, bottom: 12 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#dbeafe" />
        <XAxis type="number" allowDecimals={false} />
        <YAxis type="category" dataKey="file" width={160} tick={{ fontSize: 11 }} />
        <Tooltip formatter={(value, name) => [value, name === 'risk' ? 'Risk score' : name]} />
        <Bar dataKey="risk" fill="#0f766e" radius={[0, 8, 8, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}


function LogTimelineChart({ data }: { data: ReturnType<typeof buildTimeline> }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <LineChart data={data} margin={{ left: 8, right: 24, top: 12, bottom: 12 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#dbeafe" />
        <XAxis dataKey="index" tick={{ fontSize: 11 }} />
        <YAxis allowDecimals={false} />
        <Tooltip labelFormatter={(index) => `Event #${index}`} />
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
          const detail = await resultsApi.getIssue(tid, issue.id);
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
        message.warning(`Loaded issues, but ${failedDetails} issue detail request(s) failed.`);
      }
    } catch {
      message.error('Failed to load visualization data');
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
      const summary = detail?.summary ?? 'No summary available';
      return {
        ...issue,
        functionName: getFunctionName(detail),
        manualLabel: issue.manual_decision ?? 'Not Set',
        riskScore: riskScore(issue),
        statusCode: extractStatusCode(summary),
        summary,
        snippetPreview: detail?.snippets?.[0]?.content?.split('\n').slice(0, 8).join('\n') ?? 'No code context available',
      };
    }).sort((a, b) => b.riskScore - a.riskScore || Number(a.id) - Number(b.id))
  ), [details, issues]);

  const total = issues.length;
  const statusCounts = useMemo(() => countBy(issues.map((issue) => issue.status)), [issues]);
  const manualCounts = useMemo(() => countBy(issues.map((issue) => issue.manual_decision ?? 'Not Set')), [issues]);
  const finalizedCount = useMemo(() => issues.filter((issue) => issue.finalized).length, [issues]);
  const manualCoverage = pct(issues.filter((issue) => issue.manual_decision).length, total);
  const finalizedRate = pct(finalizedCount, total);

  const statusPieData = useMemo<ChartDatum[]>(() => (
    (['true', 'false', 'more', 'raw'] as const)
      .map((status) => ({ name: STATUS_LABEL[status], value: statusCounts[status] ?? 0 }))
      .filter((item) => item.value > 0)
  ), [statusCounts]);

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
  const sourceText = task ? `${SOURCE_LABEL[task.source_type] ?? task.source_type} · ${task.repo_url}` : '';

  const matrixColumns: ColumnsType<MatrixRecord> = [
    { title: 'Issue Type', dataIndex: 'issueType', render: (value: string) => <Text code>{value}</Text> },
    { title: 'TP', dataIndex: 'true', width: 80 },
    { title: 'FP', dataIndex: 'false', width: 80 },
    { title: 'More', dataIndex: 'more', width: 90 },
    { title: 'Raw', dataIndex: 'raw', width: 80 },
    { title: 'Total', dataIndex: 'total', width: 90 },
  ];

  const issueColumns: ColumnsType<RiskRecord> = [
    {
      title: 'ID',
      dataIndex: 'id',
      width: 70,
      sorter: (a, b) => Number(a.id) - Number(b.id),
    },
    {
      title: 'LLM Decision',
      dataIndex: 'status',
      width: 145,
      render: (status: string) => <Tag color={STATUS_COLOR[status]}>{STATUS_LABEL[status] ?? status}</Tag>,
    },
    {
      title: 'Manual',
      dataIndex: 'manualLabel',
      width: 135,
      render: (value: string) => <Tag color={MANUAL_COLORS[value]}>{value}</Tag>,
    },
    {
      title: 'Issue Type',
      dataIndex: 'issue_type',
      ellipsis: true,
      render: (value: string) => <Text code>{value}</Text>,
    },
    {
      title: 'File:Line',
      width: 210,
      render: (_, record) => <Text code>{record.file}:{record.line}</Text>,
    },
    {
      title: 'Function',
      dataIndex: 'functionName',
      width: 190,
      ellipsis: true,
      render: (value: string) => <Text code>{value}</Text>,
    },
    {
      title: 'Risk Score',
      dataIndex: 'riskScore',
      width: 115,
      sorter: (a, b) => a.riskScore - b.riskScore,
      render: (value: number) => <Progress percent={value} size="small" showInfo strokeColor="#0f766e" />,
    },
  ];

  const exportPdf = useCallback(async () => {
    if (!reportRef.current) {
      message.error('Report container is not ready');
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
      message.success('PDF report exported');
    } catch {
      message.error('Failed to export PDF report');
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
                  Back to Results
                </Button>
                {taskPresentation && <Tag color={taskPresentation.color}>{taskPresentation.statusLabel}</Tag>}
              </Space>
              <Title level={2} className="visualization-title">Task #{task.id} Analysis Observatory</Title>
              <Paragraph className="visualization-subtitle">{sourceText}</Paragraph>
            </Space>
          </Col>
          <Col>
            <Space wrap>
              <Button icon={<ReloadOutlined />} onClick={() => void loadData()}>
                Reload
              </Button>
              <Button
                type="primary"
                icon={<DownloadOutlined />}
                loading={exporting}
                disabled={!task.result_path || total === 0}
                onClick={() => void exportPdf()}
              >
                Export PDF Report
              </Button>
            </Space>
          </Col>
        </Row>
      </Card>

      {!task.result_path ? (
        <Card style={{ borderRadius: 24 }}>
          <Empty description="This task has no result snapshot yet. Run or finish analysis before opening visualization." />
        </Card>
      ) : total === 0 ? (
        <Alert type="warning" showIcon message="No issues available for visualization." />
      ) : (
        <>
          <Row gutter={[16, 16]} className="visualization-kpi-row">
            <Col xs={24} md={8} xl={4}>
              <Card className="kpi-card"><Statistic title="Total Issues" value={total} /></Card>
            </Col>
            <Col xs={24} md={8} xl={4}>
              <Card className="kpi-card kpi-green"><Statistic title="True Positive" value={statusCounts.true ?? 0} /></Card>
            </Col>
            <Col xs={24} md={8} xl={4}>
              <Card className="kpi-card kpi-red"><Statistic title="False Positive" value={statusCounts.false ?? 0} /></Card>
            </Col>
            <Col xs={24} md={8} xl={4}>
              <Card className="kpi-card kpi-amber"><Statistic title="Needs More Data" value={statusCounts.more ?? 0} /></Card>
            </Col>
            <Col xs={24} md={8} xl={4}>
              <Card className="kpi-card"><Statistic title="Manual Coverage" value={manualCoverage} suffix="%" /></Card>
            </Col>
            <Col xs={24} md={8} xl={4}>
              <Card className="kpi-card"><Statistic title="Finalized Rate" value={finalizedRate} suffix="%" /></Card>
            </Col>
          </Row>

          <Row gutter={[16, 16]}>
            <Col xs={24} xl={8}>
              <Card className="visual-panel" title="LLM Decision Distribution">
                <StatusPieChart data={statusPieData} />
              </Card>
            </Col>
            <Col xs={24} xl={8}>
              <Card className="visual-panel" title="Manual Review Stack">
                <ManualStackChart data={manualStackData} />
              </Card>
            </Col>
            <Col xs={24} xl={8}>
              <Card className="visual-panel" title="Review Maturity">
                <Space direction="vertical" size={16} style={{ width: '100%' }}>
                  <div>
                    <Text strong>Manual Review Coverage</Text>
                    <Progress percent={manualCoverage} strokeColor="#0f766e" />
                  </div>
                  <div>
                    <Text strong>Finalized LLM Analysis</Text>
                    <Progress percent={finalizedRate} strokeColor="#2563eb" />
                  </div>
                  <div className="maturity-note">
                    <FileSearchOutlined />
                    <Text>Manual decisions and LLM finalization are separated so reviewers can audit model verdicts independently.</Text>
                  </div>
                </Space>
              </Card>
            </Col>
          </Row>

          <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
            <Col xs={24} xl={12}>
              <Card className="visual-panel" title="Top Risk Files">
                <FileRiskChart data={topFiles} />
              </Card>
            </Col>
            <Col xs={24} xl={12}>
              <Card className="visual-panel" title="Analysis Log Timeline">
                <LogTimelineChart data={timelineData} />
              </Card>
            </Col>
          </Row>

          <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
            <Col xs={24} xl={10}>
              <Card className="visual-panel" title="Issue Type × Decision Matrix">
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
              <Card className="visual-panel" title="Risk-ranked Issue Table">
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

          <Card className="visual-panel issue-narrative-panel" title="Issue Narrative Evidence" style={{ marginTop: 16 }}>
            <Space direction="vertical" size={18} style={{ width: '100%' }}>
              {records.map((record) => (
                <div className="issue-narrative-card" key={`${record.issue_type}-${record.id}`}>
                  <Space wrap style={{ marginBottom: 8 }}>
                    <Tag color={STATUS_COLOR[record.status]}>{STATUS_LABEL[record.status] ?? record.status}</Tag>
                    <Tag color={MANUAL_COLORS[record.manualLabel]}>{record.manualLabel}</Tag>
                    {record.statusCode && <Tag color="geekblue">status {record.statusCode}</Tag>}
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
            <Text className="pdf-eyebrow">VulnSeeker Research Report</Text>
            <Title level={1}>Task #{task.id} Code Analysis Report</Title>
            <Paragraph>{sourceText}</Paragraph>
            <Text type="secondary">Generated at {new Date().toLocaleString()}</Text>
          </div>

          <Row gutter={[12, 12]} className="pdf-kpi-grid">
            <Col span={4}><Card><Statistic title="Total" value={total} /></Card></Col>
            <Col span={4}><Card><Statistic title="TP" value={statusCounts.true ?? 0} /></Card></Col>
            <Col span={4}><Card><Statistic title="FP" value={statusCounts.false ?? 0} /></Card></Col>
            <Col span={4}><Card><Statistic title="More" value={statusCounts.more ?? 0} /></Card></Col>
            <Col span={4}><Card><Statistic title="Manual %" value={manualCoverage} suffix="%" /></Card></Col>
            <Col span={4}><Card><Statistic title="Final %" value={finalizedRate} suffix="%" /></Card></Col>
          </Row>

          <Row gutter={[16, 16]} style={{ marginTop: 18 }}>
            <Col span={12}>
              <Card title="LLM Decision Distribution"><StatusPieChart data={statusPieData} /></Card>
            </Col>
            <Col span={12}>
              <Card title="Top Risk Files"><FileRiskChart data={topFiles} /></Card>
            </Col>
          </Row>

          <Card title="Risk-ranked Issue Table" style={{ marginTop: 18 }}>
            <Table
              size="small"
              columns={issueColumns.filter((column) => column.title !== 'Function')}
              dataSource={records}
              rowKey={(record) => `${record.issue_type}-${record.id}`}
              pagination={false}
            />
          </Card>

          <Divider />
          <Title level={2}>Issue-level Analysis Evidence</Title>
          {records.map((record) => (
            <div className="pdf-issue-block" key={`${record.issue_type}-${record.id}`}>
              <Space wrap style={{ marginBottom: 8 }}>
                <Tag color={STATUS_COLOR[record.status]}>{STATUS_LABEL[record.status] ?? record.status}</Tag>
                <Tag color={MANUAL_COLORS[record.manualLabel]}>{record.manualLabel}</Tag>
                {record.statusCode && <Tag color="geekblue">status {record.statusCode}</Tag>}
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
