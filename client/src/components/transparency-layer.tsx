import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, CheckCircle, XCircle, Database, Scale, Clock } from "lucide-react";
import { useState } from "react";
import type { Transparency } from "@shared/schema";

interface TransparencyLayerProps {
  transparency?: Transparency;
}

export function TransparencyLayer({ transparency }: TransparencyLayerProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="space-y-6" data-testid="transparency-layer">
      <Card>
        <Collapsible open={isOpen} onOpenChange={setIsOpen}>
          <CollapsibleTrigger className="w-full">
            <CardHeader className="flex flex-row items-center justify-between gap-4 cursor-pointer">
              <div className="flex items-center gap-3">
                <Scale className="w-5 h-5 text-muted-foreground" />
                <CardTitle className="text-base">How This Works</CardTitle>
              </div>
              <ChevronDown className={`w-5 h-5 text-muted-foreground transition-transform ${isOpen ? "rotate-180" : ""}`} />
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="pt-0 space-y-6">
              {transparency ? (
                <>
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400" />
                        <h4 className="font-medium text-sm">What We Checked</h4>
                      </div>
                      <ul className="space-y-1 pl-6">
                        {transparency.whatWasChecked.map((item, idx) => (
                          <li key={idx} className="text-sm text-muted-foreground list-disc">{item}</li>
                        ))}
                      </ul>
                    </div>
                    
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <XCircle className="w-4 h-4 text-muted-foreground" />
                        <h4 className="font-medium text-sm">What We Did Not Check</h4>
                      </div>
                      <ul className="space-y-1 pl-6">
                        {transparency.whatWasNotChecked.map((item, idx) => (
                          <li key={idx} className="text-sm text-muted-foreground list-disc">{item}</li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Database className="w-4 h-4 text-muted-foreground" />
                      <h4 className="font-medium text-sm">Data Sources</h4>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {transparency.dataSources.map((source, idx) => (
                        <div key={idx} className="p-2 rounded-md bg-muted/50 space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">{source.name}</span>
                            <Badge variant="outline" className="text-xs capitalize">{source.type.replace("_", " ")}</Badge>
                          </div>
                          <p className="text-xs text-muted-foreground">{source.description}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Clock className="w-3 h-3" />
                    <span>Analysis completed: {new Date(transparency.timestamp).toLocaleString()}</span>
                  </div>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Complete a scan to see detailed transparency information about the analysis.
                </p>
              )}
            </CardContent>
          </CollapsibleContent>
        </Collapsible>
      </Card>

      <div className="p-6 rounded-lg border border-border bg-muted/20 space-y-4">
        <h3 className="font-semibold text-sm">Legal Scope Statement</h3>
        <div className="text-sm text-muted-foreground space-y-3 leading-relaxed">
          <p>
            <strong>NothingHide</strong> analyzes only publicly accessible information. 
            No private systems, restricted databases, or confidential data sources were accessed during this analysis.
          </p>
          <p>
            This tool does not access the dark web, password databases, private social networks, 
            or any systems requiring authentication. All data is sourced from legitimate, 
            publicly available APIs and open datasets.
          </p>
          <p>
            The exposure score and risk assessment are estimates based on available public information. 
            They do not constitute forensic proof or legal evidence of any security incident.
          </p>
        </div>
      </div>

      <div className="text-center text-xs text-muted-foreground space-y-1">
        <p>NothingHide provides exposure awareness, not forensic proof.</p>
        <p>Your input is processed in real-time and is not stored on our servers.</p>
      </div>
    </div>
  );
}
