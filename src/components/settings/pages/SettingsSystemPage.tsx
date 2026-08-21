import { useEffect } from "react";
import { useConsoleModeStore } from "@/stores/consoleModeStore";
import { useWinlogonShellStore } from "@/stores/winlogonShellStore";
import { AutomationProfileSection } from "@/components/settings/AutomationProfileSection";
import { Panel, PanelBody, PanelDescription, PanelHeader, PanelTitle } from "@/components/ui/panel";
import { SettingToggle } from "@/components/ui/setting-row";
import { AlertTriangle, Monitor, Power, Shield } from "lucide-react";

export function SettingsSystemPage() {
  const osSupported = useConsoleModeStore((s) => s.osSupported);
  const hydrated = useConsoleModeStore((s) => s.hydrated);
  const enabled = useConsoleModeStore((s) => s.enabled);
  const launchAtLogin = useConsoleModeStore((s) => s.launchAtLogin);
  const startFullscreen = useConsoleModeStore((s) => s.startFullscreen);
  const hideTaskbar = useConsoleModeStore((s) => s.hideTaskbar);
  const globalShellHotkeys = useConsoleModeStore((s) => s.globalShellHotkeys);
  const focusWatchdog = useConsoleModeStore((s) => s.focusWatchdog);
  const returnToPortalOnGameExit = useConsoleModeStore((s) => s.returnToPortalOnGameExit);
  const focusWatchdogSupported = useConsoleModeStore((s) => s.focusWatchdogSupported);
  const setPrefs = useConsoleModeStore((s) => s.setPrefs);
  const refreshFromOs = useConsoleModeStore((s) => s.refreshFromOs);

  const shellHydrated = useWinlogonShellStore((s) => s.hydrated);
  const shellOsSupported = useWinlogonShellStore((s) => s.osSupported);
  const shellConfigured = useWinlogonShellStore((s) => s.configured);
  const shellPendingSignOut = useWinlogonShellStore((s) => s.pendingSignOut);
  const shellSessionStarted = useWinlogonShellStore((s) => s.sessionStartedAsShell);
  const shellLastError = useWinlogonShellStore((s) => s.lastError);
  const revertOnNextLaunch = useWinlogonShellStore((s) => s.revertOnNextLaunch);
  const revertedThisSession = useWinlogonShellStore((s) => s.revertedThisSession);
  const setWinlogonShell = useWinlogonShellStore((s) => s.setWinlogonShell);
  const setRevertOnNextLaunch = useWinlogonShellStore((s) => s.setRevertOnNextLaunch);
  const deferExplorerCompanion = useWinlogonShellStore((s) => s.deferExplorerCompanion);
  const setDeferExplorerCompanion = useWinlogonShellStore((s) => s.setDeferExplorerCompanion);
  const refreshShellFromOs = useWinlogonShellStore((s) => s.refreshFromOs);

  useEffect(() => {
    void refreshFromOs();
    void refreshShellFromOs();
  }, [refreshFromOs, refreshShellFromOs]);

  const windowsOnly = hydrated && !osSupported;
  const shellWindowsOnly = shellHydrated && !shellOsSupported;

  return (
    <div className="space-y-6">
      <Panel>
        <PanelHeader>
          <div className="flex items-center gap-2 text-foreground">
            <Monitor className="w-5 h-5" aria-hidden />
            <PanelTitle>
              Console mode
            </PanelTitle>
          </div>
          <PanelDescription>
            Living-room shell behavior: Phase 1 hides the taskbar and supports login startup; Phase 2
            adds global hotkeys and a focus watchdog; Phase 3 adds launch/exit automation profiles.
            Phases 1–3 keep Explorer as the OS shell. Phase 4 (below) optionally replaces it at logon.
          </PanelDescription>
        </PanelHeader>
        <PanelBody>
          {windowsOnly ? (
            <p className="text-sm text-muted-foreground rounded-none border border-border px-4 py-3">
              Desktop chrome controls require Windows. Other settings still save locally.
            </p>
          ) : null}

          <SettingToggle
            id="console-mode-enabled"
            label="Console mode"
            description="While enabled, Portal manages desktop chrome (taskbar visibility) for a console-like session."
            checked={enabled}
            onChange={(v) => setPrefs({ enabled: v })}
          />

          <SettingToggle
            id="console-mode-hide-taskbar"
            label="Hide taskbar while active"
            description="Autohides and hides the primary and secondary taskbars (and overflow tray) until you exit Portal or turn off Console mode."
            checked={hideTaskbar}
            disabled={!enabled || windowsOnly}
            onChange={(v) => setPrefs({ hideTaskbar: v })}
          />

          {enabled && hideTaskbar && !windowsOnly ? (
            <p className="text-xs text-muted-foreground px-1 leading-relaxed">
              Emergency restore:{" "}
              <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-xs">
                Ctrl+Shift+Q
              </kbd>{" "}
              restores the taskbar and disables Console mode. Task Manager: Ctrl+Shift+Esc.
            </p>
          ) : null}

          <SettingToggle
            id="console-mode-start-fullscreen"
            label="Start in Big Picture fullscreen"
            description="After the boot splash, enter fullscreen automatically when Console mode is on."
            checked={startFullscreen}
            disabled={!enabled}
            onChange={(v) => setPrefs({ startFullscreen: v })}
          />
        </PanelBody>
      </Panel>

      <Panel>
        <PanelHeader>
          <PanelTitle>
            Shell integration (Phase 2)
          </PanelTitle>
          <PanelDescription>
            System-wide shortcuts and return-to-Portal when a launched game closes. Alt+Tab is not
            disabled; use the app switcher as the primary living-room flow.
          </PanelDescription>
        </PanelHeader>
        <PanelBody>
          <SettingToggle
            id="shell-global-hotkeys"
            label="Global shell hotkeys"
            description="Ctrl+Shift+Tab opens the app switcher; Ctrl+Shift+H opens quick access — even while a game has focus."
            checked={globalShellHotkeys}
            disabled={windowsOnly}
            onChange={(v) => setPrefs({ globalShellHotkeys: v })}
          />
          {globalShellHotkeys && !windowsOnly ? (
            <p className="text-xs text-muted-foreground px-1 leading-relaxed font-mono">
              Switcher: Ctrl+Shift+Tab · Guide: Ctrl+Shift+H
            </p>
          ) : null}

          <SettingToggle
            id="shell-focus-watchdog"
            label="Focus watchdog"
            description="Tracks launched game processes and detects when they exit."
            checked={focusWatchdog}
            disabled={windowsOnly || !focusWatchdogSupported}
            onChange={(v) => setPrefs({ focusWatchdog: v })}
          />

          <SettingToggle
            id="shell-return-portal"
            label="Return to Portal when a game exits"
            description="Raises the dashboard and focuses Portal after a tracked game process ends."
            checked={returnToPortalOnGameExit}
            disabled={windowsOnly || !focusWatchdog || !focusWatchdogSupported}
            onChange={(v) => setPrefs({ returnToPortalOnGameExit: v })}
          />
        </PanelBody>
      </Panel>

      <AutomationProfileSection />

      <Panel>
        <PanelHeader>
          <div className="flex items-center gap-2 text-foreground">
            <Shield className="w-5 h-5" aria-hidden />
            <PanelTitle>
              Windows shell (Phase 4)
            </PanelTitle>
          </div>
          <PanelDescription>
            Advanced: set Portal as the Winlogon shell so Windows signs in directly to the dashboard.
            Requires administrator approval and a sign-out or restart. See Documentation for recovery.
          </PanelDescription>
        </PanelHeader>
        <PanelBody>
          {shellWindowsOnly ? (
            <p className="text-sm text-muted-foreground rounded-none border border-border px-4 py-3">
              Winlogon shell replacement is only available on Windows.
            </p>
          ) : null}

          <SettingToggle
            id="winlogon-shell-enabled"
            label="Use Portal as Windows shell"
            description="Writes HKLM\\Software\\Microsoft\\Windows NT\\CurrentVersion\\Winlogon\\Shell to this app. Disabling restores the previous value (usually explorer.exe)."
            checked={shellConfigured}
            disabled={shellWindowsOnly}
            onChange={(v) => {
              void setWinlogonShell(v).catch(() => undefined);
            }}
          />

          <SettingToggle
            id="winlogon-shell-defer-explorer"
            label="Skip Explorer at logon (frees memory)"
            description="Boots straight into Portal without starting explorer.exe, like the Xbox full screen experience. Explorer returns when you turn off Console mode, press Ctrl+Shift+Q, or exit Portal. While skipped there is no taskbar, tray, volume flyout or notifications — recover with Ctrl+Alt+Del → Task Manager → Run → explorer.exe."
            checked={deferExplorerCompanion}
            disabled={shellWindowsOnly || !shellConfigured}
            onChange={(v) => {
              void setDeferExplorerCompanion(v).catch(() => undefined);
            }}
          />

          <SettingToggle
            id="winlogon-shell-revert-next"
            label="Revert to Explorer on next Portal start"
            description="Sets Shell back to Explorer when Portal launches (UAC). Use if the desktop does not appear or you cannot open Settings. Command line: --revert-winlogon-shell"
            checked={revertOnNextLaunch}
            disabled={shellWindowsOnly}
            onChange={(v) => {
              void setRevertOnNextLaunch(v).catch(() => undefined);
            }}
          />

          {revertedThisSession ? (
            <p className="text-xs text-foreground px-1 leading-relaxed">
              This session restored Explorer as the Windows shell. Sign out or restart for a normal
              desktop.
            </p>
          ) : null}

          {shellLastError ? (
            <p className="text-sm text-destructive rounded-none border border-destructive/40 px-4 py-3 flex gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden />
              <span>{shellLastError}</span>
            </p>
          ) : null}

          {shellConfigured && shellPendingSignOut && !shellSessionStarted ? (
            <p className="text-xs text-muted-foreground px-1 leading-relaxed">
              Shell registry updated. Sign out or restart Windows for Portal to start at logon.
            </p>
          ) : null}

          {shellSessionStarted ? (
            <p className="text-xs text-muted-foreground px-1 leading-relaxed">
              This session started as the logon shell. Explorer runs in the background for the system
              tray when needed. Console mode defaults were applied for this session.
            </p>
          ) : null}

          <p className="text-xs text-muted-foreground px-1 leading-relaxed">
            Recovery: enable <strong className="text-foreground">Revert on next start</strong>, then
            launch Portal from Task Manager; Safe Mode → Shell ={" "}
            <span className="font-mono text-foreground">explorer.exe</span>; or{" "}
            <span className="font-mono text-foreground">portal-media.exe --revert-winlogon-shell</span>
            . Emergency: Ctrl+Shift+Esc, Ctrl+Shift+Q.
          </p>
        </PanelBody>
      </Panel>

      <Panel>
        <PanelHeader>
          <div className="flex items-center gap-2 text-foreground">
            <Power className="w-5 h-5" aria-hidden />
            <PanelTitle>Startup</PanelTitle>
          </div>
          <PanelDescription>
            Opens Portal when you sign in to Windows (current user, Run key). Pair with Console mode
            for a boot-to-dashboard flow.
          </PanelDescription>
        </PanelHeader>
        <PanelBody className="pt-0">
          <SettingToggle
            id="console-mode-launch-login"
            label="Launch Portal at login"
            description="Adds Portal Media to HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run. Disable here to remove the entry."
            checked={launchAtLogin}
            disabled={windowsOnly}
            onChange={(v) => setPrefs({ launchAtLogin: v })}
          />
        </PanelBody>
      </Panel>
    </div>
  );
}
