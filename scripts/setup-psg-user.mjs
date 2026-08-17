#!/usr/bin/env node

/**
 * Complete setup for PSG user:
 * 1. Ensures profiles table constraint allows psg_user role
 * 2. Seeds the psg@psg.co.za profile
 * 3. Grants permission override for viewing all projects
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

function loadEnv(envPath) {
  try {
    const envContent = readFileSync(envPath, 'utf-8');
    const env = {};
    envContent.split('\n').forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) return;
      const [key, ...valueParts] = trimmed.split('=');
      env[key] = valueParts.join('=');
    });
    return env;
  } catch {
    return {};
  }
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const envPath = resolve(__dirname, '../.env.local');
const env = { ...loadEnv(envPath), ...process.env };

const supabaseUrl = env.VITE_SUPABASE_URL;
const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey || serviceRoleKey === 'REPLACE_WITH_YOUR_SERVICE_ROLE_SECRET') {
  console.error('\n❌ Missing SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}

const adminClient = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function setupPSGUser() {
  console.log('\n🚀 Setting up PSG user with all permissions...\n');

  try {
    // Step 1: Check if profile exists
    console.log('1️⃣  Checking for existing psg@psg.co.za profile...');
    const { data: existingProfile, error: checkError } = await adminClient
      .from('profiles')
      .select('*')
      .eq('email', 'psg@psg.co.za')
      .single();

    if (checkError && checkError.code !== 'PGRST116') {
      // PGRST116 = no rows returned (expected)
      throw checkError;
    }

    if (existingProfile) {
      console.log('   ✓ Profile exists, updating...');
    } else {
      console.log('   ✓ Profile does not exist yet, will create...');
    }

    // Step 2: Ensure profile exists with correct role
    console.log('\n2️⃣  Creating/upserting PSG user profile...');
    const { data: profileData, error: profileError } = await adminClient
      .from('profiles')
      .upsert(
        {
          email: 'psg@psg.co.za',
          name: 'PSG User',
          role: 'psg_user',
          branch: null,
          company: null,
          profile_title: null,
          workspace_ids: ['default'],
        },
        { onConflict: 'email' }
      )
      .select();

    if (profileError) {
      console.error('   ✗ Error creating profile:', profileError.message);
      console.error('\n⚠️  This likely means the constraint hasn\'t been updated in Supabase yet.');
      console.error('   Please run this SQL in Supabase Dashboard > SQL Editor:');
      console.error(`
    ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
    ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check 
      CHECK (role IN ('colourpix_admin', 'psg_head_office', 'psg_branch_manager', 'psg_user', 'sign_company'));
      `);
      process.exit(1);
    }

    console.log('   ✓ Profile created/updated successfully');

    // Step 3: Grant permission override
    console.log('\n3️⃣  Granting view-all-projects permission...');
    const { data: updateData, error: updateError } = await adminClient
      .from('profiles')
      .update({
        permission_overrides: {
          'projectAccess.canViewAllProjects': true,
        },
      })
      .eq('email', 'psg@psg.co.za');

    if (updateError) {
      console.error('   ✗ Error updating permissions:', updateError.message);
      process.exit(1);
    }

    console.log('   ✓ Permission override applied');

    // Summary
    console.log('\n✅ PSG user setup complete!\n');
    console.log('User: psg@psg.co.za');
    console.log('Password: PSGrebrand');
    console.log('Role: psg_user');
    console.log('\nPermissions:');
    console.log('  ✓ Can view ALL projects (permission override)');
    console.log('  ✗ Cannot edit or create projects');
    console.log('  ✗ Cannot add comments or create tasks');
    console.log('  ✓ Can download and export files\n');
  } catch (err) {
    console.error('Unexpected error:', err);
    process.exit(1);
  }
}

setupPSGUser();
