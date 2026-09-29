import { TYPE_INFO } from "../../shared/types";

export { TYPE_INFO };

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
