export const productBrand = {
  name: 'RolloutHQ™',
  description: 'Private Project Workspace',
  developer: 'RolloutHQ',
  licensee: 'Platform owner',
  customer: 'PSG Wealth Insure',
  partner: 'Colourpix CC',
  workspace: 'Colourpix / PSG Wealth Insure Workspace',
  licenseStatus: 'Licensed',
  version: import.meta.env.VITE_APP_VERSION ?? '0.0.0',
  poweredBy: 'Powered by RolloutHQ™',
  copyright: '© 2026 RolloutHQ',
} as const;

export const userAgreementPoints = [
  'Project activity is recorded.',
  'Communications may be retained.',
  'Administrators may audit activity.',
  'AI suggestions require human approval.',
  'Completed project records may be archived or removed after completion by Colourpix or RolloutHQ; users should keep their own copies of critical documents where required.',
  'Files remain the property of their respective owners.',
  'RolloutHQ™ is licensed software.',
] as const;