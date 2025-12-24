import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface RecordActionRequest {
  userId: string;
  emailId: string;
  action: "opened" | "clicked_link" | "typed_credentials" | "reported" | "deleted" | "marked_safe";
  metadata?: Record<string, any>;
}

const handler = async (req: Request): Promise<Response> => {
  console.log("record-action function called");
  
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { userId, emailId, action, metadata = {} }: RecordActionRequest = await req.json();
    console.log("Recording action:", { userId, emailId, action });

    if (!userId || !emailId || !action) {
      return new Response(
        JSON.stringify({ error: "userId, emailId, and action are required" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Get the email to determine its type
    const { data: email, error: emailError } = await supabase
      .from("emails")
      .select("type, risk_level")
      .eq("id", emailId)
      .single();

    if (emailError) {
      console.error("Email not found:", emailError);
      return new Response(
        JSON.stringify({ error: "Email not found" }),
        { status: 404, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Record the action
    const { error: actionError } = await supabase
      .from("user_actions")
      .insert({
        user_id: userId,
        email_id: emailId,
        action,
        metadata,
      });

    if (actionError) {
      console.error("Error recording action:", actionError);
      return new Response(
        JSON.stringify({ error: "Failed to record action" }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Calculate score change based on action and email type
    let scoreChange = 0;
    const isPhishing = email.type === "phishing" || email.type === "suspicious";

    switch (action) {
      case "clicked_link":
        if (isPhishing) scoreChange = -50;
        break;
      case "typed_credentials":
        if (isPhishing) scoreChange = -20;
        break;
      case "reported":
        if (isPhishing) scoreChange = 40;
        break;
      case "deleted":
        if (isPhishing) scoreChange = 20;
        break;
      case "opened":
      case "marked_safe":
        scoreChange = 0;
        break;
    }

    // Update user score
    const { data: currentScore, error: scoreError } = await supabase
      .from("scores")
      .select("*")
      .eq("user_id", userId)
      .single();

    if (scoreError) {
      // Create score record if doesn't exist
      await supabase.from("scores").insert({
        user_id: userId,
        score: Math.max(0, Math.min(100, 100 + scoreChange)),
        risk_level: "low",
        total_phishing_clicked: action === "clicked_link" && isPhishing ? 1 : 0,
        total_phishing_reported: action === "reported" && isPhishing ? 1 : 0,
        total_safe_opened: email.type === "safe" && action === "opened" ? 1 : 0,
      });
    } else {
      const newScore = Math.max(0, Math.min(100, currentScore.score + scoreChange));
      
      // Determine risk level based on score
      let riskLevel: "low" | "medium" | "high" = "low";
      if (newScore < 40) riskLevel = "high";
      else if (newScore < 70) riskLevel = "medium";

      const updates: any = {
        score: newScore,
        risk_level: riskLevel,
        last_updated: new Date().toISOString(),
      };

      if (action === "clicked_link" && isPhishing) {
        updates.total_phishing_clicked = currentScore.total_phishing_clicked + 1;
      }
      if (action === "reported" && isPhishing) {
        updates.total_phishing_reported = currentScore.total_phishing_reported + 1;
      }
      if (email.type === "safe" && action === "opened") {
        updates.total_safe_opened = currentScore.total_safe_opened + 1;
      }

      await supabase
        .from("scores")
        .update(updates)
        .eq("user_id", userId);
    }

    console.log("Action recorded successfully:", { action, scoreChange });

    return new Response(
      JSON.stringify({ 
        success: true, 
        scoreChange,
        message: scoreChange < 0 
          ? "⚠️ Your awareness score decreased" 
          : scoreChange > 0 
            ? "🎉 Your awareness score increased" 
            : "Action recorded"
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("Error in record-action:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
