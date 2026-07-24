import type { Branch, Project } from '../types/domain';

const branchCodePrefix = 'PSG';

function leftPad(value: number, width: number) {
  return String(value).padStart(width, '0');
}

export function formatBranchCode(index: number) {
  return `${branchCodePrefix}${leftPad(index + 1, 3)}`;
}

function branchSortKey(branch: Branch) {
  return `${branch.createdAt}|${branch.name.toLowerCase()}|${branch.id}`;
}

export function buildBranchCodeMap(branches: Branch[]) {
  const sorted = [...branches].sort((a, b) => branchSortKey(a).localeCompare(branchSortKey(b)));
  const codeByBranchId: Record<string, string> = {};

  sorted.forEach((branch, index) => {
    codeByBranchId[branch.id] = formatBranchCode(index);
  });

  return codeByBranchId;
}

export function getBranchCodeForBranch(branch: Branch, codeByBranchId: Record<string, string>) {
  return codeByBranchId[branch.id] ?? branch.code ?? `${branchCodePrefix}000`;
}

export function getBranchCodeForProject(project: Project, codeByBranchId: Record<string, string>) {
  const explicitCode = project.branchCode?.trim();
  if (explicitCode) {
    return explicitCode;
  }

  const derivedFromBranch = codeByBranchId[project.branchId];
  if (derivedFromBranch) {
    return derivedFromBranch;
  }

  const fromProjectId = /^([A-Z]{3}\d{3})P\d+$/i.exec(project.id);
  return fromProjectId?.[1]?.toUpperCase() ?? `${branchCodePrefix}000`;
}

function getProjectSequence(projectId: string, branchCode: string) {
  const match = new RegExp(`^${branchCode}P(\\d+)$`, 'i').exec(projectId.trim());
  if (!match) {
    return 0;
  }

  const parsed = Number.parseInt(match[1], 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function createNextProjectId(branchCode: string, projects: Project[]) {
  const maxSequence = projects.reduce((max, project) => {
    if ((project.branchCode?.toUpperCase() ?? '').trim() === branchCode.toUpperCase()) {
      return Math.max(max, getProjectSequence(project.id, branchCode));
    }

    return Math.max(max, getProjectSequence(project.id, branchCode));
  }, 0);

  return `${branchCode}P${maxSequence + 1}`;
}
