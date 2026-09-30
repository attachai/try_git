# Arena

Turn-based battles between a child and a parent. The rules live in `shared/` and are used by both the UI and the Worker. The Worker is authoritative: it rolls every random number and computes every hit.

- `shared/battle.ts`: stats, levels, type chart, base damage
- `shared/arena.ts`: battle engine (pure, random source injected), specials, statuses, AI
- `worker/routes/arena.ts`: rooms, joining, team pick, actions, rewards
- `src/components/arena/`: parent lobby, child join/pick, battle view, polling hook

## Stats

Derived from rarity and an archetype picked by primary type, so every character, including new ones, is balanced without hand-tuning.

Base (neutral): HP 100, ATK 20, DEF 10, evade 8%, crit 10%.

| Archetype | Primary types | HP | ATK | DEF | Evade | Crit |
|---|---|---|---|---|---|---|
| 🛡️ tank | Rock, Ground, Steel | ×1.2 | ×0.9 | ×1.5 | 4% | 6% |
| ⚔️ striker | Fire, Fighting, Dragon | ×1.0 | ×1.25 | ×0.8 | 6% | 12% |
| 💨 agile | Electric, Flying, Bug | ×0.85 | ×1.05 | ×0.8 | 16% | 14% |
| 🎯 crit | Psychic, Ghost, Dark | ×0.9 | ×1.1 | ×0.9 | 10% | 20% |
| ⚖️ balanced | everything else | ×1.05 | ×1.0 | ×1.0 | 8% | 10% |

Rarity scales HP/ATK/DEF and adds flat points to evade and crit: COMMON ×1.0/+0, RARE ×1.15/+1, EPIC ×1.3/+2, LEGENDARY ×1.45/+3.

## Type chart

This is the official chart, softened for kids. Each matchup is a step: super effective +1, resisted −1, immune −2. Both defender types' steps are summed, then mapped: +2 → ×2, +1 → ×1.5, 0 → ×1, −1 → ×0.7, ≤−2 → ×0.5. Official cancellations stay neutral (Ice vs Fire/Flying is ×1), and nothing ever does zero damage.

## Damage

`(ATK × 2 − DEF) × type × random 0.9–1.1 × (crit ×1.5)`, minimum 5. Specials multiply that by their power.

## Turns

The child always moves first, then turns alternate. On your turn you pick one:

- ⚔️ **Attack**: can be evaded (defender's evade %, capped at 40%)
- 🌟 **Special**: costs ⚡3, never misses, ×1.6 power (Normal: ×2), plus the type's effect below
- 🛡️ **Guard**: the next hit you take is halved, and you get ⚡+1 extra

Energy: +1 at the end of each of your turns, +1 whenever you're hit, max 5.

| Type | Special | Effect |
|---|---|---|
| Fire | เปลวเพลิง | target 🔥 burn 2 turns (−8% max HP per turn) |
| Poison | พ่นพิษ | target ☠️ poison 3 turns (−6% per turn) |
| Electric | สายฟ้าฟาด | target ⚡ paralyze 2 turns (25% to lose the turn) |
| Ice | ลมหนาว | target ❄️ freeze 2 turns (no evade, ATK −30%) |
| Ghost / Dark | เงาหลอน / จู่โจมมืด | target 😨 fear 2 turns (ATK −20%) |
| Psychic | คลื่นจิต | target 💫 confuse 2 turns (no crit, evade −10) |
| Fighting | หมัดเจาะเกราะ | ignores DEF |
| Grass | ดูดพลัง | heals 50% of the damage |
| Water | คลื่นฟื้นฟู | heals 15% of max HP |
| Fairy | แสงอวยพร | heals 20% and removes bad statuses |
| Dragon | พลังมังกร | self 🐉 ATK +20% for 2 turns |
| Rock / Ground / Steel | หินถล่ม / แผ่นดินไหว / หางเหล็ก | self 🛡️ DEF +50% for 2 turns |
| Flying / Bug | ลมกรด / ฝูงแมลง | self 💨 evade +15 for 2 turns |
| Normal | ทุ่มสุดตัว | ×2 power, self 🎯 DEF −50% for 1 turn |

Statuses tick (burn/poison) and count down at the end of their owner's turn. When a monster faints, the next one in the chosen order comes in. A team that has lost members gets 🔥 last stand (ATK +15%) on its final monster. Teams of 1–2 get HP +20% instead.

## Levels

Each owned monster (`child_characters.level`, `xp`) has an arena level from 1 to 10. Each level above 1 adds 3% HP/ATK/DEF, so a Lv.10 COMMON (+27%) stays just below an EPIC (+30%) and evolving is still worth it. Evolving carries the level and XP over to the new form.

Every monster on the child's team gets XP when a room finishes: +30 for a win, +10 for a loss, and +20 more for the winning side's MVP. XP counts for up to 5 rooms per child per Thailand-time day. Going from level L to L+1 takes 50 × L XP (50, 100, …, 450; 2,250 total to reach Lv.10). `arena_rooms.xp_day` is claimed before paying, so a room hands out XP once, and `xp_awards` holds the summary shown on the result screen.

## Rooms

1. A parent creates a room (`POST /api/arena/rooms`) with a difficulty, a prize (0–200) and optionally "let the system play". The server rolls a random 3-monster parent team and a 4-digit code.
   - EASY: COMMON/RARE, stats ×0.85
   - NORMAL: no LEGENDARY, ×1.0
   - HARD: anything, ×1.1
2. A child in one of the parent's families joins with the code (`POST /api/arena/rooms/:code/join`) and sees the parent team and types.
3. The child picks 1–3 owned monsters in order (`POST .../team`) and the battle starts.
4. Each side acts on its turn (`POST .../action` with `{ version, action }`). A stale `version` or an out-of-turn action gets a 409. With "let the system play", the AI answers in the same request.
5. Both screens poll `GET /api/arena/rooms/:code` every 1.5 s. `GET /api/arena/rooms/current` resumes an open room after a reload.

Rewards: the child gets the prize for a win or +10 for a loss, on up to 3 rooms per Thailand-time day. The payout is an `EARN` ledger row with `reference_type = 'ARENA'`, and the unique reference index makes it pay once per room.

## Balance check (simulation, AI vs AI, 2,000 battles each)

| Scenario | Result |
|---|---|
| Random COMMON 3v3 length | median 17 turns (p10 13, p90 22) |
| Moving first | 55% win |
| Kid counter-picks from all COMMONs vs random COMMONs | 91% win |
| Kid counter-picks from a random 8-monster collection, NORMAL | 57% win |
| Random kid team (COMMON/RARE): EASY / NORMAL / HARD(×1.15) | 75% / 34% / 10% |

HARD was eased to ×1.1 after that run. Reading the parent's types and picking counters is the main skill, and it clearly pays off.
