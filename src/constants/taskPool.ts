import type { TaskItem } from '../types/domain';

export const defaultTaskPool: TaskItem[] = [
  {
    id: 'pool-create-layout-brief',
    text: 'Create Layout Brief',
    completed: false,
    status: 'pending',
  },
  {
    id: 'pool-get-layout-approved',
    text: 'Get Layout Approved',
    completed: false,
    status: 'pending',
  },
  {
    id: 'pool-send-quote',
    text: 'Send quote',
    completed: false,
    status: 'pending',
  },
  {
    id: 'pool-send-artwork-for-production',
    text: 'Send artwork for production',
    completed: false,
    status: 'pending',
  },
  {
    id: 'pool-schedule-installation',
    text: 'Schedule Installation',
    completed: false,
    status: 'pending',
  },
  {
    id: 'pool-review-installation-complete-project',
    text: 'Review installation and complete project',
    completed: false,
    status: 'pending',
  },
  {
    id: 'pool-send-invoice',
    text: 'Send Invoice',
    completed: false,
    status: 'pending',
  },
];

export function createTaskFromPool(poolTaskId: string): TaskItem {
  const poolTask = defaultTaskPool.find((task) => task.id === poolTaskId);
  if (!poolTask) {
    throw new Error(`Task not found in pool: ${poolTaskId}`);
  }

  return {
    ...poolTask,
    id: `task-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  };
}
