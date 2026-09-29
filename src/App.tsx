import { FormEvent, useEffect, useMemo, useState } from "react";
import ConfirmDialog from "./components/ConfirmDialog";

type User = { id: string; display_name: string; role: "PARENT" | "CHILD" };
type Child = { id: string; display_name: string; avatar_url?: string | null; points_balance: number };
type HistoryItem = {
  id: string; transaction_type: string; points: number; reason: string;
  created_at: string; created_by_name?: string | null;
};
type ShopCharacter = {
  id: string; name: string; slug: string; type_primary: string; type_secondary?: string | null;
  image_url: string; price: number; rarity: string; owned: number;
};
type CollectionItem = {
  child_character_id: string; character_id: string; name: string; slug: string;
  type_primary: string; type_secondary?: string | null; image_url: string; rarity: string;
  evolution_cost?: number | null; evolution_name?: string | null; evolution_image_url?: string | null;
};
type ChildTab = "home" | "shop" | "collection" | "history";
type ParentTab = "home" | "history";
type PendingAction =
  | { kind: "purchase"; character: ShopCharacter }
  | { kind: "evolve"; item: CollectionItem }
  | null;

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: { "content-type": "application/json", ...(init?.headers ?? {}) },
  });
  const body = await response.json() as { error?: { message?: string } } & T;
  if (!response.ok) throw new Error(body.error?.message ?? "เกิดข้อผิดพลาด");
  return body;
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [children, setChildren] = useState<Child[]>([]);
  const [selectedChildId, setSelectedChildId] = useState("");
  const [child, setChild] = useState<Child | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [shop, setShop] = useState<ShopCharacter[]>([]);
  const [collection, setCollection] = useState<CollectionItem[]>([]);
  const [mode, setMode] = useState<"EARN" | "DEDUCT">("EARN");
  const [amount, setAmount] = useState(50);
  const [reason, setReason] = useState("ทำการบ้าน");
  const [message, setMessage] = useState("");
  const [childTab, setChildTab] = useState<ChildTab>("home");
  const [parentTab, setParentTab] = useState<ParentTab>("home");
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [celebration, setCelebration] = useState<{ title: string; detail: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [demoLoginEnabled, setDemoLoginEnabled] = useState(false);
  const [loginRole, setLoginRole] = useState<"PARENT" | "CHILD">("PARENT");
  const [parentEmail, setParentEmail] = useState("");
  const [parentPassword, setParentPassword] = useState("");
  const [familyCode, setFamilyCode] = useState("");
  const [childName, setChildName] = useState("");
  const [childPin, setChildPin] = useState("");

  const activeChild = useMemo(
    () => (user?.role === "PARENT" ? children.find((c) => c.id === selectedChildId) ?? null : child),
    [children, selectedChildId, child, user],
  );

  async function refreshHistory(targetId: string) {
    const data = await api<{ history: HistoryItem[] }>("/api/children/" + targetId + "/history");
    setHistory(data.history);
  }

  async function refreshChildGame() {
    const [profile, shopData, collectionData] = await Promise.all([
      api<{ child: Child }>("/api/child/me"),
      api<{ characters: ShopCharacter[] }>("/api/shop"),
      api<{ child: Child; collection: CollectionItem[] }>("/api/collection"),
    ]);
    setChild(profile.child);
    setShop(shopData.characters);
    setCollection(collectionData.collection);
    await refreshHistory(profile.child.id);
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
      await refreshChildGame();
    }
  }

  useEffect(() => {
    api<{ demoLoginEnabled: boolean }>("/api/auth/config")
      .then((config) => setDemoLoginEnabled(config.demoLoginEnabled))
      .catch(() => undefined);

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

  useEffect(() => {
    if (!celebration) return;
    const timer = window.setTimeout(() => setCelebration(null), 2400);
    return () => window.clearTimeout(timer);
  }, [celebration]);

  async function productionLogin(event: FormEvent) {
    event.preventDefault();
    if (busy) return;

    try {
      setBusy(true);
      setMessage("");

      const data = loginRole === "PARENT"
        ? await api<{ user: User }>("/api/auth/login/parent", {
            method: "POST",
            body: JSON.stringify({ email: parentEmail, password: parentPassword }),
          })
        : await api<{ user: User }>("/api/auth/login/child", {
            method: "POST",
            body: JSON.stringify({ familyCode, childName, pin: childPin }),
          });

      setUser(data.user);
      await loadDashboard(data.user);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "เข้าสู่ระบบไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }

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
    setShop([]);
    setCollection([]);
    setMessage("");
  }

  async function submitPoints(event: FormEvent) {
    event.preventDefault();
    if (!activeChild || busy) return;

    try {
      setBusy(true);
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
    } finally {
      setBusy(false);
    }
  }

  async function confirmPendingAction() {
    if (!pendingAction || busy) return;
    const action = pendingAction;
    setPendingAction(null);

    try {
      setBusy(true);
      setMessage("");

      if (action.kind === "purchase") {
        await api("/api/shop/purchase", {
          method: "POST",
          body: JSON.stringify({ characterId: action.character.id }),
        });
        await refreshChildGame();
        setCelebration({ title: "ปลดล็อกแล้ว! 🎉", detail: action.character.name + " เข้า Collection แล้ว" });
        setChildTab("collection");
      } else {
        const evolutionName = action.item.evolution_name ?? "ร่างใหม่";
        await api("/api/collection/evolve", {
          method: "POST",
          body: JSON.stringify({ childCharacterId: action.item.child_character_id }),
        });
        await refreshChildGame();
        setCelebration({ title: "Evolution สำเร็จ ✨", detail: action.item.name + " → " + evolutionName });
        setChildTab("collection");
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "ทำรายการไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }

  if (!user) {
    return (
      <main className="page-shell">
        <section className="login-card">
          <div className="brand-mark">⭐</div>
          <p className="eyebrow">Family Reward Game</p>
          <h1>สะสมความดี<br />ปลดล็อกตัวโปรด</h1>

          <div className="segmented login-role-tabs">
            <button className={loginRole === "PARENT" ? "active" : ""} onClick={() => setLoginRole("PARENT")}>👨‍👩‍👧 ผู้ปกครอง</button>
            <button className={loginRole === "CHILD" ? "active" : ""} onClick={() => setLoginRole("CHILD")}>🎮 เด็ก</button>
          </div>

          <form className="login-form" onSubmit={productionLogin}>
            {loginRole === "PARENT" ? (
              <>
                <label>
                  Email
                  <input type="email" autoComplete="email" value={parentEmail} onChange={(e) => setParentEmail(e.target.value)} required />
                </label>
                <label>
                  Password
                  <input type="password" autoComplete="current-password" value={parentPassword} onChange={(e) => setParentPassword(e.target.value)} minLength={8} required />
                </label>
              </>
            ) : (
              <>
                <label>
                  Family Code
                  <input value={familyCode} onChange={(e) => setFamilyCode(e.target.value.toUpperCase())} autoCapitalize="characters" required />
                </label>
                <label>
                  ชื่อเด็ก
                  <input value={childName} onChange={(e) => setChildName(e.target.value)} required />
                </label>
                <label>
                  PIN
                  <input type="password" inputMode="numeric" pattern="[0-9]{4,8}" value={childPin} onChange={(e) => setChildPin(e.target.value)} required />
                </label>
              </>
            )}

            <button className="submit-button earn" disabled={busy} type="submit">
              {busy ? "กำลังเข้าสู่ระบบ..." : "เข้าสู่ระบบ"}
            </button>
          </form>

          {message && <p className="feedback global-feedback">{message}</p>}

          {demoLoginEnabled && (
            <div className="demo-login-box">
              <p className="muted">Development Demo</p>
              <div className="login-actions">
                <button className="action action-positive" onClick={() => demoLogin("PARENT")}>Demo ผู้ปกครอง</button>
                <button className="action action-child" onClick={() => demoLogin("CHILD")}>Demo เด็ก</button>
              </div>
            </div>
          )}
        </section>
      </main>
    );
  }

  const isChild = user.role === "CHILD";
  const showHistory = isChild ? childTab === "history" : parentTab === "history";
  const showHome = isChild ? childTab === "home" : parentTab === "home";

  return (
    <>
      <main className="page-shell app-with-nav">
        <header className="topbar">
          <div>
            <p className="eyebrow">{isChild ? "Trainer mode" : "Parent mode"}</p>
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
            <section className="hero-card game-hero">
              <div>
                <p className="eyebrow">คะแนนสะสม</p>
                <h1>{activeChild.display_name}</h1>
                <p className="balance"><span>⭐</span> {activeChild.points_balance.toLocaleString()} คะแนน</p>
              </div>
              <div className="avatar" aria-hidden="true">{isChild ? "🧒🎒" : "🧒"}</div>
            </section>

            {message && <p className="feedback global-feedback">{message}</p>}

            {user.role === "PARENT" && showHome && (
              <section className="panel">
                <div className="section-heading">
                  <div>
                    <p className="eyebrow">Daily points</p>
                    <h2>เพิ่มหรือลดคะแนน</h2>
                  </div>
                </div>
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
                  <button disabled={busy} className={mode === "EARN" ? "submit-button earn" : "submit-button deduct"} type="submit">
                    {busy ? "กำลังบันทึก..." : mode === "EARN" ? "เพิ่ม " + amount + " คะแนน" : "หัก " + amount + " คะแนน"}
                  </button>
                </form>
              </section>
            )}

            {isChild && childTab === "home" && (
              <section className="game-stats">
                <button className="stat-card" onClick={() => setChildTab("collection")}>
                  <span className="stat-icon">🎒</span>
                  <strong>{collection.length}</strong>
                  <small>Collection</small>
                </button>
                <button className="stat-card" onClick={() => setChildTab("shop")}>
                  <span className="stat-icon">🛍️</span>
                  <strong>{shop.filter((item) => !item.owned).length}</strong>
                  <small>รอปลดล็อก</small>
                </button>
                <button className="stat-card" onClick={() => setChildTab("history")}>
                  <span className="stat-icon">🏆</span>
                  <strong>{history.filter((item) => item.points > 0).length}</strong>
                  <small>ความดีล่าสุด</small>
                </button>
              </section>
            )}

            {isChild && childTab === "collection" && (
              <section className="panel">
                <div className="section-heading"><h2>My Collection</h2><span>{collection.length} ตัว</span></div>
                {collection.length === 0 ? <p className="muted">ยังไม่มีตัวละคร ไปเลือกตัวที่ชอบจากร้านกันเลย</p> : (
                  <div className="character-grid">
                    {collection.map((item) => (
                      <article className="character-card owned-card" key={item.child_character_id}>
                        <div className="character-art image-art"><img src={item.image_url} alt={item.name} /></div>
                        <div className="card-row"><h3>{item.name}</h3><span className="rarity">{item.rarity}</span></div>
                        <p>{item.type_primary}{item.type_secondary ? " / " + item.type_secondary : ""}</p>
                        {item.evolution_name && item.evolution_cost ? (
                          <button className="evolve-button" onClick={() => setPendingAction({ kind: "evolve", item })}>
                            ✨ วิวัฒนาการ · ⭐ {item.evolution_cost}
                          </button>
                        ) : <div className="max-stage">MAX STAGE</div>}
                      </article>
                    ))}
                  </div>
                )}
              </section>
            )}

            {isChild && childTab === "shop" && (
              <section className="panel">
                <div className="section-heading"><h2>Character Shop</h2><span>เลือกตัวที่ชอบ</span></div>
                <div className="character-grid">
                  {shop.map((character) => (
                    <article className="character-card" key={character.id}>
                      <div className="character-art image-art"><img src={character.image_url} alt={character.name} /></div>
                      <div className="card-row"><h3>{character.name}</h3><span className="rarity">{character.rarity}</span></div>
                      <div className="type-row">
                        <span className={"element element-" + character.type_primary.toLowerCase()}>{character.type_primary}</span>
                        {character.type_secondary && <span className="element">{character.type_secondary}</span>}
                      </div>
                      <button disabled={Boolean(character.owned) || busy} className="buy-button" onClick={() => setPendingAction({ kind: "purchase", character })}>
                        {character.owned ? "มีแล้ว ✓" : "ซื้อ · ⭐ " + character.price}
                      </button>
                    </article>
                  ))}
                </div>
              </section>
            )}

            {(showHistory || (user.role === "PARENT" && showHome)) && (
              <section className="panel">
                <div className="section-heading"><h2>ประวัติล่าสุด</h2><span>{history.length} รายการ</span></div>
                <div className="timeline">
                  {history.map((item) => (
                    <article className="timeline-item" key={item.id}>
                      <div className="history-main">
                        <strong className={item.points > 0 ? "positive" : "negative"}>{item.points > 0 ? "+" : ""}{item.points}</strong>
                        <div>
                          <p>{item.reason}</p>
                          <small>{item.created_by_name ?? "ระบบ"} · {new Date(item.created_at).toLocaleString("th-TH")}</small>
                        </div>
                      </div>
                      <span className="type-badge">{item.transaction_type}</span>
                    </article>
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </main>

      <nav className="bottom-nav" aria-label="เมนูหลัก">
        {isChild ? (
          <>
            <button className={childTab === "home" ? "active" : ""} onClick={() => setChildTab("home")}><span>🏠</span>Home</button>
            <button className={childTab === "shop" ? "active" : ""} onClick={() => setChildTab("shop")}><span>🛍️</span>Shop</button>
            <button className={childTab === "collection" ? "active" : ""} onClick={() => setChildTab("collection")}><span>🎒</span>Collection</button>
            <button className={childTab === "history" ? "active" : ""} onClick={() => setChildTab("history")}><span>📜</span>History</button>
          </>
        ) : (
          <>
            <button className={parentTab === "home" ? "active" : ""} onClick={() => setParentTab("home")}><span>⭐</span>คะแนน</button>
            <button className={parentTab === "history" ? "active" : ""} onClick={() => setParentTab("history")}><span>📜</span>ประวัติ</button>
          </>
        )}
      </nav>

      <ConfirmDialog
        open={Boolean(pendingAction)}
        title={pendingAction?.kind === "purchase" ? "รับ " + pendingAction.character.name + " เข้าทีม?" : pendingAction?.kind === "evolve" ? "พร้อมวิวัฒนาการ?" : ""}
        description={pendingAction?.kind === "purchase"
          ? "ใช้ ⭐ " + pendingAction.character.price + " คะแนน แล้วตัวละครจะเข้า Collection ทันที"
          : pendingAction?.kind === "evolve"
            ? pendingAction.item.name + " → " + pendingAction.item.evolution_name + " ใช้ ⭐ " + pendingAction.item.evolution_cost + " คะแนน"
            : ""}
        confirmLabel={pendingAction?.kind === "evolve" ? "✨ วิวัฒนาการ" : "🎉 ปลดล็อก"}
        tone={pendingAction?.kind === "evolve" ? "evolve" : "buy"}
        imageUrl={pendingAction?.kind === "purchase" ? pendingAction.character.image_url : pendingAction?.kind === "evolve" ? pendingAction.item.evolution_image_url : null}
        onCancel={() => setPendingAction(null)}
        onConfirm={confirmPendingAction}
      />

      {celebration && (
        <div className="celebration" role="status">
          <div className="celebration-burst">✨</div>
          <strong>{celebration.title}</strong>
          <span>{celebration.detail}</span>
        </div>
      )}
    </>
  );
}
