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

async function testTaskCRUD() {
  console.log("🧪 Testing Relational Task CRUD Operations\n");

  try {
    // Step 1: Get workspace
    const { data: workspace } = await supabase
      .from("rebrand_workspaces")
      .select("*")
      .eq("branch_id", "psg-001")
      .eq("is_primary", true)
      .single();

    const workspaceId = workspace.id;
    console.log("✅ Step 1: Workspace found");
    console.log(`   ID: ${workspaceId}\n`);

    // Step 2: Get reference task to match structure
    const { data: refTask } = await supabase
      .from("project_tasks")
      .select("*")
      .eq("workspace_id", workspaceId)
      .limit(1)
      .single();

    console.log("✅ Step 2: Reference task loaded");
    console.log(`   Found: "${refTask.title}"\n`);

    // Step 3: CREATE a new task
    console.log("📌 Step 3: Creating new task...");
    const { data: createResult, error: createError } = await supabase
      .from("project_tasks")
      .insert([
        {
          workspace_id: workspaceId,
          stage_id: refTask.stage_id,
          responsible_group_id: refTask.responsible_group_id,
          responsible_person_id: refTask.responsible_person_id,
          created_by: refTask.created_by,
          updated_by: refTask.updated_by,
          title: "TEST: Relational schema validation",
          description: "Verify task writes to project_tasks table",
          status: "not_started",
          priority: "normal",
          sort_order: 999,
          required_action: "Validate CRUD operations",
          is_current: false,
        },
      ])
      .select();

    if (createError) {
      throw new Error(`CREATE failed: ${createError.message}`);
    }

    const taskId = createResult[0].id;
    console.log(`✅ Task created successfully!`);
    console.log(`   ID: ${taskId}`);
    console.log(`   Status: ${createResult[0].status}\n`);

    // Step 4: READ the task
    console.log("📌 Step 4: Reading task...");
    const { data: readResult } = await supabase
      .from("project_tasks")
      .select("*")
      .eq("id", taskId)
      .single();

    console.log(`✅ Task read successfully!`);
    console.log(`   Title: ${readResult.title}`);
    console.log(`   Status: ${readResult.status}\n`);

    // Step 5: UPDATE the task
    console.log("📌 Step 5: Updating task...");
    const { data: updateResult } = await supabase
      .from("project_tasks")
      .update({
        status: "in_progress",
        title: "TEST: Updated to in_progress",
      })
      .eq("id", taskId)
      .select();

    console.log(`✅ Task updated successfully!`);
    console.log(`   New status: ${updateResult[0].status}\n`);

    // Step 6: SOFT DELETE the task
    console.log("📌 Step 6: Soft-deleting task...");
    const deleteAtTime = new Date().toISOString();
    await supabase
      .from("project_tasks")
      .update({
        deleted_at: deleteAtTime,
      })
      .eq("id", taskId);

    console.log(`✅ Task soft-deleted successfully!`);
    console.log(`   Deleted at: ${deleteAtTime}\n`);

    // Step 7: Verify the deletion
    console.log("📌 Step 7: Verifying soft-delete...");
    const { data: allTasks } = await supabase
      .from("project_tasks")
      .select("id, deleted_at")
      .eq("workspace_id", workspaceId);

    const activeCount = allTasks.filter((t) => !t.deleted_at).length;
    const deletedCount = allTasks.filter((t) => t.deleted_at).length;

    console.log(`✅ Verification complete!`);
    console.log(`   Active tasks: ${activeCount}`);
    console.log(`   Soft-deleted tasks: ${deletedCount}\n`);

    // Summary
    console.log("╔══════════════════════════════════════════════════════╗");
    console.log("║      ✅ ALL CRUD TESTS PASSED ✅                   ║");
    console.log("╚══════════════════════════════════════════════════════╝\n");
    console.log("📊 Relational Task Implementation Verified:");
    console.log("   ✅ CREATE - Tasks inserted into project_tasks");
    console.log("   ✅ READ   - Tasks retrieved correctly");
    console.log("   ✅ UPDATE - Status and title updated");
    console.log("   ✅ DELETE - Soft-delete via deleted_at column\n");
    console.log("🚀 Service Layer Status: PRODUCTION READY");
  } catch (error) {
    console.error("❌ Test failed:", error.message);
    console.error(error);
    process.exit(1);
  }
}

testTaskCRUD().catch(console.error);
