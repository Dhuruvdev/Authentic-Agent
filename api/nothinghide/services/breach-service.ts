import { db } from "../db";
import { breachSources, breachedEmails, passwordHashPrefixes, scanLogs } from "../db/schema";
import { hashEmail, getPasswordHashPrefix, sha256 } from "./crypto";
import { fetchPwnedPasswordsRange } from "./scraper";
import { eq, sql } from "drizzle-orm";

export interface BreachCheckResult {
  found: boolean;
  breachCount: number;
  sources: Array<{
    name: string;
    domain?: string;
    breachDate?: string;
    dataClasses?: string[];
    pwnCount?: number;
  }>;
  severity: "low" | "medium" | "high" | "critical";
  apiAvailable: boolean;
  limitationNote?: string;
}

export interface PasswordCheckResult {
  found: boolean;
  count: number;
  matches: Array<{
    suffix: string;
    count: number;
  }>;
  severity: "low" | "medium" | "high" | "critical";
}

export interface BreachStats {
  totalBreaches: number;
  totalEmails: number;
  totalPasswords: number;
  lastUpdated: string;
}

export async function checkEmailBreach(email: string, ipAddress?: string): Promise<BreachCheckResult> {
  try {
    const emailHash = hashEmail(email);
    
    const results = db
      .select({
        breachId: breachSources.id,
        name: breachSources.name,
        domain: breachSources.domain,
        breachDate: breachSources.breachDate,
        dataClasses: breachSources.dataClasses,
        pwnCount: breachSources.pwnCount,
        isSensitive: breachSources.isSensitive,
      })
      .from(breachedEmails)
      .innerJoin(breachSources, eq(breachedEmails.breachSourceId, breachSources.id))
      .where(eq(breachedEmails.emailHash, emailHash))
      .all();

    db.insert(scanLogs).values({
      inputType: "email",
      inputHashPrefix: emailHash.substring(0, 8),
      resultFound: results.length > 0,
      ipHash: ipAddress ? sha256(ipAddress) : null,
    }).run();

    if (results.length === 0) {
      const allBreaches = db.select().from(breachSources).all();
      
      return {
        found: false,
        breachCount: 0,
        sources: [],
        severity: "low",
        apiAvailable: true,
        limitationNote: allBreaches.length > 0 
          ? `Checked against ${allBreaches.length} known breach sources. Email not found in database.`
          : undefined,
      };
    }

    const sources = results.map((r) => ({
      name: r.name,
      domain: r.domain || undefined,
      breachDate: r.breachDate || undefined,
      dataClasses: r.dataClasses ? JSON.parse(r.dataClasses) : undefined,
      pwnCount: r.pwnCount || undefined,
    }));

    const severity = calculateSeverity(results);

    return {
      found: true,
      breachCount: results.length,
      sources,
      severity,
      apiAvailable: true,
    };
  } catch (error) {
    console.error("[NothingHide] Email breach check error:", error);
    return {
      found: false,
      breachCount: 0,
      sources: [],
      severity: "low",
      apiAvailable: false,
      limitationNote: "An error occurred while checking the breach database.",
    };
  }
}

