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

async function checkProjects() {
  console.log("🔍 Checking projects table...\n");

  // Check all projects
  const { data: projects, error } = await supabase
    .from("projects")
    .select("id, name, branch_id, created_by, updated_at");

  if (error) {
    console.error("❌ Error querying projects:", error.message);
  } else {
    console.log(`✅ Total projects: ${projects.length}`);
    if (projects.length > 0) {
      projects.forEach((p) => {
        console.log(
          `   - ${p.name} (branch: ${p.branch_id}, id: ${p.id.slice(0, 8)}...)`
        );
      });
    } else {
      console.log("   ⚠️  No projects found in database");
    }
  }

  console.log("\n🔍 Checking projects with psg-001 branch...\n");

  const { data: psg001Projects, error: error2 } = await supabase
    .from("projects")
    .select("*")
    .eq("branch_id", "psg-001");

  if (error2) {
    console.error("❌ Error:", error2.message);
  } else {
    console.log(`✅ Projects for psg-001: ${psg001Projects.length}`);
    if (psg001Projects.length > 0) {
      psg001Projects.forEach((p) => {
        console.log(`   - ${p.name}: ${p.id}`);
      });
    }
  }
}

checkProjects().catch(console.error);
