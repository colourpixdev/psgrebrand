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

async function updateProjectAccess() {
  console.log("🔄 Updating test project for user access...\n");

  const { data, error } = await supabase
    .from("projects")
    .update({
      manager_email: "head.office@psg.co.za",
    })
    .eq("id", "TEST-PSG-031-001")
    .select();

  if (error) {
    console.error("❌ Error updating project:", error.message);
  } else {
    console.log("✅ Project updated successfully!");
    console.log(`   Manager Email: ${data[0].manager_email}`);
    console.log(
      `\n👉 The PSG Head Office user can now access: http://localhost:5173/psgrebrand/#/projects/TEST-PSG-031-001`
    );
  }
}

updateProjectAccess().catch(console.error);
