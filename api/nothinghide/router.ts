import { Router, Request, Response, NextFunction } from "express";
import { initializeDatabase } from "./db";
import { 
  checkEmailBreach, 
  checkPasswordBreach, 
  getAllBreaches, 
  getBreachStats,
  BreachCheckResult,
  PasswordCheckResult
} from "./services/breach-service";
import { initializeBreachDatabase, importBreach, importPasswords } from "./services/ingestion";
import { getPasswordHashPrefix, hashEmail } from "./services/crypto";
import { 
  runFullOrchestration, 
  syncBreachData, 
  syncPasswordRange, 
  enrichEmailCheck,
  livePasswordCheck,
  getJobStatus,
  getActiveJobs
} from "./services/orchestrator";
import { verifyEmailDomain, generateEmailVariations, httpRequest } from "./services/scraper";
import { 
  recordRequest, 
  getRealTimeMetrics, 
  getRequestTimeline, 
  getErrorAnalysis,
  sha256ForAnalytics,
  incrementActiveConnections,
  decrementActiveConnections
} from "./services/analytics";

const router = Router();

let dbInitialized = false;

const rateLimitStore: Map<string, { count: number; resetAt: number }> = new Map();
const MAX_RATE_LIMIT_ENTRIES = 10000;

function pruneRateLimitStore(): number {
  const now = Date.now();
  let pruned = 0;
  for (const [key, record] of rateLimitStore) {
    if (now > record.resetAt) {
      rateLimitStore.delete(key);
      pruned++;
    }
  }
  return pruned;
}

function evictOldestEntries(count: number) {
  const entries = Array.from(rateLimitStore.entries())
    .sort((a, b) => a[1].resetAt - b[1].resetAt);
  
  for (let i = 0; i < Math.min(count, entries.length); i++) {
    rateLimitStore.delete(entries[i][0]);
  }
}

setInterval(pruneRateLimitStore, 60000);

function rateLimit(maxRequests: number, windowMs: number) {
  return (req: Request, res: Response, next: NextFunction) => {
    const key = req.ip || req.socket.remoteAddress || "unknown";
    const now = Date.now();
    
    const record = rateLimitStore.get(key);
    if (record) {
      if (now > record.resetAt) {
        rateLimitStore.set(key, { count: 1, resetAt: now + windowMs });
        return next();
      }
      
      if (record.count >= maxRequests) {
        return res.status(429).json({ 
          error: "Too many requests",
          retryAfter: Math.ceil((record.resetAt - now) / 1000)
        });
      }
      
      record.count++;
      return next();
    }
    
    if (rateLimitStore.size >= MAX_RATE_LIMIT_ENTRIES) {
      const pruned = pruneRateLimitStore();
      if (pruned === 0 && rateLimitStore.size >= MAX_RATE_LIMIT_ENTRIES) {
        evictOldestEntries(1000);
      }
    }
    
    rateLimitStore.set(key, { count: 1, resetAt: now + windowMs });
    next();
  };
}

function requireAdminKey(req: Request, res: Response, next: NextFunction) {
  const adminKey = process.env.NOTHINGHIDE_ADMIN_KEY;
  
  if (!adminKey) {
    return res.status(503).json({ 
      error: "Admin endpoints are disabled. Set NOTHINGHIDE_ADMIN_KEY environment variable to enable." 
    });
  }
  
  const providedKey = req.headers["x-admin-key"] || req.query.adminKey;
  
  if (providedKey !== adminKey) {
    return res.status(401).json({ error: "Invalid or missing admin key" });
  }
  
  next();
}

const publicRateLimit = rateLimit(100, 60000);
const sensitiveRateLimit = rateLimit(10, 60000);
const adminRateLimit = rateLimit(5, 60000);

