import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  "https://ibdhcyvridkliivwquxi.supabase.co",
  "sb_publishable_rUXidQJDGZaCPOo9T9a_Qw_ypLc-hvn"
);

const STAFF_SLUGS = ["tanaka", "suzuki", "sato"];

function seededRandom(seed: number): number {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

async function main() {
  // actual_staff_id カラムの存在チェック
  const { error: colCheck } = await supabase
    .from("reservations")
    .select("id, actual_staff_id")
    .limit(1);
  if (colCheck) {
    console.error("actual_staff_id カラムが存在しません。");
    return;
  }

  // まず過去予約の actual_staff_id を全リセット
  console.log("過去予約の actual_staff_id をリセット中...");
  let resetFrom = 0;
  let resetTotal = 0;
  while (true) {
    const { data: batch, error: fetchErr } = await supabase
      .from("reservations")
      .select("id")
      .lt("date", "2026-02-28")
      .not("actual_staff_id", "is", null)
      .order("id", { ascending: true })
      .range(resetFrom, resetFrom + 999);
    if (fetchErr || !batch || batch.length === 0) break;
    for (const row of batch) {
      await supabase.from("reservations").update({ actual_staff_id: null }).eq("id", row.id);
    }
    resetTotal += batch.length;
    console.log(`  ${resetTotal}件リセット済`);
    if (batch.length < 1000) break;
    resetFrom += 1000;
  }
  console.log(`リセット完了: ${resetTotal}件`);

  // 過去予約を全件取得（staff_id を含む）
  const allRows: { id: number; staff_id: string | null }[] = [];
  let from = 0;
  const pageSize = 1000;
  while (true) {
    const { data, error } = await supabase
      .from("reservations")
      .select("id, staff_id")
      .lt("date", "2026-02-28")
      .order("id", { ascending: true })
      .range(from, from + pageSize - 1);
    if (error) { console.error("取得エラー:", error.message); return; }
    if (!data || data.length === 0) break;
    allRows.push(...data);
    if (data.length < pageSize) break;
    from += pageSize;
  }

  console.log(`対象予約数: ${allRows.length}件`);

  let seed = 77;
  let sameCount = 0;
  let randomCount = 0;
  const counts: Record<string, number> = { tanaka: 0, suzuki: 0, sato: 0 };

  for (let i = 0; i < allRows.length; i += 100) {
    const batch = allRows.slice(i, i + 100);
    for (const row of batch) {
      let slug: string;
      if (row.staff_id) {
        // 希望ありの場合: actual = 希望通り（staff_id と同じ）
        slug = row.staff_id;
        sameCount++;
      } else {
        // 希望なしの場合: ランダム割り振り
        const idx = Math.floor(seededRandom(seed++) * STAFF_SLUGS.length);
        slug = STAFF_SLUGS[idx];
        randomCount++;
      }
      const { error } = await supabase
        .from("reservations")
        .update({ actual_staff_id: slug })
        .eq("id", row.id);
      if (error) {
        console.error(`ERROR id=${row.id}:`, error.message);
      } else {
        counts[slug]++;
      }
    }
    console.log(`${Math.min(i + 100, allRows.length)} / ${allRows.length} 更新完了`);
  }

  console.log(`希望通り（staff_id=actual）: ${sameCount}件`);
  console.log(`ランダム割り振り（staff_id=null）: ${randomCount}件`);
  console.log(`tanaka: ${counts.tanaka}, suzuki: ${counts.suzuki}, sato: ${counts.sato}`);
  console.log("完了！");
}

main();
