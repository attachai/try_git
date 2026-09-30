import { useEffect, useRef, useState } from "react";
import { api } from "../../lib/api";
import type { BattleState, Side, WeatherKind } from "../../../shared/arena";

export type ArenaCharacter = { id: string; name: string; image_url: string; rarity: string; type_primary: string; type_secondary: string | null };
export type RoomView = {
  room: {
    code: string;
    status: "WAITING" | "PICKING" | "BATTLE" | "FINISHED" | "CANCELLED";
    difficulty: "EASY" | "NORMAL" | "HARD";
    prize: number;
    auto_parent: boolean;
    version: number;
    winner: Side | null;
    reward_points: number;
    parent_name: string;
    child_name: string | null;
    my_side: Side;
    emote_seq: number;
    weather: WeatherKind;
  };
  parent_team: ArenaCharacter[];
  state: BattleState | null;
  mvp: { name: string; damage: number } | null;
  xp_awards: { name: string; gained: number; level: number; levels_gained: number }[] | null;
  emotes: { seq: number; side: Side; emoji: string; at: number }[];
};

export const POLL_MS = 1500;
const OPEN = ["WAITING", "PICKING", "BATTLE"];

export const DIFFICULTY_LABEL = { EASY: "ง่าย", NORMAL: "กลาง", HARD: "ยาก" } as const;

// Keeps a room in sync by polling the server while it's still in play.
export function useRoom(initial: RoomView | null) {
  const [view, setView] = useState<RoomView | null>(initial);
  // A poll is worth re-rendering when the battle moved or a new emoji arrived.
  const seen = useRef(initial ? initial.room.version + ":" + initial.room.emote_seq : "");
  const key = (next: RoomView) => next.room.version + ":" + next.room.emote_seq;

  function accept(next: RoomView | null) {
    seen.current = next ? key(next) : "";
    setView(next);
  }

  const code = view?.room.code;
  const open = view ? OPEN.includes(view.room.status) : false;
  useEffect(() => {
    if (!code || !open) return;
    const timer = window.setInterval(() => {
      api<RoomView>("/api/arena/rooms/" + code)
        .then((next) => { if (key(next) !== seen.current) accept(next); })
        .catch(() => undefined);
    }, POLL_MS);
    return () => window.clearInterval(timer);
  }, [code, open]);

  return { view, setView: accept };
}
