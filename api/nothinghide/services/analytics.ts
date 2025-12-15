import crypto from 'crypto';

export interface RequestMetric {
  endpoint: string;
  method: string;
  statusCode: number;
  responseTimeMs: number;
  timestamp: number;
  ipHash: string;
  userAgent?: string;
}

export interface EndpointStats {
  endpoint: string;
  totalRequests: number;
  avgResponseTime: number;
  minResponseTime: number;
  maxResponseTime: number;
  successCount: number;
  errorCount: number;
  lastRequestAt: number;
}

export interface RealTimeMetrics {
  uptime: number;
  totalRequests: number;
  requestsPerMinute: number;
  avgResponseTime: number;
  activeConnections: number;
  endpointStats: EndpointStats[];
  recentRequests: RequestMetric[];
  errorRate: number;
  lastUpdated: string;
}

const MAX_RECENT_REQUESTS = 100;
const METRICS_WINDOW_MS = 60000;

const metrics: {
  startTime: number;
  requests: RequestMetric[];
  activeConnections: number;
} = {
  startTime: Date.now(),
  requests: [],
  activeConnections: 0,
};

export function recordRequest(metric: RequestMetric): void {
  metrics.requests.push(metric);
  
  if (metrics.requests.length > 10000) {
    const cutoff = Date.now() - (5 * 60 * 1000);
    metrics.requests = metrics.requests.filter(r => r.timestamp > cutoff);
  }
}

export function incrementActiveConnections(): void {
  metrics.activeConnections++;
}

export function decrementActiveConnections(): void {
  metrics.activeConnections = Math.max(0, metrics.activeConnections - 1);
}

export function getRealTimeMetrics(): RealTimeMetrics {
  const now = Date.now();
  const windowStart = now - METRICS_WINDOW_MS;
  
  const recentRequests = metrics.requests.filter(r => r.timestamp > windowStart);
  const allRequests = metrics.requests;
  
  const endpointMap = new Map<string, {
    requests: RequestMetric[];
    lastRequestAt: number;
  }>();
  
  for (const req of allRequests) {
    const key = `${req.method} ${req.endpoint}`;
    if (!endpointMap.has(key)) {
      endpointMap.set(key, { requests: [], lastRequestAt: 0 });
    }
    const entry = endpointMap.get(key)!;
    entry.requests.push(req);
    entry.lastRequestAt = Math.max(entry.lastRequestAt, req.timestamp);
  }
  
  const endpointStats: EndpointStats[] = Array.from(endpointMap.entries()).map(([endpoint, data]) => {
    const responseTimes = data.requests.map(r => r.responseTimeMs);
    const successCount = data.requests.filter(r => r.statusCode >= 200 && r.statusCode < 400).length;
    const errorCount = data.requests.filter(r => r.statusCode >= 400).length;
    
    return {
      endpoint,
      totalRequests: data.requests.length,
      avgResponseTime: responseTimes.length > 0 
        ? Math.round(responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length) 
        : 0,
      minResponseTime: responseTimes.length > 0 ? Math.min(...responseTimes) : 0,
      maxResponseTime: responseTimes.length > 0 ? Math.max(...responseTimes) : 0,
      successCount,
      errorCount,
      lastRequestAt: data.lastRequestAt,
    };
  }).sort((a, b) => b.totalRequests - a.totalRequests);
  
  const allResponseTimes = allRequests.map(r => r.responseTimeMs);
  const avgResponseTime = allResponseTimes.length > 0
    ? Math.round(allResponseTimes.reduce((a, b) => a + b, 0) / allResponseTimes.length)
    : 0;
  
  const errorCount = allRequests.filter(r => r.statusCode >= 400).length;
  const errorRate = allRequests.length > 0 
    ? Math.round((errorCount / allRequests.length) * 10000) / 100
    : 0;
  
  return {
    uptime: Math.round((now - metrics.startTime) / 1000),
    totalRequests: allRequests.length,
    requestsPerMinute: recentRequests.length,
    avgResponseTime,
    activeConnections: metrics.activeConnections,
    endpointStats: endpointStats.slice(0, 20),
    recentRequests: metrics.requests.slice(-MAX_RECENT_REQUESTS).reverse(),
    errorRate,
    lastUpdated: new Date().toISOString(),
  };
}

export function getRequestTimeline(minutes: number = 5): Array<{ minute: number; count: number; avgTime: number }> {
  const now = Date.now();
  const timeline: Array<{ minute: number; count: number; avgTime: number }> = [];
  
  for (let i = minutes - 1; i >= 0; i--) {
    const minuteStart = now - ((i + 1) * 60000);
    const minuteEnd = now - (i * 60000);
    
    const requestsInMinute = metrics.requests.filter(
      r => r.timestamp >= minuteStart && r.timestamp < minuteEnd
    );
    
    const avgTime = requestsInMinute.length > 0
      ? Math.round(requestsInMinute.reduce((sum, r) => sum + r.responseTimeMs, 0) / requestsInMinute.length)
      : 0;
    
    timeline.push({
      minute: minutes - i,
      count: requestsInMinute.length,
      avgTime,
    });
  }
  
  return timeline;
}

export function getErrorAnalysis(): Array<{ endpoint: string; statusCode: number; count: number; lastOccurred: string }> {
  const errorMap = new Map<string, { count: number; lastOccurred: number }>();
  
  for (const req of metrics.requests) {
    if (req.statusCode >= 400) {
      const key = `${req.endpoint}:${req.statusCode}`;
      const entry = errorMap.get(key) || { count: 0, lastOccurred: 0 };
      entry.count++;
      entry.lastOccurred = Math.max(entry.lastOccurred, req.timestamp);
      errorMap.set(key, entry);
    }
  }
  
  return Array.from(errorMap.entries())
    .map(([key, data]) => {
      const [endpoint, statusCode] = key.split(':');
      return {
        endpoint,
        statusCode: parseInt(statusCode),
        count: data.count,
        lastOccurred: new Date(data.lastOccurred).toISOString(),
      };
    })
    .sort((a, b) => b.count - a.count);
}

export function sha256ForAnalytics(input: string): string {
  return crypto.createHash('sha256').update(input).digest('hex').substring(0, 16);
}