function analyticsMiddleware(req: Request, res: Response, next: NextFunction) {
  const startTime = Date.now();
  let recorded = false;
  
  const isSSE = req.path.includes('/analytics/live');
  
  if (!isSSE) {
    incrementActiveConnections();
  }
  
  const recordMetric = (aborted: boolean = false) => {
    if (recorded) return;
    recorded = true;
    
    if (!isSSE) {
      decrementActiveConnections();
    }
    
    if (isSSE) return;
    
    const responseTime = Date.now() - startTime;
    const ipHash = sha256ForAnalytics(req.ip || req.socket.remoteAddress || 'unknown');
    
    recordRequest({
      endpoint: req.path,
      method: req.method,
      statusCode: aborted ? 499 : res.statusCode,
      responseTimeMs: responseTime,
      timestamp: Date.now(),
      ipHash,
      userAgent: req.get('user-agent'),
    });
  };
  
  res.on('finish', () => recordMetric(false));
  res.on('close', () => recordMetric(true));
  
  next();
}

router.use(analyticsMiddleware);

async function ensureDbInitialized() {
  if (!dbInitialized) {
    initializeDatabase();
    await initializeBreachDatabase();
    dbInitialized = true;
  }
}

router.get("/health", async (_req: Request, res: Response) => {
  await ensureDbInitialized();
  const stats = await getBreachStats();
  
  res.json({
    status: "ok",
    service: "NothingHide API",
    version: "2.0.0",
    features: [
      "email_breach_check",
      "password_breach_check",
      "k_anonymity",
      "live_password_sync",
      "orchestration",
      "email_enrichment"
    ],
    database: {
      connected: true,
      ...stats,
    },
    timestamp: new Date().toISOString(),
  });
});

router.get("/breaches", async (_req: Request, res: Response) => {
  await ensureDbInitialized();
  const breaches = await getAllBreaches();
  
  res.json({
    count: breaches.length,
    breaches,
  });
});

router.get("/stats", async (_req: Request, res: Response) => {
  await ensureDbInitialized();
  const stats = await getBreachStats();
  
  res.json(stats);
});

router.post("/check-email", publicRateLimit, async (req: Request, res: Response) => {
  await ensureDbInitialized();
  
  const { email, enrich } = req.body;
  
  if (!email || typeof email !== "string") {
    return res.status(400).json({ error: "Email is required" });
  }
  
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ error: "Invalid email format" });
  }
  
  const ipAddress = req.ip || req.socket.remoteAddress;
  const result = await checkEmailBreach(email, ipAddress);
  
  if (enrich) {
    const enrichment = await enrichEmailCheck(email);
    const domainInfo = await verifyEmailDomain(email);
    
    return res.json({
      ...result,
      enrichment: {
        variations: enrichment.variations,
        domainInfo,
        emailHash: hashEmail(email).substring(0, 16) + "...",
      },
    });
  }
  
  res.json(result);
});

router.post("/check-password", publicRateLimit, async (req: Request, res: Response) => {
  await ensureDbInitialized();
  
  const { password, hash, prefix, live } = req.body;
  
  if (!password && !hash && !prefix) {
    return res.status(400).json({ 
      error: "Provide password, hash (SHA-1), or prefix (first 5 chars of SHA-1 hash)" 
    });
  }
  
  if (live && password) {
    const liveResult = await livePasswordCheck(password);
    return res.json({
      ...liveResult,
      mode: "live",
      message: liveResult.found 
        ? `This password has been seen ${liveResult.count.toLocaleString()} times in data breaches`
        : "This password was not found in known data breaches",
    });
  }
  
  let result: PasswordCheckResult;
  
  if (prefix && typeof prefix === "string" && prefix.length === 5) {
    const matches = await checkPasswordBreach(prefix + "0".repeat(35));
    
    result = {
      found: matches.matches.length > 0,
      count: matches.matches.reduce((sum, m) => sum + m.count, 0),
      matches: matches.matches,
      severity: matches.severity,
    };
  } else if (hash && typeof hash === "string") {
    result = await checkPasswordBreach(hash);
  } else if (password && typeof password === "string") {
    result = await checkPasswordBreach(password);
  } else {
    return res.status(400).json({ error: "Invalid input" });
  }
  
  res.json(result);
});

