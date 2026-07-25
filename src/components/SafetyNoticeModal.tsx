import { useEffect, useRef, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
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
      className="fixed inset-0 z-[110] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
      onClick={onClose}
      onKeyDown={handleKeyDown}
      role="presentation"
    >
      <Card
        className="w-full max-w-lg max-h-[85vh] overflow-y-auto border-white/20 bg-slate-900/95 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 space-y-1">
              <CardTitle className="text-xl text-white">{title}</CardTitle>
              {description ? (
                <CardDescription className="text-white/70">{description}</CardDescription>
              ) : null}
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="h-8 w-8 shrink-0 text-white/70 hover:text-white hover:bg-white/10"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="text-sm text-white/75 leading-relaxed space-y-2 pt-0">
          {children}
        </CardContent>
        <CardFooter className="flex justify-end gap-3 border-t border-white/10">
          <Button
            variant="outline"
            onClick={onClose}
            className="border-white/20 text-white hover:bg-white/10"
            data-safety-cancel
          >
            {cancelLabel}
          </Button>
          <Button
            ref={confirmRef}
            variant="default"
            onClick={onConfirm}
            className="bg-primary text-primary-foreground hover:bg-primary/90"
          >
            {confirmLabel}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
