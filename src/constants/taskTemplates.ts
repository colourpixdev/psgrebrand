/**
 * Task Template Pool
 * A collection of optional tasks that can be added to projects as they mature.
 * Organized by category and project type.
 */

export interface TaskTemplate {
  id: string;
  name: string;
  description: string;
  category: 'planning' | 'design' | 'production' | 'installation' | 'signage' | 'photography' | 'approval' | 'other';
  applicableToProjectTypes: Array<'signage_rollout' | 'general_rollout' | 'service_delivery'>;
  defaultAssigneeRole?: string;
}

export const taskTemplatePool: TaskTemplate[] = [
  // Planning & Coordination
  {
    id: 'brief-kickoff',
    name: 'Kickoff Meeting',
    description: 'Initial project kickoff meeting with stakeholders',
    category: 'planning',
    applicableToProjectTypes: ['signage_rollout', 'general_rollout', 'service_delivery'],
  },
  {
    id: 'timeline-approval',
    name: 'Confirm Project Timeline',
    description: 'Review and approve project timeline and milestones',
    category: 'planning',
    applicableToProjectTypes: ['signage_rollout', 'general_rollout', 'service_delivery'],
  },
  {
    id: 'stakeholder-alignment',
    name: 'Stakeholder Alignment',
    description: 'Align all stakeholders on project scope and objectives',
    category: 'planning',
    applicableToProjectTypes: ['signage_rollout', 'general_rollout'],
  },

  // Design & Brief
  {
    id: 'brief-submission',
    name: 'Submit Project Brief',
    description: 'Provide project brief with requirements and specifications',
    category: 'design',
    applicableToProjectTypes: ['signage_rollout', 'general_rollout', 'service_delivery'],
  },
  {
    id: 'design-concept',
    name: 'Design Concept Review',
    description: 'Review initial design concepts and provide feedback',
    category: 'design',
    applicableToProjectTypes: ['signage_rollout', 'general_rollout'],
  },
  {
    id: 'design-approval',
    name: 'Approve Final Design',
    description: 'Final approval of design before production',
    category: 'design',
    applicableToProjectTypes: ['signage_rollout', 'general_rollout'],
  },
  {
    id: 'brand-guidelines',
    name: 'Brand Guidelines Review',
    description: 'Ensure design aligns with brand guidelines',
    category: 'design',
    applicableToProjectTypes: ['signage_rollout', 'general_rollout'],
  },

  // Production
  {
    id: 'material-spec',
    name: 'Define Material Specifications',
    description: 'Specify materials, finishes, and technical requirements',
    category: 'production',
    applicableToProjectTypes: ['signage_rollout', 'general_rollout'],
  },
  {
    id: 'production-start',
    name: 'Production Start',
    description: 'Initiate production phase',
    category: 'production',
    applicableToProjectTypes: ['signage_rollout', 'general_rollout'],
  },
  {
    id: 'quality-check',
    name: 'Quality Check',
    description: 'Perform quality inspection of produced items',
    category: 'production',
    applicableToProjectTypes: ['signage_rollout', 'general_rollout'],
  },
  {
    id: 'production-delivery',
    name: 'Production Delivery',
    description: 'Delivery of produced items to site',
    category: 'production',
    applicableToProjectTypes: ['signage_rollout', 'general_rollout'],
  },

  // Signage Specific
  {
    id: 'site-survey',
    name: 'Site Survey',
    description: 'Survey installation site and verify dimensions',
    category: 'signage',
    applicableToProjectTypes: ['signage_rollout'],
  },
  {
    id: 'permit-check',
    name: 'Local Permit Requirements',
    description: 'Verify and obtain required local permits',
    category: 'signage',
    applicableToProjectTypes: ['signage_rollout'],
  },
  {
    id: 'electrical-spec',
    name: 'Electrical Specifications',
    description: 'Define electrical requirements and connections',
    category: 'signage',
    applicableToProjectTypes: ['signage_rollout'],
  },

  // Installation
  {
    id: 'install-schedule',
    name: 'Schedule Installation',
    description: 'Coordinate and schedule installation date/time',
    category: 'installation',
    applicableToProjectTypes: ['signage_rollout', 'general_rollout'],
  },
  {
    id: 'install-prep',
    name: 'Installation Preparation',
    description: 'Prepare site and gather installation materials',
    category: 'installation',
    applicableToProjectTypes: ['signage_rollout', 'general_rollout'],
  },
  {
    id: 'installation',
    name: 'Installation',
    description: 'Install signage/materials on site',
    category: 'installation',
    applicableToProjectTypes: ['signage_rollout', 'general_rollout'],
  },
  {
    id: 'install-verification',
    name: 'Installation Verification',
    description: 'Verify installation is complete and meets specs',
    category: 'installation',
    applicableToProjectTypes: ['signage_rollout', 'general_rollout'],
  },

  // Photography & Documentation
  {
    id: 'photo-shoot',
    name: 'Photography/Videography',
    description: 'Capture photos or videos of completed project',
    category: 'photography',
    applicableToProjectTypes: ['signage_rollout', 'general_rollout'],
  },
  {
    id: 'before-after',
    name: 'Before & After Documentation',
    description: 'Document before and after images for portfolio',
    category: 'photography',
    applicableToProjectTypes: ['signage_rollout', 'general_rollout'],
  },

  // Approval & Closeout
  {
    id: 'final-approval',
    name: 'Final Client Approval',
    description: 'Obtain final approval from client',
    category: 'approval',
    applicableToProjectTypes: ['signage_rollout', 'general_rollout', 'service_delivery'],
  },
  {
    id: 'project-closeout',
    name: 'Project Closeout',
    description: 'Complete final documentation and closeout activities',
    category: 'approval',
    applicableToProjectTypes: ['signage_rollout', 'general_rollout', 'service_delivery'],
  },
  {
    id: 'warranty-info',
    name: 'Warranty & Support Info',
    description: 'Provide warranty and support documentation',
    category: 'approval',
    applicableToProjectTypes: ['signage_rollout', 'general_rollout'],
  },

  // General
  {
    id: 'follow-up',
    name: 'Follow-up Meeting',
    description: 'Conduct follow-up meeting with stakeholders',
    category: 'other',
    applicableToProjectTypes: ['signage_rollout', 'general_rollout', 'service_delivery'],
  },
];

/**
 * Get task templates applicable to a specific project type
 */
export function getApplicableTaskTemplates(projectType: 'signage_rollout' | 'general_rollout' | 'service_delivery'): TaskTemplate[] {
  return taskTemplatePool.filter((template) => template.applicableToProjectTypes.includes(projectType));
}

/**
 * Get task templates by category
 */
export function getTaskTemplatesByCategory(
  projectType: 'signage_rollout' | 'general_rollout' | 'service_delivery',
  category: TaskTemplate['category'],
): TaskTemplate[] {
  return getApplicableTaskTemplates(projectType).filter((template) => template.category === category);
}

/**
 * Get unique categories for a project type, ordered for display
 */
export function getCategoriesForProjectType(projectType: 'signage_rollout' | 'general_rollout' | 'service_delivery'): TaskTemplate['category'][] {
  const categories = new Set<TaskTemplate['category']>();
  getApplicableTaskTemplates(projectType).forEach((template) => {
    categories.add(template.category);
  });

  const categoryOrder: TaskTemplate['category'][] = ['planning', 'design', 'production', 'signage', 'installation', 'photography', 'approval', 'other'];
  return categoryOrder.filter((cat) => categories.has(cat));
}
