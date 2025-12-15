import type { Express, Response } from "express";
import { createServer, type Server } from "http";
import { classifyInput } from "./modules/signal";
import { checkBreaches } from "./modules/breach";
import { correlateUsername, correlateEmail } from "./modules/correlate";
import { analyzeImageExposure } from "./modules/facerisk";
import { generateVerdict } from "./modules/verdict";
import { generateGuidance } from "./modules/guidance";
import { generateTransparency } from "./modules/transparency";
import type { ChainEvent, ScanResult, InputClassification, BreachResult, CorrelationResult, ImageRiskResult } from "@shared/schema";
import { randomUUID } from "crypto";

function sendSSEEvent(res: Response, type: string, data: any) {
  res.write(`data: ${JSON.stringify({ type, ...data })}\n\n`);
}

function createEvent(module: string, message: string, status: ChainEvent["status"], details?: any): ChainEvent {
  return {
    id: randomUUID(),
    module,
    message,
    status,
    timestamp: new Date().toISOString(),
    details,
  };
}

async function performScan(input: string, res: Response): Promise<void> {
  // Step 1: Classify input
  sendSSEEvent(res, "event", { event: createEvent("signal", "Classifying input type...", "processing") });
  
  const classification = classifyInput(input);
  
  sendSSEEvent(res, "event", { 
    event: createEvent("signal", `Input classified as ${classification.type}`, "complete", { confidence: classification.confidence }) 
  });

  if (!classification.isValid) {
    sendSSEEvent(res, "event", { 
      event: createEvent("signal", classification.validationMessage || "Invalid input", "error") 
    });
    res.end();
    return;
  }

  let breach: BreachResult | undefined;
  let correlation: CorrelationResult | undefined;
  let imageRisk: ImageRiskResult | undefined;

  // Step 2: Run appropriate modules based on input type
  if (classification.type === "email") {
    // Breach check
    sendSSEEvent(res, "event", { event: createEvent("breach", "Querying breach databases...", "processing") });
    breach = await checkBreaches(classification.value);
    sendSSEEvent(res, "event", { 
      event: createEvent("breach", breach.found ? `Found in ${breach.breachCount} breaches` : "No breaches found", "complete") 
    });

    // Username correlation from email
    sendSSEEvent(res, "event", { event: createEvent("correlate", "Checking username correlation...", "processing") });
    correlation = await correlateEmail(classification.value);
    const foundCount = correlation.matches.filter(m => !m.available).length;
    sendSSEEvent(res, "event", { 
      event: createEvent("correlate", `Checked ${correlation.checkedPlatforms.length} platforms, found ${foundCount} matches`, "complete") 
    });

  } else if (classification.type === "username") {
    // Username correlation
    sendSSEEvent(res, "event", { event: createEvent("correlate", "Checking platform presence...", "processing") });
    correlation = await correlateUsername(classification.value);
    const foundCount = correlation.matches.filter(m => !m.available).length;
    sendSSEEvent(res, "event", { 
      event: createEvent("correlate", `Checked ${correlation.checkedPlatforms.length} platforms, found ${foundCount} matches`, "complete") 
    });

    // Skip breach check for usernames
    sendSSEEvent(res, "event", { 
      event: createEvent("breach", "Breach check skipped (requires email)", "skipped") 
    });

  } else if (classification.type === "image_url") {
    // Image analysis
    sendSSEEvent(res, "event", { event: createEvent("facerisk", "Analyzing image exposure...", "processing") });
    imageRisk = await analyzeImageExposure(classification.value);
    sendSSEEvent(res, "event", { 
      event: createEvent("facerisk", imageRisk.analyzed ? "Image analysis complete" : "Unable to analyze image", 
        imageRisk.analyzed ? "complete" : "error") 
    });

    // Skip other checks
    sendSSEEvent(res, "event", { 
      event: createEvent("breach", "Breach check skipped (requires email)", "skipped") 
    });
    sendSSEEvent(res, "event", { 
      event: createEvent("correlate", "Correlation check skipped (requires username)", "skipped") 
    });
  }

  // Step 3: Generate verdict
  sendSSEEvent(res, "event", { event: createEvent("verdict", "Calculating exposure score...", "processing") });
  const verdict = generateVerdict({ input: classification, breach, correlation, imageRisk });
  sendSSEEvent(res, "event", { 
    event: createEvent("verdict", `Exposure score: ${verdict.exposureScore}/100 (${verdict.riskLevel} risk)`, "complete") 
  });

  // Step 4: Generate guidance
  sendSSEEvent(res, "event", { event: createEvent("guidance", "Generating recommendations...", "processing") });
  const guidance = generateGuidance({ input: classification, breach, correlation, imageRisk });
  sendSSEEvent(res, "event", { 
    event: createEvent("guidance", `${guidance.recommendations.length} recommendations generated`, "complete") 
  });

  // Step 5: Generate transparency info
  const transparency = generateTransparency({ input: classification, breach, correlation, imageRisk });

  // Send final result
  const result: ScanResult = {
    id: randomUUID(),
    input: classification,
    breach,
    correlation,
    imageRisk,
    verdict,
    guidance,
    transparency,
    completedAt: new Date().toISOString(),
  };

  sendSSEEvent(res, "result", { result });
  res.end();
}

