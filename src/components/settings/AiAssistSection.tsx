import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Panel, PanelBody, PanelDescription, PanelHeader, PanelTitle } from "@/components/ui/panel";
import { AI_DEFAULT_BASE_URL, useAiStore } from "@/stores/aiStore";
import { Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { toastInvokeCatch } from "@/utils/invokeError";

export function AiAssistSection() {
  const {
    baseUrl,
    model,
    models,
    configured,
    busy,
    refreshStatus,
    setBaseUrl,
    setModel,
    saveToken,
    clearToken,
    loadModels,
  } = useAiStore();

  const [token, setToken] = useState("");

  useEffect(() => {
    void refreshStatus();
  }, [refreshStatus]);

  const save = useCallback(async () => {
    if (!token.trim()) {
      toast.error("Enter an API token.");
      return;
    }
    try {
      await saveToken(token.trim());
      setToken("");
      if (!useAiStore.getState().configured) {
        toastInvokeCatch(
          "AI token may not have persisted",
          new Error("Status still shows not configured after save.")
        );
        return;
      }
      toast.success("AI token saved securely");
      await loadModels().catch((e) => toastInvokeCatch("Could not reach the AI server", e));
    } catch (e) {
      toastInvokeCatch("Could not save AI token", e);
    }
  }, [token, saveToken, loadModels]);

  const clear = useCallback(async () => {
    try {
      await clearToken();
      toast.success("AI token removed");
    } catch (e) {
      toastInvokeCatch("Could not clear AI token", e);
    }
  }, [clearToken]);

  const test = useCallback(async () => {
    try {
      const list = await loadModels();
      toast.success(`Connected — ${list.length} model${list.length === 1 ? "" : "s"} available`);
    } catch (e) {
      toastInvokeCatch("AI server test failed", e);
    }
  }, [loadModels]);

  return (
    <div id="settings-ai" className="scroll-mt-4">
      <Panel>
        <PanelHeader>
          <PanelTitle>AI assist</PanelTitle>
          <PanelDescription>
            Point at any OpenAI-compatible endpoint to search your library in plain language.
            The token is stored in the OS credential store; requests never leave your machine
            when the host is local.
          </PanelDescription>
        </PanelHeader>
        <PanelBody className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Status:{" "}
            <span className={configured ? "text-foreground font-medium" : undefined}>
              {configured ? "token saved" : "not configured"}
            </span>
            {model ? <span> · model {model}</span> : null}
          </p>
          <p className="text-xs text-muted-foreground">
            Host root only — <code className="text-foreground">/v1</code> is appended for you.
          </p>

          <div className="space-y-1.5">
            <Label htmlFor="ai-base-url">Endpoint</Label>
            <Input
              id="ai-base-url"
              type="text"
              autoComplete="off"
              spellCheck={false}
              placeholder={AI_DEFAULT_BASE_URL}
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ai-token">API token</Label>
            <Input
              id="ai-token"
              type="password"
              autoComplete="off"
              placeholder="Bearer token"
              value={token}
              onChange={(e) => setToken(e.target.value)}
            />
          </div>

          {models.length > 0 ? (
            <div className="space-y-1.5">
              <Label htmlFor="ai-model">Model</Label>
              <select
                id="ai-model"
                value={model}
                onChange={(e) => setModel(e.target.value)}
                className="flex h-control w-full rounded-input border-ui border-solid border-input bg-background px-3 text-sm font-ui"
                aria-label="Model"
              >
                <option value="">Select a model…</option>
                {models.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div className="space-y-1.5">
              <Label htmlFor="ai-model-id">Model</Label>
              <Input
                id="ai-model-id"
                type="text"
                autoComplete="off"
                spellCheck={false}
                placeholder="Model id (or press Test to list them)"
                value={model}
                onChange={(e) => setModel(e.target.value)}
              />
            </div>
          )}

          <div className="flex flex-wrap gap-2 pt-1">
            <Button type="button" size="sm" onClick={() => void save()} disabled={busy}>
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              Save token
            </Button>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => void test()}
              disabled={busy || !configured}
            >
              Test / load models
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => void clear()}
              disabled={busy || !configured}
            >
              <Trash2 className="w-4 h-4" aria-hidden />
              Remove token
            </Button>
          </div>

          <p className="text-xs text-muted-foreground">
            Once a token and model are set, Find can take a request like “relaxing single-player
            games”. Press Enter to run it.
          </p>
        </PanelBody>
      </Panel>
    </div>
  );
}
