import type { Verdict, BreachResult, CorrelationResult, ImageRiskResult, InputClassification } from "@shared/schema";

interface VerdictInput {
  input: InputClassification;
  breach?: BreachResult;
  correlation?: CorrelationResult;
  imageRisk?: ImageRiskResult;
}

export function generateVerdict(data: VerdictInput): Verdict {
  const factors: Verdict["factors"] = [];
  let totalScore = 0;
  let maxWeight = 0;

  // Process breach results
  if (data.breach) {
    if (data.breach.found) {
      const breachScore = calculateBreachScore(data.breach);
      totalScore += breachScore.score;
      maxWeight += breachScore.weight;
      factors.push({
        factor: `Found in ${data.breach.breachCount} data breach${data.breach.breachCount !== 1 ? "es" : ""}`,
        impact: "negative",
        weight: breachScore.weight,
      });

      if (data.breach.severity === "critical") {
        factors.push({
          factor: "Contains sensitive data types (passwords, financial info)",
          impact: "negative",
          weight: 15,
        });
        totalScore += 15;
        maxWeight += 15;
      }
    } else if (data.breach.apiAvailable) {
      factors.push({
        factor: "No known breaches detected",
        impact: "positive",
        weight: 20,
      });
      // Positive factors reduce the score
      maxWeight += 20;
    }
  }

  // Process correlation results
  if (data.correlation) {
    const foundCount = data.correlation.matches.filter(m => !m.available).length;
    if (foundCount > 0) {
      const correlationScore = Math.min(foundCount * 5, 25);
      totalScore += correlationScore;
      maxWeight += 25;
      factors.push({
        factor: `Username found on ${foundCount} platform${foundCount !== 1 ? "s" : ""}`,
        impact: foundCount >= 3 ? "negative" : "neutral",
        weight: correlationScore,
      });
    } else if (data.correlation.checkedPlatforms.length > 0) {
      factors.push({
        factor: "Username appears unique across checked platforms",
        impact: "positive",
        weight: 10,
      });
      maxWeight += 10;
    }
  }

  // Process image risk results
  if (data.imageRisk) {
    if (data.imageRisk.analyzed) {
      if (data.imageRisk.exposureIndicators.length > 0) {
        const imageScore = Math.min(data.imageRisk.exposureIndicators.length * 10, 30);
        totalScore += imageScore;
        maxWeight += 30;
        factors.push({
          factor: `Image found on ${data.imageRisk.exposureIndicators.length} external site${data.imageRisk.exposureIndicators.length !== 1 ? "s" : ""}`,
          impact: "negative",
          weight: imageScore,
        });
      } else {
        factors.push({
          factor: "No widespread image exposure detected",
          impact: "positive",
          weight: 10,
        });
        maxWeight += 10;
      }
    }
  }

  // Calculate final score (0-100)
  let exposureScore: number;
  if (maxWeight === 0) {
    exposureScore = 0;
  } else {
    exposureScore = Math.min(Math.round((totalScore / Math.max(maxWeight, 1)) * 100), 100);
  }

  // Ensure minimum score if there are findings
  if (data.breach?.found && exposureScore < 20) {
    exposureScore = 20;
  }

  // Determine risk level
  let riskLevel: "low" | "medium" | "high";
  if (exposureScore >= 60) {
    riskLevel = "high";
  } else if (exposureScore >= 30) {
    riskLevel = "medium";
  } else {
    riskLevel = "low";
  }

  // Generate summary
  const summary = generateSummary(data, exposureScore, riskLevel, factors);

  return {
    exposureScore,
    riskLevel,
    summary,
    factors,
  };
}

function calculateBreachScore(breach: BreachResult): { score: number; weight: number } {
  const severityScores = {
    low: 10,
    medium: 20,
    high: 35,
    critical: 50,
  };
  
  const baseScore = severityScores[breach.severity];
  const countBonus = Math.min(breach.breachCount * 2, 20);
  
  return {
    score: baseScore + countBonus,
    weight: 50,
  };
}

function generateSummary(
  data: VerdictInput,
  score: number,
  riskLevel: string,
  factors: Verdict["factors"]
): string {
  const inputType = data.input.type;
  const inputValue = data.input.type === "email" 
    ? data.input.value.split("@")[0] + "@..." 
    : data.input.value.substring(0, 10) + (data.input.value.length > 10 ? "..." : "");

  if (score === 0 && factors.length === 0) {
    return `We couldn't gather enough information about ${inputType === "email" ? "this email" : inputType === "username" ? "this username" : "this image"} to calculate an exposure score. This may be due to API limitations or the input being genuinely unexposed.`;
  }

  let summary = "";

  if (riskLevel === "high") {
    summary = `This ${inputType} shows significant public exposure. `;
    if (data.breach?.found) {
      summary += `It appears in ${data.breach.breachCount} known data breach${data.breach.breachCount !== 1 ? "es" : ""}, which means credentials or personal information may have been compromised. `;
    }
    summary += "We recommend taking immediate action to secure associated accounts.";
  } else if (riskLevel === "medium") {
    summary = `This ${inputType} has moderate public exposure. `;
    if (data.breach?.found) {
      summary += `It was found in ${data.breach.breachCount} data breach${data.breach.breachCount !== 1 ? "es" : ""}. `;
    }
    if (data.correlation?.matches.filter(m => !m.available).length) {
      summary += "The associated username appears on multiple platforms, which could enable account correlation. ";
    }
    summary += "Consider reviewing your security settings and enabling additional protections.";
  } else {
    summary = `This ${inputType} shows minimal public exposure based on our analysis. `;
    if (!data.breach?.found && data.breach?.apiAvailable) {
      summary += "No known breaches were detected. ";
    }
    summary += "Continue practicing good security hygiene to maintain this status.";
  }

  return summary;
}
