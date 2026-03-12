import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Returns a contrast-safe text color (black or white) for a given background color.
 * Uses WCAG relative luminance formula to ensure 4.5:1 contrast ratio.
 */
export function getContrastTextColor(hexColor: string): string {
  // Parse hex color (supports #rgb, #rrggbb, rgb(), and named colors)
  let r: number, g: number, b: number;

  if (hexColor.startsWith('#')) {
    const hex = hexColor.slice(1);
    if (hex.length === 3) {
      const h0 = hex[0], h1 = hex[1], h2 = hex[2];
      if (!h0 || !h1 || !h2) return '#000000';
      r = parseInt(h0 + h0, 16);
      g = parseInt(h1 + h1, 16);
      b = parseInt(h2 + h2, 16);
    } else {
      r = parseInt(hex.slice(0, 2), 16);
      g = parseInt(hex.slice(2, 4), 16);
      b = parseInt(hex.slice(4, 6), 16);
    }
  } else if (hexColor.startsWith('rgb')) {
    const match = hexColor.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
    if (match && match[1] && match[2] && match[3]) {
      r = parseInt(match[1], 10);
      g = parseInt(match[2], 10);
      b = parseInt(match[3], 10);
    } else {
      return '#000000'; // Default to black for unparseable colors
    }
  } else {
    return '#000000'; // Default to black for named colors
  }

  // Calculate relative luminance (WCAG formula)
  const toLinear = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  const luminance = 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);

  // Use black text on light backgrounds, white on dark
  // Threshold ~0.179 ensures 4.5:1 contrast ratio for WCAG AA
  return luminance > 0.179 ? '#000000' : '#ffffff';
}
