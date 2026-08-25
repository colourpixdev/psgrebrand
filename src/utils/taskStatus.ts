import type { TaskItem, TaskStatus } from '../types/domain';

export type RelationalTaskStatus = 'not_started' | 'in_progress' | 'complete' | 'waiting' | 'blocked';

export function taskStatusFromDatabase(status: RelationalTaskStatus): TaskStatus {
  return status === 'not_started' ? 'pending' : status === 'in_progress' ? 'busy' : status === 'complete' ? 'done' : status;
}

export function taskStatusToDatabase(status: TaskStatus): RelationalTaskStatus {
  return status === 'pending' ? 'not_started' : status === 'busy' ? 'in_progress' : status === 'done' ? 'complete' : status === 'open' ? 'waiting' : status;
}

export function getTaskStatus(task: TaskItem): TaskStatus {
  return task.status ?? (task.completed ? 'done' : 'open');
}

export function isTaskOutstanding(task: TaskItem): boolean {
  return !task.completed && (task.status ?? 'open') !== 'pending';
}

export function isTaskPending(task: TaskItem): boolean {
  return !task.completed && task.status === 'pending';
}
