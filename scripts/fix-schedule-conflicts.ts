/**
 * fix-schedule-conflicts.ts
 *
 * スケジュール外の枠に入っている予約を有効な枠に移動する。
 * ガントチャートと同じ割り振りロジック（seed=13）で担当医を決定後、
 * 各予約がその担当医のスケジュール内にあるかチェックし、
 * 無効な予約を同日・同担当医の有効な空き枠に移動する。
 *
 * 実行: npx ts-node --project tsconfig.scripts.json scripts/fix-schedule-conflicts.ts
 */

import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  "https://ibdhcyvridkliivwquxi.supabase.co",
  "sb_publishable_rUXidQJDGZaCPOo9T9a_Qw_ypLc-hvn"
);

const DOC_IDS = ["tanaka", "suzuki", "sato"];
const GANTT_SEED = 13;

const MORNING = [
  "09:00", "09:20", "09:40", "10:00", "10:20", "10:40",
  "11:00", "11:20", "11:40", "12:00", "12:20", "12:40",
];
const AFTERNOON = [
  "16:00", "16:20", "16:40", "17:00", "17:20", "17:40",
  "18:00", "18:20", "18:40", "19:00", "19:20", "19:40",
];
const ALL_SLOTS = [...MORNING, ...AFTERNOON];

