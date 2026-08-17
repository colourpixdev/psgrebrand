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

async function fixProjectTasks() {
  try {
    console.log('Fixing project tasks...\n');

    // Get the project
    const { data: projects, error: projectError } = await supabase
      .from('projects')
      .select('*')
      .eq('id', 'PSG001P1')
      .single();

    if (projectError || !projects) {
      console.error('Project not found:', projectError);
      return;
    }

    console.log('Found project:', projects.id);
    console.log('Current tasks:', projects.tasks.length);

    // Mark all tasks as incomplete
    const updatedTasks = projects.tasks.map(task => ({
      ...task,
      completed: false,
      status: 'open',
    }));

    // Update the project
    const { error: updateError } = await supabase
      .from('projects')
      .update({ tasks: updatedTasks })
      .eq('id', 'PSG001P1');

    if (updateError) {
      console.error('Error updating tasks:', updateError);
      return;
    }

    console.log('✓ All tasks marked as incomplete');
    console.log('\nUpdated tasks:');
    updatedTasks.forEach((task, index) => {
      console.log(`  ${index + 1}. ${task.text} (${task.status})`);
    });

  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

fixProjectTasks();
