import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Simple hash function for password (using Web Crypto API)
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

    const { email, otp, password } = await req.json();

    if (!email || !otp || !password) {
      return new Response(
        JSON.stringify({ error: 'Email, OTP, and password are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (password.length < 6) {
      return new Response(
        JSON.stringify({ error: 'Password must be at least 6 characters' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Registration attempt for:', email);

    // Verify OTP first
    const { data: otpRecord, error: otpError } = await supabase
      .from('otp_verifications')
      .select('*')
      .eq('email', email)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (otpError) {
      console.error('OTP lookup error:', otpError);
      throw otpError;
    }

    if (!otpRecord) {
      return new Response(
        JSON.stringify({ error: 'No OTP found. Please request a new code.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check expiry
    if (new Date(otpRecord.expires_at) < new Date()) {
      await supabase.from('otp_verifications').delete().eq('id', otpRecord.id);
      return new Response(
        JSON.stringify({ error: 'OTP has expired. Please request a new code.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check attempts
    if (otpRecord.attempts >= 3) {
      await supabase.from('otp_verifications').delete().eq('id', otpRecord.id);
      return new Response(
        JSON.stringify({ error: 'Too many attempts. Please request a new code.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Hash the provided OTP and compare
    const encoder = new TextEncoder();
    const otpData = encoder.encode(otp);
    const otpHashBuffer = await crypto.subtle.digest('SHA-256', otpData);
    const otpHashArray = Array.from(new Uint8Array(otpHashBuffer));
    const providedOtpHash = otpHashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    if (providedOtpHash !== otpRecord.otp_hash) {
      // Increment attempts
      await supabase
        .from('otp_verifications')
        .update({ attempts: otpRecord.attempts + 1 })
        .eq('id', otpRecord.id);

      return new Response(
        JSON.stringify({ error: 'Invalid OTP. Please try again.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // OTP is valid - delete it
    await supabase.from('otp_verifications').delete().eq('id', otpRecord.id);

    // Hash the password
    const passwordHash = await hashPassword(password);

    // Check if user already exists
    const { data: existingUser } = await supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .maybeSingle();

    let user;
    if (existingUser) {
      // Update existing user with password
      const { data: updatedUser, error: updateError } = await supabase
        .from('users')
        .update({ password_hash: passwordHash, verified: true })
        .eq('id', existingUser.id)
        .select()
        .single();

      if (updateError) throw updateError;
      user = updatedUser;
    } else {
      // Create new user
      const { data: newUser, error: insertError } = await supabase
        .from('users')
        .insert({
          email,
          password_hash: passwordHash,
          role: 'student',
          verified: true,
        })
        .select()
        .single();

      if (insertError) throw insertError;
      user = newUser;

      // Initialize score for new user
      await supabase.from('scores').insert({
        user_id: user.id,
        score: 100,
        risk_level: 'low',
      });
    }

    console.log('User registered successfully:', email);

    // Generate session token
    const token = crypto.randomUUID();

    return new Response(
      JSON.stringify({
        success: true,
        user: { id: user.id, email: user.email, role: user.role },
        token,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Registration error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Registration failed' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