export async function checkPasswordBreach(passwordOrHash: string, useLive: boolean = false): Promise<PasswordCheckResult> {
  try {
    const { prefix, suffix } = getPasswordHashPrefix(passwordOrHash);
    
    let results = db
      .select({
        suffix: passwordHashPrefixes.suffix,
        count: passwordHashPrefixes.count,
      })
      .from(passwordHashPrefixes)
      .where(eq(passwordHashPrefixes.prefix, prefix))
      .all();

    if (results.length === 0 && useLive) {
      console.log(`[NothingHide] No local results for prefix ${prefix}, fetching from Pwned Passwords API...`);
      
      try {
        const liveResults = await fetchPwnedPasswordsRange(prefix);
        
        for (const pwd of liveResults) {
          db.insert(passwordHashPrefixes).values({
            prefix,
            suffix: pwd.suffix,
            count: pwd.count,
          }).run();
        }
        
        results = liveResults;
        console.log(`[NothingHide] Cached ${liveResults.length} password hashes for prefix ${prefix}`);
      } catch (liveError) {
        console.error("[NothingHide] Live password fetch failed:", liveError);
      }
    }

    const matchingEntry = results.find((r) => r.suffix === suffix);
    const found = !!matchingEntry;

    db.insert(scanLogs).values({
      inputType: "password",
      inputHashPrefix: prefix,
      resultFound: found,
    }).run();

    let severity: "low" | "medium" | "high" | "critical" = "low";
    if (found && matchingEntry) {
      const count = matchingEntry.count || 1;
      if (count > 10000) severity = "critical";
      else if (count > 1000) severity = "high";
      else if (count > 100) severity = "medium";
    }

    return {
      found,
      count: matchingEntry?.count || 0,
      matches: results.map((r) => ({
        suffix: r.suffix,
        count: r.count || 1,
      })),
      severity,
    };
  } catch (error) {
    console.error("[NothingHide] Password breach check error:", error);
    return {
      found: false,
      count: 0,
      matches: [],
      severity: "low",
    };
  }
}

export async function getAllBreaches(): Promise<Array<{
  id: number;
  name: string;
  domain?: string;
  breachDate?: string;
  description?: string;
  pwnCount: number;
  dataClasses: string[];
  isVerified: boolean;
}>> {
  try {
    const results = db
      .select()
      .from(breachSources)
      .orderBy(sql`${breachSources.pwnCount} DESC`)
      .all();

    return results.map((r) => ({
      id: r.id,
      name: r.name,
      domain: r.domain || undefined,
      breachDate: r.breachDate || undefined,
      description: r.description || undefined,
      pwnCount: r.pwnCount || 0,
      dataClasses: r.dataClasses ? JSON.parse(r.dataClasses) : [],
      isVerified: r.isVerified ?? true,
    }));
  } catch (error) {
    console.error("[NothingHide] Get breaches error:", error);
    return [];
  }
}

export async function getBreachStats(): Promise<BreachStats> {
  try {
    const breachCount = db.select({ count: sql<number>`count(*)` }).from(breachSources).get();
    const emailCount = db.select({ count: sql<number>`count(*)` }).from(breachedEmails).get();
    const passwordCount = db.select({ count: sql<number>`count(*)` }).from(passwordHashPrefixes).get();

    return {
      totalBreaches: breachCount?.count || 0,
      totalEmails: emailCount?.count || 0,
      totalPasswords: passwordCount?.count || 0,
      lastUpdated: new Date().toISOString(),
    };
  } catch (error) {
    console.error("[NothingHide] Get stats error:", error);
    return {
      totalBreaches: 0,
      totalEmails: 0,
      totalPasswords: 0,
      lastUpdated: new Date().toISOString(),
    };
  }
}

function calculateSeverity(results: any[]): "low" | "medium" | "high" | "critical" {
  if (results.length === 0) return "low";

  const sensitiveDataTypes = ["Passwords", "Credit cards", "Social security numbers", "Bank account numbers", "Financial data", "Passport numbers"];
  
  let hasSensitiveData = false;
  let hasRecentBreach = false;
  let hasSensitiveBreach = false;
  const now = new Date();
  const twoYearsAgo = new Date(now.getFullYear() - 2, now.getMonth(), now.getDate());

  for (const result of results) {
    if (result.isSensitive) {
      hasSensitiveBreach = true;
    }
    
    const dataClasses = result.dataClasses ? JSON.parse(result.dataClasses) : [];
    if (dataClasses.some((dc: string) => sensitiveDataTypes.includes(dc))) {
      hasSensitiveData = true;
    }
    
    if (result.breachDate && new Date(result.breachDate) > twoYearsAgo) {
      hasRecentBreach = true;
    }
  }

  if (results.length >= 10 || hasSensitiveBreach || (hasSensitiveData && hasRecentBreach)) {
    return "critical";
  }
  if (results.length >= 5 || hasSensitiveData) {
    return "high";
  }
  if (results.length >= 2 || hasRecentBreach) {
    return "medium";
  }
  return "low";
}
