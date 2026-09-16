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
  ExternalLink,
} from 'lucide-react';
import { apiClient } from '../services/api.client';
import { Input, Button, Card, Badge } from '../components/ui';

interface BotChannelDto {
  id: string;
  platform: 'line' | 'telegram' | 'discord';
  hasLineChannelSecret: boolean;
  hasLineAccessToken: boolean;
  hasTelegramBotToken: boolean;
  hasDiscordBotToken: boolean;
  maskedLineChannelSecret?: string;
  maskedLineAccessToken?: string;
  maskedTelegramBotToken?: string;
  maskedDiscordBotToken?: string;
  discordApplicationId?: string | null;
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

  // Discord Form state
  const [discordToken, setDiscordToken] = useState('');
  const [discordAppId, setDiscordAppId] = useState('');
  const [discordSaving, setDiscordSaving] = useState(false);
  const [discordVerifying, setDiscordVerifying] = useState(false);
  const [discordVerifyResult, setDiscordVerifyResult] = useState<{ ok: boolean; botName?: string; error?: string } | null>(null);

  const discordChannel = channels.find((c) => c.platform === 'discord');

  const handleSaveDiscord = async () => {
    try {
      setDiscordSaving(true);
      await apiClient.put('/api/channels/discord', {
        discordBotToken: discordToken || undefined,
        discordApplicationId: discordAppId || undefined,
        isActive: true,
      });
      setDiscordToken('');
      setDiscordAppId('');
      await fetchChannels();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to save Discord channel');
    } finally {
      setDiscordSaving(false);
    }
  };

