import type { Task } from '../types';


const PARTIAL_LLM_FAILURE_PATTERN = /Analysis finished without finalized LLM results\.\s*raw=(\d+),\s*final=(\d+)/i;

export type TaskPresentation = {
  color: string;
  statusLabel: string;
  isPartialLlmFailure: boolean;
  rawCount: number;
  finalCount: number;
};


export function getTaskPresentation(task: Task): TaskPresentation {
  const match = task.error_message?.match(PARTIAL_LLM_FAILURE_PATTERN);
  if (task.status === 'failed' && match) {
    return {
      color: 'gold',
      statusLabel: 'PARTIAL',
      isPartialLlmFailure: true,
      rawCount: Number(match[1]),
      finalCount: Number(match[2]),
    };
  }

  const colorByStatus: Record<Task['status'], string> = {
    pending: 'default',
    running: 'processing',
    completed: 'success',
    failed: 'error',
  };

  return {
    color: colorByStatus[task.status],
    statusLabel: task.status.toUpperCase(),
    isPartialLlmFailure: false,
    rawCount: 0,
    finalCount: 0,
  };
}
