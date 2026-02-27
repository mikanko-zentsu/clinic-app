/**
 * fix-schedule-conflicts-v2.ts
 *
 * スケジュール対応版の予約移動スクリプト。
 * ガントチャートのスケジュール対応割り振りロジックと同じアルゴリズムで
 * 担当医を割り振り、スケジュール外の予約を有効な枠に移動する。
 *
 * 割り振りロジック:
 *   - staff_id あり → そのまま配置
 *   - staff_id null → Fisher-Yates シャッフル (seed=13) + isScheduledSlot チェック
 *
 * 移動優先順位:
 *   1. 同日・同担当医の有効な空き枠
 *   2. 同日・別担当医の有効な空き枠
 *   3. 翌営業日の空き枠
 *
 * 実行: npx ts-node --project tsconfig.scripts.json scripts/fix-schedule-conflicts-v2.ts
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

/**
 * スケジュール対応版ガント割り振り
 * staff_id=null の予約はスケジュール内の空き枠にのみ配置
 */
function assignDoctorsForDate(
  rows: { id: number; staff_id: string | null; time_slot: string }[],
  dayOfWeek: number
): Map<number, string> {
  const result = new Map<number, string>();
  const occupied: Record<string, boolean> = {};

  // Step 1: staff_id がある予約を先に配置
  for (const r of rows) {
    if (r.staff_id) {
      const key = r.staff_id + "_" + r.time_slot.slice(0, 5);
      occupied[key] = true;
      result.set(r.id, r.staff_id);
    }
  }

  // Step 2: staff_id が null の予約をスケジュール内の空きスロットに割り振り
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
      if (!occupied[key] && isScheduledSlot(docId, dayOfWeek, time)) {
        occupied[key] = true;
        result.set(r.id, docId);
        break;
      }
    }
  }
  return result;
}

function getDayOfWeek(dateStr: string): number {
  return new Date(dateStr + "T00:00:00Z").getUTCDay();
}

function nextBusinessDay(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + 1);
  if (d.getUTCDay() === 0) d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().split("T")[0];
}

interface ReservationRow {
  id: number;
  staff_id: string | null;
  time_slot: string;
  date: string;
  patient_card_id: string;
}

