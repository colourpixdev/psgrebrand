import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey);

interface BranchRow {
  id: string;
  name: string;
  division: string;
}

function formatBranchName(division: string, branchName: string): string {
  // If already formatted, skip
  if (branchName.startsWith(`PSG ${division}`)) {
    return branchName;
  }

  // Extract base name (remove "PSG [Division] " if present for some reason)
  let baseName = branchName;
  const psgMatch = branchName.match(/^PSG\s+(?:Wealth|Insure|Wealth\s+Insure|Asset|Trust)\s+(.+)$/i);
  if (psgMatch) {
    baseName = psgMatch[1];
  }

  return `PSG ${division} ${baseName.trim()}`;
}

async function migrateBranchNames() {
  try {
    console.log('Fetching all branches...');
    const { data: branches, error } = await supabase
      .from('branches')
      .select('id, name, division')
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error fetching branches:', error);
      return;
    }

    if (!branches || branches.length === 0) {
      console.log('No branches found.');
      return;
    }

    console.log(`Found ${branches.length} branches. Formatting names...`);

    let updateCount = 0;
    for (const branch of branches as BranchRow[]) {
      const formattedName = formatBranchName(branch.division, branch.name);

      if (formattedName !== branch.name) {
        console.log(`  Updating: "${branch.name}" → "${formattedName}"`);

        const { error: updateError } = await supabase
          .from('branches')
          .update({ name: formattedName })
          .eq('id', branch.id);

        if (updateError) {
          console.error(`    Error updating branch ${branch.id}:`, updateError);
        } else {
          updateCount++;
        }
      } else {
        console.log(`  OK: "${branch.name}"`);
      }
    }

    console.log(`\nMigration complete! Updated ${updateCount} branches.`);
  } catch (err) {
    console.error('Migration failed:', err);
  }
}

migrateBranchNames();
