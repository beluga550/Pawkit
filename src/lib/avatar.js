// Deterministic 8x8 pixel heads, drawn locally before (or instead of) the real skin.
export const SKINS = [
  ["#c69276", "#9c6a52", "#6b3e2a"],
  ["#f0c8a0", "#d9a47e", "#b56a4a"],
  ["#e8b894", "#c9957a", "#8a4a3a"],
  ["#b98b6e", "#946a54", "#6a3f30"],
  ["#8d5a3b", "#6e4229", "#3f2116"],
  ["#f5d6c0", "#ddb49a", "#b97a60"],
];
export const HAIR_COLORS = ["#3b2718", "#d9832e", "#1c1c24", "#e6e2d6", "#7a4a2a", "#c23b22", "#2f4f8f", "#5b3a6e"];
export const EYE_COLORS = ["#4a3a8c", "#2f7a3d", "#1c1c24", "#3a6ea8", "#6b4a2a", "#2a8a8a"];
// Hair as [x, y, width, height] rectangles on the 8x8 face.
export const HAIR_STYLES = [
  [[0, 0, 8, 2], [0, 2, 1, 1], [7, 2, 1, 1]],
  [[0, 0, 8, 2], [0, 2, 3, 1], [7, 2, 1, 1]],
  [[0, 0, 8, 2], [0, 2, 1, 4], [7, 2, 1, 4]],
  [[0, 0, 8, 1]],
];

/** 32-bit FNV-1a over the lower-cased name (Minecraft names ignore case). */
function hashName(name) {
  let hash = 0x811c9dc5;
  for (const char of String(name).toLowerCase()) {
    hash ^= char.codePointAt(0);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

export function avatarFor(name) {
  const hash = hashName(name);
  const [skin, shade, mouth] = SKINS[hash % SKINS.length];
  return {
    skin,
    shade,
    mouth,
    hair: HAIR_COLORS[(hash >>> 8) % HAIR_COLORS.length],
    eye: EYE_COLORS[(hash >>> 16) % EYE_COLORS.length],
    hairRects: HAIR_STYLES[(hash >>> 24) % HAIR_STYLES.length],
  };
}
