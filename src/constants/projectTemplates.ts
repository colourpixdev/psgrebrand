import type { ProjectTemplateId, ProjectStage } from '../types/domain';

export type ProjectTemplate = {
  id: ProjectTemplateId;
  name: string;
  description: string;
  siteLabel: string;
  deliveryPartnerLabel: string;
  defaultStages: readonly ProjectStage[];
};

export const projectTemplates: Record<ProjectTemplateId, ProjectTemplate> = {
  signage_rollout: {
    id: 'signage_rollout',
    name: 'Signage rollout',
    description: 'Multi-site signage, graphics, approvals, production, installation, photos, and signoff.',
    siteLabel: 'Site / branch',
    deliveryPartnerLabel: 'Installation partner',
    defaultStages: [
      'New Project',
      'Awaiting Information',
      'Site Survey',
      'Measurements Received',
      'Artwork In Progress',
      'Artwork Sent',
      'Awaiting Approval',
      'Approved',
      'Quotation Requested',
      'Quotation Received',
      'PO Issued',
      'Production',
      'Installation Scheduled',
      'Installation In Progress',
      'Installed',
      'Photos Uploaded',
      'Client Signoff',
      'Completed',
    ],
  },
  general_rollout: {
    id: 'general_rollout',
    name: 'General rollout',
    description: 'Repeatable project delivery across locations, departments, customers, or operational sites.',
    siteLabel: 'Site / location',
    deliveryPartnerLabel: 'Delivery partner',
    defaultStages: ['New Project', 'Awaiting Information', 'Awaiting Approval', 'Approved', 'Production', 'Installation Scheduled', 'Installed', 'Client Signoff', 'Completed'],
  },
  service_delivery: {
    id: 'service_delivery',
    name: 'Service delivery',
    description: 'Customer work requests, supplier updates, operational tasks, approvals, and closeout records.',
    siteLabel: 'Customer / site',
    deliveryPartnerLabel: 'Service partner',
    defaultStages: ['New Project', 'Awaiting Information', 'Quotation Requested', 'Quotation Received', 'Approved', 'Installation Scheduled', 'Completed'],
  },
};

export const defaultProjectTemplate = projectTemplates.signage_rollout;

export function getProjectTemplate(templateId: string | null | undefined) {
  return projectTemplates[templateId as ProjectTemplateId] ?? defaultProjectTemplate;
}

export const projectTemplateOptions = Object.values(projectTemplates);