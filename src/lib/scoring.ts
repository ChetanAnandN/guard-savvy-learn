// Scoring Formula: S = Sbase - (Wc×C) - (Wd×D) + (Wr×R) + (Wb×B)
// Where:
// Sbase = 50 (base score)
// C = Clicking link: -10% of current score
// D = Data/Password Entry: -25% of current score
// R = Reporting email: +15% of current score
// B = Blocking email: +25% of current score

export const SCORING_CONFIG = {
  Sbase: 50,
  clickedPenaltyPercent: 10,  // -10% of current score
  credentialsPenaltyPercent: 25, // -25% of current score
  reportedBonusPercent: 10,    // +10% of current score
  blockedBonusPercent: 25,     // +25% of current score
};

export interface ActionCounts {
  clicked_link: number;
  typed_credentials: number;
  reported: number;
  blocked: number;
  deleted: number;
}

// Calculate score by processing actions sequentially (percentage-based)
// This simulates applying each action's effect on the running score
export function calculateScore(actions: ActionCounts): number {
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

export function getScoreBreakdown(actions: ActionCounts) {
  const { Sbase, clickedPenaltyPercent, credentialsPenaltyPercent, reportedBonusPercent, blockedBonusPercent } = SCORING_CONFIG;
  
  // Calculate step by step to show breakdown
  let runningScore = Sbase;
  
  let clickedPenaltyTotal = 0;
  for (let i = 0; i < actions.clicked_link; i++) {
    const penalty = runningScore * clickedPenaltyPercent / 100;
    clickedPenaltyTotal += penalty;
    runningScore -= penalty;
  }
  
  let credentialsPenaltyTotal = 0;
  for (let i = 0; i < actions.typed_credentials; i++) {
    const penalty = runningScore * credentialsPenaltyPercent / 100;
    credentialsPenaltyTotal += penalty;
    runningScore -= penalty;
  }
  
  let reportedBonusTotal = 0;
  for (let i = 0; i < actions.reported; i++) {
    const bonus = runningScore * reportedBonusPercent / 100;
    reportedBonusTotal += bonus;
    runningScore = Math.min(100, runningScore + bonus);
  }
  
  let blockedBonusTotal = 0;
  for (let i = 0; i < actions.blocked; i++) {
    const bonus = runningScore * blockedBonusPercent / 100;
    blockedBonusTotal += bonus;
    runningScore = Math.min(100, runningScore + bonus);
  }
  
  return {
    baseScore: Sbase,
    clickedPenalty: -Math.round(clickedPenaltyTotal * 100) / 100,
    credentialsPenalty: -Math.round(credentialsPenaltyTotal * 100) / 100,
    reportedBonus: Math.round(reportedBonusTotal * 100) / 100,
    blockedBonus: Math.round(blockedBonusTotal * 100) / 100,
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
