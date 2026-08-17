import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(__dirname, '..', '.env.local');

// Read .env.local
const envContent = fs.readFileSync(envPath, 'utf-8');
const envVars = {};
envContent.split('\n').forEach(line => {
  const [key, value] = line.split('=');
  if (key && value) {
    envVars[key.trim()] = value.trim();
  }
});

const supabaseUrl = envVars.VITE_SUPABASE_URL;
const supabaseServiceKey = envVars.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase credentials in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

console.log('Restoring PSG Jan Kemp Dorp Wealth project...\n');

try {
  const { data, error } = await supabase
    .from('projects')
    .insert([
      {
        id: 'PSG001P1',
        branch_id: 'psg-001',
        branch: 'PSG Jan Kemp Dorp Wealth',
        workspace_id: 'default',
        workspace_name: 'PSG Rebrand',
        client_company: 'PSG',
        graphics_partner: 'Unknown',
        project_type: 'signage',
        project_type_name: 'Signage',
        site_label: 'Jan Kempdorp',
        province: 'Northern Cape',
        town: 'Jan Kempdorp',
        physical_address: 'Frans Lubbe Street, Jan Kempdorp, 8550',
        latitude: null,
        longitude: null,
        manager: 'Unknown',
        manager_email: '',
        designer: '',
        installer: 'Unknown',
        current_stage: 'Review installation and complete project',
        status: 'busy',
        target_date: '2026-07-31',
        installation_date: '',
        completion_date: '',
        updated_at: '2026-08-17T11:29:13.103+00:00',
        progress: 0,
        branch_manager_view_only: false,
        notes: '',
        files: [],
        tasks: [
          { id: 'task-1', text: 'Create Layout Brief', status: 'open', assigneeEmail: 'beverley@colourpix.co.za' },
          { id: 'task-2', text: 'Get Layout Approved', status: 'open', assigneeEmail: 'francois@colourpix.co.za' },
          { id: 'task-3', text: 'Send quote', status: 'open', assigneeEmail: null },
          { id: 'task-4', text: 'Send Invoice', status: 'open', assigneeEmail: null },
          { id: 'task-5', text: 'Send artwork for production', status: 'open', assigneeEmail: null },
          { id: 'task-6', text: 'Schedule Installation', status: 'open', assigneeEmail: null },
          { id: 'task-7', text: 'Review installation and complete project', status: 'busy', assigneeEmail: null }
        ],
        comments: [],
        activity: []
      }
    ])
    .select();

  if (error) {
    console.error('Error restoring project:', error);
    process.exit(1);
  }

  console.log('✓ Project restored successfully');
  console.log(`  ID: PSG001P1`);
  console.log(`  Branch: PSG Jan Kemp Dorp Wealth`);
  console.log(`  Status: busy`);
} catch (err) {
  console.error('Unexpected error:', err);
  process.exit(1);
}
