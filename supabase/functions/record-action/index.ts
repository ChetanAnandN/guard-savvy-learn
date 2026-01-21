import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Scoring Formula: S = Sbase - (Wc×C) - (Wd×D) + (Wr×R) + (Wb×B)
// Where:
// Sbase = 50 (base score)
// C = Clicking link: -10% of current score
// D = Data/Password Entry: -25% of current score
// R = Reporting email: +10% of current score
// B = Blocking email: +25% of current score
const SCORING_CONFIG = {
  Sbase: 50,
  clickedPenaltyPercent: 10,  // -10% of current score
  credentialsPenaltyPercent: 25, // -25% of current score
  reportedBonusPercent: 10,    // +10% of current score
  blockedBonusPercent: 25,     // +25% of current score
};

interface RecordActionRequest {
  userId: string;
  emailId: string;
  action: "opened" | "clicked_link" | "typed_credentials" | "reported" | "deleted" | "marked_safe" | "blocked";
  metadata?: Record<string, any>;
}

interface ActionCounts {
  clicked_link: number;
  typed_credentials: number;
  reported: number;
  blocked: number;
  deleted: number;
}

function calculateScore(actions: ActionCounts): number {
  const { Sbase, clickedPenaltyPercent, credentialsPenaltyPercent, reportedBonusPercent, blockedBonusPercent } = SCORING_CONFIG;
  
  let score = Sbase;
  
  // Apply clicked link penalties (-10% each)
  for (let i = 0; i < actions.clicked_link; i++) {
    score = Math.max(0, score - (score * clickedPenaltyPercent / 100));
  }
  
  // Apply credential penalties (-25% each)
  for (let i = 0; i < actions.typed_credentials; i++) {
    score = Math.max(0, score - (score * credentialsPenaltyPercent / 100));
  }
  
  // Apply reporting bonuses (+15% each, capped at 100)
  for (let i = 0; i < actions.reported; i++) {
    score = Math.min(100, score + (score * reportedBonusPercent / 100));
  }
  
  // Apply blocking bonuses (+25% each, capped at 100)
  for (let i = 0; i < actions.blocked; i++) {
    score = Math.min(100, score + (score * blockedBonusPercent / 100));
  }
  
  // Round to 2 decimal places and clamp between 0 and 100
  return Math.round(Math.max(0, Math.min(100, score)) * 100) / 100;
}

function getRiskLevel(score: number): "low" | "medium" | "high" {
  if (score >= 40) return "low";
  if (score >= 20) return "medium";
  return "high";
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

    // For scoring actions (clicked_link, reported, blocked), check if already recorded for this email
    const scoringActions = ["clicked_link", "reported", "blocked"];
    if (scoringActions.includes(action)) {
      const { data: existingAction } = await supabase
        .from("user_actions")
        .select("id")
        .eq("user_id", userId)
        .eq("email_id", emailId)
        .eq("action", action)
        .single();

      if (existingAction) {
        console.log("Action already recorded for this email:", { userId, emailId, action });
        return new Response(
          JSON.stringify({ 
            success: true, 
            alreadyRecorded: true,
            message: "Action already recorded for this email"
          }),
          { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }
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

    // Get all user actions to recalculate score
    const { data: allActions } = await supabase
      .from("user_actions")
      .select("action")
      .eq("user_id", userId);

    const actionCounts: ActionCounts = {
      clicked_link: 0,
      typed_credentials: 0,
      reported: 0,
      blocked: 0,
      deleted: 0,
    };

    if (allActions) {
      allActions.forEach((a) => {
        if (a.action in actionCounts) {
          actionCounts[a.action as keyof ActionCounts]++;
        }
      });
    }

    // Calculate new score using the percentage-based formula
    const newScore = calculateScore(actionCounts);
    const riskLevel = getRiskLevel(newScore);

    // Check if score record exists
    const { data: currentScore, error: scoreError } = await supabase
      .from("scores")
      .select("*")
      .eq("user_id", userId)
      .single();

    if (scoreError) {
      // Create score record if doesn't exist
      await supabase.from("scores").insert({
        user_id: userId,
        score: newScore,
        risk_level: riskLevel,
        total_phishing_clicked: actionCounts.clicked_link,
        total_phishing_reported: actionCounts.reported,
        total_safe_opened: email.type === "safe" && action === "opened" ? 1 : 0,
      });
    } else {
      const updates: any = {
        score: newScore,
        risk_level: riskLevel,
        last_updated: new Date().toISOString(),
        total_phishing_clicked: actionCounts.clicked_link,
        total_phishing_reported: actionCounts.reported,
      };

      if (email.type === "safe" && action === "opened") {
        updates.total_safe_opened = (currentScore.total_safe_opened || 0) + 1;
      }

      await supabase
        .from("scores")
        .update(updates)
        .eq("user_id", userId);
    }

    const scoreChange = currentScore ? newScore - currentScore.score : 0;
    console.log("Action recorded successfully:", { action, newScore, riskLevel });

    return new Response(
      JSON.stringify({ 
        success: true, 
        scoreChange,
        newScore,
        riskLevel,
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
