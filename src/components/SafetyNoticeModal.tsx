import { useEffect, useRef, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Panel, PanelBody, PanelDescription, PanelHeader, PanelTitle } from "@/components/ui/panel";
import { X } from "lucide-react";

interface SafetyNoticeModalProps {
  isOpen: boolean;
  title: string;
  description?: string;
  children: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  onClose: () => void;
  onConfirm: () => void;
}

export function SafetyNoticeModal({
  isOpen,
  title,
  description,
  children,
  confirmLabel,
  cancelLabel = "Cancel",
  onClose,
  onConfirm,
}: SafetyNoticeModalProps) {
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (isOpen) {
      confirmRef.current?.focus();
    }
  }, [isOpen]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div
      data-shell-modal
      className="fixed inset-0 z-[110] flex items-center justify-center bg-background/80 p-4"
      onClick={onClose}
      onKeyDown={handleKeyDown}
      role="presentation"
    >
      <Panel
        className="max-h-[85vh] w-full max-w-lg overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <PanelHeader>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 space-y-1">
              <PanelTitle>{title}</PanelTitle>
              {description ? <PanelDescription>{description}</PanelDescription> : null}
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="h-8 w-8 shrink-0 rounded-none"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </PanelHeader>
        <PanelBody className="space-y-2 text-sm leading-relaxed text-muted-foreground">
          {children}
        </PanelBody>
        <div className="flex justify-end gap-3 border-t border-border px-5 py-4">
          <Button variant="outline" onClick={onClose} className="rounded-none" data-safety-cancel>
            {cancelLabel}
          </Button>
          <Button ref={confirmRef} variant="default" onClick={onConfirm} className="rounded-none">
            {confirmLabel}
          </Button>
        </div>
      </Panel>
    </div>
  );
}
