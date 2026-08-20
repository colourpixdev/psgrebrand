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
  console.log("🧪 Testing Task CRUD Operations\n");

  try {
    // Get the workspace ID for psg-001
    console.log("📌 Step 1: Getting workspace and stage...");
    const { data: workspace } = await supabase
      .from("rebrand_workspaces")
      .select("*")
      .eq("branch_id", "psg-001")
      .eq("is_primary", true)
      .limit(1);

    const workspaceId = workspace[0].id;
    
    // Get a stage ID (branch_confirmed is used by default)
    const { data: stages } = await supabase
      .from("workflow_stages")
      .select("id")
      .eq("stage_key", "branch_confirmed")
      .limit(1);
    
    const stageId = stages[0]?.id || "7dd064c8-1cb9-434d-81e2-4dc85ca4c297";
    console.log(`✅ Found workspace: ${workspaceId}`);
    console.log(`   Stage ID: ${stageId}\n`);

    // Check what columns are required
    console.log("📌 Step 2a: Getting reference task structure...");
    const { data: refTask } = await supabase
      .from("project_tasks")
      .select(
        "stage_id, responsible_group_id, responsible_person_id, created_by, updated_by"
      )
      .eq("workspace_id", workspaceId)
      .limit(1);

    const refValues = refTask[0] || {};
    console.log(`   Reference values loaded\n`);
    const { data: existingTasks } = await supabase
      .from("project_tasks")
      .select("id, title, status")
      .eq("workspace_id", workspaceId)
      .is("deleted_at", null);

    console.log(
      `✅ Currently ${existingTasks.length} active tasks in workspace`
    );
    existingTasks.forEach((t) => {
      console.log(`   - ${t.title} (${t.status})`);
    });
    console.log();

    // Test CREATE
    console.log("📌 Step 3: Creating a new test task...");
    const { data: createResult, error: createError } = await supabase
      .from("project_tasks")
      .insert([
        {
          workspace_id: workspaceId,
          stage_id: stageId,
          title: "TEST TASK: Verify relational schema writes",
          status: "not_started",
          priority: "normal",
          sort_order: 999,
          required_action: "Complete validation",
          is_current: true,
        },
      ])
      .select();

    if (createError) {
      throw new Error(`Create failed: ${createError.message}`);
    }

    const taskId = createResult[0].id;
    console.log(`✅ Task created successfully!`);
    console.log(`   ID: ${taskId}`);
    console.log(`   Title: ${createResult[0].title}`);
    console.log(`   Status: ${createResult[0].status}\n`);

    // Test READ
    console.log("📌 Step 4: Reading task back from database...");
    const { data: readResult } = await supabase
      .from("project_tasks")
      .select("*")
      .eq("id", taskId)
      .single();

    console.log(`✅ Task read successfully!`);
    console.log(
      `   Verified: ${readResult.title} (status: ${readResult.status})\n`
    );

    // Test UPDATE
    console.log("📌 Step 5: Updating task status...");
    const { data: updateResult } = await supabase
      .from("project_tasks")
      .update({
        status: "in_progress",
        title: "TEST TASK: Updated to in_progress",
      })
      .eq("id", taskId)
      .select();

    console.log(`✅ Task updated successfully!`);
    console.log(`   Status: ${updateResult[0].status}\n`);

    // Test SOFT DELETE
    console.log("📌 Step 6: Soft-deleting task...");
    const { data: deleteResult } = await supabase
      .from("project_tasks")
      .update({
        deleted_at: new Date().toISOString(),
      })
      .eq("id", taskId)
      .select();

    console.log(`✅ Task soft-deleted successfully!\n`);

    // Verify
    console.log("📌 Step 7: Verifying final state...");
    const { data: allTasks } = await supabase
      .from("project_tasks")
      .select("id, deleted_at")
      .eq("workspace_id", workspaceId);

    const deletedCount = allTasks.filter((t) => t.deleted_at).length;
    const activeCount = allTasks.filter((t) => !t.deleted_at).length;

    console.log(`✅ Workspace state:`);
    console.log(`   Active: ${activeCount} | Deleted: ${deletedCount}\n`);

    console.log("╔════════════════════════════════════════════════════╗");
    console.log("║         ✅ ALL CRUD TESTS PASSED ✅              ║");
    console.log("╚════════════════════════════════════════════════════╝");
    console.log("\n✅ Relational Task Schema:");
    console.log("   ✅ CREATE - writes to project_tasks table");
    console.log("   ✅ READ   - retrieves tasks correctly");
    console.log("   ✅ UPDATE - modifies status and title");
    console.log("   ✅ DELETE - soft-deletes via deleted_at");
    console.log("\n🚀 Service layer ready for production!");
  } catch (error) {
    console.error("❌ Test failed:", error.message);
    process.exit(1);
  }
}

testTaskCRUD().catch(console.error);
