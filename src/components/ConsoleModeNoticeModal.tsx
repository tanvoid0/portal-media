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
      <ul className="list-disc pl-5 space-y-1 text-white/65">
        <li>
          <kbd className="rounded border border-white/20 bg-white/5 px-1.5 py-0.5 font-mono text-[11px]">
            Ctrl+Shift+Q
          </kbd>{" "}
          — restore the taskbar and disable Console mode
        </li>
        <li>
          <kbd className="rounded border border-white/20 bg-white/5 px-1.5 py-0.5 font-mono text-[11px]">
            Ctrl+Shift+Esc
          </kbd>{" "}
          — Task Manager
        </li>
        <li>If Portal closes unexpectedly, relaunch Portal or sign out of Windows.</li>
      </ul>
    </SafetyNoticeModal>
  );
}
