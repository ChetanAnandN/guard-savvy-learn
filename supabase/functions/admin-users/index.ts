import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const ADMIN_EMAIL = 'chetan1920681@gmail.com';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { action, adminEmail, targetEmail, targetRole } = await req.json();

    // Verify admin
    if (adminEmail !== ADMIN_EMAIL) {
      console.error('Unauthorized access attempt by:', adminEmail);
      return new Response(
        JSON.stringify({ error: 'Unauthorized. Admin access required.' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Admin action: ${action} by ${adminEmail}`);

    switch (action) {
      case 'list': {
        // Get all users with their scores
        const { data: users, error: usersError } = await supabase
          .from('users')
          .select('*')
          .order('created_at', { ascending: false });

        if (usersError) throw usersError;

        // Get all scores
        const { data: scores, error: scoresError } = await supabase
          .from('scores')
          .select('*');

        if (scoresError) throw scoresError;

        // Get action counts per user
        const { data: actions, error: actionsError } = await supabase
          .from('user_actions')
          .select('user_id, action');

        if (actionsError) throw actionsError;

        // Combine data
        const usersWithPerformance = users.map(user => {
          const userScore = scores.find(s => s.user_id === user.id);
          const userActions = actions.filter(a => a.user_id === user.id);
          
          const actionCounts = {
            opened: userActions.filter(a => a.action === 'opened').length,
            clicked_link: userActions.filter(a => a.action === 'clicked_link').length,
            typed_credentials: userActions.filter(a => a.action === 'typed_credentials').length,
            reported: userActions.filter(a => a.action === 'reported').length,
            deleted: userActions.filter(a => a.action === 'deleted').length,
          };

          const hasInteracted = userActions.length > 0;
          
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
            score: userScore?.score ?? 100,
            risk_level: userScore?.risk_level ?? 'low',
            total_phishing_clicked: userScore?.total_phishing_clicked ?? 0,
            total_phishing_reported: userScore?.total_phishing_reported ?? 0,
            total_safe_opened: userScore?.total_safe_opened ?? 0,
            action_counts: actionCounts,
            has_interacted: hasInteracted,
            risk_comment: riskComment,
          };
        });

        return new Response(
          JSON.stringify({ success: true, users: usersWithPerformance }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'add': {
        if (!targetEmail || !targetEmail.includes('@')) {
          return new Response(
            JSON.stringify({ error: 'Valid email is required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Check if user already exists
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

        // Add new user
        const { data: newUser, error: insertError } = await supabase
          .from('users')
          .insert({
            email: targetEmail,
            role: targetRole || 'student',
            verified: false,
          })
          .select()
          .single();

        if (insertError) throw insertError;

        // Initialize score
        await supabase.from('scores').insert({
          user_id: newUser.id,
          score: 100,
          risk_level: 'low',
        });

        console.log('Added new user:', targetEmail);

        return new Response(
          JSON.stringify({ success: true, user: newUser, message: 'User added successfully' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'remove': {
        if (!targetEmail) {
          return new Response(
            JSON.stringify({ error: 'Email is required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        if (targetEmail === ADMIN_EMAIL) {
          return new Response(
            JSON.stringify({ error: 'Cannot remove admin user' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Get user ID first
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

        // Delete user actions
        await supabase.from('user_actions').delete().eq('user_id', user.id);
        
        // Delete user scores
        await supabase.from('scores').delete().eq('user_id', user.id);
        
        // Delete user
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
