import type { TaskItem, TaskStatus } from '../types/domain';

export function getTaskStatus(task: TaskItem): TaskStatus {
  return task.status ?? (task.completed ? 'done' : 'open');
}

export function isTaskOutstanding(task: TaskItem): boolean {
  return !task.completed && (task.status ?? 'open') !== 'pending';
}

export function isTaskPending(task: TaskItem): boolean {
  return !task.completed && task.status === 'pending';
}
