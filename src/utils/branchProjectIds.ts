import type { Branch, Project } from '../types/domain';

const branchCodePrefix = 'PSG';

function leftPad(value: number, width: number) {
  return String(value).padStart(width, '0');
}

export function formatBranchCode(index: number) {
  return `${branchCodePrefix}${leftPad(index, 3)}`;
}

export function createNextBranchCode(branches: Branch[]) {
  const highestUsedCode = branches.reduce((highest, branch) => {
    const match = new RegExp(`^${branchCodePrefix}(\\d+)$`, 'i').exec(branch.code?.trim() ?? '');
    const value = match ? Number.parseInt(match[1], 10) : 0;
    return Number.isFinite(value) ? Math.max(highest, value) : highest;
  }, 0);

  return formatBranchCode(highestUsedCode + 1);
}

export function buildBranchCodeMap(branches: Branch[]) {
  const codeByBranchId: Record<string, string> = {};

  branches.forEach((branch) => {
    const code = branch.code?.trim().toUpperCase();
    if (code) {
      codeByBranchId[branch.id] = code;
    }
  });

  return codeByBranchId;
}

export function getBranchCodeForBranch(branch: Branch, codeByBranchId: Record<string, string>) {
  return branch.code?.trim().toUpperCase() || codeByBranchId[branch.id] || `${branchCodePrefix}000`;
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
