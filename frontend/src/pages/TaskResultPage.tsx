import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Alert, Button, Card, Col, Empty, Row, Space, Spin, Tag, Typography, message } from 'antd';
import {
  ArrowLeftOutlined,
  PlayCircleOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import { io } from 'socket.io-client';

import { tasksApi, resultsApi } from '../api';
import IssueExplorer from '../components/IssueExplorer';
import type { IssueDetail, IssueSummary, Task, WsMessage } from '../types';
import { getTaskPresentation } from '../utils/taskPresentation';


const { Title, Text } = Typography;
const SOURCE_LABEL: Record<string, string> = {
  github: 'GitHub DB',
  local_db: 'Local CodeQL DB',
  local_src: 'Local Source',
};

const TASK_PANELS_HEIGHT = 812;

function canLoadIssueResults(task: Task | null | undefined): boolean {
  return Boolean(task?.result_path);
}


export default function TaskResultPage() {
  const { taskId } = useParams<{ taskId: string }>();
  const navigate = useNavigate();
  const tid = Number(taskId);
  const logContainerRef = useRef<HTMLDivElement>(null);
  const shouldStickLogsRef = useRef(true);
  const taskRef = useRef<Task | null>(null);

  const [task, setTask] = useState<Task | null>(null);
  const [issues, setIssues] = useState<IssueSummary[]>([]);
  const [selectedIssue, setSelectedIssue] = useState<IssueSummary | null>(null);
  const [issueDetail, setIssueDetail] = useState<IssueDetail | null>(null);
  const [logs, setLogs] = useState<WsMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);

  useEffect(() => {
    taskRef.current = task;
  }, [task]);

  const loadTask = useCallback(async () => {
    const data = await tasksApi.get(tid);
    setTask(data);
    return data;
  }, [tid]);

  const loadLogs = useCallback(async () => {
    try {
      const response = await tasksApi.logs(tid);
      setLogs(response.lines);
    } catch {
      message.error('Failed to load persisted logs');
    }
  }, [tid]);

  const loadIssues = useCallback(async (targetTask?: Task | null) => {
    const activeTask = targetTask ?? taskRef.current;
    if (!canLoadIssueResults(activeTask)) {
      return;
    }
    setLoading(true);
    try {
      const data = await resultsApi.listIssues(tid);
      setIssues(data);
    } catch {
      message.error('Failed to load issues');
    } finally {
      setLoading(false);
    }
  }, [tid]);

  const loadIssueDetail = useCallback(async (issue: IssueSummary) => {
    setSelectedIssue(issue);
    setDetailLoading(true);
    try {
      const detail = await resultsApi.getIssue(tid, issue.id);
      setIssueDetail(detail);
    } catch {
      message.error('Failed to load issue detail');
    } finally {
      setDetailLoading(false);
    }
  }, [tid]);

  const handleDecisionChange = useCallback(async (issueId: string, decision: string | null) => {
    try {
      await resultsApi.updateDecision(tid, issueId, decision);
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
  }, [tid]);

  useEffect(() => {
    if (!taskId) {
      return;
    }

    const socket = io(import.meta.env.VITE_API_BASE || undefined, {
      path: '/socket.io',
      transports: ['websocket'],
      reconnection: true,
    });

    socket.on('connect', () => {
      socket.emit('join_task', { task_id: taskId });
    });
    socket.on(`task_${taskId}`, (msg: WsMessage) => {
      setLogs((previous) => {
        const last = previous[previous.length - 1];
        if (last
          && last.timestamp === msg.timestamp
          && last.type === msg.type
          && last.content === msg.content) {
          return previous;
        }
        return [...previous, msg];
      });
    });

    void (async () => {
      const currentTask = await loadTask();
      await loadLogs();
      if (canLoadIssueResults(currentTask)) {
        await loadIssues(currentTask);
      }
    })();

    return () => {
      socket.disconnect();
    };
  }, [loadIssues, loadLogs, loadTask, taskId]);

  useEffect(() => {
    const container = logContainerRef.current;
    if (!container || !shouldStickLogsRef.current) {
      return;
    }
    container.scrollTop = container.scrollHeight;
  }, [logs]);

  useEffect(() => {
    if (task?.status !== 'running') {
      return;
    }

    const timer = setInterval(() => {
      void loadTask().then((updatedTask) => {
        if (canLoadIssueResults(updatedTask)) {
          void loadIssues(updatedTask);
        }
      });
    }, 5000);
    return () => clearInterval(timer);
  }, [loadIssues, loadTask, task?.status]);

  const handleLogScroll = useCallback(() => {
    const container = logContainerRef.current;
    if (!container) {
      return;
    }
    const distanceFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
    shouldStickLogsRef.current = distanceFromBottom < 48;
  }, []);

  const sourceText = useMemo(() => {
    if (!task) {
      return '';
    }
    return `${SOURCE_LABEL[task.source_type] ?? task.source_type} · ${task.repo_url}`;
  }, [task]);

  if (!task) {
    return (
      <div style={{ minHeight: '50vh', display: 'grid', placeItems: 'center' }}>
        <Spin size="large" />
      </div>
    );
  }

  const isPending = task.status === 'pending';
  const isRunning = task.status === 'running';
  const isCompleted = task.status === 'completed';
  const isFailed = task.status === 'failed';
  const taskPresentation = getTaskPresentation(task);

  return (
    <div style={{ padding: 24 }}>
      <Card
        style={{
          marginBottom: 16,
          borderRadius: 28,
          border: '1px solid #dbe7f4',
          background:
            'radial-gradient(circle at top left, rgba(255,255,255,0.98), rgba(238,246,255,0.95) 48%, rgba(248,250,252,0.98) 100%)',
          boxShadow: '0 24px 60px rgba(15, 23, 42, 0.08)',
        }}
      >
        <Row justify="space-between" gutter={[16, 16]} align="middle">
          <Col>
            <Space direction="vertical" size={6}>
              <Space>
                <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/')}>
                  Back
                </Button>
                <Tag color={taskPresentation.color} style={{ paddingInline: 10 }}>
                  {taskPresentation.statusLabel}
                </Tag>
              </Space>
              <Title level={3} style={{ margin: 0, fontFamily: 'Georgia, serif' }}>
                Task #{task.id}
              </Title>
              <Text type="secondary">{sourceText}</Text>
            </Space>
          </Col>
          <Col>
            <Space wrap>
              {(isPending || isFailed) && (
                <Button
                  type="primary"
                  icon={<PlayCircleOutlined />}
                  onClick={async () => {
                    try {
                      await tasksApi.start(tid);
                  await loadTask();
                  await loadLogs();
                      setIssues([]);
                      setSelectedIssue(null);
                      setIssueDetail(null);
                      message.success(isFailed ? 'Task restarted' : 'Task started');
                    } catch (error: unknown) {
                      const response = error as { response?: { data?: { detail?: string } } };
                      message.error(response.response?.data?.detail ?? 'Failed to start task');
                    }
                  }}
                >
                  {isFailed ? 'Retry Analysis' : 'Start Analysis'}
                </Button>
              )}
              <Button icon={<ReloadOutlined />} onClick={() => {
                void loadTask().then((updatedTask) => {
                  void loadLogs();
                  if (canLoadIssueResults(updatedTask)) {
                    void loadIssues(updatedTask);
                  }
                });
              }}>
                Refresh
              </Button>
            </Space>
          </Col>
        </Row>
      </Card>

      {task.error_message && (
        <Card
          style={{
            marginBottom: 16,
            borderRadius: 20,
            borderColor: taskPresentation.isPartialLlmFailure ? '#facc15' : '#fecaca',
            background: taskPresentation.isPartialLlmFailure ? '#fffbea' : '#fff5f5',
          }}
        >
          {taskPresentation.isPartialLlmFailure ? (
            <Space direction="vertical" size={8}>
              <Text strong style={{ color: '#a16207' }}>
                CodeQL found {taskPresentation.rawCount} raw issue(s), but the LLM stage did not finish.
              </Text>
              <Text type="secondary">
                This is usually an LLM connectivity or provider problem, not a CodeQL detection problem.
              </Text>
              <Text style={{ color: '#92400e' }}>{task.error_message}</Text>
            </Space>
          ) : (
            <Text type="danger">{task.error_message}</Text>
          )}
        </Card>
      )}

      <Row gutter={16} align="top">
        <Col xs={24} xl={7}>
          <Card
            title="Execution Log"
            size="small"
            extra={<Text type="secondary">{logs.length} lines</Text>}
            style={{
              borderRadius: 24,
              height: TASK_PANELS_HEIGHT,
              border: '1px solid #dbe7f4',
              background: 'linear-gradient(180deg, #0f172a 0%, #111827 100%)',
              boxShadow: '0 18px 50px rgba(15, 23, 42, 0.18)',
            }}
            headStyle={{ color: '#f8fafc', borderBottomColor: 'rgba(255,255,255,0.08)' }}
            bodyStyle={{ padding: 0, height: TASK_PANELS_HEIGHT - 56, overflow: 'hidden' }}
          >
            {logs.length === 0 ? (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description={<span style={{ color: '#94a3b8' }}>No persisted logs yet</span>}
                style={{ marginTop: 120 }}
              />
            ) : (
              <div
                ref={logContainerRef}
                onScroll={handleLogScroll}
                style={{ height: TASK_PANELS_HEIGHT - 56, overflow: 'auto', padding: 16 }}
              >
                {logs.map((log, index) => (
                  <div
                    key={`${log.timestamp}-${index}`}
                    style={{
                      color: log.type === 'error'
                        ? '#fca5a5'
                        : log.type === 'done'
                          ? '#86efac'
                          : log.type === 'status'
                            ? '#7dd3fc'
                            : '#e2e8f0',
                      fontFamily: 'JetBrains Mono, Fira Code, monospace',
                      fontSize: 12,
                      marginBottom: 10,
                      whiteSpace: 'pre-wrap',
                    }}
                  >
                    [{new Date(log.timestamp).toLocaleTimeString()}] {log.content}
                  </div>
                ))}
              </div>
            )}
          </Card>
        </Col>

        <Col xs={24} xl={17}>
          {isCompleted ? (
            <IssueExplorer
              issues={issues}
              loading={loading}
              selectedIssue={selectedIssue}
              issueDetail={issueDetail}
              detailLoading={detailLoading}
              onIssueSelect={loadIssueDetail}
              onDecisionChange={handleDecisionChange}
            />
          ) : taskPresentation.isPartialLlmFailure ? (
            <Space direction="vertical" size={16} style={{ width: '100%' }}>
              <Card style={{ borderRadius: 24 }}>
                <Alert
                  type="warning"
                  showIcon
                  message="Partial analysis result"
                  description={`CodeQL found ${taskPresentation.rawCount} raw issue(s), but the LLM stage produced ${taskPresentation.finalCount} finalized result(s). Raw matches are still available below.`}
                />
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
            </Space>
          ) : isPending ? (
            <Card style={{ borderRadius: 24 }}>
              <Empty description="This task has not started yet. Start the analysis to generate results." />
            </Card>
          ) : isRunning ? (
            <Card style={{ borderRadius: 24 }}>
              <Empty description="Analysis is running. Results will appear here as soon as the task completes." />
            </Card>
          ) : (
            <Card style={{ borderRadius: 24 }}>
              <Empty description="Task failed before results were generated." />
            </Card>
          )}
        </Col>
      </Row>
    </div>
  );
}
