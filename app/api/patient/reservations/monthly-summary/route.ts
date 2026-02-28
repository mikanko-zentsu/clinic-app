import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { isHoliday } from "@/lib/holidays";

const MORNING_SLOTS = 13; // 09:00〜12:40（13枠）
const AFTERNOON_SLOTS = 12; // 16:00〜19:40（12枠）※19:40含む
const TOTAL_SLOTS_PER_DAY = MORNING_SLOTS + AFTERNOON_SLOTS; // 25枠

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

function formatDate(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const monthParam = searchParams.get("month");
  const doctorId = searchParams.get("doctorId");

  if (!monthParam || !/^\d{4}-\d{2}$/.test(monthParam)) {
    return NextResponse.json({ error: "Invalid month" }, { status: 400 });
  }

  const [yearStr, monthStr] = monthParam.split("-");
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10);

  if (month < 1 || month > 12) {
    return NextResponse.json({ error: "Invalid month" }, { status: 400 });
  }

  const daysInMonth = getDaysInMonth(year, month);
  const startDate = formatDate(year, month, 1);
  const endDate = formatDate(year, month, daysInMonth);

  // Supabaseから月全体の予約を一括取得
  let query = supabase
    .from("reservations")
    .select("date, staff_id, time_slot")
    .gte("date", startDate)
    .lte("date", endDate)
    .neq("status", "cancelled");

  if (doctorId) {
    query = query.eq("staff_id", doctorId);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // 日付ごとの予約数を集計
  const countMap = new Map<string, number>();
  for (const row of data ?? []) {
    const key = row.date;
    countMap.set(key, (countMap.get(key) ?? 0) + 1);
  }

  const days = [];

  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = formatDate(year, month, day);
    const date = new Date(year, month - 1, day);
    const dayOfWeek = date.getDay();

    // 日曜休診
    if (dayOfWeek === 0 || isHoliday(dateStr)) {
      days.push({ date: dateStr, status: "closed", reason: "定休日" });
      continue;
    }

    const reservedCount = countMap.get(dateStr) ?? 0;
    const capacity = doctorId ? TOTAL_SLOTS_PER_DAY : TOTAL_SLOTS_PER_DAY * 3; // 担当医指定なしは3人分
    const remaining = capacity - reservedCount;

    let status: "available" | "few" | "full";
    if (remaining <= 0) {
      status = "full";
    } else if (remaining <= 3) {
      status = "few";
    } else {
      status = "available";
    }

    days.push({ date: dateStr, status, count: remaining });
  }

  return NextResponse.json({ month: monthParam, days });
}
