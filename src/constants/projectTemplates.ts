import type { ProjectTemplateId, ProjectStage, TaskItem } from '../types/domain';

export type ProjectTemplate = {
  id: ProjectTemplateId;
  name: string;
  description: string;
  siteLabel: string;
  defaultStages: readonly ProjectStage[];
};

export const projectTemplates: Record<ProjectTemplateId, ProjectTemplate> = {
  signage_rollout: {
    id: 'signage_rollout',
    name: 'Signage rollout',
    description: 'Multi-site signage, graphics, approvals, production, installation, photos, and signoff.',
    siteLabel: 'Site / branch',
    defaultStages: [
      'Site Inspection',
      'Layout Brief',
      'Signed Brief',
      'Quote',
      'Invoice',
      'Production & Installation',
    ],
  },
  general_rollout: {
    id: 'general_rollout',
    name: 'General rollout',
    description: 'Repeatable project delivery across locations, departments, customers, or operational sites.',
    siteLabel: 'Site / location',
    defaultStages: ['New Project', 'Awaiting Information', 'Awaiting Approval', 'Approved', 'Production', 'Installation Scheduled', 'Installed', 'Client Signoff', 'Completed'],
  },
  service_delivery: {
    id: 'service_delivery',
    name: 'Service delivery',
    description: 'Customer work requests, supplier updates, operational tasks, approvals, and closeout records.',
    siteLabel: 'Customer / site',
    defaultStages: ['New Project', 'Awaiting Information', 'Quotation Requested', 'Quotation Received', 'Approved', 'Installation Scheduled', 'Completed'],
  },
};

export const defaultProjectTemplate = projectTemplates.signage_rollout;

export function getProjectTemplate(templateId: string | null | undefined) {
  return projectTemplates[templateId as ProjectTemplateId] ?? defaultProjectTemplate;
}

export function createProjectLifecycleTasks(templateId: string | null | undefined): TaskItem[] {
  const template = getProjectTemplate(templateId);

  return template.defaultStages.map((stageName, index) => ({
    id: `lifecycle-${index}-${stageName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
    text: stageName,
    stage: stageName,
    completed: false,
    status: 'pending',
    createdAt: new Date().toISOString(),
  }));
}

export function mergeDefaultLifecycleTasks(existingTasks: TaskItem[] | null | undefined, templateId: string | null | undefined): TaskItem[] {
  const defaultTasks = createProjectLifecycleTasks(templateId);
  const seenStages = new Set((existingTasks ?? []).map((task) => (task.stage ?? task.text).trim().toLowerCase()).filter(Boolean));

  return [...(existingTasks ?? []), ...defaultTasks.filter((task) => !seenStages.has((task.stage ?? task.text).trim().toLowerCase()))];
}

export const projectTemplateOptions = Object.values(projectTemplates);