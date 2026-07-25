import { listen } from "@tauri-apps/api/event";
import { isTauri } from "@tauri-apps/api/core";
import { useEffect } from "react";
import { toast } from "sonner";
import { SafetyNoticeModal } from "@/components/SafetyNoticeModal";
import { useWinlogonShellStore } from "@/stores/winlogonShellStore";
import { markWinlogonShellNoticeSeen } from "@/utils/winlogonShellNotice";

export function WinlogonShellOverlays() {
  const confirmOpen = useWinlogonShellStore((s) => s.confirmModalOpen);
  const closeConfirm = useWinlogonShellStore((s) => s.closeConfirmModal);
  const confirmEnable = useWinlogonShellStore((s) => s.confirmEnableShell);

  useEffect(() => {
    if (!isTauri()) return;
    let unlisten: (() => void) | undefined;
    void listen("winlogon-shell-reverted", () => {
      toast.success("Windows shell restored", {
        description: "Shell was set back to Explorer. Sign out or restart for a normal desktop.",
        duration: 12_000,
      });
    }).then((fn) => {
      unlisten = fn;
    });
    return () => unlisten?.();
  }, []);

  return (
    <SafetyNoticeModal
      isOpen={confirmOpen}
      title="Use Portal as Windows shell?"
      description="Advanced setting — read before enabling."
      confirmLabel="Enable Windows shell"
      onClose={closeConfirm}
      onConfirm={() => {
        markWinlogonShellNoticeSeen();
        void confirmEnable();
      }}
    >
      <p>
        Portal will replace <span className="font-mono text-white/90">explorer.exe</span> as the
        Windows logon shell. You must approve the administrator (UAC) prompt, then sign out or
        restart.
      </p>
      <ul className="list-disc pl-5 space-y-1 text-white/65">
        <li>Enable Console mode first (taskbar hide, global hotkeys).</li>
        <li>
          Schedule <strong className="text-white/85">Revert to Explorer on next start</strong> below
          if you need an escape hatch before sign-out.
        </li>
        <li>
          Emergency: Ctrl+Shift+Esc (Task Manager → run explorer.exe), Ctrl+Shift+Q (Console mode).
        </li>
        <li>Full recovery: Documentation → Windows shell (Phase 4).</li>
      </ul>
    </SafetyNoticeModal>
  );
}
