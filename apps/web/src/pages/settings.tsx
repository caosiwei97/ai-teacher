import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router";
import { ArrowLeft, Plus, Loader2, Star, Zap, Trash2, ShieldCheck, ShieldAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  getLlmConfigs,
  updateLlmConfig,
  deleteLlmConfig,
  testLlmConfig,
  type LlmConfig,
} from "@/lib/api-client";
import { getProviderDisplay, getColorClasses } from "@/lib/llm-presets";
import { LlmConfigForm } from "@/components/settings/llm-config-form";

const USER_ID = "seed-user-ai-teacher";

export function Component() {
  const navigate = useNavigate();
  const [configs, setConfigs] = useState<LlmConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<string, { ok: boolean; msg: string }>>({});
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadConfigs = useCallback(async () => {
    try {
      const res = await getLlmConfigs(USER_ID);
      setConfigs(res.configs);
    } catch {
      /* handled by empty state */
    }
  }, []);

  useEffect(() => {
    loadConfigs().then(() => setLoading(false));
  }, [loadConfigs]);

  async function handleSetDefault(id: string) {
    try {
      await updateLlmConfig(id, USER_ID, { isDefault: true });
      await loadConfigs();
    } catch { /* silent */ }
  }

  async function handleTest(id: string) {
    setTestingId(id);
    setTestResults((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    try {
      const res = await testLlmConfig(id, USER_ID);
      setTestResults((prev) => ({
        ...prev,
        [id]: { ok: res.success, msg: res.success ? "连接成功" : res.error ?? "连接失败" },
      }));
    } catch (err) {
      setTestResults((prev) => ({
        ...prev,
        [id]: { ok: false, msg: err instanceof Error ? err.message : "测试失败" },
      }));
    } finally {
      setTestingId(null);
    }
  }

  async function handleDelete(id: string) {
    setDeletingId(id);
    try {
      await deleteLlmConfig(id, USER_ID);
      await loadConfigs();
    } catch { /* silent */ } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="flex h-full flex-col overflow-y-auto">
      <div className="mx-auto w-full max-w-2xl px-6 py-8">
        <div className="mb-8 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate("/")}
              className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <h1 className="text-xl font-semibold text-foreground">模型设置</h1>
          </div>
          {!showForm && (
            <button
              onClick={() => setShowForm(true)}
              className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary-hover"
            >
              <Plus className="h-3.5 w-3.5" />
              添加新配置
            </button>
          )}
        </div>

        {showForm ? (
          <div className="rounded-xl border border-border bg-card p-6">
            <LlmConfigForm
              onCancel={() => setShowForm(false)}
              onSuccess={() => {
                setShowForm(false);
                loadConfigs();
              }}
            />
          </div>
        ) : loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : configs.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border py-16 text-center">
            <p className="text-sm text-muted-foreground">还没有配置任何模型</p>
            <p className="mt-1 text-xs text-muted-foreground">点击「添加新配置」开始设置</p>
          </div>
        ) : (
          <div className="space-y-6">
            <div>
              <h2 className="mb-3 text-[11px] font-medium uppercase tracking-widest text-muted-foreground">对话模型（LLM）</h2>
              <div className="space-y-3">
                {configs.map((cfg) => {
                  const display = getProviderDisplay(cfg.provider);
                  const colors = display ? getColorClasses(display.color) : null;
                  const testResult = testResults[cfg.id];

                  return (
                    <div
                      key={cfg.id}
                      className={cn(
                        "rounded-xl border bg-card p-4 transition-colors",
                        cfg.isDefault ? "border-primary/40" : "border-border",
                      )}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-start gap-3">
                          {colors && <span className={cn("mt-1.5 h-3 w-3 shrink-0 rounded-full", colors.dot)} />}
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-medium text-foreground">
                                {display?.name ?? cfg.provider}
                              </p>
                              {cfg.isDefault && (
                                <span className="flex items-center gap-1 rounded-md bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                                  <Star className="h-3 w-3" />
                                  默认
                                </span>
                              )}
                              {cfg.source === "env" && (
                                <span className="rounded-md bg-secondary px-1.5 py-0.5 text-[10px] text-muted-foreground">
                                  来自 .env
                                </span>
                              )}
                            </div>
                            <p className="mt-0.5 text-xs text-muted-foreground">
                              {cfg.apiKey}
                            </p>
                            <p className="mt-0.5 text-xs text-muted-foreground">
                              模型：{cfg.defaultModel}
                            </p>
                            {cfg.label && (
                              <p className="mt-0.5 text-xs text-muted-foreground">
                                备注：{cfg.label}
                              </p>
                        )}
                      </div>
                    </div>

                    <div className="flex shrink-0 items-center gap-1.5">
                      {testResult && (
                        <span
                          className={cn(
                            "flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium",
                            testResult.ok
                              ? "bg-accent/10 text-accent"
                              : "bg-destructive/10 text-destructive",
                          )}
                        >
                          {testResult.ok ? (
                            <ShieldCheck className="h-3 w-3" />
                          ) : (
                            <ShieldAlert className="h-3 w-3" />
                          )}
                          {testResult.msg}
                        </span>
                      )}

                      {!cfg.isDefault && (
                        <button
                          onClick={() => handleSetDefault(cfg.id)}
                          className="rounded-lg px-2.5 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                        >
                          设为默认
                        </button>
                      )}

                      <button
                        onClick={() => handleTest(cfg.id)}
                        disabled={testingId === cfg.id}
                        className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground disabled:opacity-50"
                      >
                        {testingId === cfg.id ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <Zap className="h-3 w-3" />
                        )}
                        测试
                      </button>

                      <button
                        onClick={() => handleDelete(cfg.id)}
                        disabled={deletingId === cfg.id}
                        className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
                      >
                        {deletingId === cfg.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="h-3.5 w-3.5" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
              </div>
            </div>

            <div>
              <h2 className="mb-3 text-[11px] font-medium uppercase tracking-widest text-muted-foreground">增强能力</h2>
              <div className="space-y-3">
                <div className="rounded-xl border border-dashed border-border p-4">
                  <p className="text-sm text-muted-foreground">🎬 视频理解 + 🎤 面试语音（DashScope）</p>
                  <p className="mt-1 text-xs text-muted-foreground">将在后续迭代支持在 UI 配置</p>
                </div>
                <div className="rounded-xl border border-dashed border-border p-4">
                  <p className="text-sm text-muted-foreground">📚 资料 RAG 检索（智谱 Embedding）</p>
                  <p className="mt-1 text-xs text-muted-foreground">将在后续迭代支持在 UI 配置</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
