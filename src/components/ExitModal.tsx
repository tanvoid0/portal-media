import { useEffect, useRef } from "react";
import { Button } from "./ui/button";
import { Card, CardDescription, CardFooter, CardHeader, CardTitle } from "./ui/card";
import { X } from "lucide-react";

interface ExitModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export function ExitModal({ isOpen, onClose, onConfirm }: ExitModalProps) {
  const confirmButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (isOpen && confirmButtonRef.current) {
      // Focus the confirm button (Yes) by default
      confirmButtonRef.current.focus();
    }
  }, [isOpen]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && document.activeElement === confirmButtonRef.current) {
      e.preventDefault();
      e.stopPropagation();
      onConfirm();
    } else if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      onClose();
    } else if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
      // Switch focus between Yes and No buttons
      e.preventDefault();
      const buttons = [confirmButtonRef.current, document.querySelector('[data-exit-no]')] as HTMLButtonElement[];
      const currentIndex = buttons.findIndex(btn => btn === document.activeElement);
      const nextIndex = e.key === "ArrowRight" 
        ? (currentIndex + 1) % buttons.length 
        : (currentIndex - 1 + buttons.length) % buttons.length;
      e.stopPropagation();
      buttons[nextIndex]?.focus();
    }
  };

  if (!isOpen) return null;

  return (
    <div
      data-shell-modal
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm"
      onClick={onClose}
      onKeyDown={handleKeyDown}
      role="presentation"
    >
      <Card 
        className="w-full max-w-md border-white/20 bg-slate-900/95 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-2xl text-white">Exit Application</CardTitle>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="h-8 w-8 text-white/70 hover:text-white hover:bg-white/10"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          <CardDescription className="text-white/70">
            Are you sure you want to exit?
          </CardDescription>
        </CardHeader>
        <CardFooter className="flex justify-end gap-3">
          <Button
            variant="outline"
            onClick={onClose}
            className="border-white/20 text-white hover:bg-white/10"
            data-exit-no
          >
            No
          </Button>
          <Button
            ref={confirmButtonRef}
            variant="default"
            onClick={onConfirm}
            className="bg-primary text-primary-foreground hover:bg-primary/90"
            autoFocus
          >
            Yes
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}

