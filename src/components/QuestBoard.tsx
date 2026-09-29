import { FormEvent, useEffect, useState } from "react";
import { api } from "../lib/api";

type QuestStatus = "PENDING" | "APPROVED" | "REJECTED" | null;
type Quest = { id: string; title: string; points: number; child_id: string | null; completion_id: string | null; status: QuestStatus };
type Streak = { current: number; today_done: boolean; next_milestone: number | null; next_bonus: number | null };
type Pending = { id: string; day: string; child_id: string; child_name: string; title: string; points: number };
type StreakBonus = { days: number; points: number } | null;

const QUEST_IDEAS = ["แปรงฟันก่อนนอน", "อ่านหนังสือ 15 นาที", "เก็บของเล่น", "ทำการบ้าน", "ช่วยงานบ้าน", "เข้านอนตรงเวลา"];

type Props = {
  role: "PARENT" | "CHILD";
  childId: string;
  childName: string;
  onChanged: () => Promise<void>;
  onCelebrate: (title: string, detail: string) => void;
};

export default function QuestBoard({ role, childId, childName, onChanged, onCelebrate }: Props) {
  const [quests, setQuests] = useState<Quest[]>([]);
  const [streak, setStreak] = useState<Streak | null>(null);
  const [pending, setPending] = useState<Pending[]>([]);
  const [title, setTitle] = useState("");
  const [points, setPoints] = useState(10);
  const [forAll, setForAll] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const isParent = role === "PARENT";

  async function load() {
    const [today, waiting] = await Promise.all([
      api<{ quests: Quest[]; streak: Streak }>("/api/quests" + (isParent ? "?childId=" + encodeURIComponent(childId) : "")),
      isParent ? api<{ pending: Pending[] }>("/api/quests/pending") : Promise.resolve({ pending: [] }),
    ]);
    setQuests(today.quests);
    setStreak(today.streak);
    setPending(waiting.pending);
  }

  useEffect(() => {
    setMessage("");
    load().catch(() => undefined);
  }, [childId, role]);

  async function run(action: () => Promise<string | void>) {
    if (busy) return;
    try {
      setBusy(true);
      setMessage("");
      const text = await action();
      await Promise.all([load(), onChanged()]);
      if (text) setMessage(text);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "เกิดข้อผิดพลาด");
    } finally {
      setBusy(false);
    }
  }

  function celebrateBonus(bonus: StreakBonus) {
    if (bonus) onCelebrate("🔥 ต่อเนื่อง " + bonus.days + " วัน!", "ได้โบนัส +" + bonus.points + " คะแนน");
  }

  function complete(quest: Quest) {
    run(async () => {
      const result = await api<{ status: string; streakBonus?: StreakBonus }>("/api/quests/complete", {
        method: "POST",
        body: JSON.stringify(isParent ? { questId: quest.id, childId } : { questId: quest.id }),
      });
      if (isParent) {
        celebrateBonus(result.streakBonus ?? null);
        return "ให้ " + quest.points + " คะแนนสำหรับ \"" + quest.title + "\" แล้ว";
      }
      return "ส่งแล้ว! รอพ่อแม่ยืนยันนะ ⏳";
    }).catch(() => undefined);
  }

  function review(item: Pending, approve: boolean) {
    run(async () => {
      const result = await api<{ status: string; streakBonus?: StreakBonus }>("/api/quests/review", {
        method: "POST",
        body: JSON.stringify({ completionId: item.id, approve }),
      });
      celebrateBonus(result.streakBonus ?? null);
      return approve ? "ยืนยันแล้ว " + item.child_name + " ได้ +" + item.points : "ไม่ผ่าน " + item.child_name + " ส่งใหม่ได้";
    }).catch(() => undefined);
  }

  function addQuest(event: FormEvent) {
    event.preventDefault();
    run(async () => {
      await api("/api/quests", {
        method: "POST",
        body: JSON.stringify({ childId, forAllChildren: forAll, title, points }),
      });
      setTitle("");
      return "เพิ่มภารกิจแล้ว";
    }).catch(() => undefined);
  }

  function archive(quest: Quest) {
    if (!window.confirm("ลบภารกิจ \"" + quest.title + "\"?")) return;
    run(async () => {
      await api("/api/quests/archive", { method: "POST", body: JSON.stringify({ questId: quest.id }) });
      return "ลบภารกิจแล้ว";
    }).catch(() => undefined);
  }

  const doneCount = quests.filter((quest) => quest.status === "APPROVED").length;

  return (
    <>
      {isParent && pending.length > 0 && (
        <section className="panel">
          <div className="section-heading"><h2>รอยืนยัน</h2><span>{pending.length} รายการ</span></div>
          <div className="quest-list">
            {pending.map((item) => (
              <div className="quest-row" key={item.id}>
                <div className="quest-text">
                  <strong>{item.title}</strong>
                  <small>{item.child_name} · +{item.points}</small>
                </div>
                <div className="quest-actions">
                  <button className="quest-button approve" disabled={busy} onClick={() => review(item, true)}>✓ ผ่าน</button>
                  <button className="quest-button reject" disabled={busy} onClick={() => review(item, false)}>✗</button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="panel">
        <div className="section-heading">
          <h2>{isParent ? "ภารกิจวันนี้ของ " + childName : "ภารกิจวันนี้"}</h2>
          <span>{doneCount}/{quests.length} สำเร็จ</span>
        </div>

        {streak && (
          <div className={streak.current > 0 ? "streak-banner active" : "streak-banner"}>
            <span className="streak-fire">🔥</span>
            <div>
              <strong>{streak.current > 0 ? "ต่อเนื่อง " + streak.current + " วัน" : "เริ่ม streak วันนี้เลย!"}</strong>
              <small>
                {!streak.today_done && streak.current > 0 ? "ทำภารกิจวันนี้อย่างน้อย 1 ข้อเพื่อไม่ให้ไฟดับ · " : ""}
                {streak.next_milestone
                  ? "อีก " + (streak.next_milestone - streak.current) + " วัน ได้โบนัส +" + streak.next_bonus
                  : "สุดยอด! ทำต่อไปเรื่อยๆ"}
              </small>
            </div>
          </div>
        )}

        {quests.length === 0 ? (
          <p className="muted">{isParent ? "ยังไม่มีภารกิจ เพิ่มภารกิจด้านล่างได้เลย" : "ยังไม่มีภารกิจวันนี้ ลองชวนพ่อแม่ตั้งภารกิจกัน"}</p>
        ) : (
          <div className="quest-list">
            {quests.map((quest) => (
              <div className={"quest-row" + (quest.status === "APPROVED" ? " done" : "")} key={quest.id}>
                <div className="quest-text">
                  <strong>{quest.title}</strong>
                  <small>+{quest.points} คะแนน{isParent && quest.child_id === null ? " · ทุกคน" : ""}</small>
                </div>
                <div className="quest-actions">
                  {quest.status === "APPROVED" ? (
                    <span className="quest-state done">✅ สำเร็จ</span>
                  ) : quest.status === "PENDING" && !isParent ? (
                    <span className="quest-state pending">⏳ รอยืนยัน</span>
                  ) : (
                    <button className="quest-button approve" disabled={busy} onClick={() => complete(quest)}>
                      {isParent ? "✓ ทำแล้ว" : quest.status === "REJECTED" ? "ลองอีกครั้ง" : "ทำแล้ว!"}
                    </button>
                  )}
                  {isParent && <button className="quest-button remove" disabled={busy} onClick={() => archive(quest)} aria-label={"ลบ " + quest.title}>🗑</button>}
                </div>
              </div>
            ))}
          </div>
        )}

        {message && <p className="feedback">{message}</p>}
      </section>

      {isParent && (
        <section className="panel">
          <div className="section-heading"><h2>เพิ่มภารกิจ</h2><span>ทำซ้ำได้ทุกวัน</span></div>
          <form className="point-form" onSubmit={addQuest}>
            <label>
              ชื่อภารกิจ
              <input className="reason-input" value={title} onChange={(e) => setTitle(e.target.value)} minLength={2} maxLength={80} placeholder="เช่น แปรงฟันก่อนนอน" required />
            </label>
            <div className="idea-chips">
              {QUEST_IDEAS.map((idea) => <button type="button" className="idea-chip" key={idea} onClick={() => setTitle(idea)}>{idea}</button>)}
            </div>
            <label>
              คะแนนต่อครั้ง (5-500)
              <input className="reason-input" type="number" inputMode="numeric" min={5} max={500} step={1} value={points} onChange={(e) => setPoints(Number(e.target.value))} required />
            </label>
            <label>
              สำหรับ
              <select value={forAll ? "all" : "one"} onChange={(e) => setForAll(e.target.value === "all")}>
                <option value="all">เด็กทุกคนในครอบครัว</option>
                <option value="one">เฉพาะ {childName}</option>
              </select>
            </label>
            <button disabled={busy} className="submit-button earn" type="submit">{busy ? "กำลังบันทึก..." : "เพิ่มภารกิจ"}</button>
          </form>
        </section>
      )}
    </>
  );
}
