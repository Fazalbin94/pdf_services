import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

// ─────────────────────────────────────────────
// Supabase config
// ─────────────────────────────────────────────
const supabaseUrl = "https://kkmxntzburnqreujpfba.supabase.co";
const supabaseServiceKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtrbXhudHpidXJucXJldWpwZmJhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NjUwNjIzOCwiZXhwIjoyMDgyMDgyMjM4fQ.lN0Xlbd6kE5IAfLGkYKFPR6-UeB04YeyVnRKb_8V8Tc";

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

// ─────────────────────────────────────────────
// INPUTS (CHANGE THESE)
// ─────────────────────────────────────────────
const userId = '13a90f21-2238-4ed9-8a9d-f2ab3cca3d96';
const organizationId = '9c2d7b61-1a44-4e9a-bb5e-7e8a9f3e21aa';

async function attachOrganization() {
  try {
    const { data, error } = await supabase.auth.admin.updateUserById(userId, {
      user_metadata: {
        role: 'SUPERADMIN',           
        orgId: organizationId,  
        email_verified: true,
      },
    });

    if (error) {
      console.error('❌ Failed to update user:', error);
      return;
    }

    console.log('✅ User updated successfully');
    console.log({
      userId,
      organizationId,
      role: 'SUPERADMIN',
    });

    console.log('\n⚠️ IMPORTANT:');
    console.log('User must LOG OUT and LOG IN again to refresh JWT');
  } catch (err) {
    console.error('❌ Unexpected error:', err);
  }
}

attachOrganization();