router.post("/check-password/range", publicRateLimit, async (req: Request, res: Response) => {
  await ensureDbInitialized();
  
  const { prefix } = req.body;
  
  if (!prefix || typeof prefix !== "string" || prefix.length !== 5) {
    return res.status(400).json({ 
      error: "Prefix must be exactly 5 characters (first 5 chars of SHA-1 hash)" 
    });
  }
  
  const result = await checkPasswordBreach(prefix.toUpperCase() + "0".repeat(35));
  
  const rangeText = result.matches
    .map((m) => `${m.suffix}:${m.count}`)
    .join("\n");
  
  res.type("text/plain").send(rangeText);
});

router.post("/check-password/live", sensitiveRateLimit, async (req: Request, res: Response) => {
  await ensureDbInitialized();
  
  const { password } = req.body;
  
  if (!password || typeof password !== "string") {
    return res.status(400).json({ error: "Password is required" });
  }
  
  const result = await livePasswordCheck(password);
  
  res.json({
    ...result,
    message: result.found 
      ? `This password has been seen ${result.count.toLocaleString()} times in data breaches. You should not use this password.`
      : "This password was not found in known data breaches. However, this doesn't guarantee it's secure.",
  });
});

router.post("/email/enrich", sensitiveRateLimit, async (req: Request, res: Response) => {
  await ensureDbInitialized();
  
  const { email } = req.body;
  
  if (!email || typeof email !== "string") {
    return res.status(400).json({ error: "Email is required" });
  }
  
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ error: "Invalid email format" });
  }
  
  const enrichment = await enrichEmailCheck(email);
  const domainInfo = await verifyEmailDomain(email);
  const variations = generateEmailVariations(email);
  
  res.json({
    email,
    normalizedHash: hashEmail(email),
    variations: variations.slice(0, 10),
    domain: domainInfo,
    variationHashes: enrichment.breachHashes.slice(0, 5).map((h) => h.substring(0, 16) + "..."),
  });
});

router.post("/orchestrate/full", requireAdminKey, adminRateLimit, async (_req: Request, res: Response) => {
  await ensureDbInitialized();
  
  console.log("[NothingHide API] Starting full orchestration...");
  const result = await runFullOrchestration();
  
  res.json({
    success: result.success,
    message: result.success ? "Orchestration completed successfully" : "Orchestration failed",
    stats: {
      breachesAdded: result.breachesAdded,
      emailsProcessed: result.emailsProcessed,
      passwordsAdded: result.passwordsAdded,
      duration: `${(result.duration / 1000).toFixed(2)}s`,
    },
    errors: result.errors.length > 0 ? result.errors : undefined,
  });
});

router.post("/orchestrate/sync-breaches", requireAdminKey, adminRateLimit, async (_req: Request, res: Response) => {
  await ensureDbInitialized();
  
  const result = await syncBreachData();
  
  res.json({
    success: result.success,
    breachesUpdated: result.breachesUpdated,
  });
});

router.post("/orchestrate/sync-passwords/:prefix", requireAdminKey, adminRateLimit, async (req: Request, res: Response) => {
  await ensureDbInitialized();
  
  const { prefix } = req.params;
  
  if (!prefix || prefix.length !== 5 || !/^[A-Fa-f0-9]{5}$/.test(prefix)) {
    return res.status(400).json({ error: "Invalid prefix format" });
  }
  
  const result = await syncPasswordRange(prefix.toUpperCase());
  
  res.json({
    success: result.success,
    prefix: prefix.toUpperCase(),
    passwordsAdded: result.passwordsAdded,
  });
});

