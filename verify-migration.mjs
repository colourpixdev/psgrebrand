import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";

const envContent = readFileSync(".env.local", "utf-8");
const envVars = Object.fromEntries(
  envContent
    .split("\n")
    .filter((line) => line && !line.startsWith("#"))
    .map((line) => line.split("="))
);

const supabaseUrl = envVars.VITE_SUPABASE_URL;
const serviceRoleKey = envVars.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error("Missing Supabase credentials");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false },
});

async function verifyMigration() {
  console.log("🔍 Verifying migration data...\n");

  // Check rebrand_workspaces
  const { data: workspaces, error: wsError } = await supabase
    .from("rebrand_workspaces")
    .select("*");

  if (wsError) {
    console.error("❌ Error querying rebrand_workspaces:", wsError.message);
  } else {
    console.log(`✅ rebrand_workspaces: ${workspaces.length} records`);
    if (workspaces.length > 0) {
      workspaces.forEach((ws) => {
        console.log(
          `   - branch_id: ${ws.branch_id}, workspace_reference: ${ws.workspace_reference}`
        );
      });
    }
  }

  console.log();

  // Check project_tasks
  const { data: tasks, error: tasksError } = await supabase
    .from("project_tasks")
    .select("*")
    .order("created_at", { ascending: false });

  if (tasksError) {
    console.error("❌ Error querying project_tasks:", tasksError.message);
  } else {
    console.log(`✅ project_tasks: ${tasks.length} records`);
    if (tasks.length > 0) {
      tasks.slice(0, 5).forEach((task) => {
        console.log(`   - id: ${task.id}`);
        console.log(`     title: ${task.title}`);
        console.log(`     status: ${task.status}`);
        console.log(`     workspace_id: ${task.workspace_id}`);
        console.log();
      });
      if (tasks.length > 5) {
        console.log(`   ... and ${tasks.length - 5} more`);
      }
    }
  }

  console.log();

  // Check project_files
  const { data: files, error: filesError } = await supabase
    .from("project_files")
    .select("*");

  if (filesError) {
    console.error("❌ Error querying project_files:", filesError.message);
  } else {
    console.log(`✅ project_files: ${files.length} records`);
  }

  console.log();

  // Check project_activity
  const { data: activity, error: activityError } = await supabase
    .from("project_activity")
    .select("*")
    .order("occurred_at", { ascending: false });

  if (activityError) {
    console.error("❌ Error querying project_activity:", activityError.message);
  } else {
    console.log(`✅ project_activity: ${activity.length} records`);
    if (activity.length > 0) {
      activity.slice(0, 3).forEach((act) => {
        console.log(`   - ${act.event_type} (${act.entity_type}) at ${act.occurred_at}`);
      });
    }
  }
}

verifyMigration().catch(console.error);
