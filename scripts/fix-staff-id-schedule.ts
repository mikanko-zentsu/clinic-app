/**
 * fix-staff-id-schedule.ts
 *
 * staff_id（患者の担当医希望）がスケジュール外の時間帯を指している予約を検出し、
 * staff_id を null にクリアする。
 *
 * 実行: npx ts-node --project tsconfig.scripts.json scripts/fix-staff-id-schedule.ts
 */

import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  "https://ibdhcyvridkliivwquxi.supabase.co",
  "sb_publishable_rUXidQJDGZaCPOo9T9a_Qw_ypLc-hvn"
);

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

function getDayOfWeek(dateStr: string): number {
  return new Date(dateStr + "T00:00:00Z").getUTCDay();
}

async function main() {
  console.log("=== staff_id スケジュール外チェック・修正スクリプト ===\n");

  // 全予約を取得（staff_id が設定されているもののみ）
  const { data: rows, error } = await supabase
    .from("reservations")
    .select("id, date, time_slot, staff_id")
    .lte("date", "2026-03-31")
    .neq("status", "cancelled")
    .not("staff_id", "is", null)
    .order("date")
    .order("id");

  if (error) {
    console.error("取得エラー:", error.message);
    return;
  }

  console.log(`staff_id が設定されている予約: ${(rows ?? []).length}件\n`);

  const toFix: { id: number; date: string; time: string; staffId: string }[] = [];

  for (const r of rows ?? []) {
    const dow = getDayOfWeek(r.date);
    const time = r.time_slot.slice(0, 5);
    if (!isScheduledSlot(r.staff_id, dow, time)) {
      toFix.push({ id: r.id, date: r.date, time, staffId: r.staff_id });
    }
  }

  console.log(`スケジュール外の staff_id: ${toFix.length}件\n`);

  if (toFix.length === 0) {
    console.log("修正が必要な予約はありません。完了！");
    return;
  }

  // 修正実行
  let updated = 0;
  for (const fix of toFix) {
    console.log(`  id=${fix.id} date=${fix.date} time=${fix.time} staff_id=${fix.staffId} → null`);
    const { error: upErr } = await supabase
      .from("reservations")
      .update({ staff_id: null })
      .eq("id", fix.id);
    if (upErr) {
      console.error(`    UPDATE失敗: ${upErr.message}`);
    } else {
      updated++;
    }
  }

  console.log(`\n=== 結果 ===`);
  console.log(`修正した予約: ${updated}件`);

  // 検証
  console.log("\n=== 検証 ===");
  const { data: verify } = await supabase
    .from("reservations")
    .select("id, date, time_slot, staff_id")
    .lte("date", "2026-03-31")
    .neq("status", "cancelled")
    .not("staff_id", "is", null);

  let remaining = 0;
  for (const r of verify ?? []) {
    const dow = getDayOfWeek(r.date);
    const time = r.time_slot.slice(0, 5);
    if (!isScheduledSlot(r.staff_id, dow, time)) {
      remaining++;
      console.log(`  残: id=${r.id} date=${r.date} time=${time} staff_id=${r.staff_id}`);
    }
  }
  console.log(`スケジュール外の staff_id 残数: ${remaining}件`);
  console.log("\n完了！");
}

main();
