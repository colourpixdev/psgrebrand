export const productBrand = {
  name: 'PSG Rebrand',
  description: 'Private Project Workspace',
  developer: 'PSG Rebrand',
  licensee: 'Platform owner',
  customer: 'PSG Wealth Insure',
  partner: 'Colourpix CC',
  workspace: 'Colourpix / PSG Wealth Insure Workspace',
  licenseStatus: 'Licensed',
  version: import.meta.env.VITE_APP_VERSION ?? '0.0.0',
  poweredBy: 'Powered by PSG Rebrand',
  copyright: '(c) 2026 PSG Rebrand',
} as const;

export const psgPrimaryLogoUrl = 'https://www.moneymarketing.co.za/wp-content/uploads/2026/04/PSG-Logos_rebrand-03-scaled.jpg';

export const userAgreementPoints = [
  'Project activity is recorded.',
  'Communications may be retained.',
  'Administrators may audit activity.',
  'AI suggestions require human approval.',
  'Completed project records may be archived or removed after completion by Colourpix or PSG Rebrand; users should keep their own copies of critical documents where required.',
  'Files remain the property of their respective owners.',
  'PSG Rebrand is licensed software.',
] as const;