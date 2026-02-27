/**
 * fix-duplicate-reservations.ts
 *
 * 1日1人1件ルール違反を修正する。
 * 重複している予約のうち、id が最も小さい1件を残し、残りを cancelled に更新。
 *
 * 実行: npx ts-node --project tsconfig.scripts.json scripts/fix-duplicate-reservations.ts
 */

import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  "https://ibdhcyvridkliivwquxi.supabase.co",
  "sb_publishable_rUXidQJDGZaCPOo9T9a_Qw_ypLc-hvn"
);

async function main() {
  console.log("=== 1日1人1件ルール違反修正スクリプト ===\n");

  // 全予約を取得（cancelled除外）
  const { data: rows, error } = await supabase
    .from("reservations")
    .select("id, date, patient_card_id, time_slot, staff_id, actual_staff_id, status")
    .lte("date", "2026-03-31")
    .neq("status", "cancelled")
    .order("date")
    .order("id");

  if (error) {
    console.error("取得エラー:", error.message);
    return;
  }

  console.log(`全予約数: ${(rows ?? []).length}件`);

  // 日付×患者でグルーピング
  const grouped: Record<string, typeof rows> = {};
  for (const r of rows ?? []) {
    const key = `${r.date}_${r.patient_card_id}`;
    if (!grouped[key]) grouped[key] = [];
    grouped[key]!.push(r);
  }

  // 重複を特定
  const toCancelIds: number[] = [];
  let dupPairs = 0;

  for (const [key, group] of Object.entries(grouped)) {
    if (!group || group.length <= 1) continue;
    dupPairs++;
    // id が最小の1件を残し、残りをキャンセル
    const sorted = group.sort((a, b) => a.id - b.id);
    const keep = sorted[0];
    const extras = sorted.slice(1);
    console.log(`  ${key}: ${group.length}件 → 保持 id=${keep.id}(${keep.time_slot.slice(0, 5)}), キャンセル ${extras.map(e => `id=${e.id}(${e.time_slot.slice(0, 5)})`).join(", ")}`);
    for (const e of extras) {
      toCancelIds.push(e.id);
    }
  }

  console.log(`\n重複組数: ${dupPairs}組`);
  console.log(`キャンセル対象: ${toCancelIds.length}件\n`);

  if (toCancelIds.length === 0) {
    console.log("修正不要。完了！");
    return;
  }

  // バッチでキャンセル更新
  let cancelled = 0;
  for (let i = 0; i < toCancelIds.length; i += 50) {
    const batch = toCancelIds.slice(i, i + 50);
    const { error: upErr } = await supabase
      .from("reservations")
      .update({ status: "cancelled" })
      .in("id", batch);
    if (upErr) {
      console.error(`  UPDATE失敗: ${upErr.message}`);
    } else {
      cancelled += batch.length;
    }
  }

  console.log(`キャンセル完了: ${cancelled}件\n`);

  // 検証: 重複残数チェック
  console.log("=== 検証 ===");
  const { data: verify } = await supabase
    .from("reservations")
    .select("date, patient_card_id")
    .lte("date", "2026-03-31")
    .neq("status", "cancelled");

  const verifyGrouped: Record<string, number> = {};
  for (const r of verify ?? []) {
    const key = `${r.date}_${r.patient_card_id}`;
    verifyGrouped[key] = (verifyGrouped[key] || 0) + 1;
  }

  let remaining = 0;
  for (const [key, cnt] of Object.entries(verifyGrouped)) {
    if (cnt > 1) {
      remaining++;
      console.log(`  残: ${key}: ${cnt}件`);
    }
  }
  console.log(`重複違反残数: ${remaining}組`);

  // 日別件数チェック
  console.log("\n=== 日別予約件数 ===");
  const dateCount: Record<string, number> = {};
  for (const r of verify ?? []) {
    dateCount[r.date] = (dateCount[r.date] || 0) + 1;
  }
  const sortedDates = Object.entries(dateCount).sort();
  let not20 = 0;
  for (const [date, cnt] of sortedDates) {
    const dow = new Date(date + "T00:00:00Z").getUTCDay();
    const isSaturday = dow === 6;
    if (cnt !== 20 && !isSaturday) {
      console.log(`  ${date}(${["日","月","火","水","木","金","土"][dow]}): ${cnt}件 *** NOT 20 ***`);
      not20++;
    } else if (isSaturday) {
      console.log(`  ${date}(土): ${cnt}件`);
    }
  }
  console.log(`平日で20件でない日: ${not20}日`);
  console.log("\n完了！");
}

main();
