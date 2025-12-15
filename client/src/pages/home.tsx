import { useState, useCallback, Suspense, lazy } from "react";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/components/theme-provider";
import { ScanInput } from "@/components/scan-input";
import { ChainFeed } from "@/components/chain-feed";
import { ResultsDisplay } from "@/components/results-display";
import { VerdictSection } from "@/components/verdict-section";
import { TransparencyLayer } from "@/components/transparency-layer";
import { DecryptedText } from "@/components/reactbits/decrypted-text";
import { ShinyText } from "@/components/reactbits/shiny-text";
import { Moon, Sun, Shield, Database } from "lucide-react";
import type { ChainEvent, ScanResult } from "@shared/schema";

const DitherBackground = lazy(() => 
  import("@/components/reactbits/dither-background").then(m => ({ default: m.DitherBackground }))
);

export default function Home() {
  const { theme, toggleTheme } = useTheme();
  const [isScanning, setIsScanning] = useState(false);
  const [chainEvents, setChainEvents] = useState<ChainEvent[]>([]);
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);

  const handleScan = useCallback(async (input: string) => {
    setIsScanning(true);
    setChainEvents([]);
    setScanResult(null);

    try {
      const response = await fetch("/api/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input }),
      });

      if (!response.ok) {
        throw new Error("Scan failed");
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error("No response stream");
      }

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6));
              
              if (data.type === "event") {
                setChainEvents((prev) => {
                  const existing = prev.findIndex((e) => e.id === data.event.id);
                  if (existing >= 0) {
                    const updated = [...prev];
                    updated[existing] = data.event;
                    return updated;
                  }
                  return [...prev, data.event];
                });
              } else if (data.type === "result") {
                setScanResult(data.result);
              }
            } catch {
              // Invalid JSON, skip
            }
          }
        }
      }
    } catch (error) {
      console.error("Scan error:", error);
      setChainEvents((prev) => [
        ...prev,
        {
          id: "error",
          module: "system",
          message: "An error occurred during the scan. Please try again.",
          status: "error",
          timestamp: new Date().toISOString(),
        },
      ]);
    } finally {
      setIsScanning(false);
    }
  }, []);

  return (
    <div className="min-h-screen bg-background/90 relative">
      <Suspense fallback={null}>
        <DitherBackground 
          waveColor={[0.15, 0.15, 0.2]} 
          waveSpeed={0.03} 
          waveAmplitude={0.2}
          colorNum={6}
          pixelSize={3}
        />
      </Suspense>
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-md border-b border-border/50">
        <div className="max-w-4xl mx-auto px-6 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Shield className="w-6 h-6 text-primary" />
            <span className="font-semibold text-lg">NothingHide</span>
          </div>
          
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleTheme}
              data-testid="button-theme"
            >
              {theme === "dark" ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-12 space-y-12">
        <section className="text-center space-y-4">
          <h1 className="text-4xl font-semibold tracking-tight">
            <DecryptedText 
              text="Discover Your Digital Exposure" 
              animateOn="view"
              speed={40}
              maxIterations={15}
              className="text-foreground"
              encryptedClassName="text-primary/70"
            />
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            <ShinyText 
              text="Find out where your email, username, or image appears online."
              speed={4}
            />
            {" "}Transparent analysis using only publicly accessible data.
          </p>
          <p className="text-sm text-muted-foreground flex items-center justify-center gap-1">
            <Shield className="w-4 h-4" />
            No dark web access. No private databases. Fully transparent.
          </p>
        </section>

        <section className="max-w-xl mx-auto">
          <ScanInput onScan={handleScan} isScanning={isScanning} />
        </section>

        {chainEvents.length > 0 && (
          <section>
            <ChainFeed
              events={chainEvents}
              isComplete={!isScanning && scanResult !== null}
            />
          </section>
        )}

        {scanResult && (
          <>
            <section>
              <ResultsDisplay
                breach={scanResult.breach}
                correlation={scanResult.correlation}
                imageRisk={scanResult.imageRisk}
              />
            </section>

            <section>
              <VerdictSection
                verdict={scanResult.verdict}
                guidance={scanResult.guidance}
              />
            </section>
          </>
        )}

        <section>
          <TransparencyLayer transparency={scanResult?.transparency} />
        </section>
      </main>

      <footer className="border-t border-border mt-12">
        <div className="max-w-4xl mx-auto px-6 py-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4" />
              <span>NothingHide - Digital Identity Exposure Analysis</span>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1">
                <Database className="w-3 h-3" />
                <span>Self-Hosted Breach Database</span>
              </div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
