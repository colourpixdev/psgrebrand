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

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false },
});

async function checkTasks() {
  const { data: tasks } = await supabase
    .from("project_tasks")
    .select("id, workspace_id, stage_id, title")
    .eq("workspace_id", "450d5b9f-4d61-49a2-afeb-ba3e075a90ae")
    .limit(1);

  if (tasks && tasks.length > 0) {
    console.log("Sample task:");
    console.log(JSON.stringify(tasks[0], null, 2));
  }

  const { data: stages } = await supabase.from("workflow_stages").select("*");
  console.log("\nAvailable stages:");
  stages.slice(0, 3).forEach((s) => {
    console.log(`  - ${s.stage_key} (${s.id})`);
  });
}

checkTasks().catch(console.error);
