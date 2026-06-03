import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Alert, Button, Col, Empty, Row, Space, Spin, Tag, Typography, message } from 'antd';
import {
  ArrowLeftOutlined,
  BarChartOutlined,
  PlayCircleOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { io } from 'socket.io-client';

import { tasksApi, resultsApi } from '../api';
import IssueExplorer from '../components/IssueExplorer';
import { useAuthStore } from '../stores/authStore';
import type { IssueDetail, IssueSummary, Task, WsMessage } from '../types';
import { getTaskPresentation } from '../utils/taskPresentation';

const { Title, Text } = Typography;

const TASK_PANELS_HEIGHT = 812;

function canLoadIssueResults(task: Task | null | undefined): boolean {
  return Boolean(task?.result_path);
}

export default function TaskResultPage() {
  const { taskId } = useParams<{ taskId: string }>();
  const navigate = useNavigate();
  const tid = Number(taskId);
  const user = useAuthStore((s) => s.user);
  const backPath = user?.role === 'admin' ? '/admin' : '/';
  const logContainerRef = useRef<HTMLDivElement>(null);
  const shouldStickLogsRef = useRef(true);
  const taskRef = useRef<Task | null>(null);
  const activeTaskIdRef = useRef<number | null>(null);
  const { t } = useTranslation();

  const [task, setTask] = useState<Task | null>(null);
  const [issues, setIssues] = useState<IssueSummary[]>([]);
  const [selectedIssue, setSelectedIssue] = useState<IssueSummary | null>(null);
  const [issueDetail, setIssueDetail] = useState<IssueDetail | null>(null);
  const [logs, setLogs] = useState<WsMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    taskRef.current = task;
  }, [task]);

  useEffect(() => {
    activeTaskIdRef.current = tid;
    taskRef.current = null;
    shouldStickLogsRef.current = true;
    setTask(null);
    setIssues([]);
    setSelectedIssue(null);
    setIssueDetail(null);
    setLogs([]);
    setLoading(false);
    setDetailLoading(false);
    setLoadError(null);
  }, [tid]);

  const loadTask = useCallback(async () => {
    // NaN-safe comparison — NaN !== NaN in JS, so a plain === check
    // would silently drop the error when taskId is non-numeric.
    const isCurrentTask = Number.isNaN(tid)
      ? Number.isNaN(activeTaskIdRef.current)
      : activeTaskIdRef.current === tid;

    try {
      const data = await tasksApi.get(tid);
      if (isCurrentTask) {
        setTask(data);
        setLoadError(null);
      }
      return data;
    } catch (err: unknown) {
      const axiosErr = err as { response?: { status?: number; data?: { detail?: unknown } } };
      const status = axiosErr.response?.status;
      if (isCurrentTask) {
        setTask(null);
        if (status === 404) {
          setLoadError(t('taskResult.taskNotFound'));
        } else if (status === 422) {
          // FastAPI validation error (e.g. non-numeric task ID like /tasks/abc)
          message.error(t('taskResult.invalidTaskId'));
          setLoadError(t('taskResult.invalidTaskId'));
        } else {
          setLoadError(t('taskResult.loadError'));
        }
      }
      return null;
    }
  }, [tid, t]);

  const loadLogs = useCallback(async () => {
    try {
      const response = await tasksApi.logs(tid);
      if (activeTaskIdRef.current === tid) {
        setLogs(response.lines);
      }
    } catch {
      message.error(t('taskResult.logsLoadFailed'));
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
      if (activeTaskIdRef.current === tid) {
        setIssues(data);
      }
    } catch {
      message.error(t('taskResult.issuesLoadFailed'));
    } finally {
      if (activeTaskIdRef.current === tid) {
        setLoading(false);
      }
    }
  }, [tid]);

  const loadIssueDetail = useCallback(async (issue: IssueSummary) => {
    setSelectedIssue(issue);
    setDetailLoading(true);
    try {
      const detail = await resultsApi.getIssue(tid, issue.key);
      if (activeTaskIdRef.current === tid) {
        setIssueDetail(detail);
      }
    } catch {
      message.error(t('taskResult.detailLoadFailed'));
    } finally {
      if (activeTaskIdRef.current === tid) {
        setDetailLoading(false);
      }
    }
  }, [tid]);

  const handleDecisionChange = useCallback(async (issueId: string, decision: string | null) => {
    try {
      await resultsApi.updateDecision(tid, issueId, decision);
      setIssues((previous) => previous.map((issue) => (
        issue.key === issueId ? { ...issue, manual_decision: decision } : issue
      )));
      setSelectedIssue((previous) => (
        previous && previous.key === issueId ? { ...previous, manual_decision: decision } : previous
      ));
      setIssueDetail((previous) => (
        previous && previous.key === issueId ? { ...previous, manual_decision: decision } : previous
      ));
      message.success(decision ? t('taskResult.decisionSaved') : t('taskResult.decisionCleared'));
    } catch {
      message.error(t('taskResult.decisionSaveFailed'));
    }
  }, [tid]);

  useEffect(() => {
    if (!taskId) {
      return;
    }

    const socket = io(import.meta.env.VITE_API_BASE || undefined, {
      path: '/socket.io',
      transports: ['polling', 'websocket'],
      reconnection: true,
    });

    socket.on('connect_error', (err) => {
      console.error('socket connect_error:', err.message, err);
    });

    socket.on('connect', () => {
      socket.emit('join_task', { task_id: taskId });
    });
    socket.on(`task_${taskId}`, (msg: WsMessage) => {
      if (activeTaskIdRef.current !== tid) {
        return;
      }
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
      if (activeTaskIdRef.current !== tid) {
        return;
      }
      await loadLogs();
      if (activeTaskIdRef.current !== tid) {
        return;
      }
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
    return `${t(`source.${task.source_type}`)} · ${task.repo_url}`;
  }, [task, t]);

  if (!task) {
    return (
      <div style={{ minHeight: '50vh', display: 'grid', placeItems: 'center' }}>
        {loadError ? (
          <div className="content-card" style={{ maxWidth: 480, textAlign: 'center', padding: 32 }}>
            <Space direction="vertical" size={16}>
              <Text type="danger" style={{ fontSize: 16 }}>{loadError}</Text>
              <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(backPath)}>
                {t('taskResult.back')}
              </Button>
            </Space>
          </div>
        ) : (
          <Spin size="large" />
        )}
      </div>
    );
  }

  const isPending = task.status === 'pending';
  const isRunning = task.status === 'running';
  const isCompleted = task.status === 'completed';
  const isFailed = task.status === 'failed';
  const taskPresentation = getTaskPresentation(task);

  return (
    <>
      {/* Hero */}
      <div className="hero-card" style={{ padding: '20px 28px', marginBottom: 20 }}>
        <Row justify="space-between" gutter={[16, 16]} align="middle">
          <Col>
            <Space direction="vertical" size={6}>
              <Space>
                <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(backPath)}>
                  {t('taskResult.back')}
                </Button>
                <Tag color={taskPresentation.color} style={{ paddingInline: 10 }}>
                  {t(`status.${taskPresentation.statusLabelKey}`)}
                </Tag>
              </Space>
              <Title level={3} className="hero-title" style={{ margin: 0 }}>
                {t('taskResult.taskLabel', { id: task.id })}
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
                      message.success(isFailed ? t('taskResult.restarted') : t('taskResult.started'));
                    } catch (error: unknown) {
                      const response = error as { response?: { data?: { detail?: string } } };
                      message.error(response.response?.data?.detail ?? t('taskResult.startFailed'));
                    }
                  }}
                >
                  {isFailed ? t('taskResult.retryAnalysis') : t('taskResult.startAnalysis')}
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
                {t('taskResult.refresh')}
              </Button>
              {canLoadIssueResults(task) && (
                <Button
                  icon={<BarChartOutlined />}
                  onClick={() => navigate(`/tasks/${tid}/visualization`)}
                >
                  {t('taskResult.visualizationReport')}
                </Button>
              )}
            </Space>
          </Col>
        </Row>
      </div>

      {/* Error message */}
      {task.error_message && (
        <div
          style={{
            marginBottom: 20,
            borderRadius: 'var(--radius-md)',
            border: `1px solid ${taskPresentation.isPartialLlmFailure ? '#facc15' : 'var(--error)'}`,
            background: taskPresentation.isPartialLlmFailure ? 'var(--warning-soft)' : 'var(--error-soft)',
            padding: '16px 20px',
          }}
        >
          {taskPresentation.isPartialLlmFailure ? (
            <Space direction="vertical" size={8}>
              <Text strong style={{ color: 'var(--warning)' }}>
                {t('taskResult.partialWarning', { rawCount: taskPresentation.rawCount })}
              </Text>
              <Text type="secondary">{t('taskResult.partialHint')}</Text>
              <Text style={{ color: 'var(--text-secondary)' }}>{task.error_message}</Text>
            </Space>
          ) : (
            <Text type="danger">{task.error_message}</Text>
          )}
        </div>
      )}

      {/* Log + Issue panels */}
      <Row gutter={16} align="top">
        {/* Execution log */}
        <Col xs={24} xl={7}>
          <div className="log-panel" style={{ height: TASK_PANELS_HEIGHT }}>
            <div style={{
              padding: '14px 20px',
              borderBottom: '1px solid var(--log-border)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}>
              <Space>
                {task?.status === 'running' ? <span className="status-dot running" aria-label="running" /> : null}
                <Text strong style={{ color: 'var(--log-text)', fontFamily: 'var(--font-heading)' }}>
                  {t('taskResult.executionLog')}
                </Text>
              </Space>
              <Text style={{ color: 'var(--log-text-dim)', fontSize: 12 }}>
                {t('taskResult.lines', { count: logs.length })}
              </Text>
            </div>
            <div style={{ height: TASK_PANELS_HEIGHT - 57, overflow: 'hidden' }}>
              {logs.length === 0 ? (
                <Empty
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  description={<span style={{ color: 'var(--text-tertiary)' }}>{t('taskResult.noLogs')}</span>}
                  style={{ marginTop: 120 }}
                />
              ) : (
                <div
                  ref={logContainerRef}
                  onScroll={handleLogScroll}
                  style={{ height: TASK_PANELS_HEIGHT - 57, overflow: 'auto', padding: 16 }}
                >
                  {logs.map((log, index) => {
                    const className = `log-line log-line-${log.type === 'error' ? 'error' : log.type === 'done' ? 'done' : log.type === 'status' ? 'status' : 'info'}`;
                    return (
                      <div
                        key={`${log.timestamp}-${index}`}
                        className={className}
                        style={{ marginBottom: 8 }}
                      >
                        [{new Date(log.timestamp).toLocaleTimeString()}] {log.content}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </Col>

        {/* Issue explorer */}
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
              <div className="content-card" style={{ padding: 20 }}>
                <Alert
                  type="warning"
                  showIcon
                  message={t('taskResult.partialResult')}
                  description={t('taskResult.partialResultDesc', {
                    rawCount: taskPresentation.rawCount,
                    finalCount: taskPresentation.finalCount,
                  })}
                />
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
            </Space>
          ) : isPending ? (
            <div className="content-card" style={{ padding: 32 }}>
              <Empty description={t('taskResult.notStarted')} />
            </div>
          ) : isRunning ? (
            <div className="content-card" style={{ padding: 32 }}>
              <Empty description={t('taskResult.running')} />
            </div>
          ) : (
            <div className="content-card" style={{ padding: 32 }}>
              <Empty description={t('taskResult.failedBeforeResults')} />
            </div>
          )}
        </Col>
      </Row>
    </>
  );
}
