import type { Transparency, InputClassification, BreachResult, CorrelationResult, ImageRiskResult } from "@shared/schema";

interface TransparencyInput {
  input: InputClassification;
  breach?: BreachResult;
  correlation?: CorrelationResult;
  imageRisk?: ImageRiskResult;
}

export function generateTransparency(data: TransparencyInput): Transparency {
  const whatWasChecked: string[] = [];
  const whatWasNotChecked: string[] = [];
  const dataSources: Transparency["dataSources"] = [];

  // Input classification
  whatWasChecked.push(`Input type classification (${data.input.type})`);

  // Breach checking
  if (data.breach) {
    if (data.breach.apiAvailable) {
      whatWasChecked.push("Known data breach databases via HaveIBeenPwned API");
      dataSources.push({
        name: "HaveIBeenPwned",
        type: "api",
        description: "Aggregated database of publicly disclosed data breaches",
      });
    } else {
      whatWasNotChecked.push("Data breach databases (API key not configured or unavailable)");
    }
  }

  // Correlation checking
  if (data.correlation) {
    if (data.correlation.checkedPlatforms.length > 0) {
      whatWasChecked.push(`Username availability on ${data.correlation.checkedPlatforms.length} platforms`);
      dataSources.push({
        name: "Platform Availability Checks",
        type: "public_check",
        description: "HTTP requests to check if usernames exist on major platforms",
      });
    }
  }

  // Image analysis
  if (data.imageRisk) {
    if (data.imageRisk.analyzed) {
      whatWasChecked.push("Image URL accessibility and content type verification");
      if (data.imageRisk.perceptualHash) {
        whatWasChecked.push("Perceptual hash generation (URL-based)");
      }
    } else {
      whatWasNotChecked.push("Image content analysis (unable to access image)");
    }
  }

  // Things we never check (transparency about limitations)
  whatWasNotChecked.push("Dark web or hidden services");
  whatWasNotChecked.push("Private or password-protected databases");
  whatWasNotChecked.push("Encrypted or access-restricted systems");
  whatWasNotChecked.push("Social media private messages or posts");
  whatWasNotChecked.push("Non-public company databases");

  // Add heuristic data source for scoring
  dataSources.push({
    name: "Risk Scoring Algorithm",
    type: "heuristic",
    description: "Proprietary algorithm combining breach severity, platform presence, and exposure indicators",
  });

  const legalScope = `NothingHide analyzes only publicly accessible information. No private systems, restricted databases, or confidential data sources were accessed. This analysis provides exposure awareness, not forensic proof. Results should be verified independently for critical security decisions.`;

  return {
    whatWasChecked,
    whatWasNotChecked,
    dataSources,
    legalScope,
    timestamp: new Date().toISOString(),
  };
}