// buildDoctorSchedules と同じスケジュールデータ
// admin-mockup.html の doctorSchedules と同じスロットベース定義
const SCHEDULE = {
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

function toMin(s: string): number {
  const [h, m] = s.split(":").map(Number);
  return h * 60 + m;
}

function isScheduledSlot(docId: string, dayOfWeek: number, time: string): boolean {
  if (dayOfWeek === 0) return false;

  if (docId === "tanaka") {
    if (!SCHEDULE.tanaka.workDays.includes(dayOfWeek)) return false;
    if (dayOfWeek === 6) return SCHEDULE.tanaka.amSlots.includes(time);
    return SCHEDULE.tanaka.amSlots.includes(time) || SCHEDULE.tanaka.pmSlots.includes(time);
  }

  if (docId === "suzuki") {
    if (dayOfWeek === 6) return false;
    if ([1, 3, 5].includes(dayOfWeek)) {
      return SCHEDULE.suzuki.amSlots.includes(time) || SCHEDULE.suzuki.pmSlots.includes(time);
    }
    if ([2, 4].includes(dayOfWeek)) {
      return SCHEDULE.suzuki.amSlots.includes(time);
    }
    return false;
  }

  if (docId === "sato") {
    if (!SCHEDULE.sato.workDays.includes(dayOfWeek)) return false;
    if (dayOfWeek === 6) return SCHEDULE.sato.saturdayAmSlots.includes(time);
    return SCHEDULE.sato.amSlots.includes(time) || SCHEDULE.sato.pmSlots.includes(time);
  }

  return false;
}

function getValidSlots(docId: string, dayOfWeek: number): string[] {
  return ALL_SLOTS.filter((t) => isScheduledSlot(docId, dayOfWeek, t));
}

function seededRandom(seed: number): number {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

/** ガントチャートと同じ割り振りロジック（fix-actual-staff-sync.ts と同一） */
function assignDoctorsForDate(
  rows: { id: number; staff_id: string | null; time_slot: string }[]
): Map<number, string> {
  const result = new Map<number, string>();
  const occupied: Record<string, boolean> = {};

  for (const r of rows) {
    if (r.staff_id) {
      const key = r.staff_id + "_" + r.time_slot.slice(0, 5);
      occupied[key] = true;
      result.set(r.id, r.staff_id);
    }
  }

  let seed = GANTT_SEED;
  for (const r of rows) {
    if (r.staff_id) continue;
    const time = r.time_slot.slice(0, 5);
    const shuffled = DOC_IDS.slice();
    for (let i = shuffled.length - 1; i > 0; i--) {
      const x = seededRandom(seed++);
      const j = Math.floor(x * (i + 1));
      const tmp = shuffled[i];
      shuffled[i] = shuffled[j];
      shuffled[j] = tmp;
    }
    for (const docId of shuffled) {
      const key = docId + "_" + time;
      if (!occupied[key]) {
        occupied[key] = true;
        result.set(r.id, docId);
        break;
      }
    }
  }
  return result;
}

/** 日付を1日進める（日曜はスキップ） */
function nextBusinessDay(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + 1);
  if (d.getUTCDay() === 0) d.setUTCDate(d.getUTCDate() + 1); // 日曜スキップ
  return d.toISOString().split("T")[0];
}

function getDayOfWeek(dateStr: string): number {
  return new Date(dateStr + "T00:00:00Z").getUTCDay();
}

interface ReservationRow {
  id: number;
  staff_id: string | null;
  time_slot: string;
  date: string;
  patient_card_id: string;
}

async function main() {
  console.log("=== スケジュール外予約の移動スクリプト ===\n");

  // 全日付を取得
  const { data: dateRows, error: dateErr } = await supabase
    .from("reservations")
    .select("date")
    .lte("date", "2026-02-27")
    .neq("status", "cancelled");

  if (dateErr) {
    console.error("日付取得エラー:", dateErr.message);
    return;
  }

  const uniqueDates = [...new Set((dateRows ?? []).map((r) => r.date))].sort();
  console.log(`対象日数: ${uniqueDates.length}日`);

  // 日付ごとに全予約をキャッシュ + 空き枠を管理
  const dateReservations: Map<string, ReservationRow[]> = new Map();
  // occupied[date] = Set of "docId_HH:MM"
  const occupiedByDate: Map<string, Set<string>> = new Map();

  for (const date of uniqueDates) {
    const { data: rows } = await supabase
      .from("reservations")
      .select("id, staff_id, time_slot, date, patient_card_id")
      .eq("date", date)
      .neq("status", "cancelled")
      .order("id", { ascending: true });
    dateReservations.set(date, rows ?? []);
  }

  // 各日付のガント割り振りを計算
  const resDocAssignment: Map<number, string> = new Map(); // resId → docId
  const resDateMap: Map<number, string> = new Map(); // resId → date

  for (const date of uniqueDates) {
    const rows = dateReservations.get(date)!;
    const assignments = assignDoctorsForDate(rows);
    for (const [resId, docId] of assignments) {
      resDocAssignment.set(resId, docId);
      resDateMap.set(resId, date);
    }

    // 占有マップ構築
    const occupied = new Set<string>();
    for (const [resId, docId] of assignments) {
      const row = rows.find((r) => r.id === resId)!;
      const time = row.time_slot.slice(0, 5);
      occupied.add(docId + "_" + time);
    }
    occupiedByDate.set(date, occupied);
  }

  // スケジュール外の予約を特定
  type ConflictInfo = {
    resId: number;
    date: string;
    time: string;
    docId: string;
    row: ReservationRow;
  };
  const conflicts: ConflictInfo[] = [];

  for (const date of uniqueDates) {
    const rows = dateReservations.get(date)!;
    const dow = getDayOfWeek(date);
    for (const row of rows) {
      const docId = resDocAssignment.get(row.id);
      if (!docId) continue;
      const time = row.time_slot.slice(0, 5);
      if (!isScheduledSlot(docId, dow, time)) {
        conflicts.push({ resId: row.id, date, time, docId, row });
      }
    }
  }

  console.log(`スケジュール外の予約: ${conflicts.length}件\n`);

  if (conflicts.length === 0) {
    console.log("移動が必要な予約はありません。完了！");
    return;
  }

  // 各コンフリクトを解決
  let movedCount = 0;
  let crossDayCount = 0;
  const moveHistory: {
    resId: number;
    fromDate: string;
    fromTime: string;
    fromDoc: string;
    toDate: string;
    toTime: string;
    toDoc: string;
  }[] = [];

  for (const c of conflicts) {
    const dow = getDayOfWeek(c.date);
    const validSlots = getValidSlots(c.docId, dow);
    const occupied = occupiedByDate.get(c.date)!;
    const origMin = toMin(c.time);

    // 同日・同担当医の空き枠を探す（元の時間に最も近い順）
    const candidates = validSlots
      .filter((t) => !occupied.has(c.docId + "_" + t))
      .sort((a, b) => Math.abs(toMin(a) - origMin) - Math.abs(toMin(b) - origMin));

    let targetDate = c.date;
    let targetTime: string | null = null;
    let targetDoc = c.docId;

    if (candidates.length > 0) {
      targetTime = candidates[0];
    } else {
      // 同日に空きなし → 翌営業日を探す
      let searchDate = nextBusinessDay(c.date);
      const maxSearch = "2026-02-28";
      while (searchDate < maxSearch) {
        const searchDow = getDayOfWeek(searchDate);
        const searchValid = getValidSlots(c.docId, searchDow);
        // この日の占有状態を取得（キャッシュにない場合は空）
        let searchOccupied = occupiedByDate.get(searchDate);
        if (!searchOccupied) {
          searchOccupied = new Set<string>();
          occupiedByDate.set(searchDate, searchOccupied);
        }
        const nextCandidates = searchValid.filter(
          (t) => !searchOccupied.has(c.docId + "_" + t)
        );
        if (nextCandidates.length > 0) {
          targetDate = searchDate;
          targetTime = nextCandidates[0];
          crossDayCount++;
          break;
        }
        searchDate = nextBusinessDay(searchDate);
      }
    }

    if (!targetTime) {
      console.error(`  移動先なし: id=${c.resId} date=${c.date} time=${c.time} doc=${c.docId}`);
      continue;
    }

    // 占有マップ更新
    const oldOccupied = occupiedByDate.get(c.date)!;
    oldOccupied.delete(c.docId + "_" + c.time);
    let newOccupied = occupiedByDate.get(targetDate);
    if (!newOccupied) {
      newOccupied = new Set<string>();
      occupiedByDate.set(targetDate, newOccupied);
    }
    newOccupied.add(targetDoc + "_" + targetTime);

    // DB更新: time_slot + actual_staff_id + date
    const updateFields: Record<string, string> = {
      time_slot: targetTime + ":00",
      actual_staff_id: targetDoc,
    };
    if (targetDate !== c.date) {
      updateFields.date = targetDate;
    }

    const { error: upErr } = await supabase
      .from("reservations")
      .update(updateFields)
      .eq("id", c.resId);

    if (upErr) {
      console.error(`  UPDATE失敗 id=${c.resId}: ${upErr.message}`);
      continue;
    }

    moveHistory.push({
      resId: c.resId,
      fromDate: c.date,
      fromTime: c.time + ":00",
      fromDoc: c.docId,
      toDate: targetDate,
      toTime: targetTime + ":00",
      toDoc: targetDoc,
    });
    movedCount++;

    console.log(
      `  id=${c.resId}: ${c.date} ${c.time} ${c.docId} → ${targetDate} ${targetTime} ${targetDoc}`
    );
  }

  // reservation_move_history に記録
  if (moveHistory.length > 0) {
    const inserts = moveHistory.map((m) => ({
      reservation_id: m.resId,
      from_date: m.fromDate,
      from_time: m.fromTime,
      from_staff_id: m.fromDoc,
      to_date: m.toDate,
      to_time: m.toTime,
      to_staff_id: m.toDoc,
      moved_at: new Date().toISOString(),
    }));
    for (let i = 0; i < inserts.length; i += 50) {
      const batch = inserts.slice(i, i + 50);
      const { error: insertErr } = await supabase
        .from("reservation_move_history")
        .insert(batch);
      if (insertErr) {
        console.error(`  履歴INSERT失敗: ${insertErr.message}`);
      }
    }
  }

  console.log(`\n=== 結果 ===`);
  console.log(`移動した予約: ${movedCount}件`);
  console.log(`  同日移動: ${movedCount - crossDayCount}件`);
  console.log(`  翌日以降移動: ${crossDayCount}件`);
  console.log(`移動履歴記録: ${moveHistory.length}件`);

  // 検証: 移動後にスケジュール外の予約が残っていないか
  console.log("\n=== 検証 ===");
  let remaining = 0;
  for (const date of uniqueDates) {
    const { data: rows } = await supabase
      .from("reservations")
      .select("id, staff_id, time_slot")
      .eq("date", date)
      .neq("status", "cancelled")
      .order("id", { ascending: true });
    if (!rows) continue;
    const assignments = assignDoctorsForDate(rows);
    const dow = getDayOfWeek(date);
    for (const row of rows) {
      const docId = assignments.get(row.id);
      if (!docId) continue;
      const time = row.time_slot.slice(0, 5);
      if (!isScheduledSlot(docId, dow, time)) {
        remaining++;
        console.log(`  残: id=${row.id} date=${date} time=${time} doc=${docId}`);
      }
    }
  }
  console.log(`スケジュール外の予約残数: ${remaining}件`);
  console.log("\n完了！");
}

main();
