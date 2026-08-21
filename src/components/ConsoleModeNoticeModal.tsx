import { SafetyNoticeModal } from "@/components/SafetyNoticeModal";
import { useConsoleModeStore } from "@/stores/consoleModeStore";
import { markConsoleModeNoticeSeen } from "@/utils/consoleModeNotice";

export function ConsoleModeNoticeModal() {
  const open = useConsoleModeStore((s) => s.noticeModalOpen);
  const closeNotice = useConsoleModeStore((s) => s.closeNoticeModal);
  const confirmEnable = useConsoleModeStore((s) => s.confirmEnableConsoleMode);

  return (
    <SafetyNoticeModal
      isOpen={open}
      title="Enable Console mode?"
      description="Portal will manage desktop chrome while it runs."
      confirmLabel="Enable Console mode"
      onClose={closeNotice}
      onConfirm={() => {
        markConsoleModeNoticeSeen();
        confirmEnable();
      }}
    >
      <p>Console mode hides the Windows taskbar (primary and secondary) until you exit Portal or turn it off.</p>
      <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
        <li>
          <kbd className="rounded-none border border-border bg-muted px-1.5 py-0.5 font-mono text-xs">
            Ctrl+Shift+Q
          </kbd>{" "}
          — restore the taskbar and disable Console mode
        </li>
        <li>
          <kbd className="rounded-none border border-border bg-muted px-1.5 py-0.5 font-mono text-xs">
            Ctrl+Shift+Esc
          </kbd>{" "}
          — Task Manager
        </li>
        <li>If Portal closes unexpectedly, relaunch Portal or sign out of Windows.</li>
      </ul>
    </SafetyNoticeModal>
  );
}
