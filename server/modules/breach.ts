import type { BreachResult } from "@shared/schema";
import { checkEmailBreach as localCheckEmailBreach } from "../../api/nothinghide";

export async function checkBreaches(email: string): Promise<BreachResult> {
  try {
    const result = await localCheckEmailBreach(email);
    
    return {
      found: result.found,
      breachCount: result.breachCount,
      sources: result.sources.map((s) => ({
        name: s.name,
        domain: s.domain,
        breachDate: s.breachDate,
        dataClasses: s.dataClasses,
        pwnCount: s.pwnCount,
      })),
      severity: result.severity,
      apiAvailable: result.apiAvailable,
      limitationNote: result.limitationNote,
    };
  } catch (error) {
    console.error("[NothingHide] Breach check error:", error);
    return {
      found: false,
      breachCount: 0,
      sources: [],
      severity: "low",
      apiAvailable: false,
      limitationNote: "An error occurred while checking the local breach database.",
    };
  }
}
