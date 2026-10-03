import type { BattleState, ThemeKind, WeatherKind } from './arena';

export const DAILY_ADVENTURE_LIMIT = 5;
export const REGIONS = [
  { name: 'คันโต', icon: '🌱', story: 'ออกจากเมืองมาซาระ พบเพื่อนคนแรก และเรียนรู้การเป็นเทรนเนอร์', color: '#059669' },
  { name: 'โจโต', icon: '🍁', story: 'เดินทางผ่านป่าและหอคอย ฝึกความอดทนกับเพื่อนร่วมทีม', color: '#d97706' },
  { name: 'โฮเอ็น', icon: '🌊', story: 'สำรวจทะเลและภูเขาไฟ เรียนรู้การรับมือสภาพอากาศ', color: '#0284c7' },
  { name: 'ชินโอ', icon: '🏔️', story: 'ข้ามยอดเขาหิมะ ค้นพบพลังของความเชื่อใจ', color: '#6366f1' },
  { name: 'อิชชู', icon: '🌆', story: 'พบคู่แข่งในเมืองใหญ่ ลองจัดทีมด้วยธาตุที่หลากหลาย', color: '#7c3aed' },
  { name: 'คาลอส', icon: '💎', story: 'ฝึกกลยุทธ์กับเพื่อนใหม่ เตรียมทีมให้พร้อมสำหรับลีก', color: '#db2777' },
  { name: 'อโลลา', icon: '🌴', story: 'ร่วมบททดสอบบนเกาะ ช่วยเหลือเพื่อนและเรียนรู้จากทุกการต่อสู้', color: '#ea580c' },
  { name: 'กาลาร์', icon: '🏟️', story: 'ก้าวสู่สนามใหญ่ ใช้ทุกประสบการณ์เพื่อเป็นแชมป์โลก', color: '#4f46e5' },
];
const FIELDS: { name: string; required: string; enemy: string; theme: ThemeKind; weather: WeatherKind; hint: string }[] = [
  { name: 'ริมทะเลสาบ', required: 'Electric', enemy: 'Water', theme: 'BEACH', weather: 'CLEAR', hint: 'ไฟฟ้าได้เปรียบธาตุน้ำ ลองเริ่มด้วยการโจมตีแล้วสะสมพลังท่าพิเศษ' },
  { name: 'ทางผ่านภูเขาไฟ', required: 'Water', enemy: 'Fire', theme: 'VOLCANO', weather: 'SUN', hint: 'น้ำได้เปรียบไฟ แต่แดดช่วยคู่แข่ง ลองตั้งรับเพื่อสะสมพลัง' },
  { name: 'หุบเขาหิน', required: 'Grass', enemy: 'Rock', theme: 'FOREST', weather: 'CLEAR', hint: 'หญ้าได้เปรียบหิน ท่าพิเศษหญ้าช่วยฟื้นพลังชีวิตด้วย' },
  { name: 'ป่าลึก', required: 'Fire', enemy: 'Bug', theme: 'FOREST', weather: 'CLEAR', hint: 'ไฟได้เปรียบแมลง เก็บพลังไว้ใช้ท่าพิเศษเมื่อพร้อม' },
  { name: 'ยิมสายฟ้า', required: 'Ground', enemy: 'Electric', theme: 'STADIUM', weather: 'CLEAR', hint: 'ดินรับมือไฟฟ้าได้ดี อย่าลืมดูธาตุรองของคู่แข่งด้วย' },
  { name: 'เส้นทางดอกไม้', required: 'Flying', enemy: 'Grass', theme: 'FOREST', weather: 'RAIN', hint: 'บินได้เปรียบหญ้า ลองสลับตัวให้ตรงกับคู่แข่ง' },
  { name: 'ถ้ำคริสตัล', required: 'Fighting', enemy: 'Normal', theme: 'SPACE', weather: 'CLEAR', hint: 'ต่อสู้ได้เปรียบปกติ ท่าพิเศษช่วยเจาะการตั้งรับ' },
  { name: 'ชายฝั่งพายุ', required: 'Electric', enemy: 'Flying', theme: 'BEACH', weather: 'STORM', hint: 'ไฟฟ้าได้เปรียบบิน แต่พายุอาจเปลี่ยนจังหวะเกมได้' },
  { name: 'ยอดเขาหนาว', required: 'Fire', enemy: 'Ice', theme: 'SNOWPEAK', weather: 'SNOW', hint: 'ไฟช่วยรับมือธาตุน้ำแข็ง เก็บท่าไม้ตายไว้เมื่อหลอดเต็ม' },
  { name: 'ยิมเงาจันทร์', required: 'Dark', enemy: 'Psychic', theme: 'SPACE', weather: 'CLEAR', hint: 'ความมืดได้เปรียบพลังจิต ลองใช้ท่าพิเศษและสังเกตสถานะ' },
  { name: 'สวนแฟรี่', required: 'Steel', enemy: 'Fairy', theme: 'FOREST', weather: 'CLEAR', hint: 'เหล็กได้เปรียบแฟรี่ การตั้งรับช่วยให้ทีมอยู่ได้นานขึ้น' },
  { name: 'สุสานโบราณ', required: 'Ghost', enemy: 'Ghost', theme: 'SPACE', weather: 'CLEAR', hint: 'ผีโจมตีผีได้แรงทั้งสองฝ่าย สลับตัวเมื่อพลังชีวิตต่ำ' },
  { name: 'ช่องเขามังกร', required: 'Fairy', enemy: 'Dragon', theme: 'SNOWPEAK', weather: 'CLEAR', hint: 'แฟรี่ช่วยรับมือมังกร ท่าพิเศษช่วยฟื้นฟูทีม' },
  { name: 'คู่แข่งก่อนลีก', required: 'Water', enemy: 'Ground', theme: 'STADIUM', weather: 'SAND', hint: 'น้ำได้เปรียบดิน จัดทีมให้มีตัวสำรองก่อนเข้าลีก' },
  { name: 'ศึกชิงแชมป์ภูมิภาค', required: 'Ice', enemy: 'Dragon', theme: 'STADIUM', weather: 'CLEAR', hint: 'น้ำแข็งได้เปรียบมังกร บอสมีทีมเต็ม ใช้การสลับตัวและท่าไม้ตายให้คุ้ม' },
];
export const STAGES = REGIONS.flatMap((region, r) => FIELDS.map((field, i) => ({
  id: r * 15 + i + 1, region: r, local: i + 1,
  name: `${field.name} · ${region.name}`, story: region.story,
  requiredTypes: r >= 4 && (i === 9 || i === 14) ? [field.required, i === 14 ? 'Fairy' : 'Fighting'] : [field.required],
  enemyType: field.enemy, theme: field.theme, weather: field.weather, hint: field.hint,
  boss: i === 4 || i === 9 || i === 14,
  enemyLevel: Math.min(10, r + 1 + (i >= 10 ? 1 : 0)),
  enemyCount: i === 14 || r >= 4 ? 3 : (i >= 4 ? 2 : 1),
  scale: 0.68 + r * 0.09 + i * 0.006,
  xp: 40 + r * 10 + (i === 14 ? 60 : i === 4 || i === 9 ? 20 : 0),
})));
export type AdventureStage = typeof STAGES[number];
export type AdventureMonster = { id: string; pickId: string; name: string; image_url: string; rarity: string; type_primary: string; type_secondary: string | null; level: number; loan: boolean };
export type AdventureRun = { id: string; stage_id: number; state: BattleState; version: number; status: 'BATTLE' | 'FINISHED' | 'ABANDONED'; stars: number; xp: number };
export type AdventureView = { cleared: number; xp: number; used: number; day: string; resetsAt: string; records: { stage_id: number; stars: number }[]; active: AdventureRun | null };
export function missingTypes(required: string[], team: { type_primary: string; type_secondary: string | null }[]) {
  return required.filter(type => !team.some(mon => mon.type_primary === type || mon.type_secondary === type));
}
export function battleStars(state: BattleState) {
  if (state.winner !== 'CHILD') return 0;
  const alive = state.teams.CHILD.fighters.filter(mon => mon.hp > 0).length;
  return 1 + Number(alive === state.teams.CHILD.fighters.length) + Number(state.round <= 15);
}
export const trainerTitle = (cleared: number) => cleared >= 120 ? 'แชมป์โลก' : cleared >= 90 ? 'ผู้ท้าชิงลีก' : cleared >= 60 ? 'เทรนเนอร์มากประสบการณ์' : cleared >= 30 ? 'นักผจญภัย' : 'เทรนเนอร์หน้าใหม่';
