import { FormEvent, useEffect, useMemo, useState } from "react";

type User = { id: string; display_name: string; role: "PARENT" | "CHILD" };
type Child = { id: string; display_name: string; avatar_url?: string | null; points_balance: number };
type HistoryItem = {
  id: string;
  transaction_type: string;
  points: number;
  reason: string;
  created_at: string;
  created_by_name?: string | null;
};

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: { "content-type": "application/json", ...(init?.headers ?? {}) },
  });
  const body = await response.json();
  if (!response.ok) throw new Error(body?.error?.message ?? "เกิดข้อผิดพลาด");
  return body as T;
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [children, setChildren] = useState<Child[]>([]);
  const [selectedChildId, setSelectedChildId] = useState<string>("");
  const [child, setChild] = useState<Child | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [mode, setMode] = useState<"EARN" | "DEDUCT">("EARN");
  const [amount, setAmount] = useState(50);
  const [reason, setReason] = useState("ทำการบ้าน");
  const [message, setMessage] = useState("");

  const activeChild = useMemo(
    () => (user?.role === "PARENT" ? children.find((c) => c.id === selectedChildId) ?? null : child),
    [children, selectedChildId, child, user],
  );

  async function refreshHistory(targetId: string) {
    const data = await api<{ history: HistoryItem[] }>(`/api/children/${targetId}/history`);
    setHistory(data.history);
  }

  async function loadDashboard(currentUser: User) {
    if (currentUser.role === "PARENT") {
      const data = await api<{ children: Child[] }>("/api/children");
      setChildren(data.children);
      const first = data.children[0];
      if (first) {
        setSelectedChildId(first.id);
        await refreshHistory(first.id);
      }
    } else {
      const data = await api<{ child: Child }>("/api/child/me");
      setChild(data.child);
      await refreshHistory(data.child.id);
    }
  }

  useEffect(() => {
    api<{ user: User }>("/api/auth/me")
      .then(async ({ user: currentUser }) => {
        setUser(currentUser);
        await loadDashboard(currentUser);
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (user?.role === "PARENT" && selectedChildId) {
      refreshHistory(selectedChildId).catch(() => undefined);
    }
  }, [selectedChildId, user?.role]);

  async function demoLogin(role: "PARENT" | "CHILD") {
    setMessage("");
    const data = await api<{ user: User }>("/api/auth/dev-login", {
      method: "POST",
      body: JSON.stringify({ role }),
    });
    setUser(data.user);
    await loadDashboard(data.user);
  }

  async function logout() {
    await api("/api/auth/logout", { method: "POST" });
    setUser(null);
    setChildren([]);
    setChild(null);
    setHistory([]);
  }

  async function submitPoints(event: FormEvent) {
    event.preventDefault();
    if (!activeChild) return;

    try {
      setMessage("");
      await api("/api/points", {
        method: "POST",
        body: JSON.stringify({ childId: activeChild.id, amount, reason, type: mode }),
      });

      const data = await api<{ children: Child[] }>("/api/children");
      setChildren(data.children);
      await refreshHistory(activeChild.id);
      setMessage(mode === "EARN" ? "เพิ่มคะแนนเรียบร้อย ⭐" : "หักคะแนนเรียบร้อย");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "เกิดข้อผิดพลาด");
    }
  }

  if (!user) {
    return (
      <main className="page-shell">
        <section className="login-card">
          <p className="eyebrow">Family Reward Game</p>
          <h1>เข้าสู่ Demo</h1>
          <p className="muted">Phase 2–4 ใช้ demo session เพื่อทดสอบ flow ก่อนเชื่อมระบบ login production</p>
          <div className="login-actions">
            <button className="action action-positive" onClick={() => demoLogin("PARENT")}>เข้าเป็นผู้ปกครอง</button>
            <button className="action action-child" onClick={() => demoLogin("CHILD")}>เข้าเป็นเด็ก</button>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="page-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">{user.role === "PARENT" ? "Parent mode" : "Child mode"}</p>
          <strong>{user.display_name}</strong>
        </div>
        <button className="link-button" onClick={logout}>ออกจากระบบ</button>
      </header>

      {user.role === "PARENT" && children.length > 1 && (
        <label className="child-picker">
          เด็ก
          <select value={selectedChildId} onChange={(e) => setSelectedChildId(e.target.value)}>
            {children.map((item) => <option key={item.id} value={item.id}>{item.display_name}</option>)}
          </select>
        </label>
      )}

      {activeChild && (
        <>
          <section className="hero-card">
            <div>
              <p className="eyebrow">คะแนนสะสม</p>
              <h1>{activeChild.display_name}</h1>
              <p className="balance">⭐ {activeChild.points_balance.toLocaleString()} คะแนน</p>
            </div>
            <div className="avatar" aria-hidden="true">🧒</div>
          </section>

          {user.role === "PARENT" && (
            <section className="panel">
              <div className="segmented">
                <button className={mode === "EARN" ? "active" : ""} onClick={() => setMode("EARN")}>＋ ให้คะแนน</button>
                <button className={mode === "DEDUCT" ? "active danger" : ""} onClick={() => setMode("DEDUCT")}>－ หักคะแนน</button>
              </div>

              <form className="point-form" onSubmit={submitPoints}>
                <div className="quick-grid">
                  {[10, 20, 50, 100].map((value) => (
                    <button type="button" className={amount === value ? "quick selected" : "quick"} key={value} onClick={() => setAmount(value)}>
                      {mode === "EARN" ? "+" : "-"}{value}
                    </button>
                  ))}
                </div>

                <label>
                  เหตุผล
                  <select value={reason} onChange={(e) => setReason(e.target.value)}>
                    <option>ทำการบ้าน</option>
                    <option>อ่านหนังสือ</option>
                    <option>ช่วยงานบ้าน</option>
                    <option>ตื่นตรงเวลา</option>
                    <option>เก็บของเล่น</option>
                    <option>มีน้ำใจ</option>
                    <option>เล่นเกมเกินเวลาที่ตกลง</option>
                    <option>ไม่เก็บของหลังเล่น</option>
                  </select>
                </label>

                <button className={mode === "EARN" ? "submit-button earn" : "submit-button deduct"} type="submit">
                  {mode === "EARN" ? `เพิ่ม ${amount} คะแนน` : `หัก ${amount} คะแนน`}
                </button>
                {message && <p className="feedback">{message}</p>}
              </form>
            </section>
          )}

          <section className="panel">
            <div className="section-heading">
              <h2>ประวัติล่าสุด</h2>
              <span>{history.length} รายการ</span>
            </div>
            <div className="timeline">
              {history.map((item) => (
                <article className="timeline-item" key={item.id}>
                  <div>
                    <strong className={item.points > 0 ? "positive" : "negative"}>
                      {item.points > 0 ? "+" : ""}{item.points}
                    </strong>
                    <p>{item.reason}</p>
                    <small>{item.created_by_name ?? "ระบบ"} · {new Date(item.created_at).toLocaleString("th-TH")}</small>
                  </div>
                  <span className="type-badge">{item.transaction_type}</span>
                </article>
              ))}
            </div>
          </section>

          {user.role === "CHILD" && (
            <section className="panel">
              <div className="section-heading">
                <h2>ร้านตัวละคร</h2>
                <span>Phase 5</span>
              </div>
              <p className="muted">ระบบซื้อและวิวัฒนาการจะต่อจากคะแนนจริงชุดนี้ โดยเด็กไม่มีสิทธิ์แก้คะแนนเอง</p>
            </section>
          )}
        </>
      )}
    </main>
  );
}
