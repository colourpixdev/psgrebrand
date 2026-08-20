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

async function checkProjectSchema() {
  console.log("🔍 Getting project schema...\n");

  // Get one project to see all columns
  const { data: projects, error } = await supabase
    .from("projects")
    .select("*")
    .limit(1);

  if (error) {
    console.error("❌ Error:", error.message);
  } else if (projects.length > 0) {
    const project = projects[0];
    console.log("✅ Project columns:");
    Object.keys(project).forEach((key) => {
      console.log(`   - ${key}: ${typeof project[key]}`);
    });
    console.log("\n📋 Full project object:");
    console.log(JSON.stringify(project, null, 2));
  }
}

checkProjectSchema().catch(console.error);
