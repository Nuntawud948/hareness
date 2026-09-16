import React, { useEffect, useState } from 'react';
import {
  BellRing,
  Send,
  CheckCircle2,
  XCircle,
  Clock,
  User,
  Activity,
  Filter,
} from 'lucide-react';
import { useSSE } from '../hooks/useSSE';
import { apiClient } from '../services/api.client';
import { Input, Textarea, Button, Card, Badge } from '../components/ui';

export const PushWatcherPage: React.FC = () => {
  const { messages: liveMessages, isConnected, setMessages } = useSSE('/api/push/watch');

  // Test push form state
  const [platform, setPlatform] = useState<'line' | 'telegram'>('line');
  const [targetId, setTargetId] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState<{ success: boolean; error?: string } | null>(null);

  // Filter state
  const [filterPlatform, setFilterPlatform] = useState<'all' | 'line' | 'telegram'>('all');

  // Load initial history logs
  useEffect(() => {
    apiClient
      .get<any[]>('/api/push/logs?limit=30')
      .then((res) => {
        setMessages(res.data);
      })
      .catch((err) => console.error('Failed to load past push logs:', err));
  }, [setMessages]);

  const handleSendTestPush = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetId || !message) return;

    setSending(true);
    setSendResult(null);

    try {
      await apiClient.post('/api/push', {
        platform,
        targetId: targetId.trim(),
        message: message.trim(),
        sourceTrigger: 'manual_ui',
      });
      setSendResult({ success: true });
      setMessage('');
    } catch (err: any) {
      setSendResult({
        success: false,
        error: err.response?.data?.error || err.message || 'Push delivery failed',
      });
    } finally {
      setSending(false);
    }
  };

  const filteredMessages = liveMessages.filter((m) => {
    if (filterPlatform === 'all') return true;
    return m.platform === filterPlatform;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
            <BellRing className="w-5 h-5 text-emerald-500 dark:text-emerald-400" />
            Push Message Watcher (Real-Time SSE)
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Monitor proactive outbound notifications (Minor Push) live as they happen.
          </p>
        </div>

        <Badge variant={isConnected ? 'success' : 'danger'} dot pulse={isConnected} size="md">
          {isConnected ? 'SSE Live Stream Active' : 'Connecting SSE...'}
        </Badge>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Test Push Sender Form */}
        <Card className="h-fit">
          <h3 className="text-base font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
            <Send className="w-4 h-4 text-emerald-500 dark:text-emerald-400" />
            Send Test Push Message
          </h3>

          <form onSubmit={handleSendTestPush} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Target Platform</label>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  variant={platform === 'line' ? 'primary' : 'secondary'}
                  size="sm"
                  onClick={() => setPlatform('line')}
                  className={platform === 'line' ? 'bg-[#06C755] hover:bg-[#06C755]/90 text-white' : ''}
                >
                  LINE
                </Button>

                <Button
                  type="button"
                  variant={platform === 'telegram' ? 'primary' : 'secondary'}
                  size="sm"
                  onClick={() => setPlatform('telegram')}
                  className={platform === 'telegram' ? 'bg-[#229ED9] hover:bg-[#229ED9]/90 text-white' : ''}
                >
                  Telegram
                </Button>
              </div>
            </div>

            <Input
              label={platform === 'line' ? 'LINE User ID' : 'Telegram Chat ID'}
              placeholder={platform === 'line' ? 'U4af4980629...' : '123456789'}
              value={targetId}
              onChange={(e) => setTargetId(e.target.value)}
              isMonospace
              required
            />

            <Textarea
              label="Message Content"
              rows={4}
              placeholder="Type push message notification text here..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              required
            />

            {sendResult && (
              <div
                className={`p-3 rounded-xl text-xs flex items-center space-x-2 ${
                  sendResult.success
                    ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20'
                    : 'bg-red-500/10 text-red-700 dark:text-red-300 border border-red-500/20'
                }`}
              >
                {sendResult.success ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 dark:text-emerald-400 shrink-0" />
                    <span>Push message dispatched successfully!</span>
                  </>
                ) : (
                  <>
                    <XCircle className="w-4 h-4 text-red-500 dark:text-red-400 shrink-0" />
                    <span>Failed: {sendResult.error}</span>
                  </>
                )}
              </div>
            )}

            <Button
              type="submit"
              variant="primary"
              size="md"
              isLoading={sending}
              className="w-full"
              leftIcon={<Send className="w-3.5 h-3.5" />}
            >
              Send Proactive Push
            </Button>
          </form>

          <div className="mt-4 p-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800/80 rounded-xl text-[11px] text-slate-500 dark:text-slate-400 space-y-1">
            <div className="font-semibold text-slate-700 dark:text-slate-300">External Push API Endpoint:</div>
            <code className="text-emerald-600 dark:text-emerald-400 text-[10px] block font-mono">
              POST /api/push
            </code>
            <p>Can be called via curl, cron jobs, or webhook triggers.</p>
          </div>
        </Card>

        {/* Live SSE Messages Feed */}
        <Card className="lg:col-span-2 flex flex-col space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center space-x-2">
              <Activity className="w-4 h-4 text-emerald-500 dark:text-emerald-400" />
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Live Push Activity Log</h3>
              <Badge variant="neutral">{filteredMessages.length} events</Badge>
            </div>

            <div className="flex items-center space-x-1">
              <Filter className="w-3 h-3 text-slate-400 mr-1" />
              {(['all', 'line', 'telegram'] as const).map((pf) => (
                <Button
                  key={pf}
                  variant={filterPlatform === pf ? 'secondary' : 'ghost'}
                  size="sm"
                  onClick={() => setFilterPlatform(pf)}
                  className={`text-[11px] uppercase ${filterPlatform === pf ? 'text-emerald-600 dark:text-emerald-400 border-emerald-500/30' : ''}`}
                >
                  {pf}
                </Button>
              ))}
            </div>
          </div>

          <div className="space-y-3 max-h-[600px] overflow-y-auto pr-1">
            {filteredMessages.length === 0 ? (
              <div className="p-12 text-center text-slate-400 text-xs">
                No push messages recorded yet. Send a test push above to watch it appear live!
              </div>
            ) : (
              filteredMessages.map((msg) => (
                <div
                  key={msg.id}
                  className="bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 rounded-xl p-4 space-y-2 hover:border-slate-300 dark:hover:border-slate-700 transition"
                >
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center space-x-2">
                      <Badge variant={msg.platform === 'line' ? 'line' : 'telegram'}>
                        {msg.platform}
                      </Badge>

                      <Badge variant={msg.status === 'SUCCESS' ? 'success' : 'danger'}>
                        {msg.status === 'SUCCESS' ? 'SENT' : 'FAILED'}
                      </Badge>

                      <span className="text-[10px] text-slate-400 font-mono">
                        via {msg.sourceTrigger}
                      </span>
                    </div>

                    <div className="text-slate-400 text-[11px] flex items-center space-x-1 font-mono">
                      <Clock className="w-3 h-3" />
                      <span>{new Date(msg.createdAt).toLocaleTimeString()}</span>
                    </div>
                  </div>

                  <div className="text-xs font-mono text-slate-500 dark:text-slate-400 flex items-center space-x-1">
                    <User className="w-3 h-3 text-slate-400" />
                    <span className="text-slate-700 dark:text-slate-300 font-semibold truncate">Target: {msg.targetId}</span>
                  </div>

                  <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-3 text-xs text-slate-800 dark:text-slate-200 font-sans whitespace-pre-wrap leading-relaxed">
                    {msg.messageContent}
                  </div>

                  {msg.errorMessage && (
                    <div className="text-[11px] text-red-600 dark:text-red-400 bg-red-500/10 border border-red-500/20 p-2 rounded-lg">
                      Error: {msg.errorMessage}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </Card>
      </div>
    </div>
  );
};
