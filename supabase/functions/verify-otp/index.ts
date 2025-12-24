import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface VerifyOtpRequest {
  email: string;
  otp: string;
}

async function hashOTP(otp: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(otp);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
}

const handler = async (req: Request): Promise<Response> => {
  console.log("verify-otp function called");
  
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { email, otp }: VerifyOtpRequest = await req.json();
    console.log("Verifying OTP for:", email);

    if (!email || !otp) {
      return new Response(
        JSON.stringify({ error: "Email and OTP are required" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const normalizedEmail = email.toLowerCase();

    // Get OTP record
    const { data: otpRecord, error: fetchError } = await supabase
      .from("otp_verifications")
      .select("*")
      .eq("email", normalizedEmail)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (fetchError || !otpRecord) {
      console.log("No OTP found for email:", normalizedEmail);
      return new Response(
        JSON.stringify({ error: "No OTP found. Please request a new code." }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Check if expired
    if (new Date(otpRecord.expires_at) < new Date()) {
      console.log("OTP expired for:", normalizedEmail);
      await supabase.from("otp_verifications").delete().eq("email", normalizedEmail);
      return new Response(
        JSON.stringify({ error: "OTP expired. Please request a new code." }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Check attempts
    if (otpRecord.attempts >= 3) {
      console.log("Max attempts exceeded for:", normalizedEmail);
      await supabase.from("otp_verifications").delete().eq("email", normalizedEmail);
      return new Response(
        JSON.stringify({ error: "Maximum attempts exceeded. Please request a new code." }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Increment attempts
    await supabase
      .from("otp_verifications")
      .update({ attempts: otpRecord.attempts + 1 })
      .eq("id", otpRecord.id);

    // Verify OTP
    const otpHash = await hashOTP(otp);
    if (otpHash !== otpRecord.otp_hash) {
      console.log("Invalid OTP for:", normalizedEmail);
      const remainingAttempts = 3 - (otpRecord.attempts + 1);
      return new Response(
        JSON.stringify({ 
          error: `Invalid code. ${remainingAttempts} attempt${remainingAttempts !== 1 ? 's' : ''} remaining.` 
        }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    console.log("OTP verified successfully for:", normalizedEmail);

    // Delete OTP record
    await supabase.from("otp_verifications").delete().eq("email", normalizedEmail);

    // Create or get user
    let { data: user, error: userError } = await supabase
      .from("users")
      .select("*")
      .eq("email", normalizedEmail)
      .single();

    if (userError || !user) {
      // Create new user
      const { data: newUser, error: createError } = await supabase
        .from("users")
        .insert({
          email: normalizedEmail,
          role: "student",
          verified: true,
        })
        .select()
        .single();

      if (createError) {
        console.error("Error creating user:", createError);
        return new Response(
          JSON.stringify({ error: "Failed to create user" }),
          { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      user = newUser;

      // Initialize user score
      await supabase
        .from("scores")
        .insert({
          user_id: user.id,
          score: 100,
          risk_level: "low",
        });

      console.log("Created new user:", user.id);
    } else {
      // Update existing user as verified
      await supabase
        .from("users")
        .update({ verified: true })
        .eq("id", user.id);
      
      console.log("Updated existing user:", user.id);
    }

    // Generate a simple session token (in production, use proper JWT)
    const sessionToken = crypto.randomUUID();

    return new Response(
      JSON.stringify({
        success: true,
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
          verified: true,
        },
        token: sessionToken,
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("Error in verify-otp:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
