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
  // 全予約IDを取得
  const allIds: number[] = [];
  let from = 0;
  const pageSize = 1000;
  while (true) {
    const { data, error } = await supabase
      .from("reservations")
      .select("id")
      .order("id", { ascending: true })
      .range(from, from + pageSize - 1);
    if (error) { console.error("取得エラー:", error); return; }
    if (!data || data.length === 0) break;
    data.forEach((r) => allIds.push(r.id));
    if (data.length < pageSize) break;
    from += pageSize;
  }
  console.log(`全予約数: ${allIds.length}`);

  // シード付き乱数で60%をnull、40%をランダム担当医に振り分け
  let nullCount = 0;
  let staffCounts: Record<string, number> = { tanaka: 0, suzuki: 0, sato: 0 };
  let seed = 42;

  const updates: { id: number; staff_id: string | null }[] = [];
  for (const id of allIds) {
    const rand = seededRandom(seed++);
    if (rand < 0.6) {
      updates.push({ id, staff_id: null });
      nullCount++;
    } else {
      const staffIdx = Math.floor(seededRandom(seed++) * STAFF_SLUGS.length);
      const slug = STAFF_SLUGS[staffIdx];
      updates.push({ id, staff_id: slug });
      staffCounts[slug]++;
    }
  }

  console.log(`null(希望なし): ${nullCount}件`);
  console.log(`tanaka: ${staffCounts.tanaka}件, suzuki: ${staffCounts.suzuki}件, sato: ${staffCounts.sato}件`);

  // バッチ更新（100件ずつ）
  for (let i = 0; i < updates.length; i += 100) {
    const batch = updates.slice(i, i + 100);
    for (const u of batch) {
      const { error } = await supabase
        .from("reservations")
        .update({ staff_id: u.staff_id })
        .eq("id", u.id);
      if (error) {
        console.error(`ERROR id=${u.id}:`, error.message);
      }
    }
    console.log(`${Math.min(i + 100, updates.length)} / ${updates.length} 更新完了`);
  }

  console.log("完了！");
}

main();
