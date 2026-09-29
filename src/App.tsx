const recent = [
  { points: 100, reason: "ทำการบ้านเสร็จเอง", actor: "พ่อ" },
  { points: 50, reason: "ช่วยเก็บจาน", actor: "แม่" },
  { points: -30, reason: "เล่นเกมเกินเวลาที่ตกลง", actor: "แม่" },
];

export default function App() {
  return (
    <main className="page-shell">
      <section className="hero-card">
        <div>
          <p className="eyebrow">Family Reward Game</p>
          <h1>น้อง Demo</h1>
          <p className="balance">⭐ 2,000 คะแนน</p>
        </div>
        <div className="avatar" aria-hidden="true">🧒</div>
      </section>

      <section className="action-grid">
        <button className="action action-positive">＋ ให้คะแนน</button>
        <button className="action action-negative">－ หักคะแนน</button>
      </section>

      <section className="panel">
        <div className="section-heading">
          <h2>กิจกรรมล่าสุด</h2>
          <button className="link-button">ดูทั้งหมด</button>
        </div>
        <div className="timeline">
          {recent.map((item, index) => (
            <article className="timeline-item" key={index}>
              <div>
                <strong className={item.points > 0 ? "positive" : "negative"}>
                  {item.points > 0 ? "+" : ""}{item.points}
                </strong>
                <p>{item.reason}</p>
              </div>
              <span>{item.actor}</span>
            </article>
          ))}
        </div>
      </section>

      <section className="panel">
        <div className="section-heading">
          <h2>ร้านตัวละคร</h2>
          <span>Prototype</span>
        </div>
        <div className="character-grid">
          {[
            ["⚡", "Pikachu", "Electric", 500],
            ["🔥", "Charmander", "Fire", 400],
            ["💧", "Squirtle", "Water", 400],
          ].map(([icon, name, type, price]) => (
            <article className="character-card" key={String(name)}>
              <div className="character-art">{icon}</div>
              <h3>{name}</h3>
              <p>{type}</p>
              <button>⭐ {price} คะแนน</button>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
