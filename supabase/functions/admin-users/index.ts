import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Primary admin (project owner) - can perform all actions
const PRIMARY_ADMIN_EMAIL = 'chetan1920681@gmail.com';
// Secondary admin - also has full access
const SECONDARY_ADMIN_EMAIL = 'ibrahimkasheef1@gmail.com';

// Scoring config - must match record-action and lib/scoring.ts
const SCORING_CONFIG = {
  Sbase: 50,
  clickedPenaltyPercent: 10,
  credentialsPenaltyPercent: 25,
  reportedBonusPercent: 10,
  blockedBonusPercent: 25,
};

interface ActionCounts {
  opened: number;
  clicked_link: number;
  typed_credentials: number;
  reported: number;
  deleted: number;
  blocked: number;
}

// Calculate score from actions - same formula as record-action
function calculateScore(actions: Pick<ActionCounts, 'clicked_link' | 'typed_credentials' | 'reported' | 'blocked'>): number {
  let score = SCORING_CONFIG.Sbase;

  // Apply clicked link penalties (-10% each)
  for (let i = 0; i < actions.clicked_link; i++) {
    score = Math.max(0, score - (score * SCORING_CONFIG.clickedPenaltyPercent / 100));
  }

  // Apply credential penalties (-25% each)
  for (let i = 0; i < actions.typed_credentials; i++) {
    score = Math.max(0, score - (score * SCORING_CONFIG.credentialsPenaltyPercent / 100));
  }

  // Apply reporting bonuses (+10% each)
  for (let i = 0; i < actions.reported; i++) {
    score = Math.min(100, score + (score * SCORING_CONFIG.reportedBonusPercent / 100));
  }

  // Apply blocking bonuses (+25% each)
  for (let i = 0; i < actions.blocked; i++) {
    score = Math.min(100, score + (score * SCORING_CONFIG.blockedBonusPercent / 100));
  }

  return Math.round(Math.max(0, Math.min(100, score)));
}

function getRiskLevel(score: number): 'low' | 'medium' | 'high' {
  if (score >= 40) return 'low';
  if (score >= 20) return 'medium';
  return 'high';
}

