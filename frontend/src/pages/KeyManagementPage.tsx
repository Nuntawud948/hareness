import React, { useEffect, useState } from 'react';
import {
  KeyRound,
  CheckCircle2,
  XCircle,
  Play,
  Plus,
  Trash2,
  Star,
  RefreshCw,
  Globe,
  Sparkles,
  ExternalLink,
  MessageSquare,
  Send,
  Zap,
  Bot,
  User,
  ChevronUp,
  ChevronDown,
  Clock,
  Layers,
} from 'lucide-react';
import { apiClient } from '../services/api.client';
import { Input, Button, Card, Badge, Modal, CustomDropdown } from '../components/ui';

interface AvailableModel {
  id: string;
  modelId: string;
  displayName: string;
  isDefault: boolean;
  maxTokens?: number | null;
}

export interface GlobalPriorityModel {
  id: string;
  providerId: string;
  modelId: string;
  displayName: string;
  isDefault: boolean;
  isActive: boolean;
  priorityOrder: number;
  maxTokens?: number | null;
  providerName: string;
  providerDisplayName: string;
  providerIsActive: boolean;
  cooldownSecondsRemaining: number;
  isCoolingDown: boolean;
}

interface ProviderKeyItem {
  id: string;
  providerName: string;
  displayName: string;
  maskedApiKey: string;
  hasApiKey: boolean;
  baseUrl?: string | null;
  isActive: boolean;
  priorityOrder: number;
  models: AvailableModel[];
}

interface ProviderPreset {
  name: string;
  providerName: string;
  displayName: string;
  baseUrl: string;
  defaultModelId: string;
  defaultModelName: string;
  docUrl: string;
}

const CHINESE_PRESETS: ProviderPreset[] = [
  {
    name: 'DeepSeek (深度求索)',
    providerName: 'openai_compatible',
    displayName: 'DeepSeek',
    baseUrl: 'https://api.deepseek.com/v1',
    defaultModelId: 'deepseek-chat',
    defaultModelName: 'DeepSeek-V3',
    docUrl: 'https://platform.deepseek.com',
  },
  {
    name: 'Qwen / DashScope (阿里通义千问)',
    providerName: 'openai_compatible',
    displayName: 'Alibaba Qwen (DashScope)',
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    defaultModelId: 'qwen-plus',
    defaultModelName: 'Qwen Plus',
    docUrl: 'https://help.aliyun.com/zh/model-studio',
  },
  {
    name: 'SiliconFlow (硅基流动)',
    providerName: 'openai_compatible',
    displayName: 'SiliconFlow (硅基流动)',
    baseUrl: 'https://api.siliconflow.cn/v1',
    defaultModelId: 'deepseek-ai/DeepSeek-V3',
    defaultModelName: 'DeepSeek V3 (SiliconFlow)',
    docUrl: 'https://siliconflow.cn',
  },
  {
    name: 'Z.AI / GLM (International)',
    providerName: 'openai_compatible',
    displayName: 'Z.AI (GLM)',
    baseUrl: 'https://api.z.ai/api/paas/v4/',
    defaultModelId: 'glm-5.3-flash',
    defaultModelName: 'GLM-5.3 Flash',
    docUrl: 'https://docs.z.ai',
  },
  {
    name: 'Zhipu AI / GLM (China - 智谱清言)',
    providerName: 'openai_compatible',
    displayName: 'Zhipu AI (GLM)',
    baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
    defaultModelId: 'glm-5.3-flash',
    defaultModelName: 'GLM-5.3 Flash',
    docUrl: 'https://open.bigmodel.cn',
  },
  {
    name: 'Moonshot AI / Kimi (月之暗面)',
    providerName: 'openai_compatible',
    displayName: 'Moonshot Kimi',
    baseUrl: 'https://api.moonshot.cn/v1',
    defaultModelId: 'moonshot-v1-8k',
    defaultModelName: 'Moonshot V1 8K',
    docUrl: 'https://platform.moonshot.cn',
  },
  {
    name: 'Custom OpenAI-Compatible (ใส่เองตามใจ)',
    providerName: 'openai_compatible',
    displayName: 'Custom Provider',
    baseUrl: 'https://your-api-endpoint.com/v1',
    defaultModelId: 'model-name',
    defaultModelName: 'Default Model',
    docUrl: '',
  },
];

