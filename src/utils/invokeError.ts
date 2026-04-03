import { toast } from "sonner";

/** Tauri `invoke` rejections are not always standard `Error` instances. */
export function formatInvokeError(e: unknown): string {
  if (typeof e === "string") return e;
  if (e instanceof Error) return e.message;
  if (e && typeof e === "object") {
    const o = e as Record<string, unknown>;
    if (typeof o.message === "string" && o.message.length > 0) return o.message;
    if (typeof o.error === "string" && o.error.length > 0) return o.error;
    if (typeof o.msg === "string" && o.msg.length > 0) return o.msg;
  }
  try {
    const s = JSON.stringify(e);
    if (s && s !== "{}" && s !== "null") return s;
  } catch {
    // ignore
  }
  return String(e);
}

/** Error toast with optional Copy action in dev (or when `VITE_SHOW_DEBUG_TOAST_COPY=true`). */
export function toastInvokeCatch(title: string, e: unknown): void {
  const description = formatInvokeError(e);
  const showCopy =
    import.meta.env.DEV || import.meta.env.VITE_SHOW_DEBUG_TOAST_COPY === "true";

  if (showCopy) {
    toast.error(title, {
      description,
      action: {
        label: "Copy",
        onClick: () => {
          void navigator.clipboard.writeText(`${title}\n\n${description}`);
        },
      },
    });
  } else {
    toast.error(title, { description });
  }
}