router.get("/orchestrate/jobs", requireAdminKey, async (_req: Request, res: Response) => {
  const jobs = getActiveJobs();
  res.json({ jobs });
});

router.get("/orchestrate/jobs/:jobId", requireAdminKey, async (req: Request, res: Response) => {
  const { jobId } = req.params;
  const job = getJobStatus(jobId);
  
  if (!job) {
    return res.status(404).json({ error: "Job not found" });
  }
  
  res.json(job);
});

router.post("/import/breach", requireAdminKey, adminRateLimit, async (req: Request, res: Response) => {
  await ensureDbInitialized();
  
  const { name, domain, breachDate, description, dataClasses, pwnCount, emails } = req.body;
  
  if (!name) {
    return res.status(400).json({ error: "Breach name is required" });
  }
  
  const result = await importBreach({
    name,
    domain,
    breachDate,
    description,
    dataClasses,
    pwnCount,
    emails,
  });
  
  if (result.success) {
    res.json({
      message: "Breach imported successfully",
      breachId: result.breachId,
      emailsAdded: result.emailsAdded,
    });
  } else {
    res.status(500).json({ error: "Failed to import breach" });
  }
});

router.post("/import/passwords", requireAdminKey, adminRateLimit, async (req: Request, res: Response) => {
  await ensureDbInitialized();
  
  const { passwords, hashes, breachName } = req.body;
  
  if (!passwords && !hashes) {
    return res.status(400).json({ 
      error: "Provide either passwords array or hashes array [{hash, count}]" 
    });
  }
  
  const result = await importPasswords({
    passwords,
    hashes,
    breachName,
  });
  
  if (result.success) {
    res.json({
      message: "Passwords imported successfully",
      passwordsAdded: result.passwordsAdded,
    });
  } else {
    res.status(500).json({ error: "Failed to import passwords" });
  }
});

router.post("/curl", requireAdminKey, adminRateLimit, async (req: Request, res: Response) => {
  const { url, method, headers, body, timeout } = req.body;
  
  if (!url || typeof url !== "string") {
    return res.status(400).json({ error: "URL is required" });
  }
  
  try {
    const result = await httpRequest(url, {
      method: method || "GET",
      headers: headers || {},
      body: body,
      timeout: timeout || 30000,
    });
    
    res.json({
      success: result.success,
      statusCode: result.statusCode,
      responseTime: result.responseTime,
      data: result.data ? result.data.substring(0, 10000) : null,
      error: result.error,
    });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

router.post("/initialize", requireAdminKey, adminRateLimit, async (_req: Request, res: Response) => {
  try {
    initializeDatabase();
    await initializeBreachDatabase();
    dbInitialized = true;
    
    const stats = await getBreachStats();
    
    res.json({
      message: "Database initialized successfully",
      stats,
    });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

router.get("/analytics/realtime", async (_req: Request, res: Response) => {
  const metrics = getRealTimeMetrics();
  res.json(metrics);
});

router.get("/analytics/timeline", async (req: Request, res: Response) => {
  const minutes = parseInt(req.query.minutes as string) || 5;
  const timeline = getRequestTimeline(Math.min(60, Math.max(1, minutes)));
  res.json({
    period: `${minutes} minutes`,
    timeline,
  });
});

router.get("/analytics/errors", async (_req: Request, res: Response) => {
  const errors = getErrorAnalysis();
  res.json({
    totalErrors: errors.reduce((sum, e) => sum + e.count, 0),
    errors,
  });
});

router.get("/analytics/live", async (_req: Request, res: Response) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');
  
  const sendMetrics = () => {
    const metrics = getRealTimeMetrics();
    res.write(`data: ${JSON.stringify(metrics)}\n\n`);
  };
  
  sendMetrics();
  
  const interval = setInterval(sendMetrics, 2000);
  
  req.on('close', () => {
    clearInterval(interval);
    res.end();
  });
});

export { router as nothingHideRouter, ensureDbInitialized };
