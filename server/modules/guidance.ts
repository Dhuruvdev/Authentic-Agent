import type { Guidance, BreachResult, CorrelationResult, ImageRiskResult, InputClassification } from "@shared/schema";

interface GuidanceInput {
  input: InputClassification;
  breach?: BreachResult;
  correlation?: CorrelationResult;
  imageRisk?: ImageRiskResult;
}

type RecommendationCategory = "account_security" | "privacy" | "platform_action" | "monitoring";
type Urgency = "immediate" | "soon" | "when_possible";

interface Recommendation {
  priority: number;
  category: RecommendationCategory;
  title: string;
  description: string;
  urgency: Urgency;
}

export function generateGuidance(data: GuidanceInput): Guidance {
  const recommendations: Recommendation[] = [];
  let priority = 1;

  // High priority: Breach-related recommendations
  if (data.breach?.found) {
    if (data.breach.severity === "critical" || data.breach.severity === "high") {
      recommendations.push({
        priority: priority++,
        category: "account_security",
        title: "Change passwords immediately",
        description: "Your credentials may have been exposed in a data breach. Change passwords for all accounts using this email, especially financial and primary email accounts. Use unique, strong passwords for each.",
        urgency: "immediate",
      });

      recommendations.push({
        priority: priority++,
        category: "account_security",
        title: "Enable two-factor authentication",
        description: "Add an extra layer of security by enabling 2FA on all important accounts. Use an authenticator app rather than SMS when possible.",
        urgency: "immediate",
      });
    } else {
      recommendations.push({
        priority: priority++,
        category: "account_security",
        title: "Review and update passwords",
        description: "Your email was found in data breaches. While the severity is lower, you should still update passwords for accounts using this email.",
        urgency: "soon",
      });
    }

    recommendations.push({
      priority: priority++,
      category: "monitoring",
      title: "Monitor for suspicious activity",
      description: "Watch for unusual login attempts, password reset emails, or unfamiliar transactions. Set up login notifications where available.",
      urgency: "soon",
    });
  }

  // Correlation-related recommendations
  if (data.correlation) {
    const foundCount = data.correlation.matches.filter(m => !m.available).length;
    if (foundCount >= 3) {
      recommendations.push({
        priority: priority++,
        category: "privacy",
        title: "Vary usernames across platforms",
        description: "Using the same username across many platforms makes it easier to track your online presence. Consider using different usernames for different types of accounts.",
        urgency: "when_possible",
      });
    }

    if (foundCount > 0) {
      recommendations.push({
        priority: priority++,
        category: "privacy",
        title: "Review privacy settings on found platforms",
        description: `Your username was found on ${foundCount} platform${foundCount !== 1 ? "s" : ""}. Review the privacy settings on these accounts to control what information is publicly visible.`,
        urgency: "soon",
      });
    }
  }

  // Image-related recommendations
  if (data.imageRisk?.analyzed && data.imageRisk.exposureIndicators.length > 0) {
    recommendations.push({
      priority: priority++,
      category: "platform_action",
      title: "Review image sharing settings",
      description: "Your image appears on multiple sites. If any use is unauthorized, you may be able to request removal through the platform's reporting tools.",
      urgency: "soon",
    });
  }

  // General recommendations if nothing specific found
  if (recommendations.length === 0) {
    recommendations.push({
      priority: priority++,
      category: "monitoring",
      title: "Stay vigilant",
      description: "While no major exposures were found, continue practicing good security hygiene. Use unique passwords, enable 2FA, and be cautious of phishing attempts.",
      urgency: "when_possible",
    });

    recommendations.push({
      priority: priority++,
      category: "privacy",
      title: "Periodic security check-ups",
      description: "Run periodic exposure checks to stay informed about your digital footprint. New breaches are discovered regularly.",
      urgency: "when_possible",
    });
  }

  // Always recommend password manager
  if (!recommendations.some(r => r.title.toLowerCase().includes("password manager"))) {
    recommendations.push({
      priority: priority++,
      category: "account_security",
      title: "Use a password manager",
      description: "A password manager helps you create and store unique, strong passwords for every account, making it easier to maintain good security practices.",
      urgency: "when_possible",
    });
  }

  return { recommendations };
}
