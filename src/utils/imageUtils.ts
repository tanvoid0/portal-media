/**
 * Validates if a string is a valid URL or data URI
 */
export function isValidImageSource(src: string | undefined | null): boolean {
  if (!src) return false;
  
  // Check if it's a data URI
  if (src.startsWith('data:')) {
    return true;
  }
  
  // Check if it's a valid URL
  try {
    const url = new URL(src);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    // If URL constructor throws, it's not a valid URL
    return false;
  }
}

/**
 * Gets a safe image source, falling back to a placeholder if invalid
 */
export function getSafeImageSource(src: string | undefined | null): string {
  if (isValidImageSource(src)) {
    return src!;
  }
  
  // Return a placeholder SVG
  return "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='600'%3E%3Crect fill='%231e293b' width='400' height='600'/%3E%3Ctext fill='%23647591' font-family='sans-serif' font-size='20' x='50%25' y='50%25' text-anchor='middle' dominant-baseline='middle'%3ENo Cover%3C/text%3E%3C/svg%3E";
}