export const KeyManagementPage: React.FC = () => {
  const [providers, setProviders] = useState<ProviderKeyItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [testResults, setTestResults] = useState<Record<string, { ok: boolean; error?: string; testing?: boolean }>>({});
  
  // Edit existing key modal state
  const [editingKey, setEditingKey] = useState<ProviderKeyItem | null>(null);
  const [newApiKey, setNewApiKey] = useState('');
  const [newBaseUrl, setNewBaseUrl] = useState('');
  const [savingKey, setSavingKey] = useState(false);

  // Add new provider modal state
  const [isAddingProvider, setIsAddingProvider] = useState(false);
  const [selectedPresetKey, setSelectedPresetKey] = useState(CHINESE_PRESETS[0].name);
  const [customDisplayName, setCustomDisplayName] = useState(CHINESE_PRESETS[0].displayName);
  const [customBaseUrl, setCustomBaseUrl] = useState(CHINESE_PRESETS[0].baseUrl);
  const [customApiKey, setCustomApiKey] = useState('');
  const [customModelId, setCustomModelId] = useState(CHINESE_PRESETS[0].defaultModelId);
  const [customModelName, setCustomModelName] = useState(CHINESE_PRESETS[0].defaultModelName);
  const [creatingProvider, setCreatingProvider] = useState(false);

  // Dedicated Add Model Modal state (User creates models dynamically into DB)
  const [isAddingModelModal, setIsAddingModelModal] = useState(false);
  const [selectedProviderForModel, setSelectedProviderForModel] = useState<string>('');
  const [newModelId, setNewModelId] = useState('');
  const [newModelName, setNewModelName] = useState('');
  const [newModelIsDefault, setNewModelIsDefault] = useState(false);
  const [savingModel, setSavingModel] = useState(false);

  // Live Chat Playground state
  const [isChatPlaygroundOpen, setIsChatPlaygroundOpen] = useState(false);
  const [testChatModelId, setTestChatModelId] = useState<string>('');
  const [testChatInput, setTestChatInput] = useState('');
  const [isTestChatSending, setIsTestChatSending] = useState(false);
  const [testChatMessages, setTestChatMessages] = useState<
    Array<{
      id: string;
      role: 'user' | 'assistant';
      content: string;
      metrics?: {
        responseTimeMs: number;
        promptTokens: number;
        completionTokens: number;
        totalTokens: number;
        estimatedCostUsd: number;
        modelId: string;
        providerName: string;
        wasFailover: boolean;
        failoverReason?: string;
      };
    }>
  >([]);

  // Global Model Priority Cascade state
  const [priorityModels, setPriorityModels] = useState<GlobalPriorityModel[]>([]);
  const [loadingPriority, setLoadingPriority] = useState(false);
  const [reordering, setReordering] = useState(false);

  const fetchPriorityModels = async () => {
    try {
      setLoadingPriority(true);
      const res = await apiClient.get<GlobalPriorityModel[]>('/api/models/priority');
      setPriorityModels(res.data);
    } catch (err) {
      console.error('Failed to fetch model priorities:', err);
    } finally {
      setLoadingPriority(false);
    }
  };

  const handleMovePriority = async (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= priorityModels.length || reordering) return;

    const newModels = [...priorityModels];
    const temp = newModels[index];
    newModels[index] = newModels[targetIndex];
    newModels[targetIndex] = temp;

    // Optimistically update
    setPriorityModels(newModels);

    try {
      setReordering(true);
      const orderedIds = newModels.map((m) => m.id);
      await apiClient.put('/api/models/reorder', { orderedIds });
      await fetchPriorityModels();
      await fetchKeys();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to reorder models');
      await fetchPriorityModels();
    } finally {
      setReordering(false);
    }
  };

  const handleToggleModelActive = async (model: GlobalPriorityModel) => {
    const newActive = !model.isActive;
    setPriorityModels((prev) =>
      prev.map((m) => (m.id === model.id ? { ...m, isActive: newActive } : m))
    );

    try {
      await apiClient.patch(`/api/models/${model.id}/toggle`, { isActive: newActive });
      await fetchPriorityModels();
      await fetchKeys();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to update model status');
      await fetchPriorityModels();
    }
  };

  const handleOpenChatPlayground = (preselectedModelId?: string) => {
    if (preselectedModelId) {
      setTestChatModelId(preselectedModelId);
    } else if (!testChatModelId && providers.length > 0) {
      // Find first default model across active providers
      const activeP = providers.find((p) => p.isActive && p.hasApiKey);
      const defM = activeP?.models.find((m) => m.isDefault) || activeP?.models[0];
      if (defM) setTestChatModelId(defM.modelId);
    }
    setIsChatPlaygroundOpen(true);
  };

  const handleSendTestChat = async () => {
    if (!testChatInput.trim() || isTestChatSending) return;
    const userText = testChatInput.trim();
    const userMsgId = `user-${Date.now()}`;

    setTestChatMessages((prev) => [
      ...prev,
      { id: userMsgId, role: 'user', content: userText },
    ]);
    setTestChatInput('');
    setIsTestChatSending(true);

    try {
      const res = await apiClient.post('/api/keys/chat-test', {
        modelId: testChatModelId || undefined,
        message: userText,
      });
      const data = res.data;
      setTestChatMessages((prev) => [
        ...prev,
        {
          id: `bot-${Date.now()}`,
          role: 'assistant',
          content: data.content,
          metrics: {
            responseTimeMs: data.responseTimeMs,
            promptTokens: data.promptTokens,
            completionTokens: data.completionTokens,
            totalTokens: data.totalTokens,
            estimatedCostUsd: data.estimatedCostUsd,
            modelId: data.modelId,
            providerName: data.providerName,
            wasFailover: data.wasFailover,
            failoverReason: data.failoverReason,
          },
        },
      ]);
    } catch (err: any) {
      const errMsg = err.response?.data?.error || err.message || 'Failed to send message';
      setTestChatMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          role: 'assistant',
          content: `⚠️ เกิดข้อผิดพลาด: ${errMsg}`,
        },
      ]);
    } finally {
      setIsTestChatSending(false);
    }
  };

  const fetchKeys = async () => {
    try {
      setLoading(true);
      const [keysRes] = await Promise.all([
        apiClient.get<ProviderKeyItem[]>('/api/keys'),
        fetchPriorityModels(),
      ]);
      setProviders(keysRes.data);
      if (keysRes.data.length > 0 && !selectedProviderForModel) {
        setSelectedProviderForModel(keysRes.data[0].id);
      }
    } catch (err) {
      console.error('Failed to fetch keys:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchKeys();
  }, []);

  const handleSelectPreset = (presetName: string) => {
    setSelectedPresetKey(presetName);
    const preset = CHINESE_PRESETS.find((p) => p.name === presetName) || CHINESE_PRESETS[0];
    setCustomDisplayName(preset.displayName);
    setCustomBaseUrl(preset.baseUrl);
    setCustomModelId(preset.defaultModelId);
    setCustomModelName(preset.defaultModelName);
  };

  const handleCreateCustomProvider = async () => {
    if (!customDisplayName.trim()) return;
    try {
      setCreatingProvider(true);
      await apiClient.post('/api/keys', {
        providerName: 'openai_compatible',
        displayName: customDisplayName.trim(),
        rawApiKey: customApiKey.trim() || undefined,
        baseUrl: customBaseUrl.trim() || null,
        initialModelId: customModelId.trim() || undefined,
        initialModelName: customModelName.trim() || undefined,
      });

      setIsAddingProvider(false);
      setCustomApiKey('');
      await fetchKeys();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to create provider');
    } finally {
      setCreatingProvider(false);
    }
  };

  const handleDeleteProvider = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete "${name}"? All associated models will be removed.`)) return;
    try {
      await apiClient.delete(`/api/keys/${id}`);
      fetchKeys();
    } catch (err) {
      console.error('Failed to delete provider:', err);
    }
  };

  const handleTestConnection = async (id: string) => {
    setTestResults((prev) => ({ ...prev, [id]: { ok: false, testing: true } }));
    try {
      const res = await apiClient.post<{ ok: boolean; error?: string }>(`/api/keys/${id}/test`);
      setTestResults((prev) => ({ ...prev, [id]: { ok: res.data.ok, error: res.data.error, testing: false } }));
    } catch (err: any) {
      setTestResults((prev) => ({
        ...prev,
        [id]: { ok: false, error: err.response?.data?.error || 'Connection failed', testing: false },
      }));
    }
  };

  const handleToggleActive = async (provider: ProviderKeyItem) => {
    try {
      await apiClient.put(`/api/keys/${provider.id}`, {
        isActive: !provider.isActive,
      });
      fetchKeys();
    } catch (err) {
      console.error('Failed to toggle active state:', err);
    }
  };

  const handleSaveKey = async () => {
    if (!editingKey) return;
    try {
      setSavingKey(true);
      await apiClient.put(`/api/keys/${editingKey.id}`, {
        rawApiKey: newApiKey || undefined,
        baseUrl: newBaseUrl || null,
      });
      setEditingKey(null);
      setNewApiKey('');
      setNewBaseUrl('');
      fetchKeys();
    } catch (err) {
      console.error('Failed to update key:', err);
    } finally {
      setSavingKey(false);
    }
  };

  const handleOpenAddModelModal = (providerId?: string) => {
    if (providerId) {
      setSelectedProviderForModel(providerId);
    } else if (providers.length > 0) {
      setSelectedProviderForModel(providers[0].id);
    }
    setNewModelId('');
    setNewModelName('');
    setNewModelIsDefault(false);
    setIsAddingModelModal(true);
  };

  const handleSaveNewModel = async () => {
    if (!selectedProviderForModel || !newModelId.trim() || !newModelName.trim()) return;
    try {
      setSavingModel(true);
      await apiClient.post(`/api/keys/${selectedProviderForModel}/models`, {
        modelId: newModelId.trim(),
        displayName: newModelName.trim(),
        isDefault: newModelIsDefault,
      });
      setIsAddingModelModal(false);
      setNewModelId('');
      setNewModelName('');
      setNewModelIsDefault(false);
      await fetchKeys();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to add model to database');
    } finally {
      setSavingModel(false);
    }
  };

  const handleDeleteModel = async (modelId: string) => {
    if (!confirm('Are you sure you want to remove this model?')) return;
    try {
      await apiClient.delete(`/api/keys/models/${modelId}`);
      fetchKeys();
    } catch (err) {
      console.error('Failed to delete model:', err);
    }
  };

  const handleSetDefaultModel = async (providerId: string, modelId: string) => {
    try {
      await apiClient.post(`/api/keys/${providerId}/models/${modelId}/default`);
      fetchKeys();
    } catch (err) {
      console.error('Failed to set default model:', err);
    }
  };

  // Preset options for CustomDropdown
  const presetOptions = CHINESE_PRESETS.map((p) => ({
    value: p.name,
    label: p.name,
    sublabel: p.baseUrl,
    badge: p.defaultModelName,
  }));

  const allAvailableModelsList = providers
    .filter((p) => p.isActive && p.hasApiKey)
    .flatMap((p) =>
      p.models.map((m) => ({
        ...m,
        providerName: p.displayName,
      }))
    );

  const providerDropdownOptions = providers.map((p) => ({
    value: p.id,
    label: p.displayName,
    sublabel: p.providerName,
    badge: `#${p.priorityOrder}`,
  }));

  const playgroundModelOptions = [
    {
      value: '',
      label: '⚡ Auto-Router (Default Priority & Failover Cascade)',
      sublabel: 'เลือกลำดับอัตโนมัติ และสลับตัวสำรองให้ทันทีหากติดโควตา',
      badge: 'Recommended',
    },
    ...allAvailableModelsList.map((m) => ({
      value: m.modelId,
      label: m.displayName,
      sublabel: `${m.providerName} • ${m.modelId}`,
      badge: m.isDefault ? 'Default' : undefined,
    })),
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
            <KeyRound className="w-5 h-5 text-emerald-500 dark:text-emerald-400" />
            LLM Providers & API Keys
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Configure provider credentials (AES-256-GCM encrypted), failover priority, and add custom Chinese models (DeepSeek, Qwen, SiliconFlow, Zhipu, etc.).
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <Button
            variant="primary"
            size="sm"
            onClick={() => handleOpenChatPlayground()}
            leftIcon={<MessageSquare className="w-3.5 h-3.5" />}
            className="bg-teal-600 hover:bg-teal-700 text-white"
          >
            Chat Playground
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => handleOpenAddModelModal()}
            leftIcon={<Plus className="w-3.5 h-3.5" />}
          >
            Add Model
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => setIsAddingProvider(true)}
            leftIcon={<Plus className="w-3.5 h-3.5" />}
          >
            Add Provider
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={fetchKeys}
            leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
          >
            Refresh
          </Button>
        </div>
      </div>

      {/* ────────────────── Global Model Priority Cascade Card ────────────────── */}
      <Card className="border-teal-500/30 dark:border-teal-500/20 bg-gradient-to-br from-white via-white to-teal-50/20 dark:from-slate-900 dark:via-slate-900 dark:to-teal-950/20 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100 dark:border-slate-800">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-teal-500/10 text-teal-600 dark:text-teal-400">
                <Layers className="w-5 h-5" />
              </span>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                ลำดับความสำคัญของโมเดล AI (Global Model Priority Cascade)
              </h3>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              ระบบจะเรียกใช้โมเดลตามลำดับ <strong>#1 ➔ #2 ➔ #3...</strong> หากโมเดลติดโควตา (429 Rate Limit) จะสลับไปตัวถัดไปให้อัตโนมัติทันที พร้อมคูลดาวน์ 60 วิ
            </p>
          </div>
          <div className="flex items-center space-x-2">
            <Badge variant="neutral">
              {priorityModels.filter((m) => m.isActive).length} / {priorityModels.length} ใช้งานอยู่
            </Badge>
            <Button
              variant="outline"
              size="sm"
              onClick={fetchPriorityModels}
              isLoading={loadingPriority}
              leftIcon={<RefreshCw className="w-3 h-3" />}
            >
              รีเฟรชสถานะ
            </Button>
          </div>
        </div>

        {loadingPriority && priorityModels.length === 0 ? (
          <div className="py-8 text-center text-xs text-slate-400">กำลังโหลดลำดับความสำคัญของโมเดล...</div>
        ) : priorityModels.length === 0 ? (
          <div className="py-8 text-center text-xs text-slate-400">ยังไม่มีโมเดลในระบบ กรุณาเพิ่มโมเดลด้านล่าง</div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800/60 mt-2">
            {priorityModels.map((model, index) => {
              const isFirst = index === 0;
              const isLast = index === priorityModels.length - 1;
              const isLiteModel = model.modelId.includes('lite');
              const isFlash36 = model.modelId.includes('3.6');

              return (
                <div
                  key={model.id}
                  className={`py-3 px-2 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors ${
                    !model.isActive
                      ? 'opacity-50 bg-slate-50/50 dark:bg-slate-950/30'
                      : model.isCoolingDown
                      ? 'bg-amber-500/5 border border-amber-500/20'
                      : index === 0
                      ? 'bg-teal-500/5 border border-teal-500/15'
                      : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'
                  }`}
                >
                  {/* Left: Rank & Move Buttons & Model Info */}
                  <div className="flex items-center space-x-3">
                    {/* Rank Badge */}
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 border ${
                        index === 0
                          ? 'bg-teal-600 text-white border-teal-600 shadow-sm shadow-teal-500/20'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                      }`}
                    >
                      #{index + 1}
                    </div>

                    {/* Up / Down Controls */}
                    <div className="flex flex-col space-y-0.5">
                      <button
                        type="button"
                        onClick={() => handleMovePriority(index, 'up')}
                        disabled={isFirst || reordering}
                        title="เลื่อนลำดับขึ้น (ให้ความสำคัญก่อน)"
                        className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 disabled:opacity-20 disabled:hover:bg-transparent transition cursor-pointer disabled:cursor-not-allowed"
                      >
                        <ChevronUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleMovePriority(index, 'down')}
                        disabled={isLast || reordering}
                        title="เลื่อนลำดับลง (เป็นตัวสำรองถัดไป)"
                        className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 disabled:opacity-20 disabled:hover:bg-transparent transition cursor-pointer disabled:cursor-not-allowed"
                      >
                        <ChevronDown className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Model Details */}
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold text-slate-900 dark:text-white">
                          {model.displayName}
                        </span>
                        <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700">
                          {model.modelId}
                        </span>
                        <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-slate-200/70 dark:bg-slate-700 text-slate-700 dark:text-slate-200">
                          {model.providerDisplayName}
                        </span>
                        {index === 0 && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-teal-500/20 text-teal-700 dark:text-teal-300 border border-teal-500/30">
                            ★ ลำดับหลัก (Primary)
                          </span>
                        )}
                        {isLiteModel && (
                          <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                            โควตา 500 RPD
                          </span>
                        )}
                        {isFlash36 && (
                          <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                            โควตาจำกัด 20 RPD
                          </span>
                        )}
                      </div>

                      {/* Cooldown Warning if triggered */}
                      {model.isCoolingDown && (
                        <div className="flex items-center gap-1.5 text-[11px] text-amber-600 dark:text-amber-400 font-medium mt-1">
                          <Clock className="w-3 h-3 animate-spin" />
                          <span>ติด Rate Limit ชั่วคราว — พักคูลดาวน์ {model.cooldownSecondsRemaining} วินาที (ระบบข้ามไปเรียกตัวสำรองอัตโนมัติ)</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Right: Active Toggle & Chat Shortcut */}
                  <div className="flex items-center space-x-2 shrink-0 self-end sm:self-auto pl-12 sm:pl-0">
                    <button
                      type="button"
                      onClick={() => handleToggleModelActive(model)}
                      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border transition ${
                        model.isActive
                          ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/20'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-400 border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700'
                      }`}
                      title={model.isActive ? 'คลิกเพื่อปิดใช้งาน' : 'คลิกเพื่อเปิดใช้งาน'}
                    >
                      {model.isActive ? (
                        <>
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                          <span>พร้อมใช้งาน</span>
                        </>
                      ) : (
                        <>
                          <XCircle className="w-3.5 h-3.5 text-slate-400" />
                          <span>ปิดใช้งาน</span>
                        </>
                      )}
                    </button>

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleOpenChatPlayground(model.modelId)}
                      leftIcon={<MessageSquare className="w-3 h-3" />}
                      className="text-xs"
                    >
                      ทดสอบ
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {loading ? (
        <div className="p-12 text-center text-slate-400">Loading configured providers...</div>
      ) : (
        <div className="grid grid-cols-1 gap-6">
          {providers.map((p) => {
            const testResult = testResults[p.id];
            const isCustom = p.providerName === 'openai_compatible';

            return (
              <Card key={p.id}>
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                  <div className="flex items-start space-x-3">
                    <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center font-bold text-emerald-600 dark:text-emerald-400 border border-slate-200 dark:border-slate-700 shrink-0">
                      #{p.priorityOrder}
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-base font-bold text-slate-900 dark:text-white">{p.displayName}</h3>
                        <span className="text-[11px] font-mono uppercase bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700">
                          {p.providerName}
                        </span>
                        {p.baseUrl && (
                          <span className="text-[10px] font-mono text-slate-500 bg-slate-100 dark:bg-slate-800/80 px-2 py-0.5 rounded flex items-center gap-1 border border-slate-200 dark:border-slate-700">
                            <Globe className="w-3 h-3" /> {p.baseUrl}
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 font-mono mt-1">
                        {p.hasApiKey ? (
                          <span>Key: {p.maskedApiKey}</span>
                        ) : (
                          <span className="text-amber-600 dark:text-amber-400">No API key configured</span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 self-end md:self-auto">
                    <button
                      onClick={() => handleToggleActive(p)}
                      title="Toggle active status"
                      className="cursor-pointer"
                    >
                      <Badge variant={p.isActive ? 'success' : 'neutral'} dot={p.isActive}>
                        {p.isActive ? 'Active (Ready)' : 'Disabled'}
                      </Badge>
                    </button>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setEditingKey(p);
                        setNewApiKey('');
                        setNewBaseUrl(p.baseUrl || '');
                      }}
                    >
                      Configure Key
                    </Button>

                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => handleTestConnection(p.id)}
                      disabled={!p.hasApiKey}
                      isLoading={testResult?.testing}
                      leftIcon={<Play className="w-3 h-3" />}
                    >
                      Test
                    </Button>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const def = p.models.find((m) => m.isDefault) || p.models[0];
                        handleOpenChatPlayground(def?.modelId);
                      }}
                      disabled={!p.hasApiKey}
                      leftIcon={<MessageSquare className="w-3 h-3" />}
                    >
                      Chat
                    </Button>

                    {isCustom && (
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={() => handleDeleteProvider(p.id, p.displayName)}
                        title="Delete custom provider"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    )}
                  </div>
                </div>

                {/* Test Result Message */}
                {testResult && !testResult.testing && (
                  <div
                    className={`mt-4 p-3 rounded-xl text-xs flex items-center space-x-2 ${
                      testResult.ok
                        ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-300'
                        : 'bg-red-500/10 border border-red-500/20 text-red-700 dark:text-red-300'
                    }`}
                  >
                    {testResult.ok ? (
                      <>
                        <CheckCircle2 className="w-4 h-4 text-emerald-500 dark:text-emerald-400 shrink-0" />
                        <span>API Key verified successfully! Model ping succeeded.</span>
                      </>
                    ) : (
                      <>
                        <XCircle className="w-4 h-4 text-red-500 dark:text-red-400 shrink-0" />
                        <span>Verification failed: {testResult.error}</span>
                      </>
                    )}
                  </div>
                )}

                {/* Models Section */}
                <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800/80">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      Models under this Provider ({p.models.length})
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleOpenAddModelModal(p.id)}
                      leftIcon={<Plus className="w-3.5 h-3.5" />}
                    >
                      Add Model
                    </Button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                    {p.models.map((m) => (
                      <div
                        key={m.id}
                        className="bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 rounded-xl p-3 flex items-center justify-between group transition"
                      >
                        <div className="min-w-0 pr-2">
                          <div className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">
                            {m.displayName}
                          </div>
                          <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400 truncate">
                            {m.modelId}
                          </div>
                        </div>

                        <div className="flex items-center space-x-1 shrink-0">
                          {m.isDefault ? (
                            <Badge variant="success">
                              <Star className="w-2.5 h-2.5 fill-current" /> Default
                            </Badge>
                          ) : (
                            <button
                              onClick={() => handleSetDefaultModel(p.id, m.modelId)}
                              className="text-[10px] text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-800"
                              title="Set as Default"
                            >
                              <Star className="w-3 h-3" />
                            </button>
                          )}

                          <button
                            onClick={() => handleDeleteModel(m.id)}
                            className="text-slate-400 hover:text-red-500 dark:hover:text-red-400 p-1 rounded hover:bg-red-500/10 transition"
                            title="Delete model"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* ────────────────── MODAL: Add Custom Provider with CustomDropdown ────────────────── */}
      <Modal
        isOpen={isAddingProvider}
        onClose={() => setIsAddingProvider(false)}
        title="Add Custom / Chinese LLM Provider"
        description="Select a Chinese or OpenAI-compatible provider preset from the custom dropdown or enter custom endpoints."
        maxWidth="lg"
      >
        <div className="space-y-4">
          <div>
            <CustomDropdown
              label="Select Preset (Chinese & OpenAI Compatible Providers)"
              options={presetOptions}
              value={selectedPresetKey}
              onChange={handleSelectPreset}
              placeholder="Choose a provider preset..."
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
            <Input
              label="Provider Display Name"
              value={customDisplayName}
              onChange={(e) => setCustomDisplayName(e.target.value)}
              placeholder="e.g. DeepSeek"
              required
            />

            <Input
              label="Base URL (OpenAI-Compatible)"
              value={customBaseUrl}
              onChange={(e) => setCustomBaseUrl(e.target.value)}
              placeholder="https://api.deepseek.com/v1"
              isMonospace
              required
            />
          </div>

          <Input
            label="API Key (Will be encrypted AES-256-GCM)"
            type="password"
            isMonospace
            value={customApiKey}
            onChange={(e) => setCustomApiKey(e.target.value)}
            placeholder="sk-..."
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Initial Model ID"
              value={customModelId}
              onChange={(e) => setCustomModelId(e.target.value)}
              placeholder="deepseek-chat"
              isMonospace
            />

            <Input
              label="Initial Model Display Name"
              value={customModelName}
              onChange={(e) => setCustomModelName(e.target.value)}
              placeholder="DeepSeek V3"
            />
          </div>

          {(() => {
            const curPreset = CHINESE_PRESETS.find((p) => p.name === selectedPresetKey);
            return curPreset?.docUrl ? (
              <div className="text-[11px] text-slate-500 flex items-center gap-1">
                <span>Need an API key? Get it at:</span>
                <a
                  href={curPreset.docUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-emerald-600 dark:text-emerald-400 underline inline-flex items-center gap-0.5"
                >
                  {curPreset.docUrl}
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            ) : null;
          })()}

          <div className="flex justify-end space-x-2 pt-4 border-t border-slate-100 dark:border-slate-800">
            <Button variant="ghost" size="md" onClick={() => setIsAddingProvider(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="md"
              onClick={handleCreateCustomProvider}
              isLoading={creatingProvider}
              disabled={!customDisplayName}
            >
              Add Provider
            </Button>
          </div>
        </div>
      </Modal>

      {/* ────────────────── MODAL: Add Model by User (Saved directly to DB) ────────────────── */}
      <Modal
        isOpen={isAddingModelModal}
        onClose={() => setIsAddingModelModal(false)}
        title="Add Model to Provider"
        description="Add a new model for a provider. It will be stored in PostgreSQL and immediately available in dropdowns and bot commands."
      >
        <div className="space-y-4">
          <CustomDropdown
            label="Target Provider"
            options={providerDropdownOptions}
            value={selectedProviderForModel}
            onChange={(val: string) => setSelectedProviderForModel(val)}
            placeholder="Select a provider..."
          />

          <Input
            label="Model ID (Raw Identifier)"
            placeholder="e.g. deepseek-reasoner, gpt-4o-mini, qwen-max"
            value={newModelId}
            onChange={(e) => setNewModelId(e.target.value)}
            isMonospace
            required
            helperText="Exact model name used when sending requests to the API"
          />

          <Input
            label="Display Name"
            placeholder="e.g. DeepSeek R1 (Reasoner), GPT-4o Mini"
            value={newModelName}
            onChange={(e) => setNewModelName(e.target.value)}
            required
            helperText="Friendly name displayed to users in LINE / Telegram /model lists"
          />

          <div className="flex items-center space-x-2 pt-1">
            <input
              type="checkbox"
              id="modelIsDefault"
              checked={newModelIsDefault}
              onChange={(e) => setNewModelIsDefault(e.target.checked)}
              className="w-4 h-4 rounded border-slate-300 dark:border-slate-700 text-emerald-600 focus:ring-emerald-500"
            />
            <label htmlFor="modelIsDefault" className="text-xs text-slate-700 dark:text-slate-300 font-medium cursor-pointer">
              Set as default model for this provider
            </label>
          </div>

          <div className="flex justify-end space-x-2 pt-4 border-t border-slate-100 dark:border-slate-800">
            <Button variant="ghost" size="md" onClick={() => setIsAddingModelModal(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="md"
              onClick={handleSaveNewModel}
              isLoading={savingModel}
              disabled={!newModelId.trim() || !newModelName.trim() || !selectedProviderForModel}
            >
              Save Model to DB
            </Button>
          </div>
        </div>
      </Modal>

      {/* ────────────────── MODAL: Edit API Key ────────────────── */}
      <Modal
        isOpen={Boolean(editingKey)}
        onClose={() => setEditingKey(null)}
        title={`Configure ${editingKey?.displayName || ''} Key`}
        description="The API key will be encrypted using AES-256-GCM before saving to PostgreSQL."
      >
        <div className="space-y-4">
          <Input
            label="API Key (leave blank to keep current)"
            type="password"
            isMonospace
            value={newApiKey}
            onChange={(e) => setNewApiKey(e.target.value)}
            placeholder={editingKey?.hasApiKey ? '••••••••••••••••••••' : 'Enter API key here...'}
          />

          {editingKey?.providerName === 'openai_compatible' && (
            <Input
              label="Custom Base URL"
              type="text"
              isMonospace
              value={newBaseUrl}
              onChange={(e) => setNewBaseUrl(e.target.value)}
              placeholder="https://api.deepseek.com/v1"
            />
          )}

          <div className="flex justify-end space-x-2 pt-2">
            <Button variant="ghost" size="md" onClick={() => setEditingKey(null)}>
              Cancel
            </Button>
            <Button variant="primary" size="md" onClick={handleSaveKey} isLoading={savingKey}>
              Save & Encrypt
            </Button>
          </div>
        </div>
      </Modal>

      {/* ────────────────── MODAL: AI Chat Playground ────────────────── */}
      <Modal
        isOpen={isChatPlaygroundOpen}
        onClose={() => setIsChatPlaygroundOpen(false)}
        title="AI Chat Playground (ทดสอบคุยจริง & เช็ก Token)"
        description="ทดสอบยิงข้อความจริงไปยังโมเดลที่เลือก ตรวจสอบความเร็ว (ms), ปริมาณ Token ที่กิน และเช็กระบบ Auto-Failover สดๆ"
      >
        <div className="space-y-4">
          {/* Model Selector */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              เลือกโมเดลที่ต้องการทดสอบ (Model to Test)
            </label>
            <CustomDropdown
              options={playgroundModelOptions}
              value={testChatModelId}
              onChange={(val: string) => setTestChatModelId(val)}
              placeholder="เลือกโมเดลที่จะทดสอบ..."
            />
          </div>

          {/* Quick Prompts */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] text-slate-400 font-medium">ตัวอย่างคำถาม:</span>
            {[
              'สวัสดีครับคุณเลขา แนะนำตัวหน่อย',
              'คำนวณเลข 125 * 84 ให้หน่อย',
              'สรุปข้อดีของ Cloud Run ให้หน่อย',
            ].map((prompt) => (
              <button
                key={prompt}
                type="button"
                onClick={() => setTestChatInput(prompt)}
                className="text-[11px] bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 px-2 py-0.5 rounded-lg transition"
              >
                {prompt}
              </button>
            ))}
          </div>

          {/* Chat Messages Area */}
          <div className="h-64 overflow-y-auto border border-slate-200 dark:border-slate-800 rounded-xl p-3 bg-slate-50 dark:bg-slate-950/60 space-y-3">
            {testChatMessages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-400 text-xs text-center space-y-1.5">
                <Bot className="w-8 h-8 text-slate-300 dark:text-slate-600" />
                <p className="font-semibold text-slate-600 dark:text-slate-400">ยังไม่มีข้อความทดสอบ</p>
                <p className="text-[11px] text-slate-400">พิมพ์ข้อความด้านล่างเพื่อเริ่มทดสอบการตอบของโมเดล</p>
              </div>
            ) : (
              testChatMessages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
                >
                  <div
                    className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-xs leading-relaxed ${
                      msg.role === 'user'
                        ? 'bg-teal-600 text-white rounded-br-none shadow-sm'
                        : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-bl-none shadow-sm'
                    }`}
                  >
                    {msg.content}
                  </div>

                  {/* Metrics under assistant bubble */}
                  {msg.metrics && (
                    <div className="flex flex-wrap items-center gap-1.5 mt-1 text-[10px] text-slate-500 dark:text-slate-400">
                      <span className="bg-slate-200/60 dark:bg-slate-800 px-1.5 py-0.5 rounded font-mono flex items-center gap-0.5">
                        <Zap className="w-2.5 h-2.5 text-amber-500" />
                        {msg.metrics.responseTimeMs}ms
                      </span>
                      <span className="bg-slate-200/60 dark:bg-slate-800 px-1.5 py-0.5 rounded font-mono">
                        🪙 {msg.metrics.totalTokens} tokens (in: {msg.metrics.promptTokens}, out: {msg.metrics.completionTokens})
                      </span>
                      <span className="bg-slate-200/60 dark:bg-slate-800 px-1.5 py-0.5 rounded font-mono">
                        💵 ${msg.metrics.estimatedCostUsd.toFixed(6)}
                      </span>
                      {msg.metrics.wasFailover ? (
                        <span
                          className="bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30 px-1.5 py-0.5 rounded font-semibold"
                          title={msg.metrics.failoverReason}
                        >
                          ⚠️ Failover to {msg.metrics.modelId}
                        </span>
                      ) : (
                        <span className="bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 px-1.5 py-0.5 rounded font-semibold">
                          🟢 {msg.metrics.modelId}
                        </span>
                      )}
                    </div>
                  )}
                  {msg.metrics?.wasFailover && msg.metrics.failoverReason && (
                    <div className="mt-1.5 px-2.5 py-1.5 rounded-md bg-amber-500/10 border border-amber-500/30 text-[11px] text-amber-700 dark:text-amber-300">
                      <span className="font-semibold">⚠️ เหตุผลที่เกิด Failover: </span>
                      <span className="font-mono break-all">{msg.metrics.failoverReason}</span>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>

          {/* Chat Input & Controls */}
          <div className="flex items-center space-x-2">
            <input
              type="text"
              value={testChatInput}
              onChange={(e) => setTestChatInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSendTestChat()}
              placeholder="พิมพ์ข้อความทดสอบคุยกับ AI..."
              disabled={isTestChatSending}
              className="flex-1 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2.5 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
            <Button
              variant="primary"
              size="md"
              onClick={handleSendTestChat}
              isLoading={isTestChatSending}
              leftIcon={<Send className="w-3.5 h-3.5" />}
              className="bg-teal-600 hover:bg-teal-700 text-white shrink-0"
            >
              ส่ง
            </Button>
          </div>

          <div className="flex items-center justify-between pt-1 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-400">
            <span>
              {testChatModelId ? `โมเดลที่กำลังเทส: ${testChatModelId}` : 'โหมด Auto-Failover (คัดลอกตาม Production)'}
            </span>
            {testChatMessages.length > 0 && (
              <button
                type="button"
                onClick={() => setTestChatMessages([])}
                className="text-slate-400 hover:text-red-500 transition"
              >
                ล้างบทสนทนา
              </button>
            )}
          </div>
        </div>
      </Modal>
    </div>
  );
};