async function performDemoScan(input: string, res: Response): Promise<void> {
  const classification = classifyInput(input);
  
  // Simulate processing with delays
  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  sendSSEEvent(res, "event", { event: createEvent("signal", "Classifying input type...", "processing") });
  await delay(300);
  sendSSEEvent(res, "event", { 
    event: createEvent("signal", `Input classified as ${classification.type} (DEMO)`, "complete") 
  });

  sendSSEEvent(res, "event", { event: createEvent("breach", "Querying breach databases (DEMO)...", "processing") });
  await delay(500);
  
  const demoBreach: BreachResult = {
    found: true,
    breachCount: 3,
    sources: [
      { name: "ExampleBreach2022", domain: "example.com", breachDate: "2022-06-15", dataClasses: ["Email addresses", "Passwords"], pwnCount: 1500000 },
      { name: "DemoLeakSite", domain: "demo.org", breachDate: "2021-03-22", dataClasses: ["Email addresses", "Usernames"], pwnCount: 500000 },
      { name: "TestDataBreach", domain: "test.net", breachDate: "2020-11-10", dataClasses: ["Email addresses"], pwnCount: 200000 },
    ],
    severity: "medium",
    apiAvailable: true,
  };
  sendSSEEvent(res, "event", { 
    event: createEvent("breach", "Found in 3 breaches (DEMO DATA)", "complete") 
  });

  sendSSEEvent(res, "event", { event: createEvent("correlate", "Checking platform presence (DEMO)...", "processing") });
  await delay(400);
  
  const demoCorrelation: CorrelationResult = {
    matches: [
      { platform: "GitHub", available: false, confidence: 0.85 },
      { platform: "Twitter/X", available: true, confidence: 0.7 },
      { platform: "Instagram", available: false, confidence: 0.8 },
      { platform: "Reddit", available: true, confidence: 0.6 },
    ],
    risk: "medium",
    checkedPlatforms: ["GitHub", "Twitter/X", "Instagram", "Reddit"],
    limitationNote: "This is demo data - no actual platform checks were performed.",
  };
  sendSSEEvent(res, "event", { 
    event: createEvent("correlate", "Checked 4 platforms, found 2 matches (DEMO DATA)", "complete") 
  });

  sendSSEEvent(res, "event", { event: createEvent("verdict", "Calculating exposure score...", "processing") });
  await delay(300);
  
  const demoVerdict = generateVerdict({ input: classification, breach: demoBreach, correlation: demoCorrelation });
  sendSSEEvent(res, "event", { 
    event: createEvent("verdict", `Exposure score: ${demoVerdict.exposureScore}/100 (DEMO)`, "complete") 
  });

  sendSSEEvent(res, "event", { event: createEvent("guidance", "Generating recommendations...", "processing") });
  await delay(200);
  
  const demoGuidance = generateGuidance({ input: classification, breach: demoBreach, correlation: demoCorrelation });
  sendSSEEvent(res, "event", { 
    event: createEvent("guidance", `${demoGuidance.recommendations.length} recommendations (DEMO)`, "complete") 
  });

  const transparency = generateTransparency({ input: classification, breach: demoBreach, correlation: demoCorrelation });
  transparency.dataSources.unshift({
    name: "Demo Mode",
    type: "heuristic",
    description: "This scan used simulated data for demonstration purposes",
  });

  const result: ScanResult = {
    id: randomUUID(),
    input: classification,
    breach: demoBreach,
    correlation: demoCorrelation,
    verdict: demoVerdict,
    guidance: demoGuidance,
    transparency,
    completedAt: new Date().toISOString(),
  };

  sendSSEEvent(res, "result", { result });
  res.end();
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  
  // Real scan endpoint with SSE streaming
  app.post("/api/scan", async (req, res) => {
    const { input } = req.body;
    
    if (!input || typeof input !== "string") {
      return res.status(400).json({ error: "Input is required" });
    }

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();

    try {
      await performScan(input.trim(), res);
    } catch (error) {
      console.error("Scan error:", error);
      sendSSEEvent(res, "event", { event: createEvent("system", "An error occurred", "error") });
      res.end();
    }
  });

  // Demo scan endpoint
  app.post("/api/scan/demo", async (req, res) => {
    const { input } = req.body;
    
    if (!input || typeof input !== "string") {
      return res.status(400).json({ error: "Input is required" });
    }

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();

    try {
      await performDemoScan(input.trim(), res);
    } catch (error) {
      console.error("Demo scan error:", error);
      sendSSEEvent(res, "event", { event: createEvent("system", "An error occurred", "error") });
      res.end();
    }
  });

  return httpServer;
}
