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
const DAY_START = 9 * 60;       // 09:00
const DAY_END = 17 * 60 + 40;   // 17:40

function minutesToTime(m: number): string {
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
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

    // 09:00〜17:40の20分刻みスロットを生成
    const slots: Slot[] = [];
    for (let t = DAY_START; t + SLOT_MINUTES <= DAY_END; t += SLOT_MINUTES) {
      const startTime = minutesToTime(t);
      const endTime = minutesToTime(t + SLOT_MINUTES);
      const reservedCount = reservedMap.get(startTime) ?? 0;
      slots.push({
        startTime,
        endTime,
        capacity: SLOT_CAPACITY,
        reservedCount,
        isBooked: reservedCount >= SLOT_CAPACITY,
      });
    }

    return NextResponse.json({ date: dateParam, closed: false, slots });
  } catch {
    return NextResponse.json(
      { error: "予約枠の取得に失敗しました" },
      { status: 500 }
    );
  }
}
