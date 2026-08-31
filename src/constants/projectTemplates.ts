import type { ProjectTemplateId, ProjectStage, TaskItem } from '../types/domain';

export type ProjectTemplate = {
  id: ProjectTemplateId;
  name: string;
  description: string;
  siteLabel: string;
  defaultStages: readonly ProjectStage[];
};

export const signageProjectStageDefinitions = [
  { key: 'Colourpix to prepare brief', description: 'Colourpix prepares the brief (allow 3–5 working days).' },
  { key: 'Site inspection', description: 'Site inspection required or not required.' },
  { key: 'Other', description: 'Electrician or wall preparation required.' },
  { key: 'Brief', description: 'CPIX submitted brief date.' },
  { key: 'Quote', description: 'CPIX supply quote uploaded.' },
  { key: 'Artwork approval', description: 'Head office and office approval status.' },
  { key: 'Quote acceptance', description: 'Head office acceptance status.' },
  { key: 'Quote additional approval', description: 'Additional office approval required for part of the quote.' },
  { key: 'Date of installation', description: 'Scheduled installation date.' },
  { key: 'Completion date', description: 'Completed date.' },
  { key: 'Invoice', description: 'Invoice upload.' },
  { key: 'Summary', description: 'Happy or issues summary.' },
  { key: 'Photos', description: 'Photo uploads.' },
] as const;

export const signageProjectStages = signageProjectStageDefinitions.map((stage) => stage.key) as ProjectStage[];

export function normalizeProjectStageName(value: string) {
  return value.trim().toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
}

export function canonicalizeProjectStageName(value: string): string {
  const raw = value?.trim() ?? '';
  if (!raw) {
    return '';
  }

  const key = normalizeProjectStageName(raw);
  const aliasMap: Record<string, string> = {
    'site inspection': 'Site inspection',
    'layout brief': 'Colourpix to prepare brief',
    'signed brief': 'Brief',
    quote: 'Quote',
    invoice: 'Invoice',
    'production installation': 'Date of installation',
    'production and installation': 'Date of installation',
    'production & installation': 'Date of installation',
  };

  const mappedStage = aliasMap[key];
  if (mappedStage) {
    return mappedStage;
  }

  const exactMatch = signageProjectStages.find((stage) => normalizeProjectStageName(stage) === key);
  if (exactMatch) {
    return exactMatch;
  }

  return raw;
}

export const projectTemplates: Record<ProjectTemplateId, ProjectTemplate> = {
  signage_rollout: {
    id: 'signage_rollout',
    name: 'Signage rollout',
    description: 'Multi-site signage, graphics, approvals, production, installation, photos, and signoff.',
    siteLabel: 'Site / branch',
    defaultStages: signageProjectStages,
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