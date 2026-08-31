import type { TaskItem, TaskStatus } from '../types/domain';

export type RelationalTaskStatus = 'not_started' | 'in_progress' | 'complete' | 'waiting' | 'blocked';

export function taskStatusFromDatabase(status: RelationalTaskStatus): TaskStatus {
  if (status === 'not_started') return 'pending';
  if (status === 'in_progress' || status === 'waiting' || status === 'blocked') return 'busy';
  return 'done';
}

export function taskStatusToDatabase(status: TaskStatus): RelationalTaskStatus {
  return status === 'pending' ? 'not_started' : status === 'busy' ? 'in_progress' : 'complete';
}

export function getTaskStatus(task: TaskItem): TaskStatus {
  if (task.status) {
    return task.status;
  }

  return task.completed ? 'done' : (task.startedDate ? 'busy' : 'pending');
}

export function isTaskOutstanding(task: TaskItem): boolean {
  return !task.completed && getTaskStatus(task) !== 'pending';
}

export function isTaskPending(task: TaskItem): boolean {
  return !task.completed && task.status === 'pending';
}
