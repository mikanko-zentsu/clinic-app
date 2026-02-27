/**
 * fix-actual-staff-sync.ts
 *
 * ガントチャートの担当医割り振りロジック（loadReservationDataForDate, seed=13）と
 * 同じアルゴリズムで past reservations の actual_staff_id を再設定する。
 *
 * ガントチャートのロジック（admin-mockup.html L5532-5581）:
 *   1. staff_id がある予約を先に配置: key = staffId + '_' + time
 *   2. staff_id が null の予約を空きスロットにランダム割り振り:
 *      - docIds = ['tanaka','suzuki','sato']（DOCTORS配列順）
 *      - seed = 13（loadReservationDataForDate）
 *      - Fisher-Yates シャッフル: Math.sin(seed++) * 10000 の小数部
 *      - シャッフル後の docIds から空きスロットを探して最初に見つかった先生に配置
 *   3. API レスポンス順 = Supabase デフォルト（id 昇順）
 *   4. シードは日付ごとにリセット（関数呼び出しごとに var seed = 13）
 *
 * 実行: npx ts-node --project tsconfig.scripts.json scripts/fix-actual-staff-sync.ts
 */

import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  "https://ibdhcyvridkliivwquxi.supabase.co",
  "sb_publishable_rUXidQJDGZaCPOo9T9a_Qw_ypLc-hvn"
);

const DOC_IDS = ["tanaka", "suzuki", "sato"];
const GANTT_SEED = 13; // loadReservationDataForDate のシード値

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

/**
 * ガントチャートと同じ乱数生成
 * Math.sin(seed) * 10000 の小数部を返す
 */
function seededRandom(seed: number): number {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

/**
 * 1日分の予約に対してガントチャートと同じロジックで担当医を割り振る
 * @param rows - その日の全予約（id昇順、cancelled除外済み）
 * @returns resId → assignedDocId のマッピング
 */
function assignDoctorsForDate(
  rows: { id: number; staff_id: string | null; time_slot: string }[],
  dayOfWeek: number
): Map<number, string> {
  const result = new Map<number, string>();
  const occupied: Record<string, boolean> = {}; // key → true

  // Step 1: staff_id がある予約を先に配置（ガントと同じ順序）
  for (const r of rows) {
    if (r.staff_id) {
      const key = r.staff_id + "_" + r.time_slot.slice(0, 5);
      occupied[key] = true;
      result.set(r.id, r.staff_id);
    }
  }

  // Step 2: staff_id が null の予約をランダム割り振り
  let seed = GANTT_SEED;
  for (const r of rows) {
    if (r.staff_id) continue; // 既に配置済み

    const time = r.time_slot.slice(0, 5);

    // Fisher-Yates シャッフル（ガントと完全一致）
    const shuffled = DOC_IDS.slice();
    for (let i = shuffled.length - 1; i > 0; i--) {
      const x = seededRandom(seed++);
      const j = Math.floor(x * (i + 1));
      const tmp = shuffled[i];
      shuffled[i] = shuffled[j];
      shuffled[j] = tmp;
    }

    // シャッフル後の順序で空きスロットを探す（スケジュール内のみ）
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

async function main() {
  console.log("=== actual_staff_id 同期スクリプト ===");
  console.log(`ガントチャートシード値: ${GANTT_SEED} (loadReservationDataForDate)`);

  // 対象日付を全取得（<= 2026-03-31、cancelled 除外、ページネーション対応）
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

  let totalUpdated = 0;
  let totalSkipped = 0;
  let totalMismatch = 0;

  for (const date of uniqueDates) {
    // その日の全予約を取得（id昇順 = Supabaseデフォルト順、ガントAPIと一致）
    const { data: rows, error: rowErr } = await supabase
      .from("reservations")
      .select("id, staff_id, time_slot")
      .eq("date", date)
      .neq("status", "cancelled")
      .order("id", { ascending: true });

    if (rowErr || !rows) {
      console.error(`  ${date}: 取得エラー - ${rowErr?.message}`);
      continue;
    }

    // ガントと同じロジックで担当医を割り振り（スケジュール考慮）
    const dow = getDayOfWeek(date);
    const assignments = assignDoctorsForDate(rows, dow);

    // actual_staff_id を更新
    let dateUpdated = 0;
    for (const [resId, docId] of assignments) {
      const { error: upErr } = await supabase
        .from("reservations")
        .update({ actual_staff_id: docId })
        .eq("id", resId);

      if (upErr) {
        console.error(`  ERROR id=${resId}: ${upErr.message}`);
      } else {
        dateUpdated++;
      }
    }

    totalUpdated += dateUpdated;
    totalSkipped += rows.length - assignments.size;
  }

  console.log(`\n更新完了: ${totalUpdated}件`);
  if (totalSkipped > 0) {
    console.log(`スキップ（割り振り不能）: ${totalSkipped}件`);
  }

  // 検証: 2/27 のデータを表示
  console.log("\n=== 検証: 2026-02-27 ===");
  const { data: verify } = await supabase
    .from("reservations")
    .select("id, time_slot, staff_id, actual_staff_id")
    .eq("date", "2026-02-27")
    .neq("status", "cancelled")
    .order("time_slot", { ascending: true })
    .order("id", { ascending: true });

  if (verify) {
    for (const r of verify) {
      const match = r.staff_id
        ? r.actual_staff_id === r.staff_id
          ? "OK(希望通り)"
          : "MOVE"
        : "OK(割振)";
      console.log(
        `  time=${r.time_slot.slice(0, 5)} staff_id=${(r.staff_id || "null").padEnd(7)} actual=${(r.actual_staff_id || "null").padEnd(7)} ${match}`
      );
    }
  }

  console.log("\n完了！");
}

main();
