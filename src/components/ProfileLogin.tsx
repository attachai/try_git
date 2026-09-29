import { FormEvent, useEffect, useState } from "react";
import { api } from "../lib/api";

type User = { id: string; display_name: string; role: "PARENT" | "CHILD" };
type Profile = {
  id: string;
  display_name: string;
  role: "PARENT" | "CHILD";
  relation: "FATHER" | "MOTHER" | "GUARDIAN" | "CHILD";
  avatar_url?: string | null;
  has_pin: number;
};
type FamilyInfo = { name: string; family_code: string };
type Step = "code" | "profiles" | "pin" | "email";

const FAMILY_CODE_KEY = "frg.familyCode";
const PIN_MAX = 8;
const PIN_MIN = 4;

export const RELATION_ICON: Record<Profile["relation"], string> = {
  FATHER: "👨", MOTHER: "👩", GUARDIAN: "🧑", CHILD: "🧒",
};
export const RELATION_LABEL: Record<Profile["relation"], string> = {
  FATHER: "พ่อ", MOTHER: "แม่", GUARDIAN: "ผู้ปกครอง", CHILD: "ลูก",
};

function readRememberedCode() {
  try { return localStorage.getItem(FAMILY_CODE_KEY) ?? ""; } catch { return ""; }
}

function rememberCode(code: string | null) {
  try {
    if (code) localStorage.setItem(FAMILY_CODE_KEY, code);
    else localStorage.removeItem(FAMILY_CODE_KEY);
  } catch { /* storage unavailable: the code is simply asked again next time */ }
}

export function ProfileAvatar({ profile, size = "large" }: { profile: Pick<Profile, "relation" | "avatar_url" | "display_name">; size?: "large" | "small" }) {
  return (
    <span className={"profile-avatar " + size} aria-hidden="true">
      {profile.avatar_url ? <img src={profile.avatar_url} alt="" /> : RELATION_ICON[profile.relation]}
    </span>
  );
}

type Props = {
  demoLoginEnabled: boolean;
  onLoggedIn: (user: User) => Promise<void>;
  onDemoLogin: (role: "PARENT" | "CHILD") => Promise<void>;
};