  const handleVerifyDiscord = async () => {
    try {
      setDiscordVerifying(true);
      setDiscordVerifyResult(null);
      const res = await apiClient.post<{ ok: boolean; botName?: string; error?: string }>('/api/channels/discord/verify');
      setDiscordVerifyResult(res.data);
      await fetchChannels();
    } catch (err: any) {
      setDiscordVerifyResult({
        ok: false,
        error: err.response?.data?.error || 'Verification request failed',
      });
    } finally {
      setDiscordVerifying(false);
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

          {/* ────────────────── SECTION 3: DISCORD BOT ────────────────── */}
          <Card>
            <div className="flex items-start justify-between pb-6 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 rounded-2xl bg-[#5865F2]/10 text-[#5865F2] border border-[#5865F2]/30 flex items-center justify-center font-bold text-xl">
                  Discord
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white">Discord Bot</h3>
                    {discordChannel?.lastVerifiedAt ? (
                      <Badge variant="success" dot>
                        Connected
                      </Badge>
                    ) : discordChannel?.hasDiscordBotToken ? (
                      <Badge variant="warning" dot>
                        Configured (Unverified)
                      </Badge>
                    ) : (
                      <Badge variant="neutral">Not Configured</Badge>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    WebSocket Gateway client for Direct Messages (DM), Server Channels (@Mention), and Receipt Vision OCR.
                  </p>
                </div>
              </div>

              {discordChannel?.botDisplayName && (
                <div className="flex items-center space-x-3 bg-slate-50 dark:bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800">
                  {discordChannel.botAvatarUrl ? (
                    <img
                      src={discordChannel.botAvatarUrl}
                      alt="Bot Avatar"
                      className="w-8 h-8 rounded-full border border-slate-300 dark:border-slate-700 object-cover"
                    />
                  ) : (
                    <Bot className="w-5 h-5 text-indigo-500" />
                  )}
                  <div>
                    <div className="text-xs font-bold text-slate-900 dark:text-white">
                      {discordChannel.botDisplayName}
                    </div>
                    <div className="text-[10px] text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" />
                      Gateway Ready
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Quick Setup Instructions */}
            <div className="mt-5 p-4 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 text-xs space-y-2 text-slate-600 dark:text-slate-400">
              <div className="font-semibold text-slate-900 dark:text-slate-200 flex items-center gap-2">
                <span>📘 วิธีขอ Discord Bot Token และเปิดใช้งาน:</span>
                <a
                  href="https://discord.com/developers/applications"
                  target="_blank"
                  rel="noreferrer"
                  className="text-indigo-500 hover:underline inline-flex items-center gap-1 font-normal"
                >
                  Discord Developer Portal <ExternalLink className="w-3 h-3" />
                </a>
              </div>
              <ol className="list-decimal list-inside space-y-1 ml-1">
                <li>สร้าง New Application ใน Discord Developer Portal</li>
                <li>ไปที่เมนู <strong>Bot</strong> ➔ กด <strong>Reset Token</strong> และคัดลอก Token มาวางในช่องด้านล่าง</li>
                <li>
                  เลื่อนลงมาที่หัวข้อ <strong>Privileged Gateway Intents</strong> ➔ ติ๊กเปิดสวิตช์{' '}
                  <strong className="text-indigo-600 dark:text-indigo-400">MESSAGE CONTENT INTENT</strong> (จำเป็นต้องเปิดเพื่อให้ AI อ่านข้อความและรูปบิลได้)
                </li>
                <li>
                  คัดลอก <strong>Application ID</strong> จากหน้า General Information มาใส่ เพื่อสร้างลิงก์เชิญบอทเข้า Server ได้ทันที
                </li>
              </ol>
            </div>

            {/* 1-Click Bot Invite Link (if Application ID exists) */}
            {discordChannel?.discordApplicationId && (
              <div className="mt-4 p-3 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                <div>
                  <div className="font-bold text-indigo-900 dark:text-indigo-200">🔗 เชิญบอทเข้า Discord Server</div>
                  <div className="text-indigo-700/80 dark:text-indigo-300 text-[11px] mt-0.5">
                    คลิกปุ่มด้านขวาเพื่อเพิ่มคุณเลขา AI เข้าไปใน Server หรือแชทส่วนตัวของคุณ
                  </div>
                </div>
                <a
                  href={`https://discord.com/oauth2/authorize?client_id=${discordChannel.discordApplicationId}&scope=bot%20applications.commands&permissions=534723950656`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold transition shrink-0"
                >
                  <ExternalLink className="w-3.5 h-3.5" /> เชิญบอทเข้า Server
                </a>
              </div>
            )}

            {/* Token Inputs */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-5">
              <Input
                label="Discord Bot Token"
                type="password"
                isMonospace
                placeholder={
                  discordChannel?.hasDiscordBotToken
                    ? `Encrypted (${discordChannel.maskedDiscordBotToken})`
                    : 'OTg3NjU0MzIx... (จากหน้า Developer Portal > Bot)'
                }
                value={discordToken}
                onChange={(e) => setDiscordToken(e.target.value)}
              />

              <Input
                label="Application ID / Client ID (สำหรับสร้างปุ่ม Invite)"
                type="text"
                isMonospace
                placeholder={discordChannel?.discordApplicationId || '123456789012345678'}
                value={discordAppId}
                onChange={(e) => setDiscordAppId(e.target.value)}
              />
            </div>

            {/* Verification Result Feedback */}
            {discordVerifyResult && (
              <div
                className={`mt-4 p-3 rounded-xl text-xs flex items-center space-x-2 ${
                  discordVerifyResult.ok
                    ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-300'
                    : 'bg-red-500/10 border border-red-500/20 text-red-700 dark:text-red-300'
                }`}
              >
                {discordVerifyResult.ok ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 dark:text-emerald-400 shrink-0" />
                    <span>Discord Bot verified successfully! Connected as {discordVerifyResult.botName}.</span>
                  </>
                ) : (
                  <>
                    <XCircle className="w-4 h-4 text-red-500 dark:text-red-400 shrink-0" />
                    <span>Verification failed: {discordVerifyResult.error}</span>
                  </>
                )}
              </div>
            )}

            {/* Actions */}
            <div className="mt-5 flex items-center justify-end space-x-3">
              <Button
                variant="secondary"
                size="md"
                onClick={handleVerifyDiscord}
                disabled={!discordChannel?.hasDiscordBotToken}
                isLoading={discordVerifying}
                leftIcon={<Play className="w-3.5 h-3.5" />}
              >
                Verify Connection
              </Button>

              <Button
                variant="primary"
                size="md"
                onClick={handleSaveDiscord}
                disabled={!discordToken && !discordAppId}
                isLoading={discordSaving}
              >
                Save Discord Settings
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};
