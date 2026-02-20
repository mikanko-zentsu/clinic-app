import { NextRequest, NextResponse } from "next/server";
import { DOCTORS } from "@/app/api/patient/doctors/route";

// Mock: some specific closed dates
const SPECIFIC_CLOSED: Record<string, string> = {};

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

function formatDate(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

// Mock reservation counts per day (seed-based)
function getMockCount(dateStr: string, doctorId: string): number {
  const key = dateStr + doctorId;
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    hash = (hash * 31 + key.charCodeAt(i)) & 0xffffffff;
  }
  return Math.abs(hash) % 10; // 0-9
}

const CAPACITY_PER_DAY = 8;

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const monthParam = searchParams.get("month"); // YYYY-MM
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

  // Find doctor if specified
  const doctor = doctorId ? DOCTORS.find((d) => d.id === doctorId) : null;

  const daysInMonth = getDaysInMonth(year, month);
  const days = [];

  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = formatDate(year, month, day);
    const date = new Date(year, month - 1, day);
    const dayOfWeek = date.getDay(); // 0=Sun

    // Check if doctor is available on this weekday
    if (doctor && !doctor.availableWeekdays.includes(dayOfWeek)) {
      days.push({ date: dateStr, status: "closed", reason: "担当医休診" });
      continue;
    }

    // Sunday closed (if no specific doctor or doctor also unavailable)
    if (!doctor && dayOfWeek === 0) {
      days.push({ date: dateStr, status: "closed", reason: "定休日" });
      continue;
    }

    if (SPECIFIC_CLOSED[dateStr]) {
      days.push({ date: dateStr, status: "closed", reason: SPECIFIC_CLOSED[dateStr] });
      continue;
    }

    const reservedCount = getMockCount(dateStr, doctorId ?? "default");
    const remaining = CAPACITY_PER_DAY - reservedCount;

    let status: "available" | "few" | "full";
    if (remaining <= 0) {
      status = "full";
    } else if (remaining <= 2) {
      status = "few";
    } else {
      status = "available";
    }

    days.push({ date: dateStr, status, count: remaining });
  }

  return NextResponse.json({ month: monthParam, days });
}
