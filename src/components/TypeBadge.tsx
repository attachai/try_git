// Icon + Thai name for each element type. Colors live in styles.css as .element-<type>.
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

// e.g. "💧 ธาตุน้ำ"
export function typeLabel(type: string) {
  const info = TYPE_INFO[type];
  return info ? info.icon + " ธาตุ" + info.th : "ธาตุ " + type;
}

type Props = { type: string; iconOnly?: boolean };

export default function TypeBadge({ type, iconOnly = false }: Props) {
  const info = TYPE_INFO[type];
  const name = info ? info.th + " (" + type + ")" : type;
  return (
    <span className={"element element-" + type.toLowerCase() + (iconOnly ? " icon-only" : "")} title={name} aria-label={"ธาตุ" + name}>
      <span aria-hidden="true">{info?.icon ?? "•"}</span>
      {!iconOnly && <span aria-hidden="true">{info?.th ?? type}</span>}
    </span>
  );
}

export function TypeBadges({ primary, secondary, iconOnly = false }: { primary: string; secondary?: string | null; iconOnly?: boolean }) {
  return (
    <span className="type-badges">
      <TypeBadge type={primary} iconOnly={iconOnly} />
      {secondary && <TypeBadge type={secondary} iconOnly={iconOnly} />}
    </span>
  );
}
