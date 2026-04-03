import { currentMonitor, getCurrentWindow, LogicalSize } from "@tauri-apps/api/window";

export const DEFAULT_WINDOWED_WIDTH = 1360;
export const DEFAULT_WINDOWED_HEIGHT = 860;

/** Inner size when leaving fullscreen / restore — avoids WebView vs outer-size mismatch on Windows. */
export async function applyReasonableWindowedSize(
  appWindow: ReturnType<typeof getCurrentWindow>
) {
  if (await appWindow.isMaximized()) {
    await appWindow.unmaximize();
  }
  const mon = await currentMonitor();
  if (mon) {
    const { width: pw, height: ph } = mon.workArea.size;
    const sf = mon.scaleFactor;
    const lw = pw / sf;
    const lh = ph / sf;
    const w = Math.min(DEFAULT_WINDOWED_WIDTH, Math.max(960, lw * 0.88));
    const h = Math.min(DEFAULT_WINDOWED_HEIGHT, Math.max(640, lh * 0.88));
    await appWindow.setSize(new LogicalSize(Math.round(w), Math.round(h)));
  } else {
    await appWindow.setSize(new LogicalSize(DEFAULT_WINDOWED_WIDTH, DEFAULT_WINDOWED_HEIGHT));
  }
  await appWindow.center();
}
