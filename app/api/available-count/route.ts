export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

const doctorSchedules: Record<string, {
  workDays: number[];
  fullDays?: number[];
  amOnlyDays?: number[];
  weekdayAM: string[];
  weekdayPM: string[];
  saturdayAM: string[];
  saturdayPM: string[];
}> = {
  tanaka: {
    workDays: [1, 2, 3, 4, 5, 6],
    weekdayAM: ['09:00','09:20','09:40','10:00','10:20','10:40','11:00','11:20','11:40','12:00','12:20','12:40'],
    weekdayPM: ['16:00','16:20','16:40','17:00','17:20','17:40','18:00','18:20','18:40','19:00','19:20','19:40'],
    saturdayAM: ['09:00','09:20','09:40','10:00','10:20','10:40','11:00','11:20','11:40','12:00','12:20','12:40'],
    saturdayPM: [],
  },
  suzuki: {
    workDays: [1, 2, 3, 4, 5],
    fullDays: [1, 3, 5],
    amOnlyDays: [2, 4],
    weekdayAM: ['09:00','09:20','09:40','10:00','10:20','10:40','11:00','11:20','11:40','12:00','12:20','12:40'],
    weekdayPM: ['16:00','16:20','16:40','17:00','17:20','17:40','18:00','18:20','18:40','19:00','19:20','19:40'],
    saturdayAM: [],
    saturdayPM: [],
  },
  sato: {
    workDays: [1, 2, 3, 4, 5, 6],
    weekdayAM: ['10:40','11:00','11:20','11:40'],
    weekdayPM: ['16:00','16:20','16:40','17:00','17:20','17:40'],
    saturdayAM: ['09:00','09:20','09:40','10:00','10:20','10:40','11:00','11:20','11:40','12:00','12:20','12:40'],
    saturdayPM: [],
  },
};

const DOC_IDS = ["tanaka", "suzuki", "sato"];

function getScheduledSlots(doctorId: string, dateStr: string): string[] {
  const dow = new Date(dateStr + "T00:00:00Z").getUTCDay();
  const s = doctorSchedules[doctorId];
  if (!s || !s.workDays.includes(dow) || dow === 0) return [];

  if (dow === 6) return [...s.saturdayAM, ...s.saturdayPM];

  if (doctorId === "suzuki") {
    if (s.fullDays?.includes(dow)) return [...s.weekdayAM, ...s.weekdayPM];
    if (s.amOnlyDays?.includes(dow)) return [...s.weekdayAM];
    return [];
  }

  return [...s.weekdayAM, ...s.weekdayPM];
}

function formatDate(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const yearParam = searchParams.get("year");
  const monthParam = searchParams.get("month");

  if (!yearParam || !monthParam) {
    return NextResponse.json({ error: "year, month are required" }, { status: 400 });
  }

  const staffId = searchParams.get("staffId");

  const year = parseInt(yearParam, 10);
  const month = parseInt(monthParam, 10);
  if (isNaN(year) || isNaN(month) || month < 1 || month > 12) {
    return NextResponse.json({ error: "Invalid year/month" }, { status: 400 });
  }

  const targetDocs = staffId && doctorSchedules[staffId] ? [staffId] : DOC_IDS;

  try {
    const daysInMonth = new Date(year, month, 0).getDate();
    const startDate = formatDate(year, month, 1);
    const endDate = formatDate(year, month, daysInMonth);

    // Fetch reservations for the month (paginated, filtered by staffId if provided)
    const allRows: { date: string; time_slot: string; actual_staff_id: string | null }[] = [];
    let from = 0;
    const pageSize = 1000;
    while (true) {
      let q = supabase
        .from("reservations")
        .select("date, time_slot, actual_staff_id")
        .gte("date", startDate)
        .lte("date", endDate)
        .neq("status", "cancelled");
      if (staffId) {
        q = q.eq("actual_staff_id", staffId);
      }
      const { data: page, error } = await q.range(from, from + pageSize - 1);
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      if (!page || page.length === 0) break;
      allRows.push(...page);
      if (page.length < pageSize) break;
      from += pageSize;
    }

    // Group reservations by date
    const resByDate = new Map<string, typeof allRows>();
    for (const r of allRows) {
      if (!resByDate.has(r.date)) resByDate.set(r.date, []);
      resByDate.get(r.date)!.push(r);
    }

    // Calculate per-day availability
    const days: { date: string; available: number; total: number }[] = [];

    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = formatDate(year, month, day);
      const dow = new Date(dateStr + "T00:00:00Z").getUTCDay();

      if (dow === 0) {
        days.push({ date: dateStr, available: 0, total: 0 });
        continue;
      }

      // Count total valid doctor-slot pairs
      let total = 0;
      for (const docId of targetDocs) {
        total += getScheduledSlots(docId, dateStr).length;
      }

      // Count reserved doctor-slot pairs (deduplicated, only within valid schedule)
      const dateReservations = resByDate.get(dateStr) ?? [];
      const reservedKeys = new Set<string>();
      for (const r of dateReservations) {
        if (!r.actual_staff_id) continue;
        const time = String(r.time_slot ?? "").substring(0, 5);
        const validSlots = getScheduledSlots(r.actual_staff_id, dateStr);
        if (validSlots.includes(time)) {
          reservedKeys.add(`${r.actual_staff_id}_${time}`);
        }
      }
      const reserved = reservedKeys.size;

      days.push({ date: dateStr, available: total - reserved, total });
    }

    return NextResponse.json({ year, month, days });
  } catch {
    return NextResponse.json(
      { error: "空き枠数の取得に失敗しました" },
      { status: 500 }
    );
  }
}
