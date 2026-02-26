import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

interface Slot {
  startTime: string;
  endTime: string;
  capacity: number;
  reservedCount: number;
  isBooked: boolean;
}

const SLOT_MINUTES = 20;
const SLOT_CAPACITY = 3;
const MORNING_START   = 9 * 60;         // 09:00
const MORNING_END     = 12 * 60 + 40;   // 12:40（最終開始枠）
const AFTERNOON_START = 16 * 60;        // 16:00
const AFTERNOON_END   = 19 * 60 + 40;   // 19:40（最終開始枠）

function minutesToTime(m: number): string {
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

function generateSlots(start: number, end: number): number[] {
  const slots: number[] = [];
  for (let t = start; t <= end; t += SLOT_MINUTES) {
    slots.push(t);
  }
  return slots;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const dateParam = searchParams.get("date");
  const doctorId = searchParams.get("doctorId");

  if (!dateParam || !/^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
    return NextResponse.json({ error: "Invalid date" }, { status: 400 });
  }

  try {
    // Supabaseから予約データを取得
    let query = supabase
      .from("reservations")
      .select("time_slot")
      .eq("date", dateParam)
      .neq("status", "cancelled");

    if (doctorId) {
      query = query.eq("staff_id", doctorId);
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // 時間帯ごとの予約数を集計
    const reservedMap = new Map<string, number>();
    for (const row of data ?? []) {
      const time = row.time_slot?.substring(0, 5); // "09:00:00" → "09:00"
      if (time) {
        reservedMap.set(time, (reservedMap.get(time) ?? 0) + 1);
      }
    }

    // 午前(09:00〜12:40)・午後(16:00〜19:40)のスロットを生成
    const allSlotMinutes = [
      ...generateSlots(MORNING_START, MORNING_END),
      ...generateSlots(AFTERNOON_START, AFTERNOON_END),
    ];
    const slots: Slot[] = allSlotMinutes.map((t) => {
      const startTime = minutesToTime(t);
      const endTime = minutesToTime(t + SLOT_MINUTES);
      const reservedCount = reservedMap.get(startTime) ?? 0;
      return {
        startTime,
        endTime,
        capacity: SLOT_CAPACITY,
        reservedCount,
        isBooked: reservedCount >= SLOT_CAPACITY,
      };
    });

    return NextResponse.json({ date: dateParam, closed: false, slots });
  } catch {
    return NextResponse.json(
      { error: "予約枠の取得に失敗しました" },
      { status: 500 }
    );
  }
}
