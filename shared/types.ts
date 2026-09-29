// Icon + Thai name for each element type. Badge colors live in src/styles.css as .element-<type>.
export const TYPE_INFO: Record<string, { icon: string; th: string }> = {
  Normal: { icon: "⚪", th: "ปกติ" },
  Fire: { icon: "🔥", th: "ไฟ" },
  Water: { icon: "💧", th: "น้ำ" },
  Grass: { icon: "🌿", th: "หญ้า" },
  Electric: { icon: "⚡", th: "ไฟฟ้า" },
  Ice: { icon: "❄️", th: "น้ำแข็ง" },
  Fighting: { icon: "🥊", th: "ต่อสู้" },
  Poison: { icon: "☠️", th: "พิษ" },
  Ground: { icon: "⛰️", th: "ดิน" },
  Flying: { icon: "🕊️", th: "บิน" },
  Psychic: { icon: "🔮", th: "พลังจิต" },
  Bug: { icon: "🐛", th: "แมลง" },
  Rock: { icon: "🪨", th: "หิน" },
  Ghost: { icon: "👻", th: "ผี" },
  Dragon: { icon: "🐉", th: "มังกร" },
  Dark: { icon: "🌙", th: "ความมืด" },
  Steel: { icon: "⚙️", th: "เหล็ก" },
  Fairy: { icon: "🧚", th: "แฟรี่" },
};

export const TYPE_ICON: Record<string, string> = Object.fromEntries(
  Object.entries(TYPE_INFO).map(([type, info]) => [type, info.icon]),
);
