import React, { useEffect, useState } from 'react';
import {
  Radio,
  Copy,
  Check,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Bot,
  Play,
} from 'lucide-react';
import { apiClient } from '../services/api.client';
import { Input, Button, Card, Badge } from '../components/ui';

interface BotChannelDto {
  id: string;
  platform: 'line' | 'telegram';
  hasLineChannelSecret: boolean;
  hasLineAccessToken: boolean;
  hasTelegramBotToken: boolean;
  maskedLineChannelSecret?: string;
  maskedLineAccessToken?: string;
  maskedTelegramBotToken?: string;
  isActive: boolean;
  webhookUrl: string;
  lastVerifiedAt?: string | null;
  botDisplayName?: string | null;
  botAvatarUrl?: string | null;
}

export const ChannelSettingsPage: React.FC = () => {
  const [channels, setChannels] = useState<BotChannelDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);

  // LINE Form state
  const [lineSecret, setLineSecret] = useState('');
  const [lineToken, setLineToken] = useState('');
  const [lineSaving, setLineSaving] = useState(false);
  const [lineVerifying, setLineVerifying] = useState(false);
  const [lineVerifyResult, setLineVerifyResult] = useState<{ ok: boolean; error?: string } | null>(null);

  // Telegram Form state
  const [tgToken, setTgToken] = useState('');
  const [tgWebhookSecret, setTgWebhookSecret] = useState('');
  const [tgSaving, setTgSaving] = useState(false);
  const [tgVerifying, setTgVerifying] = useState(false);
  const [tgVerifyResult, setTgVerifyResult] = useState<{ ok: boolean; error?: string } | null>(null);

  const fetchChannels = async () => {
    try {
      setLoading(true);
      const res = await apiClient.get<BotChannelDto[]>('/api/channels');
      setChannels(res.data);
    } catch (err) {
      console.error('Failed to fetch channels:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchChannels();
  }, []);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedUrl(text);
    setTimeout(() => setCopiedUrl(null), 2500);
  };

  const lineChannel = channels.find((c) => c.platform === 'line');
  const tgChannel = channels.find((c) => c.platform === 'telegram');

  const handleSaveLine = async () => {
    try {
      setLineSaving(true);
      await apiClient.put('/api/channels/line', {
        lineChannelSecret: lineSecret || undefined,
        lineAccessToken: lineToken || undefined,
        isActive: true,
      });
      setLineSecret('');
      setLineToken('');
      await fetchChannels();
    } catch (err) {
      console.error('Failed to save LINE channel:', err);
    } finally {
      setLineSaving(false);
    }
  };

  const handleVerifyLine = async () => {
    try {
      setLineVerifying(true);
      setLineVerifyResult(null);
      const res = await apiClient.post<{ ok: boolean; error?: string }>('/api/channels/line/verify');
      setLineVerifyResult(res.data);
      await fetchChannels();
    } catch (err: any) {
      setLineVerifyResult({
        ok: false,
        error: err.response?.data?.error || 'Verification request failed',
      });
    } finally {
      setLineVerifying(false);
    }
  };

  const handleSaveTg = async () => {
    try {
      setTgSaving(true);
      await apiClient.put('/api/channels/telegram', {
        telegramBotToken: tgToken || undefined,
        telegramWebhookSecret: tgWebhookSecret || undefined,
        isActive: true,
      });
      setTgToken('');
      setTgWebhookSecret('');
      await fetchChannels();
    } catch (err) {
      console.error('Failed to save Telegram channel:', err);
    } finally {
      setTgSaving(false);
    }
  };

  const handleVerifyTg = async () => {
    try {
      setTgVerifying(true);
      setTgVerifyResult(null);
      const res = await apiClient.post<{ ok: boolean; error?: string }>('/api/channels/telegram/verify');
      setTgVerifyResult(res.data);
      await fetchChannels();
    } catch (err: any) {
      setTgVerifyResult({
        ok: false,
        error: err.response?.data?.error || 'Verification request failed',
      });
    } finally {
      setTgVerifying(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
            <Radio className="w-5 h-5 text-emerald-500 dark:text-emerald-400" />
            Bot Channel Settings
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Manage LINE Messaging API and Telegram Bot credentials dynamically via Web UI instead of .env.
          </p>
        </div>

        <Button variant="secondary" size="sm" onClick={fetchChannels} leftIcon={<RefreshCw className="w-3.5 h-3.5" />}>
          Refresh
        </Button>
      </div>

      {loading ? (
        <div className="p-12 text-center text-slate-400">Loading channel settings...</div>
      ) : (
        <div className="grid grid-cols-1 gap-8">
          {/* ────────────────── SECTION 1: LINE BOT ────────────────── */}
          <Card>
            <div className="flex items-start justify-between pb-6 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 rounded-2xl bg-[#06C755]/10 text-[#06C755] border border-[#06C755]/30 flex items-center justify-center font-bold text-xl">
                  LINE
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white">LINE Messaging API</h3>
                    {lineChannel?.lastVerifiedAt ? (
                      <Badge variant="success" dot>
                        Connected
                      </Badge>
                    ) : lineChannel?.hasLineAccessToken ? (
                      <Badge variant="warning" dot>
                        Configured (Unverified)
                      </Badge>
                    ) : (
                      <Badge variant="neutral">Not Configured</Badge>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Free Reply-First with intelligent 5-bubble splitting & proactive minor push.
                  </p>
                </div>
              </div>

              {lineChannel?.botDisplayName && (
                <div className="flex items-center space-x-3 bg-slate-50 dark:bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800">
                  {lineChannel.botAvatarUrl ? (
                    <img
                      src={lineChannel.botAvatarUrl}
                      alt="Bot Avatar"
                      className="w-8 h-8 rounded-full border border-slate-200 dark:border-slate-700 object-cover"
                    />
                  ) : (
                    <Bot className="w-6 h-6 text-emerald-500 dark:text-emerald-400" />
                  )}
                  <div className="text-right">
                    <div className="text-xs font-bold text-slate-900 dark:text-white">{lineChannel.botDisplayName}</div>
                    <div className="text-[10px] text-slate-500 dark:text-slate-400">
                      Verified: {new Date(lineChannel.lastVerifiedAt!).toLocaleTimeString()}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Webhook URL with Copy button */}
            <div className="mt-5 p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  LINE Webhook URL (Paste this into LINE Developers Console)
                </span>
                <span className="text-[11px] text-emerald-600 dark:text-emerald-400">Strict HTTPS required</span>
              </div>
              <div className="flex items-center space-x-2">
                <Input
                  readOnly
                  isMonospace
                  value={lineChannel?.webhookUrl || ''}
                  className="bg-white dark:bg-slate-900 select-all"
                />
                <Button
                  variant="primary"
                  size="md"
                  onClick={() => copyToClipboard(lineChannel?.webhookUrl || '')}
                  leftIcon={
                    copiedUrl === lineChannel?.webhookUrl ? (
                      <Check className="w-3.5 h-3.5" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )
                  }
                >
                  {copiedUrl === lineChannel?.webhookUrl ? 'Copied!' : 'Copy'}
                </Button>
              </div>
            </div>

            {/* Credential Inputs */}
            <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="Channel Secret"
                type="password"
                isMonospace
                placeholder={
                  lineChannel?.hasLineChannelSecret
                    ? `Encrypted (${lineChannel.maskedLineChannelSecret})`
                    : 'Paste Channel Secret...'
                }
                value={lineSecret}
                onChange={(e) => setLineSecret(e.target.value)}
              />

              <Input
                label="Channel Access Token (Long-lived)"
                type="password"
                isMonospace
                placeholder={
                  lineChannel?.hasLineAccessToken
                    ? `Encrypted (${lineChannel.maskedLineAccessToken})`
                    : 'Paste Channel Access Token...'
                }
                value={lineToken}
                onChange={(e) => setLineToken(e.target.value)}
              />
            </div>

            {/* Verification Result Feedback */}
            {lineVerifyResult && (
              <div
                className={`mt-4 p-3 rounded-xl text-xs flex items-center space-x-2 ${
                  lineVerifyResult.ok
                    ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-300'
                    : 'bg-red-500/10 border border-red-500/20 text-red-700 dark:text-red-300'
                }`}
              >
                {lineVerifyResult.ok ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 dark:text-emerald-400 shrink-0" />
                    <span>LINE Channel verified successfully! Connected to bot.</span>
                  </>
                ) : (
                  <>
                    <XCircle className="w-4 h-4 text-red-500 dark:text-red-400 shrink-0" />
                    <span>Verification failed: {lineVerifyResult.error}</span>
                  </>
                )}
              </div>
            )}

            {/* Actions */}
            <div className="mt-5 flex items-center justify-end space-x-3">
              <Button
                variant="secondary"
                size="md"
                onClick={handleVerifyLine}
                disabled={!lineChannel?.hasLineAccessToken}
                isLoading={lineVerifying}
                leftIcon={<Play className="w-3.5 h-3.5" />}
              >
                Verify Connection
              </Button>

              <Button
                variant="primary"
                size="md"
                onClick={handleSaveLine}
                disabled={!lineSecret && !lineToken}
                isLoading={lineSaving}
              >
                Save LINE Settings
              </Button>
            </div>
          </Card>

          {/* ────────────────── SECTION 2: TELEGRAM BOT ────────────────── */}
          <Card>
            <div className="flex items-start justify-between pb-6 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 rounded-2xl bg-[#229ED9]/10 text-[#229ED9] border border-[#229ED9]/30 flex items-center justify-center font-bold text-xl">
                  TG
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white">Telegram Bot API</h3>
                    {tgChannel?.lastVerifiedAt ? (
                      <Badge variant="success" dot>
                        Connected
                      </Badge>
                    ) : tgChannel?.hasTelegramBotToken ? (
                      <Badge variant="warning" dot>
                        Configured (Unverified)
                      </Badge>
                    ) : (
                      <Badge variant="neutral">Not Configured</Badge>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Direct reply-to messages, auto Markdown fallback, and 4,000-char message chunking.
                  </p>
                </div>
              </div>

              {tgChannel?.botDisplayName && (
                <div className="bg-slate-50 dark:bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 text-right">
                  <div className="text-xs font-bold text-slate-900 dark:text-white font-mono">{tgChannel.botDisplayName}</div>
                  <div className="text-[10px] text-slate-500 dark:text-slate-400">
                    Verified: {new Date(tgChannel.lastVerifiedAt!).toLocaleTimeString()}
                  </div>
                </div>
              )}
            </div>

            {/* Telegram Webhook URL with Copy button */}
            <div className="mt-5 p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Telegram Webhook URL (Set via setWebhook API or BotFather)
                </span>
                <span className="text-[11px] text-emerald-600 dark:text-emerald-400">HTTP Webhook Mode</span>
              </div>
              <div className="flex items-center space-x-2">
                <Input
                  readOnly
                  isMonospace
                  value={tgChannel?.webhookUrl || ''}
                  className="bg-white dark:bg-slate-900 select-all"
                />
                <Button
                  variant="primary"
                  size="md"
                  onClick={() => copyToClipboard(tgChannel?.webhookUrl || '')}
                  leftIcon={
                    copiedUrl === tgChannel?.webhookUrl ? (
                      <Check className="w-3.5 h-3.5" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )
                  }
                >
                  {copiedUrl === tgChannel?.webhookUrl ? 'Copied!' : 'Copy'}
                </Button>
              </div>
            </div>

            {/* Telegram Credential Inputs */}
            <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="Telegram Bot Token (from @BotFather)"
                type="password"
                isMonospace
                placeholder={
                  tgChannel?.hasTelegramBotToken
                    ? `Encrypted (${tgChannel.maskedTelegramBotToken})`
                    : '123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ...'
                }
                value={tgToken}
                onChange={(e) => setTgToken(e.target.value)}
              />

              <Input
                label="Webhook Secret Token (Optional header verification)"
                type="password"
                isMonospace
                placeholder="Optional secret string..."
                value={tgWebhookSecret}
                onChange={(e) => setTgWebhookSecret(e.target.value)}
              />
            </div>

            {/* Telegram Verification Result Feedback */}
            {tgVerifyResult && (
              <div
                className={`mt-4 p-3 rounded-xl text-xs flex items-center space-x-2 ${
                  tgVerifyResult.ok
                    ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-300'
                    : 'bg-red-500/10 border border-red-500/20 text-red-700 dark:text-red-300'
                }`}
              >
                {tgVerifyResult.ok ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 dark:text-emerald-400 shrink-0" />
                    <span>Telegram Bot verified successfully! Connected to BotFather token.</span>
                  </>
                ) : (
                  <>
                    <XCircle className="w-4 h-4 text-red-500 dark:text-red-400 shrink-0" />
                    <span>Verification failed: {tgVerifyResult.error}</span>
                  </>
                )}
              </div>
            )}

            {/* Actions */}
            <div className="mt-5 flex items-center justify-end space-x-3">
              <Button
                variant="secondary"
                size="md"
                onClick={handleVerifyTg}
                disabled={!tgChannel?.hasTelegramBotToken}
                isLoading={tgVerifying}
                leftIcon={<Play className="w-3.5 h-3.5" />}
              >
                Verify Connection
              </Button>

              <Button
                variant="primary"
                size="md"
                onClick={handleSaveTg}
                disabled={!tgToken && !tgWebhookSecret}
                isLoading={tgSaving}
              >
                Save Telegram Settings
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};
