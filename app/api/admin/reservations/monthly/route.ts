import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { isHoliday } from "@/lib/holidays";

const SLOTS_PER_STAFF = 25; // 午前13枠 + 午後12枠

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

function formatDate(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const monthParam = searchParams.get("month"); // YYYY-MM

  if (!monthParam || !/^\d{4}-\d{2}$/.test(monthParam)) {
    return NextResponse.json({ error: "Invalid month" }, { status: 400 });
  }

  const [yearStr, monthStr] = monthParam.split("-");
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10);
  const daysInMonth = getDaysInMonth(year, month);
  const startDate = formatDate(year, month, 1);
  const endDate = formatDate(year, month, daysInMonth);

  try {
    // スタッフ数を取得
    const { data: staffData } = await supabase.from("staff").select("slug");
    const staffCount = staffData?.length ?? 3;

    // 月全体の予約を取得（キャンセル含む、上限緩和）
    const { data, error } = await supabase
      .from("reservations")
      .select("date, patient_card_id, status")
      .gte("date", startDate)
      .lte("date", endDate)
      .limit(5000);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // 日別集計
    const dayMap = new Map<string, { booked: number; cancelled: number; patients: Set<string> }>();
    for (const row of data ?? []) {
      if (!dayMap.has(row.date)) {
        dayMap.set(row.date, { booked: 0, cancelled: 0, patients: new Set() });
      }
      const entry = dayMap.get(row.date)!;
      if (row.status === "cancelled") {
        entry.cancelled++;
      } else {
        entry.booked++;
        if (row.patient_card_id) entry.patients.add(row.patient_card_id);
      }
    }

    // 日別レスポンス
    const totalPerDay = staffCount * SLOTS_PER_STAFF;
    const days = [];
    let monthBooked = 0;
    let monthCancelled = 0;
    let monthTotal = 0;
    const monthPatients = new Set<string>();

    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = formatDate(year, month, d);
      const dow = new Date(year, month - 1, d).getDay();
      if (dow === 0 || isHoliday(dateStr)) {
        days.push({ date: dateStr, closed: true, booked: 0, total: 0 });
        continue;
      }
      const entry = dayMap.get(dateStr);
      const booked = entry?.booked ?? 0;
      const cancelled = entry?.cancelled ?? 0;
      days.push({ date: dateStr, closed: false, booked, total: totalPerDay });
      monthBooked += booked;
      monthCancelled += cancelled;
      monthTotal += totalPerDay;
      if (entry) entry.patients.forEach((p) => monthPatients.add(p));
    }

    // 月間KPI
    const uniquePatients = monthPatients.size;
    const utilRate = monthTotal > 0 ? Math.round((monthBooked / monthTotal) * 100) : 0;
    const cancelRate = monthBooked + monthCancelled > 0
      ? Math.round((monthCancelled / (monthBooked + monthCancelled)) * 100) : 0;
    // 新患数・リピート率はデモ用の概算（実運用では初診フラグ等で判定）
    const newCount = Math.max(1, Math.round(uniquePatients * 0.2));
    const repeatRate = uniquePatients > 0
      ? Math.round(((uniquePatients - newCount) / uniquePatients) * 100) : 0;

    return NextResponse.json({
      month: monthParam,
      days,
      kpi: {
        reservations: monthBooked,
        utilization: utilRate,
        cancelRate,
        repeatRate,
        newPatients: newCount,
        uniquePatients,
      },
    });
  } catch {
    return NextResponse.json({ error: "月間データの取得に失敗しました" }, { status: 500 });
  }
}
