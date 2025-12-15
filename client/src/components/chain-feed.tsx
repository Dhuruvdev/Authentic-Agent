import { CheckCircle, Loader2, AlertCircle, Clock, SkipForward } from "lucide-react";
import { Card } from "@/components/ui/card";
import type { ChainEvent } from "@shared/schema";

interface ChainFeedProps {
  events: ChainEvent[];
  isComplete: boolean;
}

export function ChainFeed({ events, isComplete }: ChainFeedProps) {
  if (events.length === 0) return null;

  const getStatusIcon = (status: ChainEvent["status"]) => {
    switch (status) {
      case "complete":
        return <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400" />;
      case "processing":
        return <Loader2 className="w-4 h-4 text-blue-600 dark:text-blue-400 animate-spin" />;
      case "error":
        return <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400" />;
      case "skipped":
        return <SkipForward className="w-4 h-4 text-muted-foreground" />;
      case "pending":
      default:
        return <Clock className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  };

  return (
    <Card className="p-4 space-y-1" data-testid="chain-feed">
      <div className="flex items-center justify-between gap-4 mb-3">
        <h3 className="text-sm font-medium text-muted-foreground">Analysis Progress</h3>
        {isComplete && (
          <span className="text-xs text-green-600 dark:text-green-400 font-medium">Complete</span>
        )}
      </div>
      
      <div className="space-y-2 max-h-64 overflow-y-auto">
        {events.map((event) => (
          <div
            key={event.id}
            className="flex items-start gap-3 py-2 border-b border-border/50 last:border-0"
            data-testid={`chain-event-${event.id}`}
          >
            <div className="mt-0.5">{getStatusIcon(event.status)}</div>
            <div className="flex-1 min-w-0">
              <p className="text-sm">{event.message}</p>
              {event.details && (
                <p className="text-xs text-muted-foreground mt-1 truncate">
                  {typeof event.details === "string" ? event.details : JSON.stringify(event.details)}
                </p>
              )}
            </div>
            <span className="text-xs text-muted-foreground font-mono shrink-0">
              {formatTime(event.timestamp)}
            </span>
          </div>
        ))}
      </div>
    </Card>
  );
}
