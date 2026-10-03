import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import ConfirmDialog from "./components/ConfirmDialog";
import ProfileLogin from "./components/ProfileLogin";
import QuestBoard from "./components/QuestBoard";
import GachaBox from "./components/GachaBox";
import Pokedex from "./components/Pokedex";
import { TypeBadges } from "./components/TypeBadge";
import { TYPE_INFO } from "../shared/types";
import StatBlock, { LevelBar } from "./components/StatBlock";
import ArenaParent from "./components/arena/ArenaParent";
import ArenaChild from "./components/arena/ArenaChild";
import { api } from "./lib/api";
import { ProfileAvatar, RELATION_LABEL } from "./components/ProfileLogin";

type User = { id: string; display_name: string; role: "PARENT" | "CHILD" };
type Child = { id: string; family_id?: string; display_name: string; avatar_url?: string | null; points_balance: number };
type FamilyMember = {
  family_id: string; user_id: string; display_name: string; role: "PARENT" | "CHILD";
  relation: "FATHER" | "MOTHER" | "GUARDIAN" | "CHILD"; child_id?: string | null; avatar_url?: string | null; has_pin: number;
};
type Family = { id: string; name: string; family_code: string | null; members?: FamilyMember[] };
type ParentRelation = "FATHER" | "MOTHER" | "GUARDIAN";
type HistoryItem = {
  id: string; transaction_type: string; points: number; reason: string;
  created_at: string; created_by_name?: string | null;
};
type ShopCharacter = {
  id: string; name: string; slug: string; type_primary: string; type_secondary?: string | null;
  image_url: string; price: number; rarity: string; owned: number;
  evolutions?: { id: string; name: string; image_url: string; rarity: string; type_primary: string; type_secondary: string | null; cost: number }[];
};
type CollectionItem = {
  child_character_id: string; character_id: string; name: string; slug: string;
  type_primary: string; type_secondary?: string | null; image_url: string; rarity: string;
  evolution_cost?: number | null; evolution_name?: string | null; evolution_image_url?: string | null;
  level: number; xp: number;
};
type ChildTab = "home" | "shop" | "collection" | "pokedex" | "history" | "arena";
type ParentTab = "home" | "quests" | "arena" | "history" | "family";
type PendingAction =
  | { kind: "purchase"; character: ShopCharacter }
  | { kind: "evolve"; item: CollectionItem }
  | null;

const EARN_REASONS = [
  "ทำการบ้าน", "อ่านหนังสือ", "ช่วยงานบ้าน", "ตื่นตรงเวลา", "เก็บของเล่น", "มีน้ำใจ",
  "แปรงฟันเอง", "อาบน้ำแต่งตัวเอง", "กินข้าวหมด", "เข้านอนตรงเวลา", "ช่วยดูแลน้อง",
  "พูดจาสุภาพ", "ทำตามข้อตกลง", "ออกกำลังกาย", "ฝึกดนตรีหรือกีฬา", "ได้คำชมจากคุณครู",
];
const DEDUCT_REASONS = [
  "เล่นเกมเกินเวลาที่ตกลง", "ไม่เก็บของหลังเล่น", "ไม่ทำการบ้าน", "ตื่นสาย", "ทะเลาะกับพี่น้อง",
  "พูดจาไม่สุภาพ", "ไม่ทำตามข้อตกลง", "โกหก", "ดูจอเกินเวลา", "กินข้าวไม่หมด",
  "เข้านอนเกินเวลา", "ไม่ช่วยงานบ้าน",
];
const OTHER_REASON = "อื่นๆ";
const NEW_FAMILY = "__new";
const AVATAR_SIZE = 256;
const AVATAR_MAX_CHARS = 200 * 1024;

// Center-crops and shrinks a photo so it fits the API's inline avatar limit.
async function resizeAvatar(file: File) {
  const bitmap = await createImageBitmap(file);
  const side = Math.min(bitmap.width, bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = AVATAR_SIZE;
  canvas.height = AVATAR_SIZE;
  canvas.getContext("2d")!.drawImage(
    bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, AVATAR_SIZE, AVATAR_SIZE,
  );
  bitmap.close();
  for (const quality of [0.85, 0.7, 0.5]) {
    const url = canvas.toDataURL("image/jpeg", quality);
    if (url.length <= AVATAR_MAX_CHARS) return url;
  }
  throw new Error("รูปใหญ่เกินไป ลองรูปอื่น");
}
const CUSTOM_AMOUNT_MIN = 10;
const CUSTOM_AMOUNT_MAX = 1000;

const RARITIES = ["COMMON", "RARE", "EPIC", "LEGENDARY"];

type HistoryFilter = { mode: "7" | "30" | "custom"; from: string; to: string };
type HistoryInfo = { range: { from: string; to: string }; summary: { count: number; earned: number; spent: number }; truncated: boolean };
const THAILAND_OFFSET_MS = 7 * 60 * 60 * 1000;
const thaiToday = () => new Date(Date.now() + THAILAND_OFFSET_MS).toISOString().slice(0, 10);
const shiftDay = (day: string, delta: number) => {
  const date = new Date(day + "T00:00:00Z");
  date.setUTCDate(date.getUTCDate() + delta);
  return date.toISOString().slice(0, 10);
};
const dayLabel = (day: string) => new Date(day + "T00:00:00+07:00").toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "2-digit" });
// D1 timestamps are UTC "YYYY-MM-DD HH:MM:SS".
const timestampLabel = (value: string) => new Date(value.replace(" ", "T") + "Z").toLocaleString("th-TH", { dateStyle: "medium", timeStyle: "short" });
function historyQuery(filter: HistoryFilter) {
  if (filter.mode === "custom") return "?from=" + filter.from + "&to=" + filter.to;
  return "?days=" + filter.mode;
}
const customRangeValid = (filter: HistoryFilter) => Boolean(filter.from && filter.to && filter.from <= filter.to);
const hasType = (character: { type_primary: string; type_secondary?: string | null }, type: string) =>
  character.type_primary === type || character.type_secondary === type;

