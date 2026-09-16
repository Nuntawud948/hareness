import React, { useEffect, useState } from 'react';
import {
  MessageSquareText,
  CheckCircle,
  Plus,
  Trash2,
  Check,
  RefreshCw,
  Sparkles,
} from 'lucide-react';
import { apiClient } from '../services/api.client';
import { Input, Textarea, Button, Card, Badge, Modal } from '../components/ui';

interface SystemPrompt {
  id: string;
  name: string;
  content: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export const SystemPromptPage: React.FC = () => {
  const [prompts, setPrompts] = useState<SystemPrompt[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPrompt, setSelectedPrompt] = useState<SystemPrompt | null>(null);
  const [editedContent, setEditedContent] = useState('');
  const [saving, setSaving] = useState(false);

  // New prompt modal
  const [isCreating, setIsCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newContent, setNewContent] = useState('');

  const fetchPrompts = async () => {
    try {
      setLoading(true);
      const res = await apiClient.get<SystemPrompt[]>('/api/prompts');
      setPrompts(res.data);
      if (res.data.length > 0) {
        const active = res.data.find((p) => p.isActive) || res.data[0];
        setSelectedPrompt(active);
        setEditedContent(active.content);
      }
    } catch (err) {
      console.error('Failed to fetch prompts:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPrompts();
  }, []);

  const handleSelectPrompt = (prompt: SystemPrompt) => {
    setSelectedPrompt(prompt);
    setEditedContent(prompt.content);
  };

  const handleSaveContent = async () => {
    if (!selectedPrompt) return;
    try {
      setSaving(true);
      await apiClient.put(`/api/prompts/${selectedPrompt.id}`, {
        content: editedContent,
      });
      fetchPrompts();
    } catch (err) {
      console.error('Failed to save prompt:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleActivate = async (id: string) => {
    try {
      await apiClient.post(`/api/prompts/${id}/activate`);
      fetchPrompts();
    } catch (err) {
      console.error('Failed to activate prompt:', err);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this prompt?')) return;
    try {
      await apiClient.delete(`/api/prompts/${id}`);
      fetchPrompts();
    } catch (err) {
      console.error('Failed to delete prompt:', err);
    }
  };

  const handleCreateNew = async () => {
    if (!newName || !newContent) return;
    try {
      await apiClient.post('/api/prompts', {
        name: newName,
        content: newContent,
        isActive: false,
      });
      setIsCreating(false);
      setNewName('');
      setNewContent('');
      fetchPrompts();
    } catch (err) {
      console.error('Failed to create prompt:', err);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
            <MessageSquareText className="w-5 h-5 text-emerald-500 dark:text-emerald-400" />
            System Prompt & Bot Persona
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Customize how your bot thinks, speaks, and formats answers across LINE and Telegram.
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Button
            variant="primary"
            size="sm"
            onClick={() => setIsCreating(true)}
            leftIcon={<Plus className="w-3.5 h-3.5" />}
          >
            New Prompt
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={fetchPrompts}
            leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
          >
            Refresh
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="p-12 text-center text-slate-400">Loading system prompts...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Prompt Selector List */}
          <div className="space-y-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 px-1">
              Available Personas
            </span>
            <div className="space-y-2">
              {prompts.map((p) => (
                <div
                  key={p.id}
                  onClick={() => handleSelectPrompt(p)}
                  className={`p-4 rounded-xl border cursor-pointer transition-all ${
                    selectedPrompt?.id === p.id
                      ? 'bg-white dark:bg-slate-900 border-emerald-500 dark:border-emerald-500/50 shadow-md shadow-emerald-500/10'
                      : 'bg-slate-50 dark:bg-slate-950/60 border-slate-200 dark:border-slate-800/80 hover:bg-slate-100 dark:hover:bg-slate-900/60'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2 font-semibold text-sm text-slate-900 dark:text-white">
                      <span>{p.name}</span>
                      {p.isActive && (
                        <Badge variant="success" dot>
                          Active
                        </Badge>
                      )}
                    </div>

                    <div className="flex items-center space-x-1">
                      {!p.isActive && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleActivate(p.id);
                          }}
                        >
                          Activate
                        </Button>
                      )}
                      {prompts.length > 1 && !p.isActive && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(p.id);
                          }}
                          className="text-slate-400 hover:text-red-500 p-1 rounded"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 mt-2 font-mono">
                    {p.content}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Prompt Editor */}
          <Card className="md:col-span-2 flex flex-col space-y-4">
            {selectedPrompt ? (
              <>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <h3 className="text-base font-bold text-slate-900 dark:text-white">{selectedPrompt.name}</h3>
                    {selectedPrompt.isActive && (
                      <Badge variant="success">Currently Applied to All Bots</Badge>
                    )}
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    Updated: {new Date(selectedPrompt.updatedAt).toLocaleDateString()}
                  </div>
                </div>

                <div className="flex-1 flex flex-col">
                  <Textarea
                    label="Prompt Instructions"
                    helperText="Plaintext or Markdown instructions for the assistant"
                    isMonospace
                    rows={14}
                    value={editedContent}
                    onChange={(e) => setEditedContent(e.target.value)}
                    placeholder="Enter instructions for the AI assistant..."
                  />
                </div>

                <div className="flex items-center justify-between pt-2">
                  {!selectedPrompt.isActive ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleActivate(selectedPrompt.id)}
                      leftIcon={<CheckCircle className="w-3.5 h-3.5 text-emerald-500" />}
                    >
                      Set as Active Persona
                    </Button>
                  ) : (
                    <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center space-x-1">
                      <Sparkles className="w-3.5 h-3.5 text-emerald-500 dark:text-emerald-400" />
                      <span>Live on all incoming chats</span>
                    </div>
                  )}

                  <Button
                    variant="primary"
                    size="md"
                    onClick={handleSaveContent}
                    isLoading={saving}
                  >
                    Save Changes
                  </Button>
                </div>
              </>
            ) : (
              <div className="p-12 text-center text-slate-400">Select a prompt to edit.</div>
            )}
          </Card>
        </div>
      )}

      {/* New Prompt Modal */}
      <Modal
        isOpen={isCreating}
        onClose={() => setIsCreating(false)}
        title="Create New Persona Prompt"
      >
        <div className="space-y-4">
          <Input
            label="Name / Label"
            placeholder="e.g. Friendly Thai Bot or Customer Support"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
          />

          <Textarea
            label="Prompt Instructions"
            rows={6}
            isMonospace
            placeholder="You are a professional assistant..."
            value={newContent}
            onChange={(e) => setNewContent(e.target.value)}
          />

          <div className="flex justify-end space-x-2 pt-2">
            <Button variant="ghost" size="md" onClick={() => setIsCreating(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="md"
              onClick={handleCreateNew}
              disabled={!newName || !newContent}
            >
              Create Persona
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
