import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { TypeBadges } from "./TypeBadge";

type Odds = { rarity: string; percent: number; count: number };
type Info = { price: number; daily_limit: number; spins_today: number; pool_size: number; odds: Odds[] };
type Prize = { id: string; name: string; image_url: string; rarity: string; type_primary: string; type_secondary: string | null };

// How long the box shakes before the prize is shown.
const OPENING_MS = 1400;

type Props = {
  balance: number;
  onChanged: () => Promise<void>;
};

export default function GachaBox({ balance, onChanged }: Props) {
  const [info, setInfo] = useState<Info | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [opening, setOpening] = useState(false);
  const [prize, setPrize] = useState<Prize | null>(null);
  const [message, setMessage] = useState("");

  async function load() {
    setInfo(await api<Info>("/api/gacha"));
  }

  useEffect(() => {
    load().catch(() => undefined);
  }, []);

  async function spin() {
    setConfirming(false);
    setMessage("");
    setOpening(true);
    try {
      const [result] = await Promise.all([
        api<{ character: Prize }>("/api/gacha/spin", { method: "POST", body: "{}" }),
        new Promise((resolve) => window.setTimeout(resolve, OPENING_MS)),
      ]);
      setPrize(result.character);
      await Promise.all([load(), onChanged()]);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "เปิดกล่องไม่สำเร็จ");
    } finally {
      setOpening(false);
    }
  }

  if (!info) return null;
  const spinsLeft = Math.max(0, info.daily_limit - info.spins_today);
  const soldOut = info.pool_size === 0;
  const canSpin = !soldOut && spinsLeft > 0 && balance >= info.price && !opening;
  const reason = soldOut
    ? "สะสมตัวในร้านครบแล้ว 🎉"
    : spinsLeft === 0
      ? "วันนี้เปิดครบแล้ว พรุ่งนี้มาใหม่นะ"
      : balance < info.price
        ? "ต้องมีอย่างน้อย ⭐ " + info.price + " คะแนน"
        : "";

  return (
    <section className="panel gacha-panel">
      <div className="section-heading"><h2>🎁 กล่องสุ่ม</h2><span>เหลือวันนี้ {spinsLeft}/{info.daily_limit} ครั้ง</span></div>
      <div className={"gacha-box" + (opening ? " opening" : "")} aria-hidden="true">🎁</div>
      <p className="muted gacha-note">ได้ตัวที่ยังไม่มีเสมอ ไม่มีตัวซ้ำ</p>

      <div className="odds-row">
        {info.odds.map((row) => (
          <span className={"rarity rarity-" + row.rarity.toLowerCase()} key={row.rarity} title={row.count + " ตัว"}>
            {row.rarity} {row.percent}%
          </span>
        ))}
      </div>

      {confirming ? (
        <div className="gacha-confirm">
          <p>ใช้ ⭐ {info.price} คะแนน เปิดกล่อง?</p>
          <div className="dialog-actions">
            <button className="quest-button reject" onClick={() => setConfirming(false)}>ยกเลิก</button>
            <button className="submit-button earn" onClick={() => spin()}>🎁 เปิดเลย!</button>
          </div>
        </div>
      ) : (
        <button className="submit-button gacha-button" disabled={!canSpin} onClick={() => setConfirming(true)}>
          {opening ? "กำลังเปิด..." : reason || "เปิดกล่อง · ⭐ " + info.price}
        </button>
      )}
      {message && <p className="feedback">{message}</p>}

      {prize && (
        <div className="gacha-reveal" role="dialog" aria-modal="true" aria-label={"ได้ " + prize.name}>
          <div className={"gacha-card rarity-glow-" + prize.rarity.toLowerCase()}>
            <p className="eyebrow">ได้ตัวใหม่!</p>
            <img src={prize.image_url} alt={prize.name} />
            <h2>{prize.name}</h2>
            <TypeBadges primary={prize.type_primary} secondary={prize.type_secondary} />
            <span className={"rarity rarity-" + prize.rarity.toLowerCase()}>{prize.rarity}</span>
            <button className="submit-button earn" onClick={() => setPrize(null)}>เยี่ยม! 🎉</button>
          </div>
        </div>
      )}
    </section>
  );
}
