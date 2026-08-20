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

async function createTestProject() {
  console.log("🆕 Creating test project for psg-031...\n");

  const testProject = {
    id: "TEST-PSG-031-001",
    branch_id: "psg-031",
    branch: "PSG Bloemhof Insure",
    province: "Free State",
    town: "Bloemhof",
    physical_address: "Main Street, Bloemhof, 2660",
    latitude: -27.6386,
    longitude: 24.9856,
    manager: "Test Manager",
    manager_email: "manager@psg.co.za",
    designer: "Test Designer",
    installer: "Test Installer",
    current_stage: "New Project",
    status: "in_progress",
    target_date: "2026-09-30",
    installation_date: "",
    completion_date: "",
    updated_at: new Date().toISOString(),
    progress: 0,
    branch_manager_view_only: false,
    notes: "Test project for task creation validation",
    files: [],
    tasks: [
      {
        id: "task-001",
        text: "Review site requirements",
        completed: false,
        status: "open",
        createdAt: new Date().toISOString(),
      },
      {
        id: "task-002",
        text: "Schedule installation",
        completed: false,
        status: "open",
        createdAt: new Date().toISOString(),
      },
    ],
    comments: [],
    activity: [],
    client_company: "PSG",
    graphics_partner: "Colourpix CC",
    project_type: "signage_rollout",
    project_type_name: "Signage rollout",
    site_label: "Site / branch",
  };

  const { data, error } = await supabase
    .from("projects")
    .insert([testProject])
    .select();

  if (error) {
    console.error("❌ Error creating project:", error.message);
  } else {
    console.log("✅ Test project created successfully!");
    console.log(`   Project ID: ${data[0].id}`);
    console.log(`   Branch: ${data[0].branch}`);
    console.log(`   Status: ${data[0].status}`);
    console.log(
      `\n📝 Navigate to UI: http://localhost:5173/psgrebrand/#/projects/${data[0].id}`
    );
  }
}

createTestProject().catch(console.error);
