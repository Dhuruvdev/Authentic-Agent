import { sql } from "drizzle-orm";
import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";

export const breachSources = sqliteTable("breach_sources", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull().unique(),
  domain: text("domain"),
  breachDate: text("breach_date"),
  addedDate: text("added_date").default(sql`CURRENT_TIMESTAMP`),
  description: text("description"),
  dataClasses: text("data_classes"),
  pwnCount: integer("pwn_count").default(0),
  isVerified: integer("is_verified", { mode: "boolean" }).default(true),
  isSensitive: integer("is_sensitive", { mode: "boolean" }).default(false),
});

export const breachedEmails = sqliteTable("breached_emails", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  emailHash: text("email_hash").notNull(),
  breachSourceId: integer("breach_source_id").notNull().references(() => breachSources.id),
  addedDate: text("added_date").default(sql`CURRENT_TIMESTAMP`),
}, (table) => ({
  emailHashIdx: index("email_hash_idx").on(table.emailHash),
  breachSourceIdx: index("breach_source_idx").on(table.breachSourceId),
}));

export const passwordHashPrefixes = sqliteTable("password_hash_prefixes", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  prefix: text("prefix").notNull(),
  suffix: text("suffix").notNull(),
  count: integer("count").default(1),
  breachSourceId: integer("breach_source_id").references(() => breachSources.id),
}, (table) => ({
  prefixIdx: index("prefix_idx").on(table.prefix),
}));

export const scanLogs = sqliteTable("scan_logs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  inputType: text("input_type").notNull(),
  inputHashPrefix: text("input_hash_prefix"),
  resultFound: integer("result_found", { mode: "boolean" }).default(false),
  scanDate: text("scan_date").default(sql`CURRENT_TIMESTAMP`),
  ipHash: text("ip_hash"),
});

export type BreachSource = typeof breachSources.$inferSelect;
export type InsertBreachSource = typeof breachSources.$inferInsert;
export type BreachedEmail = typeof breachedEmails.$inferSelect;
export type InsertBreachedEmail = typeof breachedEmails.$inferInsert;
export type PasswordHashPrefix = typeof passwordHashPrefixes.$inferSelect;
export type InsertPasswordHashPrefix = typeof passwordHashPrefixes.$inferInsert;
