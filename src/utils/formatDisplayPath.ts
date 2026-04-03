/** Strip Windows extended-length prefixes so paths look normal in the UI. */
export function formatDisplayPath(path: string): string {
  const p = path.trim();
  if (!p) return p;
  if (!p.startsWith("\\\\?\\")) return p;
  const rest = p.slice(4);
  if (rest.toUpperCase().startsWith("UNC\\")) {
    return `\\${rest.slice(3)}`;
  }
  return rest;
}
