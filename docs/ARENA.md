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
- 💥 **Ultimate**: needs a full gauge (100). ×2.2 power, never misses, applies the type's special effect, costs no energy, and resets the gauge. Guard still halves it. The gauge fills +15 per hit you land, +10 per hit you take, and +10 for guarding. That's about one ultimate per side per battle in simulation (median 15 turns, and moving first still wins 55.6%)

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

The parent team plays at the child team's average level, rounded down (`parentLevelFor`). It's set when the child starts the battle, and the picker shows it, so fights stay close while leveling up still gives the child a small edge.

Every monster on the child's team gets XP when a room finishes: +30 for a win, +10 for a loss, and +20 more for the winning side's MVP. XP counts for up to 5 rooms per child per Thailand-time day. Going from level L to L+1 takes 50 × L XP (50, 100, …, 450; 2,250 total to reach Lv.10). `arena_rooms.xp_day` is claimed before paying, so a room hands out XP once, and `xp_awards` holds the summary shown on the result screen.

## Effects

Every beat the engine resolves is also recorded as a structured event in `state.events`: `attack`, `special`, `hit`, `miss`, `heal`, `status`, `buff`, `tick`, `guard`, `paralyzed`, `faint`, `switch`, `win`. Each has an increasing `seq`, and only the last 40 are kept. `src/components/arena/usePlayback.ts` plays events newer than the last one seen, one at a time:

| Event | Effect |
|---|---|
| attack | attacker lunges toward the other side |
| special | move-name banner, type-colored screen flash, type icon projectile |
| hit | defender shakes and flashes red, a floating −N, the HP bar drains with a trailing chip, and floats for advantage ×1.5 / resisted ×0.7 / guard |
| crit | "CRITICAL!", screen shake, phone vibration |
| miss | defender dodges sideways, "MISS 💨" |
| heal / buff / status / tick | glow, floating +N or the status icon |
| guard | a shield bubble |
| faint / switch | the fallen monster drops and greys out, the next one pops in |
| win | confetti for the winner's screen |

During playback, the cards show the HP and active monster of that moment, the battle log holds the previous lines so it doesn't spoil the outcome, and action buttons stay disabled. Sounds are synthesized with Web Audio (no asset files), and the 🔊/🔇 toggle is remembered per device. `prefers-reduced-motion` turns the animations off.

### Hype

- **Intro:** both teams slide in for a VS reveal, then a 3-2-1 **FIGHT!** countdown, once per room per device (sessionStorage). Actions are locked until it ends
- **Commentary:** callouts during playback, for crits, ×2 advantage, a dodge, 3 hits in a row, surviving at ≤10% HP ("เกือบไปแล้ว!!"), the last monster coming in, an ultimate, and a comeback win with the last monster against a team of 2+ ("พลิกเกม!!!")
- **Danger:** when your active monster is at ≤25% HP, a pulsing red vignette, a blinking HP bar, and a heartbeat sound
- **Ultimate cut-in:** a type-colored diagonal band with the monster's art and the move name
- **Emoji reactions:** 8 emojis, sent with `POST /api/arena/rooms/:code/emote`. They're stored in `arena_rooms.emotes` with their own `emote_seq` (migration 0013), so they never bump the battle `version`. Each side can send one per second, and the last 10 are kept. Polling re-renders when either `version` or `emote_seq` changes

### Strategy

- **Field:** rolled when the room is created (`arena_rooms.weather`) and shown while picking. The attacker's primary type gets ×1.2 when boosted or ×0.8 when weakened. It re-rolls to a different field every 4 rounds, with a `weather` event
  - 🌤️ Clear: no effect
  - ☀️ Sun: Fire+, Water−
  - 🌧️ Rain: Water+, Fire−
  - ⛈️ Storm: Electric/Flying+
  - ❄️ Snow: Ice+, Grass−
  - 🏜️ Sand: Rock/Ground/Steel+, Electric−
- **Combos:** a Water hit leaves 💧 WET and a Grass hit leaves 🌿 GRASSY for 2 turns. Then:
  - WET + Electric = ⚡💧 ช็อตไฟฟ้า ×1.3
  - FREEZE + Rock/Fighting/Steel = ❄️💥 แตกกระจาย, a guaranteed crit
  - GRASSY + Fire = 🌿🔥 ไฟลาม, ×1.1 plus burn
  - BURN + Flying = 🔥🌪️ พายุไฟ ×1.3
  - The mark is consumed, except burn. The UI hints when a combo is ready
- **Switch:** `{ action: "SWITCH", target }` takes the turn to bring in a living bench monster, and works even while paralyzed. The AI switches away from a ×1.5 threat 30% of the time
- **Items:** the child may carry one item, picked with the team (`item` on `POST .../team`):
  - 🧪 potion: heal 30%, 60 points
  - 🔋 ether: ⚡+2, 50 points
  - ✨ cleanse: clear bad statuses + heal 10%, 40 points
  - Using it takes the turn. It's paid only when used, once per room (`ARENA_ITEM` in the unique ledger index), and the balance is checked first

Simulation with all of this (AI vs AI, random fields): median 15 turns, first mover 57%, about 1.3 field changes per battle.

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

## History

`GET /api/arena/history` (child: their own; parent: `?childId=` for a child in one of their families) summarizes the child's last 100 finished rooms against any parent:
- totals and win rate
- current and best win streak
- win-loss per difficulty
- the top 3 monsters by wins, then damage (battles, wins, total damage, MVP count)
- the latest 20 rooms with both teams, rounds, MVP and reward

Children see it under the code entry on the Arena screen. Parents see it in the Arena tab, with a picker when they have more than one child.

## Balance check (simulation, AI vs AI, 2,000 battles each)

| Scenario | Result |
|---|---|
| Random COMMON 3v3 length | median 17 turns (p10 13, p90 22) |
| Moving first | 55% win |
| Kid counter-picks from all COMMONs vs random COMMONs | 91% win |
| Kid counter-picks from a random 8-monster collection, NORMAL | 57% win |
| Random kid team (COMMON/RARE): EASY / NORMAL / HARD(×1.15) | 75% / 34% / 10% |

HARD was eased to ×1.1 after that run. Reading the parent's types and picking counters is the main skill, and it clearly pays off.
