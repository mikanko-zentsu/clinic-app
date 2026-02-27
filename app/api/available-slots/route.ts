import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

const SCHEDULE: Record<string, {
  workDays: number[];
  amOnlyDays?: number[];
  amSlots: string[];
  pmSlots: string[];
  saturdayAmSlots?: string[];
}> = {
  tanaka: {
    workDays: [1, 2, 3, 4, 5, 6],
    amSlots: ['09:00','09:20','09:40','10:00','10:20','10:40','11:00','11:20','11:40','12:00','12:20','12:40'],
    pmSlots: ['16:00','16:20','16:40','17:00','17:20','17:40','18:00','18:20','18:40','19:00','19:20','19:40'],
  },
  suzuki: {
    workDays: [1, 3, 5],
    amOnlyDays: [2, 4],
    amSlots: ['09:00','09:20','09:40','10:00','10:20','10:40','11:00','11:20','11:40','12:00','12:20','12:40'],
    pmSlots: ['16:00','16:20','16:40','17:00','17:20','17:40','18:00','18:20','18:40','19:00','19:20','19:40'],
  },
  sato: {
    workDays: [1, 2, 3, 4, 5, 6],
    amSlots: ['10:40','11:00','11:20','11:40'],
    pmSlots: ['16:00','16:20','16:40','17:00','17:20','17:40'],
    saturdayAmSlots: ['09:00','09:20','09:40','10:00','10:20','10:40','11:00','11:20','11:40','12:00','12:20','12:40'],
  },
};

const DOC_IDS = ["tanaka", "suzuki", "sato"];

function getScheduledSlots(docId: string, dayOfWeek: number): string[] {
  if (dayOfWeek === 0) return [];
  const sched = SCHEDULE[docId];
  if (!sched) return [];

  if (docId === "tanaka") {
    if (!sched.workDays.includes(dayOfWeek)) return [];
    if (dayOfWeek === 6) return sched.amSlots;
    return [...sched.amSlots, ...sched.pmSlots];
  }
  if (docId === "suzuki") {
    if (dayOfWeek === 6) return [];
    if ([1, 3, 5].includes(dayOfWeek)) return [...sched.amSlots, ...sched.pmSlots];
    if ([2, 4].includes(dayOfWeek)) return sched.amSlots;
    return [];
  }
  if (docId === "sato") {
    if (!sched.workDays.includes(dayOfWeek)) return [];
    if (dayOfWeek === 6) return sched.saturdayAmSlots ?? [];
    return [...sched.amSlots, ...sched.pmSlots];
  }
  return [];
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const dateParam = searchParams.get("date");
  const staffId = searchParams.get("staffId");

  if (!dateParam || !/^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
    return NextResponse.json({ error: "Invalid date" }, { status: 400 });
  }

  try {
    const dayOfWeek = new Date(dateParam + "T00:00:00Z").getUTCDay();

    // 1. Generate valid slots based on doctor schedule
    let validSlots: string[];
    if (staffId && SCHEDULE[staffId]) {
      validSlots = getScheduledSlots(staffId, dayOfWeek);
    } else {
      // Union of all doctors' scheduled slots
      const slotSet = new Set<string>();
      for (const docId of DOC_IDS) {
        for (const slot of getScheduledSlots(docId, dayOfWeek)) {
          slotSet.add(slot);
        }
      }
      validSlots = Array.from(slotSet).sort();
    }

    // 2. Get reserved slots from Supabase
    let query = supabase
      .from("reservations")
      .select("time_slot, actual_staff_id")
      .eq("date", dateParam)
      .neq("status", "cancelled");

    if (staffId) {
      query = query.eq("actual_staff_id", staffId);
    }

    const { data, error } = await query;
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // 3. Determine availability
    let slots: { time: string; available: boolean }[];

    if (staffId) {
      // Single doctor: available if no reservation at that time for this doctor
      const reservedTimes = new Set(
        (data ?? []).map((r) => r.time_slot?.substring(0, 5))
      );
      slots = validSlots.map((time) => ({
        time,
        available: !reservedTimes.has(time),
      }));
    } else {
      // No doctor specified: available if at least one doctor has an open slot
      const reservedByTime = new Map<string, Set<string>>();
      for (const r of data ?? []) {
        const time = r.time_slot?.substring(0, 5);
        if (time && r.actual_staff_id) {
          if (!reservedByTime.has(time)) {
            reservedByTime.set(time, new Set());
          }
          reservedByTime.get(time)!.add(r.actual_staff_id);
        }
      }

      slots = validSlots.map((time) => {
        const docsAtTime = DOC_IDS.filter((docId) =>
          getScheduledSlots(docId, dayOfWeek).includes(time)
        );
        const reservedDocs = reservedByTime.get(time) ?? new Set();
        const available = docsAtTime.some((docId) => !reservedDocs.has(docId));
        return { time, available };
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
