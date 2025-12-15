import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Shield, Users, Image, ChevronDown, AlertTriangle, CheckCircle, Info } from "lucide-react";
import { useState } from "react";
import type { BreachResult, CorrelationResult, ImageRiskResult } from "@shared/schema";

interface ResultsDisplayProps {
  breach?: BreachResult;
  correlation?: CorrelationResult;
  imageRisk?: ImageRiskResult;
}

function SeverityBadge({ severity }: { severity: string }) {
  const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
    low: "secondary",
    medium: "default",
    high: "destructive",
    critical: "destructive",
  };
  
  return (
    <Badge variant={variants[severity] || "secondary"} className="capitalize">
      {severity}
    </Badge>
  );
}

function BreachCard({ result }: { result: BreachResult }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Card data-testid="result-breach">
      <CardHeader className="flex flex-row items-center justify-between gap-4 pb-2">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-md bg-muted">
            <Shield className="w-5 h-5" />
          </div>
          <div>
            <CardTitle className="text-base">Breach Intelligence</CardTitle>
            <p className="text-sm text-muted-foreground">NH-Breach Module</p>
          </div>
        </div>
        <SeverityBadge severity={result.severity} />
      </CardHeader>
      <CardContent className="space-y-4">
        {!result.apiAvailable && (
          <div className="flex items-start gap-2 p-3 rounded-md bg-muted/50 text-sm">
            <Info className="w-4 h-4 mt-0.5 text-muted-foreground shrink-0" />
            <p className="text-muted-foreground">{result.limitationNote}</p>
          </div>
        )}
        
        {result.found ? (
          <>
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-destructive" />
              <span className="font-medium">
                Found in {result.breachCount} known breach{result.breachCount !== 1 ? "es" : ""}
              </span>
            </div>
            
            {result.sources.length > 0 && (
              <Collapsible open={isOpen} onOpenChange={setIsOpen}>
                <CollapsibleTrigger className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
                  <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? "rotate-180" : ""}`} />
                  View breach details
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-3 space-y-2">
                  {result.sources.map((source, idx) => (
                    <div key={idx} className="p-3 rounded-md bg-muted/50 space-y-1">
                      <p className="font-medium text-sm">{source.name}</p>
                      {source.breachDate && (
                        <p className="text-xs text-muted-foreground">
                          Breach date: {new Date(source.breachDate).toLocaleDateString()}
                        </p>
                      )}
                      {source.dataClasses && source.dataClasses.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {source.dataClasses.slice(0, 5).map((dc, i) => (
                            <Badge key={i} variant="outline" className="text-xs">
                              {dc}
                            </Badge>
                          ))}
                          {source.dataClasses.length > 5 && (
                            <Badge variant="outline" className="text-xs">
                              +{source.dataClasses.length - 5} more
                            </Badge>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </CollapsibleContent>
              </Collapsible>
            )}
          </>
        ) : (
          <div className="flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
            <span>No known breaches detected</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function CorrelationCard({ result }: { result: CorrelationResult }) {
  const [isOpen, setIsOpen] = useState(false);
  const foundMatches = result.matches.filter(m => !m.available);

  return (
    <Card data-testid="result-correlation">
      <CardHeader className="flex flex-row items-center justify-between gap-4 pb-2">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-md bg-muted">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <CardTitle className="text-base">Username Correlation</CardTitle>
            <p className="text-sm text-muted-foreground">NH-Correlate Module</p>
          </div>
        </div>
        <SeverityBadge severity={result.risk} />
      </CardHeader>
      <CardContent className="space-y-4">
        {result.limitationNote && (
          <div className="flex items-start gap-2 p-3 rounded-md bg-muted/50 text-sm">
            <Info className="w-4 h-4 mt-0.5 text-muted-foreground shrink-0" />
            <p className="text-muted-foreground">{result.limitationNote}</p>
          </div>
        )}

        <div className="flex items-center gap-2">
          {foundMatches.length > 0 ? (
            <>
              <AlertTriangle className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
              <span className="font-medium">
                Username found on {foundMatches.length} platform{foundMatches.length !== 1 ? "s" : ""}
              </span>
            </>
          ) : (
            <>
              <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
              <span>Username appears available on checked platforms</span>
            </>
          )}
        </div>

        <Collapsible open={isOpen} onOpenChange={setIsOpen}>
          <CollapsibleTrigger className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? "rotate-180" : ""}`} />
            View {result.checkedPlatforms.length} checked platforms
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-3">
            <div className="flex flex-wrap gap-2">
              {result.matches.map((match, idx) => (
                <Badge
                  key={idx}
                  variant={match.available ? "outline" : "secondary"}
                  className="gap-1"
                >
                  {!match.available && <CheckCircle className="w-3 h-3" />}
                  {match.platform}
                </Badge>
              ))}
            </div>
          </CollapsibleContent>
        </Collapsible>
      </CardContent>
    </Card>
  );
}

function ImageRiskCard({ result }: { result: ImageRiskResult }) {
  return (
    <Card data-testid="result-image">
      <CardHeader className="flex flex-row items-center justify-between gap-4 pb-2">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-md bg-muted">
            <Image className="w-5 h-5" />
          </div>
          <div>
            <CardTitle className="text-base">Image Exposure Risk</CardTitle>
            <p className="text-sm text-muted-foreground">NH-FaceRisk Module</p>
          </div>
        </div>
        <SeverityBadge severity={result.riskLevel} />
      </CardHeader>
      <CardContent className="space-y-4">
        {result.limitationNote && (
          <div className="flex items-start gap-2 p-3 rounded-md bg-muted/50 text-sm">
            <Info className="w-4 h-4 mt-0.5 text-muted-foreground shrink-0" />
            <p className="text-muted-foreground">{result.limitationNote}</p>
          </div>
        )}

        {result.analyzed ? (
          <>
            {result.perceptualHash && (
              <p className="text-xs font-mono text-muted-foreground">
                Hash: {result.perceptualHash.substring(0, 16)}...
              </p>
            )}
            
            {result.exposureIndicators.length > 0 ? (
              <div className="space-y-2">
                {result.exposureIndicators.map((indicator, idx) => (
                  <div key={idx} className="p-3 rounded-md bg-muted/50">
                    <p className="text-sm font-medium">{indicator.source}</p>
                    <p className="text-xs text-muted-foreground">
                      Confidence: {Math.round(indicator.matchConfidence * 100)}%
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
                <span>No significant exposure indicators found</span>
              </div>
            )}
          </>
        ) : (
          <p className="text-sm text-muted-foreground">Image analysis was not performed.</p>
        )}

        <div className="p-3 rounded-md bg-muted/30 border border-border/50">
          <p className="text-xs text-muted-foreground italic">{result.disclaimer}</p>
        </div>
      </CardContent>
    </Card>
  );
}

export function ResultsDisplay({ breach, correlation, imageRisk }: ResultsDisplayProps) {
  const hasResults = breach || correlation || imageRisk;
  
  if (!hasResults) return null;

  return (
    <div className="space-y-4" data-testid="results-display">
      <h2 className="text-lg font-semibold">Analysis Results</h2>
      <div className="grid gap-4">
        {breach && <BreachCard result={breach} />}
        {correlation && <CorrelationCard result={correlation} />}
        {imageRisk && <ImageRiskCard result={imageRisk} />}
      </div>
    </div>
  );
}
