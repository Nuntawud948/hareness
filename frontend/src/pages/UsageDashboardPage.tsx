import React, { useEffect, useState } from 'react';
import {
  BarChart3,
  Coins,
  Cpu,
  Layers,
  Sparkles,
  RefreshCw,
} from 'lucide-react';
import { apiClient } from '../services/api.client';
import { Button, Card, Badge } from '../components/ui';

interface UsageSummary {
  totalRequests: number;
  totalTokens: number;
  promptTokens: number;
  completionTokens: number;
  estimatedCostUsd: number;
  providerBreakdown: Array<{
    providerName: string;
    requests: number;
    tokens: number;
    costUsd: number;
  }>;
  dailyStats: Array<{
    date: string;
    tokens: number;
    requests: number;
  }>;
}

interface RecentLog {
  id: string;
  platform: string;
  userId: string;
  providerName: string;
  modelId: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  estimatedCostUsd: number;
  responseTimeMs?: number | null;
  wasFailover: boolean;
  createdAt: string;
}

export const UsageDashboardPage: React.FC = () => {
  const [summary, setSummary] = useState<UsageSummary | null>(null);
  const [recentLogs, setRecentLogs] = useState<RecentLog[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [sumRes, logsRes] = await Promise.all([
        apiClient.get<UsageSummary>('/api/usage/summary?days=30'),
        apiClient.get<RecentLog[]>('/api/usage/logs?limit=25'),
      ]);
      setSummary(sumRes.data);
      setRecentLogs(logsRes.data);
    } catch (err) {
      console.error('Failed to fetch usage data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-emerald-500 dark:text-emerald-400" />
            Usage & Cost Analytics (Last 30 Days)
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Real-time token telemetry, provider distribution, and cost estimates.
          </p>
        </div>

        <Button variant="secondary" size="sm" onClick={fetchData} leftIcon={<RefreshCw className="w-3.5 h-3.5" />}>
          Refresh
        </Button>
      </div>

      {loading ? (
        <div className="p-12 text-center text-slate-400">Calculating analytics...</div>
      ) : (
        <>
          {/* Top Metrics Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="p-5">
              <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
                <span className="text-xs font-semibold uppercase">Total Requests</span>
                <Cpu className="w-4 h-4 text-emerald-500 dark:text-emerald-400" />
              </div>
              <div className="text-2xl font-bold text-slate-900 dark:text-white font-mono">
                {summary?.totalRequests.toLocaleString() || 0}
              </div>
              <div className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">Conversations served</div>
            </Card>

            <Card className="p-5">
              <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
                <span className="text-xs font-semibold uppercase">Total Tokens</span>
                <Layers className="w-4 h-4 text-teal-500 dark:text-teal-400" />
              </div>
              <div className="text-2xl font-bold text-slate-900 dark:text-white font-mono">
                {summary?.totalTokens.toLocaleString() || 0}
              </div>
              <div className="text-[11px] text-slate-400 dark:text-slate-500 mt-1 flex justify-between">
                <span>In: {summary?.promptTokens.toLocaleString() || 0}</span>
                <span>Out: {summary?.completionTokens.toLocaleString() || 0}</span>
              </div>
            </Card>

            <Card className="p-5">
              <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
                <span className="text-xs font-semibold uppercase">Estimated Cost</span>
                <Coins className="w-4 h-4 text-amber-500 dark:text-amber-400" />
              </div>
              <div className="text-2xl font-bold text-slate-900 dark:text-white font-mono">
                ${summary?.estimatedCostUsd.toFixed(4) || '0.0000'}
              </div>
              <div className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">USD (Based on official rates)</div>
            </Card>

            <Card className="p-5">
              <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
                <span className="text-xs font-semibold uppercase">Active Providers</span>
                <Sparkles className="w-4 h-4 text-purple-500 dark:text-purple-400" />
              </div>
              <div className="text-2xl font-bold text-slate-900 dark:text-white font-mono">
                {summary?.providerBreakdown.length || 0}
              </div>
              <div className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">Across Gemini, OpenAI, Claude, etc.</div>
            </Card>
          </div>

          {/* Provider Breakdown Table */}
          <Card>
            <h3 className="text-base font-bold text-slate-900 dark:text-white mb-4">Provider Distribution</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-950 text-slate-500 dark:text-slate-400 uppercase font-semibold border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="p-3">Provider</th>
                    <th className="p-3">Requests</th>
                    <th className="p-3">Tokens Consumed</th>
                    <th className="p-3">Est. Cost</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-slate-700 dark:text-slate-300">
                  {summary?.providerBreakdown.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="p-4 text-center text-slate-400">
                        No usage data yet.
                      </td>
                    </tr>
                  ) : (
                    summary?.providerBreakdown.map((p) => (
                      <tr key={p.providerName} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition">
                        <td className="p-3 font-semibold text-slate-900 dark:text-white capitalize">{p.providerName}</td>
                        <td className="p-3 font-mono">{p.requests.toLocaleString()}</td>
                        <td className="p-3 font-mono">{p.tokens.toLocaleString()}</td>
                        <td className="p-3 font-mono text-emerald-600 dark:text-emerald-400">${p.costUsd.toFixed(4)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Recent Query Log Table */}
          <Card>
            <h3 className="text-base font-bold text-slate-900 dark:text-white mb-4">Recent Query Executions</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-950 text-slate-500 dark:text-slate-400 uppercase font-semibold border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="p-3">Timestamp</th>
                    <th className="p-3">Platform</th>
                    <th className="p-3">User ID</th>
                    <th className="p-3">Model</th>
                    <th className="p-3">Tokens</th>
                    <th className="p-3">Latency</th>
                    <th className="p-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-slate-700 dark:text-slate-300 font-mono">
                  {recentLogs.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-4 text-center text-slate-400 font-sans">
                        No recent queries found.
                      </td>
                    </tr>
                  ) : (
                    recentLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition">
                        <td className="p-3 text-slate-500 dark:text-slate-400">
                          {new Date(log.createdAt).toLocaleTimeString()}
                        </td>
                        <td className="p-3">
                          <Badge variant={log.platform === 'line' ? 'line' : 'telegram'}>
                            {log.platform}
                          </Badge>
                        </td>
                        <td className="p-3 truncate max-w-[120px] text-slate-500 dark:text-slate-400">{log.userId}</td>
                        <td className="p-3 text-slate-900 dark:text-white font-semibold">{log.modelId}</td>
                        <td className="p-3">{log.totalTokens}</td>
                        <td className="p-3 text-slate-500 dark:text-slate-400">
                          {log.responseTimeMs ? `${log.responseTimeMs}ms` : '-'}
                        </td>
                        <td className="p-3 font-sans">
                          {log.wasFailover ? (
                            <Badge variant="warning" dot>
                              Failover
                            </Badge>
                          ) : (
                            <Badge variant="success">Primary</Badge>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
    </div>
  );
};
