import { db } from "../db";
import { breachSources, breachedEmails, passwordHashPrefixes } from "../db/schema";
import { scrapeBreachDirectory, fetchPwnedPasswordsRange, verifyEmailDomain, generateEmailVariations, hashForSearch } from "./scraper";
import { hashEmail, sha1 } from "./crypto";
import { eq, sql } from "drizzle-orm";

export interface OrchestrationJob {
  id: string;
  type: "full_sync" | "breach_update" | "password_range_sync" | "email_verification";
  status: "pending" | "running" | "completed" | "failed";
  startedAt?: string;
  completedAt?: string;
  progress: number;
  totalItems: number;
  processedItems: number;
  errors: string[];
}

export interface OrchestrationResult {
  success: boolean;
  breachesAdded: number;
  emailsProcessed: number;
  passwordsAdded: number;
  errors: string[];
  duration: number;
}

const activeJobs: Map<string, OrchestrationJob> = new Map();

function generateJobId(): string {
  return `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

export function getJobStatus(jobId: string): OrchestrationJob | null {
  return activeJobs.get(jobId) || null;
}

export function getActiveJobs(): OrchestrationJob[] {
  return Array.from(activeJobs.values());
}

export async function runFullOrchestration(): Promise<OrchestrationResult> {
  const startTime = Date.now();
  const jobId = generateJobId();
  
  const job: OrchestrationJob = {
    id: jobId,
    type: "full_sync",
    status: "running",
    startedAt: new Date().toISOString(),
    progress: 0,
    totalItems: 0,
    processedItems: 0,
    errors: [],
  };
  
  activeJobs.set(jobId, job);
  console.log(`[NothingHide Orchestrator] Starting full orchestration job: ${jobId}`);

  let breachesAdded = 0;
  let emailsProcessed = 0;
  let passwordsAdded = 0;
  const errors: string[] = [];

  try {
    job.status = "running";
    
    console.log("[NothingHide Orchestrator] Phase 1: Scraping breach directory...");
    const breaches = await scrapeBreachDirectory();
    job.totalItems = breaches.length;

    for (const breach of breaches) {
      try {
        const existing = db.select().from(breachSources).where(eq(breachSources.name, breach.name)).get();
        
        if (existing) {
          db.update(breachSources)
            .set({
              domain: breach.domain,
              breachDate: breach.breachDate,
              description: breach.description,
              dataClasses: JSON.stringify(breach.dataClasses),
              pwnCount: breach.pwnCount,
              isVerified: breach.isVerified,
            })
            .where(eq(breachSources.id, existing.id))
            .run();
        } else {
          db.insert(breachSources).values({
            name: breach.name,
            domain: breach.domain,
            breachDate: breach.breachDate,
            description: breach.description,
            dataClasses: JSON.stringify(breach.dataClasses),
            pwnCount: breach.pwnCount,
            isVerified: breach.isVerified,
          }).run();
          breachesAdded++;
        }

        job.processedItems++;
        job.progress = Math.round((job.processedItems / job.totalItems) * 50);
      } catch (err) {
        const errorMsg = `Failed to process breach ${breach.name}: ${err}`;
        console.error(`[NothingHide Orchestrator] ${errorMsg}`);
        errors.push(errorMsg);
      }
    }

    console.log("[NothingHide Orchestrator] Phase 2: Syncing common password hashes...");
    const commonPrefixes = ["00000", "21BD1", "A94A8", "5BAA6", "7C4A8", "E99A1", "D8578"];
    
    for (const prefix of commonPrefixes) {
      try {
        const passwords = await fetchPwnedPasswordsRange(prefix);
        
        for (const pwd of passwords.slice(0, 100)) {
          const existing = db
            .select()
            .from(passwordHashPrefixes)
            .where(sql`${passwordHashPrefixes.prefix} = ${prefix} AND ${passwordHashPrefixes.suffix} = ${pwd.suffix}`)
            .get();

          if (!existing) {
            db.insert(passwordHashPrefixes).values({
              prefix,
              suffix: pwd.suffix,
              count: pwd.count,
            }).run();
            passwordsAdded++;
          } else {
            db.update(passwordHashPrefixes)
              .set({ count: pwd.count })
              .where(eq(passwordHashPrefixes.id, existing.id))
              .run();
          }
        }

        job.progress = Math.round(50 + ((commonPrefixes.indexOf(prefix) + 1) / commonPrefixes.length) * 50);
        
        await new Promise((resolve) => setTimeout(resolve, 100));
      } catch (err) {
        const errorMsg = `Failed to fetch password range ${prefix}: ${err}`;
        console.error(`[NothingHide Orchestrator] ${errorMsg}`);
        errors.push(errorMsg);
      }
    }

    job.status = "completed";
    job.completedAt = new Date().toISOString();
    job.progress = 100;
    
    console.log(`[NothingHide Orchestrator] Orchestration completed. Breaches: ${breachesAdded}, Passwords: ${passwordsAdded}`);

  } catch (error) {
    job.status = "failed";
    job.errors.push(String(error));
    errors.push(String(error));
    console.error("[NothingHide Orchestrator] Orchestration failed:", error);
  }

  const duration = Date.now() - startTime;

  return {
    success: job.status === "completed",
    breachesAdded,
    emailsProcessed,
    passwordsAdded,
    errors,
    duration,
  };
}

export async function syncBreachData(): Promise<{ success: boolean; breachesUpdated: number }> {
  console.log("[NothingHide Orchestrator] Starting breach data sync...");
  
  try {
    const breaches = await scrapeBreachDirectory();
    let breachesUpdated = 0;

    for (const breach of breaches) {
      const existing = db.select().from(breachSources).where(eq(breachSources.name, breach.name)).get();
      
      if (!existing) {
        db.insert(breachSources).values({
          name: breach.name,
          domain: breach.domain,
          breachDate: breach.breachDate,
          description: breach.description,
          dataClasses: JSON.stringify(breach.dataClasses),
          pwnCount: breach.pwnCount,
          isVerified: breach.isVerified,
        }).run();
        breachesUpdated++;
      }
    }

    console.log(`[NothingHide Orchestrator] Breach sync completed. Added ${breachesUpdated} new breaches.`);
    return { success: true, breachesUpdated };
  } catch (error) {
    console.error("[NothingHide Orchestrator] Breach sync failed:", error);
    return { success: false, breachesUpdated: 0 };
  }
}

export async function syncPasswordRange(prefix: string): Promise<{ success: boolean; passwordsAdded: number }> {
  console.log(`[NothingHide Orchestrator] Syncing password range for prefix: ${prefix}`);
  
  try {
    const passwords = await fetchPwnedPasswordsRange(prefix);
    let passwordsAdded = 0;

    for (const pwd of passwords) {
      const existing = db
        .select()
        .from(passwordHashPrefixes)
        .where(sql`${passwordHashPrefixes.prefix} = ${prefix} AND ${passwordHashPrefixes.suffix} = ${pwd.suffix}`)
        .get();

      if (!existing) {
        db.insert(passwordHashPrefixes).values({
          prefix,
          suffix: pwd.suffix,
          count: pwd.count,
        }).run();
        passwordsAdded++;
      }
    }

    console.log(`[NothingHide Orchestrator] Password sync completed. Added ${passwordsAdded} hashes.`);
    return { success: true, passwordsAdded };
  } catch (error) {
    console.error("[NothingHide Orchestrator] Password sync failed:", error);
    return { success: false, passwordsAdded: 0 };
  }
}

export async function enrichEmailCheck(email: string): Promise<{
  variations: string[];
  domainInfo: { valid: boolean; hasMx: boolean; disposable: boolean; domain: string };
  breachHashes: string[];
}> {
  const variations = generateEmailVariations(email);
  const domainInfo = await verifyEmailDomain(email);
  const breachHashes = variations.map((v) => hashEmail(v));

  return {
    variations,
    domainInfo,
    breachHashes,
  };
}

export async function processEmailForBreaches(email: string): Promise<{
  found: boolean;
  breachCount: number;
  sources: Array<{ name: string; domain?: string; breachDate?: string; dataClasses?: string[] }>;
}> {
  const emailHash = hashEmail(email);
  
  const results = db
    .select({
      name: breachSources.name,
      domain: breachSources.domain,
      breachDate: breachSources.breachDate,
      dataClasses: breachSources.dataClasses,
    })
    .from(breachedEmails)
    .innerJoin(breachSources, eq(breachedEmails.breachSourceId, breachSources.id))
    .where(eq(breachedEmails.emailHash, emailHash))
    .all();

  return {
    found: results.length > 0,
    breachCount: results.length,
    sources: results.map((r) => ({
      name: r.name,
      domain: r.domain || undefined,
      breachDate: r.breachDate || undefined,
      dataClasses: r.dataClasses ? JSON.parse(r.dataClasses) : undefined,
    })),
  };
}

export async function livePasswordCheck(password: string): Promise<{
  found: boolean;
  count: number;
  severity: "low" | "medium" | "high" | "critical";
}> {
  const hash = sha1(password);
  const prefix = hash.substring(0, 5);
  const suffix = hash.substring(5);

  const localResult = db
    .select()
    .from(passwordHashPrefixes)
    .where(sql`${passwordHashPrefixes.prefix} = ${prefix} AND ${passwordHashPrefixes.suffix} = ${suffix}`)
    .get();

  if (localResult) {
    const count = localResult.count || 1;
    let severity: "low" | "medium" | "high" | "critical" = "low";
    if (count > 10000) severity = "critical";
    else if (count > 1000) severity = "high";
    else if (count > 100) severity = "medium";

    return { found: true, count, severity };
  }

  try {
    const liveResults = await fetchPwnedPasswordsRange(prefix);
    const match = liveResults.find((r) => r.suffix === suffix);

    if (match) {
      db.insert(passwordHashPrefixes).values({
        prefix,
        suffix,
        count: match.count,
      }).run();

      let severity: "low" | "medium" | "high" | "critical" = "low";
      if (match.count > 10000) severity = "critical";
      else if (match.count > 1000) severity = "high";
      else if (match.count > 100) severity = "medium";

      return { found: true, count: match.count, severity };
    }
  } catch (error) {
    console.error("[NothingHide Orchestrator] Live password check failed:", error);
  }

  return { found: false, count: 0, severity: "low" };
}
