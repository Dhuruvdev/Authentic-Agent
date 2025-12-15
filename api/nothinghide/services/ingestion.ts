import { db } from "../db";
import { breachSources, breachedEmails, passwordHashPrefixes } from "../db/schema";
import { hashEmail, sha1 } from "./crypto";
import { scrapeBreachDirectory, fetchPwnedPasswordsRange } from "./scraper";
import { eq, sql } from "drizzle-orm";

export interface BreachImportData {
  name: string;
  domain?: string;
  breachDate?: string;
  description?: string;
  dataClasses?: string[];
  pwnCount?: number;
  isVerified?: boolean;
  isSensitive?: boolean;
  emails?: string[];
}

export interface PasswordImportData {
  passwords?: string[];
  hashes?: Array<{ hash: string; count: number }>;
  breachName?: string;
}

export async function importBreach(data: BreachImportData): Promise<{ success: boolean; breachId?: number; emailsAdded?: number }> {
  try {
    const existing = db.select().from(breachSources).where(eq(breachSources.name, data.name)).get();
    
    let breachId: number;
    
    if (existing) {
      db.update(breachSources)
        .set({
          domain: data.domain,
          breachDate: data.breachDate,
          description: data.description,
          dataClasses: data.dataClasses ? JSON.stringify(data.dataClasses) : null,
          pwnCount: data.pwnCount,
          isVerified: data.isVerified ?? true,
          isSensitive: data.isSensitive ?? false,
        })
        .where(eq(breachSources.id, existing.id))
        .run();
      breachId = existing.id;
    } else {
      const result = db.insert(breachSources).values({
        name: data.name,
        domain: data.domain,
        breachDate: data.breachDate,
        description: data.description,
        dataClasses: data.dataClasses ? JSON.stringify(data.dataClasses) : null,
        pwnCount: data.pwnCount || 0,
        isVerified: data.isVerified ?? true,
        isSensitive: data.isSensitive ?? false,
      }).run();
      breachId = Number(result.lastInsertRowid);
    }

    let emailsAdded = 0;
    if (data.emails && data.emails.length > 0) {
      const batchSize = 1000;
      for (let i = 0; i < data.emails.length; i += batchSize) {
        const batch = data.emails.slice(i, i + batchSize);
        const values = batch.map((email) => ({
          emailHash: hashEmail(email),
          breachSourceId: breachId,
        }));
        
        db.insert(breachedEmails).values(values).run();
        emailsAdded += batch.length;
      }
    }

    console.log(`[NothingHide] Imported breach: ${data.name}, emails added: ${emailsAdded}`);
    
    return { success: true, breachId, emailsAdded };
  } catch (error) {
    console.error("[NothingHide] Import breach error:", error);
    return { success: false };
  }
}

export async function importPasswords(data: PasswordImportData): Promise<{ success: boolean; passwordsAdded?: number }> {
  try {
    let breachSourceId: number | null = null;
    
    if (data.breachName) {
      const breach = db.select().from(breachSources).where(eq(breachSources.name, data.breachName)).get();
      if (breach) {
        breachSourceId = breach.id;
      }
    }

    let passwordsAdded = 0;
    const batchSize = 1000;

    if (data.passwords && data.passwords.length > 0) {
      for (let i = 0; i < data.passwords.length; i += batchSize) {
        const batch = data.passwords.slice(i, i + batchSize);
        const values = batch.map((password) => {
          const hash = sha1(password);
          return {
            prefix: hash.substring(0, 5),
            suffix: hash.substring(5),
            count: 1,
            breachSourceId,
          };
        });
        
        db.insert(passwordHashPrefixes).values(values).run();
        passwordsAdded += batch.length;
      }
    }

    if (data.hashes && data.hashes.length > 0) {
      for (let i = 0; i < data.hashes.length; i += batchSize) {
        const batch = data.hashes.slice(i, i + batchSize);
        const values = batch.map((item) => {
          const hash = item.hash.toUpperCase();
          return {
            prefix: hash.substring(0, 5),
            suffix: hash.substring(5),
            count: item.count,
            breachSourceId,
          };
        });
        
        db.insert(passwordHashPrefixes).values(values).run();
        passwordsAdded += batch.length;
      }
    }

    console.log(`[NothingHide] Imported ${passwordsAdded} password hashes`);
    
    return { success: true, passwordsAdded };
  } catch (error) {
    console.error("[NothingHide] Import passwords error:", error);
    return { success: false };
  }
}

export async function initializeBreachDatabase(): Promise<void> {
  const isDevelopment = process.env.NODE_ENV !== "production";
  
  console.log("[NothingHide] Initializing breach database...");

  const existingCount = db.select({ count: sql<number>`count(*)` }).from(breachSources).get();
  
  if (existingCount && existingCount.count > 0) {
    console.log(`[NothingHide] Database already has ${existingCount.count} breach sources`);
    return;
  }

  if (!isDevelopment) {
    console.log("[NothingHide] Production mode: Skipping reference data seeding.");
    console.log("[NothingHide] Use admin endpoints to import real breach data.");
    return;
  }

  console.log("[NothingHide] Development mode: Seeding reference breach metadata...");
  
  const breaches = await scrapeBreachDirectory();
  
  for (const breach of breaches) {
    await importBreach({
      name: breach.name,
      domain: breach.domain,
      breachDate: breach.breachDate,
      description: breach.description,
      dataClasses: breach.dataClasses,
      pwnCount: breach.pwnCount,
      isVerified: breach.isVerified,
    });
  }

  console.log("[NothingHide] Syncing password hashes from Pwned Passwords API (k-anonymity)...");
  
  const commonPrefixes = ["00000", "21BD1", "A94A8", "5BAA6", "7C4A8"];
  
  for (const prefix of commonPrefixes) {
    try {
      const passwords = await fetchPwnedPasswordsRange(prefix);
      
      for (const pwd of passwords.slice(0, 500)) {
        db.insert(passwordHashPrefixes).values({
          prefix,
          suffix: pwd.suffix,
          count: pwd.count,
        }).run();
      }
      
      await new Promise((resolve) => setTimeout(resolve, 200));
    } catch (error) {
      console.error(`[NothingHide] Failed to fetch prefix ${prefix}:`, error);
    }
  }

  console.log("[NothingHide] Development seed complete. Use admin endpoints to import production data.");
}

export async function seedDemoData(): Promise<void> {
  await initializeBreachDatabase();
}
