// Scoring Formula: S = Sbase - (Wo×O) - (Wc×C) - (Wd×D) + (Wr×R)
// Where:
// Sbase = 50 (base score)
// O = Number of emails opened (Low penalty)
// C = Number of links clicked (Medium penalty)
// D = Number of credentials/data entered (High penalty)
// R = Number of phishing emails reported (High reward)

export const SCORING_WEIGHTS = {
  Sbase: 50,
  Wo: 1,   // Opening email weight (Low penalty)
  Wc: 10,  // Clicking link weight (Medium penalty)
  Wd: 20,  // Data/Password entry weight (High penalty)
  Wr: 15,  // Reporting email weight (High reward)
};

export interface ActionCounts {
  opened: number;
  clicked_link: number;
  typed_credentials: number;
  reported: number;
  deleted: number;
}

export function calculateScore(actions: ActionCounts): number {
  const { Sbase, Wo, Wc, Wd, Wr } = SCORING_WEIGHTS;
  
  const O = actions.opened;
  const C = actions.clicked_link;
  const D = actions.typed_credentials;
  const R = actions.reported;
  
  const score = Sbase - (Wo * O) - (Wc * C) - (Wd * D) + (Wr * R);
  
  // Clamp between 0 and 100
  return Math.max(0, Math.min(100, score));
}

export function getScoreBreakdown(actions: ActionCounts) {
  const { Sbase, Wo, Wc, Wd, Wr } = SCORING_WEIGHTS;
  
  return {
    baseScore: Sbase,
    openedPenalty: -(Wo * actions.opened),
    clickedPenalty: -(Wc * actions.clicked_link),
    credentialsPenalty: -(Wd * actions.typed_credentials),
    reportedBonus: Wr * actions.reported,
    finalScore: calculateScore(actions),
  };
}

export function getRiskLevel(score: number): 'low' | 'medium' | 'high' {
  if (score >= 40) return 'low';
  if (score >= 20) return 'medium';
  return 'high';
}

export function getRiskComment(score: number, hasInteracted: boolean): string {
  if (!hasInteracted) {
    return 'Normal - No interactions yet';
  }
  
  if (score >= 70) {
    return 'Excellent - Highly security aware';
  } else if (score >= 50) {
    return 'Good - Generally cautious';
  } else if (score >= 40) {
    return 'Fair - Needs improvement';
  } else if (score >= 20) {
    return 'At Risk - Requires training';
  } else {
    return 'Critical - Immediate training needed';
  }
}