// Hash function matching login/register
async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { action, adminEmail, targetEmail, targetRole, targetPassword } = await req.json();

    // Verify requester is an instructor
    if (!adminEmail || typeof adminEmail !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Unauthorized. Requester email required.' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: requester, error: requesterError } = await supabase
      .from('users')
      .select('email, role')
      .eq('email', adminEmail)
      .maybeSingle();

    if (requesterError || !requester) {
      console.error('Unauthorized access attempt by:', adminEmail, requesterError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized. Instructor access required.' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const canList = requester.role === 'instructor';
    // Both primary admin and secondary admin can mutate, or any instructor
    const isAdmin = requester.email === PRIMARY_ADMIN_EMAIL || requester.email === SECONDARY_ADMIN_EMAIL;
    const canMutate = isAdmin || requester.role === 'instructor';

    console.log(`Admin action: ${action} by ${adminEmail}`);

    switch (action) {
      case 'list': {
        if (!canList) {
          return new Response(
            JSON.stringify({ error: 'Unauthorized. Instructor access required.' }),
            { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Get all users
        const { data: users, error: usersError } = await supabase
          .from('users')
          .select('*')
          .order('created_at', { ascending: false });

        if (usersError) throw usersError;

        // Get all actions
        const { data: actions, error: actionsError } = await supabase
          .from('user_actions')
          .select('user_id, action');

        if (actionsError) throw actionsError;

        // Build user performance data with computed scores
        const usersWithPerformance = await Promise.all(users.map(async (user) => {
          const userActions = actions.filter(a => a.user_id === user.id);

          const actionCounts: ActionCounts = {
            opened: userActions.filter(a => a.action === 'opened').length,
            clicked_link: userActions.filter(a => a.action === 'clicked_link').length,
            typed_credentials: userActions.filter(a => a.action === 'typed_credentials').length,
            reported: userActions.filter(a => a.action === 'reported').length,
            deleted: userActions.filter(a => a.action === 'deleted').length,
            blocked: userActions.filter(a => a.action === 'blocked').length,
          };

          const hasInteracted = userActions.length > 0;

          // Compute score from actions
          const computedScore = calculateScore({
            clicked_link: actionCounts.clicked_link,
            typed_credentials: actionCounts.typed_credentials,
            reported: actionCounts.reported,
            blocked: actionCounts.blocked,
          });

          const computedRisk = getRiskLevel(computedScore);

          // Sync score to database so individual user pages match
          await supabase
            .from('scores')
            .upsert({
              user_id: user.id,
              score: computedScore,
              risk_level: computedRisk,
              total_phishing_clicked: actionCounts.clicked_link,
              total_phishing_reported: actionCounts.reported,
              last_updated: new Date().toISOString(),
            }, { onConflict: 'user_id' });

          // Generate risk comment
          let riskComment = 'Normal - No interactions yet';
          if (hasInteracted) {
            if (actionCounts.typed_credentials > 0) {
              riskComment = `Critical Risk - Entered credentials ${actionCounts.typed_credentials} time(s)`;
            } else if (actionCounts.clicked_link > 0) {
              riskComment = `High Risk - Clicked phishing links ${actionCounts.clicked_link} time(s)`;
            } else if (actionCounts.reported > 0 && actionCounts.clicked_link === 0) {
              riskComment = `Low Risk - Reported ${actionCounts.reported} phishing email(s)`;
            } else {
              riskComment = 'Moderate - Active but needs improvement';
            }
          }

          return {
            ...user,
            has_password: !!user.password_hash,
            password_hash: undefined,
            score: computedScore,
            risk_level: computedRisk,
            total_phishing_clicked: actionCounts.clicked_link,
            total_phishing_reported: actionCounts.reported,
            total_safe_opened: actionCounts.opened,
            action_counts: actionCounts,
            has_interacted: hasInteracted,
            risk_comment: riskComment,
          };
        }));

        return new Response(
          JSON.stringify({ success: true, users: usersWithPerformance }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'add': {
        if (!canMutate) {
          return new Response(
            JSON.stringify({ error: 'Unauthorized. Admin access required.' }),
            { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        if (!targetEmail || !targetEmail.includes('@')) {
          return new Response(
            JSON.stringify({ error: 'Valid email is required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const { data: existing } = await supabase
          .from('users')
          .select('id')
          .eq('email', targetEmail)
          .maybeSingle();

        if (existing) {
          return new Response(
            JSON.stringify({ error: 'User already exists' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        let passwordHash = null;
        if (targetPassword && targetPassword.length >= 6) {
          passwordHash = await hashPassword(targetPassword);
        }

        const { data: newUser, error: insertError } = await supabase
          .from('users')
          .insert({
            email: targetEmail,
            role: targetRole || 'student',
            verified: !!passwordHash,
            password_hash: passwordHash,
          })
          .select()
          .single();

        if (insertError) throw insertError;

        await supabase.from('scores').insert({
          user_id: newUser.id,
          score: SCORING_CONFIG.Sbase,
          risk_level: 'low',
        });

        console.log('Added new user:', targetEmail);

        return new Response(
          JSON.stringify({ success: true, user: newUser, message: 'User added successfully' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'update-password': {
        if (!canMutate) {
          return new Response(
            JSON.stringify({ error: 'Unauthorized. Admin access required.' }),
            { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        if (!targetEmail) {
          return new Response(
            JSON.stringify({ error: 'Email is required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        if (!targetPassword || targetPassword.length < 6) {
          return new Response(
            JSON.stringify({ error: 'Password must be at least 6 characters' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const passwordHash = await hashPassword(targetPassword);

        const { error: updateError } = await supabase
          .from('users')
          .update({ password_hash: passwordHash, verified: true })
          .eq('email', targetEmail);

        if (updateError) throw updateError;

        console.log('Updated password for:', targetEmail);

        return new Response(
          JSON.stringify({ success: true, message: 'Password updated successfully' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'remove': {
        if (!canMutate) {
          return new Response(
            JSON.stringify({ error: 'Unauthorized. Admin access required.' }),
            { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        if (!targetEmail) {
          return new Response(
            JSON.stringify({ error: 'Email is required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        if (targetEmail === PRIMARY_ADMIN_EMAIL || targetEmail === SECONDARY_ADMIN_EMAIL) {
          return new Response(
            JSON.stringify({ error: 'Cannot remove admin user' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const { data: user } = await supabase
          .from('users')
          .select('id')
          .eq('email', targetEmail)
          .maybeSingle();

        if (!user) {
          return new Response(
            JSON.stringify({ error: 'User not found' }),
            { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        await supabase.from('user_actions').delete().eq('user_id', user.id);
        await supabase.from('scores').delete().eq('user_id', user.id);

        const { error: deleteError } = await supabase
          .from('users')
          .delete()
          .eq('email', targetEmail);

        if (deleteError) throw deleteError;

        console.log('Removed user:', targetEmail);

        return new Response(
          JSON.stringify({ success: true, message: 'User removed successfully' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      default:
        return new Response(
          JSON.stringify({ error: 'Invalid action' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
  } catch (error: any) {
    console.error('Admin users error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
