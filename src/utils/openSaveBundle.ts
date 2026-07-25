import { openPath, revealItemInDir } from "@tauri-apps/plugin-opener";
import type { SaveBundle } from "@/types/saveSync";

/** Open a save bundle folder (or reveal a single save file) in the OS file manager. */
export async function openSaveBundleLocation(bundle: SaveBundle): Promise<void> {
  const p = bundle.localPath.trim();
  if (!p) throw new Error("No path for this save location.");

  try {
    await revealItemInDir(p);
  } catch {
    await openPath(p);
  }
}
