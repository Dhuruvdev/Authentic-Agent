import { CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Shield, ShieldCheck, ArrowRight } from "lucide-react";
import { SpotlightCard } from "@/components/reactbits/spotlight-card";
import type { Verdict, Guidance } from "@shared/schema";

interface VerdictSectionProps {
  verdict: Verdict;
  guidance: Guidance;
}

function getScoreColor(score: number): string {
  if (score <= 25) return "text-green-600 dark:text-green-400";
  if (score <= 50) return "text-yellow-600 dark:text-yellow-400";
  if (score <= 75) return "text-orange-600 dark:text-orange-400";
  return "text-red-600 dark:text-red-400";
}

function getRiskIcon(level: string) {
  switch (level) {
    case "low":
      return <ShieldCheck className="w-6 h-6 text-green-600 dark:text-green-400" />;
    case "medium":
      return <Shield className="w-6 h-6 text-yellow-600 dark:text-yellow-400" />;
    case "high":
      return <AlertTriangle className="w-6 h-6 text-red-600 dark:text-red-400" />;
    default:
      return <Shield className="w-6 h-6" />;
  }
}

function UrgencyBadge({ urgency }: { urgency: string }) {
  const variants: Record<string, "destructive" | "default" | "secondary"> = {
    immediate: "destructive",
    soon: "default",
    when_possible: "secondary",
  };
  const labels: Record<string, string> = {
    immediate: "Do Now",
    soon: "Soon",
    when_possible: "When Possible",
  };
  
  return (
    <Badge variant={variants[urgency] || "secondary"} className="text-xs">
      {labels[urgency] || urgency}
    </Badge>
  );
}

function CategoryIcon({ category }: { category: string }) {
  const icons: Record<string, string> = {
    account_security: "🔐",
    privacy: "🔒",
    platform_action: "📱",
    monitoring: "👁️",
  };
  return <span className="text-lg">{icons[category] || "📋"}</span>;
}

export function VerdictSection({ verdict, guidance }: VerdictSectionProps) {
  return (
    <div className="space-y-6" data-testid="verdict-section">
      <SpotlightCard spotlightColor="rgba(139, 92, 246, 0.15)" className="overflow-hidden">
        <CardHeader className="pb-4">
          <CardTitle className="text-lg">Exposure Assessment</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <div className={`text-6xl font-bold tabular-nums ${getScoreColor(verdict.exposureScore)}`}>
                {verdict.exposureScore}
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Exposure Score</p>
                <p className="text-xs text-muted-foreground">0 = minimal, 100 = severe</p>
              </div>
            </div>
            
            <div className="flex items-center gap-3 p-4 rounded-lg bg-muted/50">
              {getRiskIcon(verdict.riskLevel)}
              <div>
                <p className="text-sm font-medium capitalize">{verdict.riskLevel} Risk</p>
                <p className="text-xs text-muted-foreground">Overall assessment</p>
              </div>
            </div>
          </div>

          <div className="p-4 rounded-lg bg-muted/30 border border-border/50">
            <p className="text-sm leading-relaxed">{verdict.summary}</p>
          </div>

          {verdict.factors.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium text-muted-foreground">Contributing Factors</p>
              <div className="flex flex-wrap gap-2">
                {verdict.factors.map((factor, idx) => (
                  <Badge
                    key={idx}
                    variant={factor.impact === "negative" ? "destructive" : factor.impact === "positive" ? "secondary" : "outline"}
                  >
                    {factor.impact === "negative" ? "−" : factor.impact === "positive" ? "+" : "•"} {factor.factor}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </SpotlightCard>

      {guidance.recommendations.length > 0 && (
        <SpotlightCard data-testid="guidance-section" spotlightColor="rgba(34, 197, 94, 0.15)">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg">Recommended Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="space-y-4">
              {guidance.recommendations.map((rec, idx) => (
                <li
                  key={idx}
                  className="flex items-start gap-4 p-4 rounded-lg bg-muted/30 border border-border/50"
                  data-testid={`recommendation-${idx}`}
                >
                  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary font-semibold text-sm shrink-0">
                    {idx + 1}
                  </div>
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <h4 className="font-medium">{rec.title}</h4>
                      <UrgencyBadge urgency={rec.urgency} />
                    </div>
                    <p className="text-sm text-muted-foreground">{rec.description}</p>
                  </div>
                  <ArrowRight className="w-5 h-5 text-muted-foreground shrink-0 mt-1" />
                </li>
              ))}
            </ol>
          </CardContent>
        </SpotlightCard>
      )}
    </div>
  );
}
