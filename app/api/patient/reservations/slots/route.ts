import { NextRequest, NextResponse } from "next/server";
import { DOCTORS } from "@/app/api/patient/doctors/route";

interface Slot {
  startTime: string;
  endTime: string;
  capacity: number;
  reservedCount: number;
}

const SLOT_MINUTES = 20;
const SLOT_CAPACITY = 3;

function timeToMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

function minutesToTime(m: number): string {
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

function getMockReserved(dateStr: string, startTime: string, doctorId: string): number {
  const key = dateStr + startTime + doctorId;
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    hash = (hash * 31 + key.charCodeAt(i)) & 0xffffffff;
  }
  return Math.abs(hash) % (SLOT_CAPACITY + 1);
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const dateParam = searchParams.get("date"); // YYYY-MM-DD
  const doctorId = searchParams.get("doctorId");

  if (!dateParam || !/^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
    return NextResponse.json({ error: "Invalid date" }, { status: 400 });
  }

  const date = new Date(dateParam + "T00:00:00");
  const dayOfWeek = date.getDay();

  // Find doctor if specified
  const doctor = doctorId ? DOCTORS.find((d) => d.id === doctorId) : null;

  // Check availability
  if (doctor) {
    if (!doctor.availableWeekdays.includes(dayOfWeek)) {
      return NextResponse.json({
        date: dateParam,
        closed: true,
        reason: "担当医の休診日です",
        slots: [],
      });
    }
  } else {
    // Default: Sunday closed
    if (dayOfWeek === 0) {
      return NextResponse.json({
        date: dateParam,
        closed: true,
        reason: "定休日",
        slots: [],
      });
    }
  }

  const morningStart = doctor ? timeToMinutes(doctor.morningStart) : 9 * 60;
  const morningEnd = doctor ? timeToMinutes(doctor.morningEnd) : 12 * 60 + 40;
  const afternoonStart = doctor?.afternoonStart ? timeToMinutes(doctor.afternoonStart) : 16 * 60;
  const afternoonEnd = doctor?.afternoonEnd ? timeToMinutes(doctor.afternoonEnd) : 19 * 60 + 40;
  const hasAfternoon = doctor ? doctor.afternoonStart !== null : true;

  const slots: Slot[] = [];
  const effectiveDoctorId = doctorId ?? "default";

  // Morning slots
  for (let t = morningStart; t + SLOT_MINUTES <= morningEnd; t += SLOT_MINUTES) {
    const startTime = minutesToTime(t);
    const endTime = minutesToTime(t + SLOT_MINUTES);
    const reservedCount = getMockReserved(dateParam, startTime, effectiveDoctorId);
    slots.push({ startTime, endTime, capacity: SLOT_CAPACITY, reservedCount });
  }

  // Afternoon slots
  if (hasAfternoon) {
    for (let t = afternoonStart; t + SLOT_MINUTES <= afternoonEnd; t += SLOT_MINUTES) {
      const startTime = minutesToTime(t);
      const endTime = minutesToTime(t + SLOT_MINUTES);
      const reservedCount = getMockReserved(dateParam, startTime, effectiveDoctorId);
      slots.push({ startTime, endTime, capacity: SLOT_CAPACITY, reservedCount });
    }
  }

  return NextResponse.json({ date: dateParam, closed: false, slots });
}
