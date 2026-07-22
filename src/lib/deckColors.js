// Shared deck-color helpers: turn a deck's color list into a CSS
// gradient for tiles, matching the collection palette.

export const COLOR_HEX = {
  Red: '#ef4444',
  Blue: '#3b82f6',
  Green: '#22c55e',
  Yellow: '#eab308',
  Purple: '#a855f7',
  Colorless: '#6b7280',
};

function hexToRgba(hex, alpha) {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * A left-to-right gradient built from a deck's colors. Falls back to a
 * neutral slate wash when a deck has no colors recorded.
 */
export function deckGradient(colors, alpha = 0.55) {
  const list = (colors || []).map((c) => COLOR_HEX[c]).filter(Boolean);
  if (list.length === 0) {
    return `linear-gradient(135deg, ${hexToRgba('#334155', alpha)}, ${hexToRgba('#1e293b', alpha)})`;
  }
  if (list.length === 1) {
    return `linear-gradient(135deg, ${hexToRgba(list[0], alpha)}, ${hexToRgba(list[0], alpha * 0.35)})`;
  }
  const stops = list
    .map((hex, i) => `${hexToRgba(hex, alpha)} ${Math.round((i / (list.length - 1)) * 100)}%`)
    .join(', ');
  return `linear-gradient(135deg, ${stops})`;
}