async function main() {
  console.log("=== スケジュール外予約の移動スクリプト v2 ===\n");

  // 全日付を取得（ページネーション対応）
  const allDateRows: { date: string }[] = [];
  let from = 0;
  const pageSize = 1000;
  while (true) {
    const { data: page, error: pageErr } = await supabase
      .from("reservations")
      .select("date")
      .lte("date", "2026-03-31")
      .neq("status", "cancelled")
      .range(from, from + pageSize - 1);
    if (pageErr) {
      console.error("日付取得エラー:", pageErr.message);
      return;
    }
    if (!page || page.length === 0) break;
    allDateRows.push(...page);
    if (page.length < pageSize) break;
    from += pageSize;
  }

  const uniqueDates = [...new Set(allDateRows.map((r) => r.date))].sort();
  console.log(`対象日数: ${uniqueDates.length}日`);

  // 日付ごとの全予約をキャッシュ
  const dateReservations: Map<string, ReservationRow[]> = new Map();
  for (const date of uniqueDates) {
    const { data: rows } = await supabase
      .from("reservations")
      .select("id, staff_id, time_slot, date, patient_card_id")
      .eq("date", date)
      .neq("status", "cancelled")
      .order("id", { ascending: true });
    dateReservations.set(date, rows ?? []);
  }

  // 各日付のスケジュール対応割り振りを計算
  const resDocAssignment: Map<number, string> = new Map();
  const occupiedByDate: Map<string, Set<string>> = new Map();

  for (const date of uniqueDates) {
    const rows = dateReservations.get(date)!;
    const dow = getDayOfWeek(date);
    const assignments = assignDoctorsForDate(rows, dow);

    for (const [resId, docId] of assignments) {
      resDocAssignment.set(resId, docId);
    }

    const occupied = new Set<string>();
    for (const [resId, docId] of assignments) {
      const row = rows.find((r) => r.id === resId)!;
      occupied.add(docId + "_" + row.time_slot.slice(0, 5));
    }
    occupiedByDate.set(date, occupied);
  }

  // 割り振られなかった予約 + スケジュール外に配置された予約を特定
  type ConflictInfo = {
    resId: number;
    date: string;
    time: string;
    docId: string | null;
    row: ReservationRow;
    reason: string;
  };
  const conflicts: ConflictInfo[] = [];

  for (const date of uniqueDates) {
    const rows = dateReservations.get(date)!;
    const dow = getDayOfWeek(date);
    for (const row of rows) {
      const docId = resDocAssignment.get(row.id);
      const time = row.time_slot.slice(0, 5);
      if (!docId) {
        // 割り振りされなかった（全ドクターのスロットが埋まっている or スケジュール外）
        conflicts.push({ resId: row.id, date, time, docId: null, row, reason: "未割当" });
      } else if (!isScheduledSlot(docId, dow, time)) {
        // staff_id ありで配置されたがスケジュール外
        conflicts.push({ resId: row.id, date, time, docId, row, reason: "スケジュール外" });
      }
    }
  }

  console.log(`問題のある予約: ${conflicts.length}件\n`);

  if (conflicts.length === 0) {
    console.log("移動が必要な予約はありません。完了！");
    return;
  }

  // 各コンフリクトを解決
  let movedCount = 0;
  let crossDayCount = 0;
  let crossDocCount = 0;
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
    const origMin = toMin(c.time);
    const occupied = occupiedByDate.get(c.date)!;
    const origDoc = c.docId || c.row.staff_id || "tanaka";

    let targetDate = c.date;
    let targetTime: string | null = null;
    let targetDoc: string = origDoc;

    // 1. 同日・同担当医の有効な空き枠
    const sameDocSlots = getValidSlots(origDoc, dow)
      .filter((t) => !occupied.has(origDoc + "_" + t))
      .sort((a, b) => Math.abs(toMin(a) - origMin) - Math.abs(toMin(b) - origMin));

    if (sameDocSlots.length > 0) {
      targetTime = sameDocSlots[0];
      targetDoc = origDoc;
    }

    // 2. 同日・別担当医の有効な空き枠
    if (!targetTime) {
      for (const altDoc of DOC_IDS) {
        if (altDoc === origDoc) continue;
        const altSlots = getValidSlots(altDoc, dow)
          .filter((t) => !occupied.has(altDoc + "_" + t))
          .sort((a, b) => Math.abs(toMin(a) - origMin) - Math.abs(toMin(b) - origMin));
        if (altSlots.length > 0) {
          targetTime = altSlots[0];
          targetDoc = altDoc;
          crossDocCount++;
          break;
        }
      }
    }

    // 3. 翌営業日の空き枠
    if (!targetTime) {
      let searchDate = nextBusinessDay(c.date);
      const maxSearch = "2026-04-01";
      while (searchDate < maxSearch) {
        const searchDow = getDayOfWeek(searchDate);
        let searchOccupied = occupiedByDate.get(searchDate);
        if (!searchOccupied) {
          searchOccupied = new Set<string>();
          occupiedByDate.set(searchDate, searchOccupied);
        }
        // 同担当医優先
        for (const doc of [origDoc, ...DOC_IDS.filter((d) => d !== origDoc)]) {
          const slots = getValidSlots(doc, searchDow)
            .filter((t) => !searchOccupied.has(doc + "_" + t));
          if (slots.length > 0) {
            targetDate = searchDate;
            targetTime = slots[0];
            targetDoc = doc;
            crossDayCount++;
            break;
          }
        }
        if (targetTime) break;
        searchDate = nextBusinessDay(searchDate);
      }
    }

    if (!targetTime) {
      console.error(`  移動先なし: id=${c.resId} date=${c.date} time=${c.time} doc=${origDoc}`);
      continue;
    }

    // 占有マップ更新
    if (c.docId) {
      occupied.delete(c.docId + "_" + c.time);
    }
    let newOccupied = occupiedByDate.get(targetDate);
    if (!newOccupied) {
      newOccupied = new Set<string>();
      occupiedByDate.set(targetDate, newOccupied);
    }
    newOccupied.add(targetDoc + "_" + targetTime);

    // DB更新
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
      fromDoc: origDoc,
      toDate: targetDate,
      toTime: targetTime + ":00",
      toDoc: targetDoc,
    });
    movedCount++;

    console.log(
      `  id=${c.resId}: ${c.date} ${c.time} ${origDoc} → ${targetDate} ${targetTime} ${targetDoc}${targetDoc !== origDoc ? ' [別担当]' : ''}`
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
  console.log(`  同日・同担当医: ${movedCount - crossDayCount - crossDocCount}件`);
  console.log(`  同日・別担当医: ${crossDocCount}件`);
  console.log(`  翌日以降: ${crossDayCount}件`);

  // 検証: 再割り振りしてスケジュール外が残っていないか
  console.log("\n=== 検証 ===");
  let remaining = 0;
  let unassigned = 0;
  for (const date of uniqueDates) {
    const { data: rows } = await supabase
      .from("reservations")
      .select("id, staff_id, time_slot")
      .eq("date", date)
      .neq("status", "cancelled")
      .order("id", { ascending: true });
    if (!rows) continue;
    const dow = getDayOfWeek(date);
    const assignments = assignDoctorsForDate(rows, dow);
    for (const row of rows) {
      const docId = assignments.get(row.id);
      const time = row.time_slot.slice(0, 5);
      if (!docId) {
        unassigned++;
      } else if (!isScheduledSlot(docId, dow, time)) {
        remaining++;
        console.log(`  残: id=${row.id} date=${date} time=${time} doc=${docId}`);
      }
    }
  }
  console.log(`スケジュール外の予約残数: ${remaining}件`);
  if (unassigned > 0) {
    console.log(`未割当の予約: ${unassigned}件`);
  }
  console.log("\n完了！");
}

main();