export default function ProfileLogin({ demoLoginEnabled, onLoggedIn, onDemoLogin }: Props) {
  const [step, setStep] = useState<Step>("code");
  const [familyCode, setFamilyCode] = useState(readRememberedCode);
  const [family, setFamily] = useState<FamilyInfo | null>(null);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [selected, setSelected] = useState<Profile | null>(null);
  const [pin, setPin] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function lookupFamily(code: string) {
    setBusy(true);
    setMessage("");
    try {
      const data = await api<{ family: FamilyInfo; profiles: Profile[] }>("/api/auth/family", {
        method: "POST",
        body: JSON.stringify({ familyCode: code }),
      });
      setFamily(data.family);
      setProfiles(data.profiles);
      rememberCode(data.family.family_code);
      setStep("profiles");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "ไม่พบครอบครัว");
      setStep("code");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    const remembered = readRememberedCode();
    if (remembered) lookupFamily(remembered).catch(() => undefined);
  }, []);

  function chooseProfile(profile: Profile) {
    setMessage("");
    setPin("");
    setSelected(profile);
    setStep("pin");
  }

  function changeFamily() {
    rememberCode(null);
    setFamily(null);
    setProfiles([]);
    setFamilyCode("");
    setMessage("");
    setStep("code");
  }

  async function submitPin(value = pin) {
    if (!selected || !family || busy || value.length < PIN_MIN) return;
    setBusy(true);
    setMessage("");
    try {
      const data = await api<{ user: User }>("/api/auth/login/profile", {
        method: "POST",
        body: JSON.stringify({ familyCode: family.family_code, userId: selected.id, pin: value }),
      });
      await onLoggedIn(data.user);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "PIN ไม่ถูกต้อง");
      setPin("");
    } finally {
      setBusy(false);
    }
  }

  async function submitEmail(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setMessage("");
    try {
      const data = await api<{ user: User }>("/api/auth/login/parent", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      await onLoggedIn(data.user);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "เข้าสู่ระบบไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }

  function pressKey(key: string) {
    setMessage("");
    if (key === "back") setPin((value) => value.slice(0, -1));
    else setPin((value) => (value.length >= PIN_MAX ? value : value + key));
  }

  useEffect(() => {
    if (step !== "pin") return;
    function onKeyDown(event: KeyboardEvent) {
      if (/^\d$/.test(event.key)) pressKey(event.key);
      else if (event.key === "Backspace") pressKey("back");
      else if (event.key === "Enter") submitPin().catch(() => undefined);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  const needsPinSetup = selected?.has_pin === 0;

  return (
    <main className="page-shell">
      <section className="login-card">
        <div className="brand-mark">⭐</div>
        <p className="eyebrow">Family Reward Game</p>

        {step === "code" && (
          <>
            <h1>สะสมความดี<br />ปลดล็อกตัวโปรด</h1>
            <form className="login-form" onSubmit={(event) => { event.preventDefault(); lookupFamily(familyCode).catch(() => undefined); }}>
              <label>
                Family Code ของครอบครัว
                <input
                  className="family-code-input"
                  value={familyCode}
                  onChange={(e) => setFamilyCode(e.target.value.toUpperCase())}
                  autoCapitalize="characters"
                  autoComplete="off"
                  minLength={4}
                  maxLength={20}
                  placeholder="เช่น ULTRA"
                  required
                />
              </label>
              <button className="submit-button earn" disabled={busy} type="submit">{busy ? "กำลังค้นหา..." : "ถัดไป"}</button>
            </form>
            <button className="link-button login-alt" onClick={() => { setMessage(""); setStep("email"); }}>ผู้ปกครองเข้าด้วยอีเมล</button>
          </>
        )}

        {step === "profiles" && family && (
          <>
            <h1>ใครกำลังใช้งาน?</h1>
            <p className="muted">ครอบครัว {family.name}</p>
            <div className="profile-grid">
              {profiles.map((profile) => (
                <button className="profile-tile" key={profile.id} onClick={() => chooseProfile(profile)}>
                  <ProfileAvatar profile={profile} />
                  <strong>{profile.display_name}</strong>
                  <span>{RELATION_LABEL[profile.relation]}</span>
                </button>
              ))}
            </div>
            <button className="link-button login-alt" onClick={changeFamily}>เปลี่ยนครอบครัว</button>
          </>
        )}

        {step === "pin" && selected && (
          <>
            <div className="pin-header">
              <ProfileAvatar profile={selected} />
              <h1>{selected.display_name}</h1>
            </div>
            {needsPinSetup ? (
              <>
                <p className="feedback">ยังไม่ได้ตั้ง PIN สำหรับ {selected.display_name} ให้เข้าด้วยอีเมลก่อน แล้วตั้ง PIN ในแท็บ "ครอบครัว"</p>
                <button className="submit-button earn" onClick={() => setStep("email")}>เข้าด้วยอีเมล</button>
              </>
            ) : (
              <>
                <p className="muted">ใส่ PIN</p>
                <div className="pin-dots" aria-label={"ใส่แล้ว " + pin.length + " หลัก"}>
                  {Array.from({ length: Math.max(PIN_MIN, pin.length) }, (_, i) => (
                    <span key={i} className={i < pin.length ? "filled" : ""} />
                  ))}
                </div>
                <div className="pin-pad">
                  {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((key) => (
                    <button key={key} disabled={busy} onClick={() => pressKey(key)}>{key}</button>
                  ))}
                  <button disabled={busy || !pin} onClick={() => pressKey("back")} aria-label="ลบ">⌫</button>
                  <button disabled={busy} onClick={() => pressKey("0")}>0</button>
                  <button className="pin-ok" disabled={busy || pin.length < PIN_MIN} onClick={() => submitPin()} aria-label="ตกลง">
                    {busy ? "…" : "✓"}
                  </button>
                </div>
              </>
            )}
            <button className="link-button login-alt" onClick={() => { setMessage(""); setStep("profiles"); }}>← เลือกคนอื่น</button>
          </>
        )}

        {step === "email" && (
          <>
            <h1>ผู้ปกครองเข้าด้วยอีเมล</h1>
            <form className="login-form" onSubmit={submitEmail}>
              <label>
                Email
                <input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
              </label>
              <label>
                Password
                <input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} minLength={8} required />
              </label>
              <button className="submit-button earn" disabled={busy} type="submit">{busy ? "กำลังเข้าสู่ระบบ..." : "เข้าสู่ระบบ"}</button>
            </form>
            <button className="link-button login-alt" onClick={() => { setMessage(""); setStep(family ? "profiles" : "code"); }}>← กลับ</button>
          </>
        )}

        {message && <p className="feedback global-feedback">{message}</p>}

        {demoLoginEnabled && step === "code" && (
          <div className="demo-login-box">
            <p className="muted">Development Demo</p>
            <div className="login-actions">
              <button className="action action-positive" onClick={() => onDemoLogin("PARENT")}>Demo ผู้ปกครอง</button>
              <button className="action action-child" onClick={() => onDemoLogin("CHILD")}>Demo เด็ก</button>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
