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
  console.error('Missing SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const projectId = 'PSG001P1';

console.log(`Deleting project: ${projectId}...\n`);

try {
  // Get project details first
  const { data: project, error: getError } = await supabase
    .from('projects')
    .select('*')
    .eq('id', projectId)
    .single();

  if (getError) {
    console.error('Error finding project:', getError);
    process.exit(1);
  }

  if (!project) {
    console.log('Project not found.');
    process.exit(0);
  }

  console.log('Found project:');
  console.log(`  ID: ${project.id}`);
  console.log(`  Branch: ${project.branch}`);
  console.log(`  Name: ${project.name}\n`);

  // Delete the project
  const { error: deleteError } = await supabase
    .from('projects')
    .delete()
    .eq('id', projectId);

  if (deleteError) {
    console.error('Error deleting project:', deleteError);
    process.exit(1);
  }

  console.log('✓ Project deleted successfully');
} catch (err) {
  console.error('Unexpected error:', err);
  process.exit(1);
}