// The forms a shop character evolves into, with the points each step costs.
function EvolutionLine({ character }: { character: ShopCharacter }) {
  const forms = character.evolutions ?? [];
  if (forms.length === 0) return <p className="evo-line none">✨ ร่างเดียว ไม่มีวิวัฒนาการ</p>;
  return (
    <div className="evo-line" aria-label={"วิวัฒนาการเป็น " + forms.map((form) => form.name).join(" แล้วเป็น ")}>
      <small>🔄 วิวัฒนาการได้ {forms.length} ขั้น</small>
      <ol>
        {forms.map((form) => (
          <li key={form.id}>
            <span className="evo-arrow">⬇ <em>ใช้ ⭐{form.cost}</em></span>
            <span className={"evo-form rarity-ring-" + form.rarity.toLowerCase()}>
              <img src={form.image_url} alt="" loading="lazy" />
              <strong>{form.name}</strong>
              <TypeBadges primary={form.type_primary} secondary={form.type_secondary} iconOnly />
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [children, setChildren] = useState<Child[]>([]);
  const [selectedChildId, setSelectedChildId] = useState("");
  const [child, setChild] = useState<Child | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [shop, setShop] = useState<ShopCharacter[]>([]);
  const [historyFilter, setHistoryFilter] = useState<HistoryFilter>({ mode: "7", from: "", to: "" });
  const [historyInfo, setHistoryInfo] = useState<HistoryInfo | null>(null);
  const [historyError, setHistoryError] = useState("");
  // refreshHistory is called from many places; it always uses the latest filter and remembers the child.
  const historyFilterRef = useRef(historyFilter);
  historyFilterRef.current = historyFilter;
  const historyTarget = useRef("");
  const [shopType, setShopType] = useState("");
  const [shopRarity, setShopRarity] = useState("");
  const [collection, setCollection] = useState<CollectionItem[]>([]);
  const [mode, setMode] = useState<"EARN" | "DEDUCT">("EARN");
  const [amount, setAmount] = useState(50);
  const [customAmount, setCustomAmount] = useState("");
  const [reason, setReason] = useState(EARN_REASONS[0]);
  const [customReason, setCustomReason] = useState("");
  const [families, setFamilies] = useState<Family[]>([]);
  const [addFamilyId, setAddFamilyId] = useState(NEW_FAMILY);
  const [newFamilyName, setNewFamilyName] = useState("");
  const [newFamilyCode, setNewFamilyCode] = useState("");
  const [newChildName, setNewChildName] = useState("");
  const [newChildPin, setNewChildPin] = useState("");
  const [familyMessage, setFamilyMessage] = useState("");
  const [myPin, setMyPin] = useState("");
  const [myRelation, setMyRelation] = useState<ParentRelation>("GUARDIAN");
  const [parentFamilyId, setParentFamilyId] = useState("");
  const [parentName, setParentName] = useState("");
  const [parentRelation, setParentRelation] = useState<ParentRelation>("MOTHER");
  const [parentPin, setParentPin] = useState("");
  const [editingFamily, setEditingFamily] = useState<{ id: string; name: string; code: string } | null>(null);
  const [renaming, setRenaming] = useState<{ familyId: string; userId: string; name: string } | null>(null);
  const [message, setMessage] = useState("");
  const [childTab, setChildTab] = useState<ChildTab>("home");
  const [parentTab, setParentTab] = useState<ParentTab>("home");
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [celebration, setCelebration] = useState<{ title: string; detail: string } | null>(null);
  const [pendingQuestCount, setPendingQuestCount] = useState(0);
  const [busy, setBusy] = useState(false);
  const [demoLoginEnabled, setDemoLoginEnabled] = useState(false);

  // Shop filters: element (primary or secondary type) and rarity. Counts on each chip
  // reflect the other filter, so a chip never promises results that aren't there.
  const shopTypes = useMemo(
    () => Object.keys(TYPE_INFO).filter((type) => shop.some((character) => hasType(character, type))),
    [shop],
  );
  const shownShop = useMemo(
    () => shop.filter((character) => (!shopType || hasType(character, shopType)) && (!shopRarity || character.rarity === shopRarity)),
    [shop, shopType, shopRarity],
  );

  const activeChild = useMemo(
    () => (user?.role === "PARENT" ? children.find((c) => c.id === selectedChildId) ?? null : child),
    [children, selectedChildId, child, user],
  );
  const reasonOptions = mode === "EARN" ? EARN_REASONS : DEDUCT_REASONS;
  const isOtherReason = reason === OTHER_REASON;
  // The API requires 2-240 characters after trimming.
  const finalReason = isOtherReason ? (customReason.trim().length >= 2 ? customReason.trim() : "") : reason;
  const parsedCustomAmount = Number(customAmount);
  const isCustomAmount = customAmount !== "";
  const customAmountValid = Number.isInteger(parsedCustomAmount)
    && parsedCustomAmount >= CUSTOM_AMOUNT_MIN && parsedCustomAmount <= CUSTOM_AMOUNT_MAX;
  const finalAmount = isCustomAmount ? (customAmountValid ? parsedCustomAmount : null) : amount;

  function changeMode(next: "EARN" | "DEDUCT") {
    setMode(next);
    setReason((next === "EARN" ? EARN_REASONS : DEDUCT_REASONS)[0]);
    setCustomReason("");
  }

  async function refreshHistory(targetId: string) {
    historyTarget.current = targetId;
    const filter = historyFilterRef.current;
    if (filter.mode === "custom" && !customRangeValid(filter)) return;
    const data = await api<{ history: HistoryItem[] } & HistoryInfo>("/api/children/" + targetId + "/history" + historyQuery(filter));
    if (historyTarget.current !== targetId) return; // switched child meanwhile
    setHistory(data.history);
    setHistoryInfo({ range: data.range, summary: data.summary, truncated: data.truncated });
    setHistoryError("");
  }

  useEffect(() => {
    if (!historyTarget.current) return;
    refreshHistory(historyTarget.current).catch((error) => setHistoryError(error instanceof Error ? error.message : "โหลดประวัติไม่สำเร็จ"));
  }, [historyFilter]);

  function chooseHistoryMode(mode: HistoryFilter["mode"]) {
    if (mode !== "custom") return setHistoryFilter({ ...historyFilter, mode });
    // Start the custom range from what's on screen, so nothing jumps.
    const today = thaiToday();
    setHistoryFilter({ mode, from: historyFilter.from || historyInfo?.range.from || shiftDay(today, -6), to: historyFilter.to || today });
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

  async function refreshPendingQuests() {
    const data = await api<{ pending: unknown[] }>("/api/quests/pending");
    setPendingQuestCount(data.pending.length);
  }

  async function refreshAfterQuest() {
    if (user?.role === "PARENT") {
      const data = await api<{ children: Child[] }>("/api/children");
      setChildren(data.children);
      await Promise.all([refreshPendingQuests(), selectedChildId ? refreshHistory(selectedChildId) : Promise.resolve()]);
    } else {
      await refreshChildGame();
    }
  }

  async function loadDashboard(currentUser: User) {
    if (currentUser.role === "PARENT") {
      const [data, familyData] = await Promise.all([
        api<{ children: Child[] }>("/api/children"),
        api<{ families: Family[] }>("/api/families"),
      ]);
      setChildren(data.children);
      setFamilies(familyData.families);
      if (familyData.families[0]) setAddFamilyId(familyData.families[0].id);
      refreshPendingQuests().catch(() => undefined);
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

  const myMembership = families.flatMap((family) => family.members ?? []).find((member) => member.user_id === user?.id);

  useEffect(() => {
    if (myMembership && myMembership.relation !== "CHILD") setMyRelation(myMembership.relation);
  }, [myMembership?.relation]);

  useEffect(() => {
    if (!celebration) return;
    const timer = window.setTimeout(() => setCelebration(null), 2400);
    return () => window.clearTimeout(timer);
  }, [celebration]);

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
    setHistoryInfo(null);
    setHistoryFilter({ mode: "7", from: "", to: "" });
    historyTarget.current = "";
    setShop([]);
    setCollection([]);
    setMessage("");
    setFamilies([]);
    setFamilyMessage("");
    setParentTab("home");
    setChildTab("home");
  }

  async function refreshFamilies() {
    const [data, familyData] = await Promise.all([
      api<{ children: Child[] }>("/api/children"),
      api<{ families: Family[] }>("/api/families"),
    ]);
    setChildren(data.children);
    setFamilies(familyData.families);
    return familyData.families;
  }

  async function runFamilyAction(action: () => Promise<string>) {
    if (busy) return;
    try {
      setBusy(true);
      setFamilyMessage("");
      setFamilyMessage(await action());
    } catch (error) {
      setFamilyMessage(error instanceof Error ? error.message : "เกิดข้อผิดพลาด");
    } finally {
      setBusy(false);
    }
  }

  function submitMyProfile(event: FormEvent) {
    event.preventDefault();
    runFamilyAction(async () => {
      await api("/api/auth/profile", {
        method: "POST",
        body: JSON.stringify({ relation: myRelation, ...(myPin ? { pin: myPin } : {}) }),
      });
      setMyPin("");
      await refreshFamilies();
      return myPin ? "บันทึก PIN และบทบาทแล้ว ครั้งหน้าแตะรูปของคุณแล้วใส่ PIN ได้เลย" : "บันทึกบทบาทแล้ว";
    }).catch(() => undefined);
  }

  function submitAddParent(event: FormEvent) {
    event.preventDefault();
    runFamilyAction(async () => {
      await api("/api/parents", {
        method: "POST",
        body: JSON.stringify({ familyId: parentFamilyId || families[0]?.id, displayName: parentName, relation: parentRelation, pin: parentPin }),
      });
      const added = parentName;
      setParentName("");
      setParentPin("");
      await refreshFamilies();
      return "เพิ่ม " + added + " แล้ว 🎉 เข้าสู่ระบบโดยแตะรูปแล้วใส่ PIN ที่ตั้งไว้";
    }).catch(() => undefined);
  }

  function submitEditFamily(event: FormEvent) {
    event.preventDefault();
    if (!editingFamily) return;
    const { id, name, code } = editingFamily;
    runFamilyAction(async () => {
      const saved = await api<{ family: Family }>("/api/families/update", {
        method: "POST",
        body: JSON.stringify({ familyId: id, name, familyCode: code }),
      });
      setEditingFamily(null);
      await refreshFamilies();
      return "บันทึกครอบครัว " + saved.family.name + " แล้ว · Family Code ใหม่: " + saved.family.family_code;
    }).catch(() => undefined);
  }

  function submitRename(event: FormEvent) {
    event.preventDefault();
    if (!renaming) return;
    const { familyId, userId, name } = renaming;
    runFamilyAction(async () => {
      await api("/api/members/rename", { method: "POST", body: JSON.stringify({ familyId, userId, displayName: name }) });
      setRenaming(null);
      await refreshFamilies();
      if (userId === user?.id) setUser((current) => (current ? { ...current, display_name: name.trim() } : current));
      return "เปลี่ยนชื่อเป็น " + name.trim() + " แล้ว";
    }).catch(() => undefined);
  }

  function leaveFamily(family: Family) {
    if (!window.confirm("ออกจากครอบครัว " + family.name + "? คุณจะไม่เห็นเด็กในครอบครัวนี้อีก")) return;
    runFamilyAction(async () => {
      await api("/api/families/leave", { method: "POST", body: JSON.stringify({ familyId: family.id }) });
      await refreshFamilies();
      return "ออกจากครอบครัว " + family.name + " แล้ว";
    }).catch(() => undefined);
  }

  function changeAvatar(member: FamilyMember, file: File | undefined) {
    const childId = member.child_id;
    if (!file || !childId) return;
    runFamilyAction(async () => {
      const avatarUrl = await resizeAvatar(file);
      await api("/api/children/avatar", { method: "POST", body: JSON.stringify({ childId, avatarUrl }) });
      await refreshFamilies();
      return "เปลี่ยนรูปของ " + member.display_name + " แล้ว";
    }).catch(() => undefined);
  }

  async function submitAddChild(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    const isNewFamily = addFamilyId === NEW_FAMILY;

    try {
      setBusy(true);
      setFamilyMessage("");
      const created = await api<{ family: Family; child: Child }>("/api/children", {
        method: "POST",
        body: JSON.stringify({
          displayName: newChildName,
          pin: newChildPin,
          ...(isNewFamily
            ? { newFamily: { name: newFamilyName, ...(newFamilyCode.trim() ? { familyCode: newFamilyCode } : {}) } }
            : { familyId: addFamilyId }),
        }),
      });
      await refreshFamilies();
      setAddFamilyId(created.family.id);
      if (!selectedChildId) setSelectedChildId(created.child.id);
      setNewChildName("");
      setNewChildPin("");
      setNewFamilyName("");
      setNewFamilyCode("");
      setFamilyMessage(
        "เพิ่ม " + created.child.display_name + " แล้ว 🎉 ใส่ Family Code "
          + (created.family.family_code ?? "-") + " แล้วแตะรูป " + created.child.display_name + " และใส่ PIN ที่ตั้งไว้",
      );
    } catch (error) {
      setFamilyMessage(error instanceof Error ? error.message : "เกิดข้อผิดพลาด");
    } finally {
      setBusy(false);
    }
  }

  async function submitPoints(event: FormEvent) {
    event.preventDefault();
    if (!activeChild || busy || !finalReason || finalAmount === null) return;

    try {
      setBusy(true);
      setMessage("");
      await api("/api/points", {
        method: "POST",
        body: JSON.stringify({ childId: activeChild.id, amount: finalAmount, reason: finalReason, type: mode }),
      });
      setCustomReason("");
      setCustomAmount("");
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
      <ProfileLogin
        demoLoginEnabled={demoLoginEnabled}
        onLoggedIn={async (loggedIn) => {
          setUser(loggedIn);
          await loadDashboard(loggedIn);
        }}
        onDemoLogin={demoLogin}
      />
    );
  }

  const isChild = user.role === "CHILD";
  const showHistory = isChild ? childTab === "history" : parentTab === "history";
  const showHome = isChild ? childTab === "home" : parentTab === "home";
  const showFamily = !isChild && parentTab === "family";
  const showArena = !isChild && parentTab === "arena";

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

        {user.role === "PARENT" && !showFamily && !showArena && children.length > 1 && (
          <label className="child-picker">
            เด็ก
            <select value={selectedChildId} onChange={(e) => setSelectedChildId(e.target.value)}>
              {children.map((item) => <option key={item.id} value={item.id}>{item.display_name}</option>)}
            </select>
          </label>
        )}

        {user.role === "PARENT" && !showFamily && children.length === 0 && (
          <section className="panel">
            <p className="muted">ยังไม่มีเด็กในครอบครัว ไปที่แท็บ "ครอบครัว" เพื่อเพิ่มเด็กได้เลย</p>
          </section>
        )}

        {showFamily && (
          <>
            {familyMessage && <p className="feedback global-feedback">{familyMessage}</p>}

            <section className="panel">
              <div className="section-heading"><h2>ครอบครัว</h2><span>{families.length} ครอบครัว</span></div>
              {families.length === 0 ? <p className="muted">ยังไม่มีครอบครัว</p> : (
                <div className="family-list">
                  {families.map((family) => (
                    <article className="family-card" key={family.id}>
                      <div className="card-row">
                        <h3>{family.name}</h3>
                        <span className="family-code">{family.family_code ?? "ไม่มี Family Code"}</span>
                      </div>
                      {editingFamily?.id === family.id ? (
                        <form className="point-form family-edit" onSubmit={submitEditFamily}>
                          <label>
                            ชื่อครอบครัว
                            <input className="reason-input" value={editingFamily.name} onChange={(e) => setEditingFamily({ ...editingFamily, name: e.target.value })} minLength={2} maxLength={100} required />
                          </label>
                          <label>
                            Family Code (ใช้ตอนเข้าสู่ระบบ)
                            <input className="reason-input" value={editingFamily.code} onChange={(e) => setEditingFamily({ ...editingFamily, code: e.target.value.toUpperCase() })} autoCapitalize="characters" minLength={4} maxLength={20} required />
                          </label>
                          <small className="muted">เปลี่ยน Family Code แล้ว ทุกคนในครอบครัวต้องใช้รหัสใหม่ตอนเข้าสู่ระบบครั้งถัดไป</small>
                          <div className="family-edit-actions">
                            <button disabled={busy} className="submit-button earn" type="submit">บันทึก</button>
                            <button type="button" className="link-button" onClick={() => setEditingFamily(null)}>ยกเลิก</button>
                          </div>
                        </form>
                      ) : (
                        <button className="link-button" onClick={() => setEditingFamily({ id: family.id, name: family.name, code: family.family_code ?? "" })}>✏️ แก้ชื่อ / Family Code</button>
                      )}
                      <div className="member-list">
                        {(family.members ?? []).map((member) => (
                          <div className="member-row" key={member.user_id}>
                            <ProfileAvatar profile={member} size="small" />
                            {renaming?.userId === member.user_id && renaming.familyId === family.id ? (
                              <form className="member-rename" onSubmit={submitRename}>
                                <input className="reason-input" value={renaming.name} onChange={(e) => setRenaming({ ...renaming, name: e.target.value })} maxLength={80} required autoFocus />
                                <button disabled={busy} className="quest-button" type="submit">บันทึก</button>
                                <button type="button" className="link-button" onClick={() => setRenaming(null)}>ยกเลิก</button>
                              </form>
                            ) : (
                              <div>
                                <strong>{member.display_name}{member.user_id === user.id ? " (คุณ)" : ""}</strong>
                                <small>
                                  {RELATION_LABEL[member.relation]}{member.has_pin ? "" : " · ยังไม่ได้ตั้ง PIN"}
                                  {" · "}
                                  <button className="link-button inline" onClick={() => setRenaming({ familyId: family.id, userId: member.user_id, name: member.display_name })}>เปลี่ยนชื่อ</button>
                                </small>
                              </div>
                            )}
                            {member.child_id && (
                              <label className="avatar-upload">
                                เปลี่ยนรูป
                                <input
                                  type="file"
                                  accept="image/jpeg,image/png,image/webp"
                                  disabled={busy}
                                  onChange={(e) => { changeAvatar(member, e.target.files?.[0]); e.target.value = ""; }}
                                />
                              </label>
                            )}
                          </div>
                        ))}
                      </div>
                      {(family.members ?? []).filter((member) => member.relation !== "CHILD").length > 1 && (
                        <button className="link-button family-leave" onClick={() => leaveFamily(family)}>ออกจากครอบครัวนี้</button>
                      )}
                    </article>
                  ))}
                </div>
              )}
            </section>

            <section className="panel">
              <div className="section-heading"><h2>โปรไฟล์ของฉัน</h2><span>ใช้ตอนแตะรูปเพื่อเข้าสู่ระบบ</span></div>
              <form className="point-form" onSubmit={submitMyProfile}>
                <label>
                  ฉันเป็น
                  <select value={myRelation} onChange={(e) => setMyRelation(e.target.value as ParentRelation)}>
                    <option value="FATHER">พ่อ</option>
                    <option value="MOTHER">แม่</option>
                    <option value="GUARDIAN">ผู้ปกครอง</option>
                  </select>
                </label>
                <label>
                  {myMembership?.has_pin ? "เปลี่ยน PIN (เว้นว่างถ้าไม่เปลี่ยน)" : "ตั้ง PIN (ตัวเลข 4-8 หลัก)"}
                  <input className="reason-input" type="password" inputMode="numeric" pattern="[0-9]{4,8}" value={myPin} onChange={(e) => setMyPin(e.target.value)} required={!myMembership?.has_pin} />
                </label>
                <button disabled={busy} className="submit-button earn" type="submit">{busy ? "กำลังบันทึก..." : "บันทึก"}</button>
              </form>
            </section>

            {families.length > 0 && (
              <section className="panel">
                <div className="section-heading"><h2>เพิ่มผู้ปกครอง</h2><span>เช่น แม่ หรือ พ่อ</span></div>
                <form className="point-form" onSubmit={submitAddParent}>
                  {families.length > 1 && (
                    <label>
                      ครอบครัว
                      <select value={parentFamilyId || families[0].id} onChange={(e) => setParentFamilyId(e.target.value)}>
                        {families.map((family) => <option key={family.id} value={family.id}>{family.name}</option>)}
                      </select>
                    </label>
                  )}
                  <label>
                    ชื่อ
                    <input className="reason-input" value={parentName} onChange={(e) => setParentName(e.target.value)} maxLength={80} required />
                  </label>
                  <label>
                    เป็น
                    <select value={parentRelation} onChange={(e) => setParentRelation(e.target.value as ParentRelation)}>
                      <option value="MOTHER">แม่</option>
                      <option value="FATHER">พ่อ</option>
                      <option value="GUARDIAN">ผู้ปกครอง</option>
                    </select>
                  </label>
                  <label>
                    PIN (ตัวเลข 4-8 หลัก)
                    <input className="reason-input" type="password" inputMode="numeric" pattern="[0-9]{4,8}" value={parentPin} onChange={(e) => setParentPin(e.target.value)} required />
                  </label>
                  <button disabled={busy} className="submit-button earn" type="submit">{busy ? "กำลังบันทึก..." : "เพิ่มผู้ปกครอง"}</button>
                </form>
              </section>
            )}

            <section className="panel">
              <div className="section-heading"><h2>เพิ่มเด็ก</h2><span>ตั้งชื่อและ PIN สำหรับเข้าสู่ระบบ</span></div>
              <form className="point-form" onSubmit={submitAddChild}>
                <label>
                  ครอบครัว
                  <select value={addFamilyId} onChange={(e) => setAddFamilyId(e.target.value)}>
                    {families.map((family) => <option key={family.id} value={family.id}>{family.name}</option>)}
                    <option value={NEW_FAMILY}>＋ สร้างครอบครัวใหม่</option>
                  </select>
                </label>
                {addFamilyId === NEW_FAMILY && (
                  <>
                    <label>
                      ชื่อครอบครัว
                      <input className="reason-input" value={newFamilyName} onChange={(e) => setNewFamilyName(e.target.value)} minLength={2} maxLength={100} required />
                    </label>
                    <label>
                      Family Code (ไม่ใส่ก็ได้ ระบบจะสุ่มให้)
                      <input className="reason-input" value={newFamilyCode} onChange={(e) => setNewFamilyCode(e.target.value.toUpperCase())} autoCapitalize="characters" minLength={4} maxLength={20} />
                    </label>
                  </>
                )}
                <label>
                  ชื่อเด็ก
                  <input className="reason-input" value={newChildName} onChange={(e) => setNewChildName(e.target.value)} maxLength={80} required />
                </label>
                <label>
                  PIN (ตัวเลข 4-8 หลัก)
                  <input className="reason-input" type="password" inputMode="numeric" pattern="[0-9]{4,8}" value={newChildPin} onChange={(e) => setNewChildPin(e.target.value)} required />
                </label>
                <button disabled={busy} className="submit-button earn" type="submit">{busy ? "กำลังบันทึก..." : "เพิ่มเด็ก"}</button>
              </form>
            </section>
          </>
        )}

        {showArena && <ArenaParent kids={children} />}

        {activeChild && !showFamily && !showArena && (
          <>
            <section className="hero-card game-hero">
              <div>
                <p className="eyebrow">คะแนนสะสม</p>
                <h1>{activeChild.display_name}</h1>
                <p className="balance"><span>⭐</span> {activeChild.points_balance.toLocaleString()} คะแนน</p>
              </div>
              <div className="avatar" aria-hidden="true">{activeChild.avatar_url ? <img src={activeChild.avatar_url} alt="" /> : isChild ? "🧒🎒" : "🧒"}</div>
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
                  <button className={mode === "EARN" ? "active" : ""} onClick={() => changeMode("EARN")}>＋ ให้คะแนน</button>
                  <button className={mode === "DEDUCT" ? "active danger" : ""} onClick={() => changeMode("DEDUCT")}>－ หักคะแนน</button>
                </div>

                <form className="point-form" onSubmit={submitPoints}>
                  <div className="quick-grid">
                    {[10, 20, 50, 100].map((value) => (
                      <button
                        type="button"
                        className={!isCustomAmount && amount === value ? "quick selected" : "quick"}
                        key={value}
                        onClick={() => { setAmount(value); setCustomAmount(""); }}
                      >
                        {mode === "EARN" ? "+" : "-"}{value}
                      </button>
                    ))}
                  </div>
                  <label>
                    หรือพิมพ์จำนวนเอง ({CUSTOM_AMOUNT_MIN}-{CUSTOM_AMOUNT_MAX})
                    <input
                      className={isCustomAmount && !customAmountValid ? "reason-input invalid" : "reason-input"}
                      type="number"
                      inputMode="numeric"
                      min={CUSTOM_AMOUNT_MIN}
                      max={CUSTOM_AMOUNT_MAX}
                      step={1}
                      value={customAmount}
                      onChange={(e) => setCustomAmount(e.target.value)}
                      placeholder={"เช่น " + (mode === "EARN" ? "250" : "30")}
                    />
                    {isCustomAmount && !customAmountValid && (
                      <small className="field-error">ใส่จำนวนเต็มระหว่าง {CUSTOM_AMOUNT_MIN} ถึง {CUSTOM_AMOUNT_MAX}</small>
                    )}
                  </label>
                  <label>
                    {mode === "EARN" ? "เหตุผลที่ให้คะแนน" : "เหตุผลที่หักคะแนน"}
                    <select value={reason} onChange={(e) => setReason(e.target.value)}>
                      {reasonOptions.map((option) => <option key={option}>{option}</option>)}
                      <option value={OTHER_REASON}>อื่นๆ (ระบุเอง)</option>
                    </select>
                  </label>
                  {isOtherReason && (
                    <label>
                      ระบุเหตุผล
                      <input
                        className="reason-input"
                        value={customReason}
                        onChange={(e) => setCustomReason(e.target.value)}
                        placeholder={mode === "EARN" ? "เช่น ช่วยคุณยายยกของ" : "เช่น ออกไปเล่นโดยไม่บอก"}
                        maxLength={240}
                        autoFocus
                      />
                    </label>
                  )}
                  <button disabled={busy || !finalReason || finalAmount === null} className={mode === "EARN" ? "submit-button earn" : "submit-button deduct"} type="submit">
                    {busy ? "กำลังบันทึก..." : finalAmount === null ? "ใส่จำนวนคะแนนให้ถูกต้อง" : mode === "EARN" ? "เพิ่ม " + finalAmount + " คะแนน" : "หัก " + finalAmount + " คะแนน"}
                  </button>
                </form>
              </section>
            )}

            {user.role === "PARENT" && parentTab === "quests" && (
              <QuestBoard
                role="PARENT"
                childId={activeChild.id}
                childName={activeChild.display_name}
                onChanged={refreshAfterQuest}
                onCelebrate={(title, detail) => setCelebration({ title, detail })}
              />
            )}

            {isChild && childTab === "home" && (
              <QuestBoard
                role="CHILD"
                childId={activeChild.id}
                childName={activeChild.display_name}
                onChanged={refreshAfterQuest}
                onCelebrate={(title, detail) => setCelebration({ title, detail })}
              />
            )}

            {isChild && childTab === "home" && (
              <button className="arena-banner" onClick={() => setChildTab("arena")}>
                <span aria-hidden="true">⚔️</span>
                <div><strong>Arena</strong><small>ใส่รหัสห้องแล้วท้าสู้พ่อแม่!</small></div>
                <span aria-hidden="true">›</span>
              </button>
            )}

            {isChild && childTab === "arena" && (
              <ArenaChild collection={collection} onBack={() => setChildTab("home")} onFinished={refreshChildGame} />
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
                        <div className="character-art image-art"><img src={item.image_url} alt={item.name} loading="lazy" /></div>
                        <div className="card-row"><h3>{item.name}</h3><span className={"rarity rarity-" + item.rarity.toLowerCase()}>{item.rarity}</span></div>
                        <div className="type-row"><TypeBadges primary={item.type_primary} secondary={item.type_secondary} /></div>
                        <LevelBar level={item.level} xp={item.xp} />
                        <StatBlock monster={item} />
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

            {isChild && childTab === "pokedex" && (
              <Pokedex onChanged={refreshChildGame} onCelebrate={(title, detail) => setCelebration({ title, detail })} />
            )}

            {isChild && childTab === "shop" && (
              <GachaBox balance={activeChild.points_balance} onChanged={refreshChildGame} />
            )}

            {isChild && childTab === "shop" && (
              <section className="panel">
                <div className="section-heading"><h2>Character Shop</h2><span>{shownShop.length === shop.length ? shop.length + " ตัว" : shownShop.length + " จาก " + shop.length + " ตัว"}</span></div>
                <div className="shop-filters">
                  <div className="shop-filter-row" role="group" aria-label="กรองตามระดับ">
                    <button className={shopRarity === "" ? "active" : ""} onClick={() => setShopRarity("")}>ทุกระดับ</button>
                    {RARITIES.map((rarity) => (
                      <button key={rarity} className={"rarity-chip chip-" + rarity.toLowerCase() + (shopRarity === rarity ? " active" : "")} onClick={() => setShopRarity(shopRarity === rarity ? "" : rarity)}>
                        {rarity} <small>{shop.filter((character) => character.rarity === rarity && (!shopType || hasType(character, shopType))).length}</small>
                      </button>
                    ))}
                  </div>
                  <div className="shop-filter-row types" role="group" aria-label="กรองตามธาตุ">
                    <button className={shopType === "" ? "active" : ""} onClick={() => setShopType("")}>ทุกธาตุ</button>
                    {shopTypes.map((type) => (
                      <button
                        key={type}
                        className={shopType === type ? "active" : ""}
                        onClick={() => setShopType(shopType === type ? "" : type)}
                        // Keep the selected element in view in the sideways-scrolling row.
                        ref={shopType === type ? (el) => { if (el?.parentElement) el.parentElement.scrollLeft = el.offsetLeft - el.parentElement.offsetLeft - 8; } : undefined}
                      >
                        {TYPE_INFO[type].icon} {TYPE_INFO[type].th} <small>{shop.filter((character) => hasType(character, type) && (!shopRarity || character.rarity === shopRarity)).length}</small>
                      </button>
                    ))}
                  </div>
                </div>
                {shownShop.length === 0 && (
                  <p className="muted shop-empty">
                    ไม่มีตัวละครที่ตรงกับตัวกรอง <button className="link-button inline" onClick={() => { setShopType(""); setShopRarity(""); }}>ล้างตัวกรอง</button>
                  </p>
                )}
                <div className="character-grid">
                  {shownShop.map((character) => (
                    <article className="character-card" key={character.id}>
                      <div className="character-art image-art"><img src={character.image_url} alt={character.name} loading="lazy" /></div>
                      <div className="card-row"><h3>{character.name}</h3><span className={"rarity rarity-" + character.rarity.toLowerCase()}>{character.rarity}</span></div>
                      <div className="type-row">
                        <TypeBadges primary={character.type_primary} secondary={character.type_secondary} />
                      </div>
                      <EvolutionLine character={character} />
                      <StatBlock monster={character} showMatchups={false} />
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
                <div className="section-heading"><h2>ประวัติคะแนน</h2><span>{historyInfo?.summary.count ?? history.length} รายการ</span></div>
                <div className="history-filter">
                  <div className="segmented three" role="group" aria-label="ช่วงเวลา">
                    <button className={historyFilter.mode === "7" ? "active" : ""} onClick={() => chooseHistoryMode("7")}>7 วัน</button>
                    <button className={historyFilter.mode === "30" ? "active" : ""} onClick={() => chooseHistoryMode("30")}>30 วัน</button>
                    <button className={historyFilter.mode === "custom" ? "active" : ""} onClick={() => chooseHistoryMode("custom")}>📅 เลือกช่วงวัน</button>
                  </div>
                  {historyFilter.mode === "custom" && (
                    <div className="history-dates">
                      <label>
                        ตั้งแต่
                        <input type="date" value={historyFilter.from} max={historyFilter.to || thaiToday()} onChange={(e) => setHistoryFilter({ ...historyFilter, from: e.target.value })} />
                      </label>
                      <label>
                        ถึง
                        <input type="date" value={historyFilter.to} min={historyFilter.from} max={thaiToday()} onChange={(e) => setHistoryFilter({ ...historyFilter, to: e.target.value })} />
                      </label>
                    </div>
                  )}
                  {historyFilter.mode === "custom" && !customRangeValid(historyFilter) && <p className="feedback">วันเริ่มต้องไม่เกินวันสุดท้าย</p>}
                  {historyError && <p className="feedback">{historyError}</p>}
                  {historyInfo && (
                    <div className="history-summary">
                      <span>📅 {historyInfo.range.from === historyInfo.range.to ? dayLabel(historyInfo.range.from) : dayLabel(historyInfo.range.from) + " – " + dayLabel(historyInfo.range.to)}</span>
                      <span className="positive">ได้ +{historyInfo.summary.earned}</span>
                      <span className="negative">ใช้ −{historyInfo.summary.spent}</span>
                    </div>
                  )}
                </div>
                {history.length === 0 && historyInfo && <p className="muted history-empty">ไม่มีรายการในช่วงนี้</p>}
                <div className="timeline">
                  {history.map((item) => (
                    <article className="timeline-item" key={item.id}>
                      <div className="history-main">
                        <strong className={item.points > 0 ? "positive" : "negative"}>{item.points > 0 ? "+" : ""}{item.points}</strong>
                        <div>
                          <p>{item.reason}</p>
                          <small>{item.created_by_name ?? "ระบบ"} · {timestampLabel(item.created_at)}</small>
                        </div>
                      </div>
                      <span className="type-badge">{item.transaction_type}</span>
                    </article>
                  ))}
                </div>
                {historyInfo?.truncated && <p className="muted history-empty">แสดง {history.length} รายการล่าสุด ลองเลือกช่วงวันให้สั้นลงเพื่อดูส่วนที่เหลือ</p>}
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
            <button className={childTab === "pokedex" ? "active" : ""} onClick={() => setChildTab("pokedex")}><span>📖</span>สมุดสะสม</button>
            <button className={childTab === "history" ? "active" : ""} onClick={() => setChildTab("history")}><span>📜</span>History</button>
          </>
        ) : (
          <>
            <button className={parentTab === "home" ? "active" : ""} onClick={() => setParentTab("home")}><span>⭐</span>คะแนน</button>
            <button className={parentTab === "quests" ? "active" : ""} onClick={() => setParentTab("quests")}>
              <span>🎯</span>ภารกิจ
              {pendingQuestCount > 0 && <em className="nav-badge" aria-label={pendingQuestCount + " รายการรอยืนยัน"}>{pendingQuestCount}</em>}
            </button>
            <button className={parentTab === "arena" ? "active" : ""} onClick={() => setParentTab("arena")}><span>⚔️</span>Arena</button>
            <button className={parentTab === "history" ? "active" : ""} onClick={() => setParentTab("history")}><span>📜</span>ประวัติ</button>
            <button className={parentTab === "family" ? "active" : ""} onClick={() => setParentTab("family")}><span>👨‍👩‍👧</span>ครอบครัว</button>
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
