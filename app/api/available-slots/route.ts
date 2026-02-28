export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { isHoliday } from "@/lib/holidays";

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

function getScheduledSlots(doctorId: string, date: string): string[] {
  const dow = new Date(date + "T00:00:00Z").getUTCDay();
  const s = doctorSchedules[doctorId];
  if (!s || !s.workDays.includes(dow) || dow === 0 || isHoliday(date)) return [];

  if (dow === 6) return [...s.saturdayAM, ...s.saturdayPM];

  if (doctorId === "suzuki") {
    if (s.fullDays?.includes(dow)) return [...s.weekdayAM, ...s.weekdayPM];
    if (s.amOnlyDays?.includes(dow)) return [...s.weekdayAM];
    return [];
  }

  return [...s.weekdayAM, ...s.weekdayPM];
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const dateParam = searchParams.get("date");
  const staffId = searchParams.get("staffId");

  if (!dateParam || !/^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
    return NextResponse.json({ error: "Invalid date" }, { status: 400 });
  }

  try {
    // 1. Generate valid slots based on doctor schedule
    let validSlots: string[];
    if (staffId && doctorSchedules[staffId]) {
      validSlots = getScheduledSlots(staffId, dateParam);
    } else {
      const slotSet = new Set<string>();
      for (const docId of DOC_IDS) {
        for (const slot of getScheduledSlots(docId, dateParam)) {
          slotSet.add(slot);
        }
      }
      validSlots = Array.from(slotSet).sort();
    }

    // 2. Get reserved slots from Supabase
    let query = supabase
      .from("reservations")
      .select("time_slot, actual_staff_id, staff_id")
      .eq("date", dateParam)
      .neq("status", "cancelled");

    if (staffId) {
      query = query.or(`actual_staff_id.eq.${staffId},and(actual_staff_id.is.null,staff_id.eq.${staffId})`);
    }

    const { data, error } = await query;
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // 3. Normalize time_slot to HH:MM format and resolve effective staff ID
    const reservations = (data ?? []).map((r) => ({
      time: String(r.time_slot ?? "").substring(0, 5),
      doctor: (r.actual_staff_id ?? r.staff_id) as string | null,
    }));

    // 4. Determine availability
    let slots: { time: string; available: boolean; availableCount?: number }[];

    if (staffId) {
      const bookedSet = new Set(reservations.map((r) => r.time));
      slots = validSlots.map((time) => ({
        time,
        available: !bookedSet.has(time),
      }));
    } else {
      // No doctor specified: available if at least one doctor has an open slot
      // Pre-build booked sets per doctor
      const bookedByDoc = new Map<string, Set<string>>();
      for (const docId of DOC_IDS) {
        bookedByDoc.set(docId, new Set(
          reservations.filter((r) => r.doctor === docId).map((r) => r.time)
        ));
      }

      slots = validSlots.map((slot) => {
        let count = 0;
        for (const d of DOC_IDS) {
          const dSlots = getScheduledSlots(d, dateParam);
          if (dSlots.includes(slot) && !bookedByDoc.get(d)!.has(slot)) {
            count++;
          }
        }
        return { time: slot, available: count > 0, availableCount: count };
      });
    }

    return NextResponse.json({ date: dateParam, slots });
  } catch {
    return NextResponse.json(
      { error: "空き枠の取得に失敗しました" },
      { status: 500 }
    );
  }
}
