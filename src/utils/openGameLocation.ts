import { openPath, openUrl, revealItemInDir } from "@tauri-apps/plugin-opener";
import type { Game } from "@/types/game";

function isLikelyFilesystemPath(p: string): boolean {
  const s = p.trim();
  if (!s) return false;
  return /^[a-zA-Z]:[\\/]/.test(s) || s.startsWith("\\\\") || s.startsWith("/");
}

/** True if we can offer “show in file manager” (not bookmarks / protocol-only installs). */
export function canRevealGameInFileManager(game: Game): boolean {
  if (game.launch_type === "Url") return false;
  return isLikelyFilesystemPath(game.path) || isLikelyFilesystemPath(game.executable);
}

/**
 * Reveals the install folder in the OS file manager when possible; otherwise opens a directory path.
 * For `Url` games, opens the target URL in the default browser.
 */
export async function openGameFilesystemLocation(game: Game): Promise<void> {
  if (game.launch_type === "Url") {
    const u = game.executable?.trim() || game.path?.trim();
    if (u) await openUrl(u);
    return;
  }

  const exe = game.executable?.trim();
  const dir = game.path?.trim();

  if (exe && isLikelyFilesystemPath(exe)) {
    try {
      await revealItemInDir(exe);
      return;
    } catch {
      // fall through to directory
    }
  }

  if (dir && isLikelyFilesystemPath(dir)) {
    await openPath(dir);
    return;
  }

  throw new Error("No file path available to open.");
}
