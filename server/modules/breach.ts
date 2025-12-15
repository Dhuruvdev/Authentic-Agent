import type { BreachResult } from "@shared/schema";

const HIBP_API_URL = "https://haveibeenpwned.com/api/v3";

interface HIBPBreach {
  Name: string;
  Title: string;
  Domain: string;
  BreachDate: string;
  AddedDate: string;
  ModifiedDate: string;
  PwnCount: number;
  Description: string;
  DataClasses: string[];
  IsVerified: boolean;
  IsFabricated: boolean;
  IsSensitive: boolean;
  IsRetired: boolean;
  IsSpamList: boolean;
  IsMalware: boolean;
}

export async function checkBreaches(email: string): Promise<BreachResult> {
  const apiKey = process.env.HIBP_API_KEY;
  
  if (!apiKey) {
    return {
      found: false,
      breachCount: 0,
      sources: [],
      severity: "low",
      apiAvailable: false,
      limitationNote: "Breach detection requires a HaveIBeenPwned API key. Without it, we cannot check if this email appears in known data breaches. Visit haveibeenpwned.com/API/Key to obtain an API key.",
    };
  }

  try {
    const response = await fetch(
      `${HIBP_API_URL}/breachedaccount/${encodeURIComponent(email)}?truncateResponse=false`,
      {
        headers: {
          "hibp-api-key": apiKey,
          "user-agent": "NothingHide-ExposureAnalysis",
        },
      }
    );

    if (response.status === 404) {
      return {
        found: false,
        breachCount: 0,
        sources: [],
        severity: "low",
        apiAvailable: true,
      };
    }

    if (response.status === 401) {
      return {
        found: false,
        breachCount: 0,
        sources: [],
        severity: "low",
        apiAvailable: false,
        limitationNote: "The provided API key is invalid. Please check your HaveIBeenPwned API key configuration.",
      };
    }

    if (response.status === 429) {
      return {
        found: false,
        breachCount: 0,
        sources: [],
        severity: "low",
        apiAvailable: false,
        limitationNote: "Rate limit exceeded. Please try again in a few moments.",
      };
    }

    if (!response.ok) {
      throw new Error(`HIBP API error: ${response.status}`);
    }

    const breaches: HIBPBreach[] = await response.json();
    
    const sources = breaches.map((breach) => ({
      name: breach.Title || breach.Name,
      domain: breach.Domain,
      breachDate: breach.BreachDate,
      dataClasses: breach.DataClasses,
      pwnCount: breach.PwnCount,
    }));

    const severity = calculateSeverity(breaches);

    return {
      found: true,
      breachCount: breaches.length,
      sources,
      severity,
      apiAvailable: true,
    };
  } catch (error) {
    console.error("HIBP API error:", error);
    return {
      found: false,
      breachCount: 0,
      sources: [],
      severity: "low",
      apiAvailable: false,
      limitationNote: "An error occurred while checking breach databases. The service may be temporarily unavailable.",
    };
  }
}

function calculateSeverity(breaches: HIBPBreach[]): "low" | "medium" | "high" | "critical" {
  if (breaches.length === 0) return "low";
  
  const sensitiveDataTypes = ["Passwords", "Credit cards", "Social security numbers", "Bank account numbers"];
  
  let hasSensitiveData = false;
  let hasRecentBreach = false;
  const now = new Date();
  const twoYearsAgo = new Date(now.getFullYear() - 2, now.getMonth(), now.getDate());

  for (const breach of breaches) {
    if (breach.DataClasses?.some(dc => sensitiveDataTypes.includes(dc))) {
      hasSensitiveData = true;
    }
    if (new Date(breach.BreachDate) > twoYearsAgo) {
      hasRecentBreach = true;
    }
  }

  if (breaches.length >= 10 || (hasSensitiveData && hasRecentBreach)) {
    return "critical";
  }
  if (breaches.length >= 5 || hasSensitiveData) {
    return "high";
  }
  if (breaches.length >= 2 || hasRecentBreach) {
    return "medium";
  }
  return "low";
}
