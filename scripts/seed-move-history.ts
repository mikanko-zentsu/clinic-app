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
  // テーブル存在チェック
  const { error: tableCheck } = await supabase
    .from("reservation_move_history")
    .select("id")
    .limit(1);
  if (tableCheck) {
    console.error("reservation_move_history テーブルが存在しません。");
    console.log("Supabase SQL Editor で以下を実行してください:");
    console.log(`
CREATE TABLE reservation_move_history (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  reservation_id bigint REFERENCES reservations(id) ON DELETE CASCADE,
  moved_at timestamptz DEFAULT now(),
  from_date date,
  from_time time,
  from_staff_id text,
  to_date date,
  to_time time,
  to_staff_id text
);
ALTER TABLE reservation_move_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for anon" ON reservation_move_history FOR ALL USING (true) WITH CHECK (true);
`);
    return;
  }

  // actual_staff_id カラム存在チェック
  const { error: colCheck } = await supabase
    .from("reservations")
    .select("id, actual_staff_id")
    .limit(1);
  if (colCheck) {
    console.error("actual_staff_id カラムが存在しません。先に seed-actual-staff.ts を実行してください。");
    return;
  }

  // 既存の移動履歴を全削除
  console.log("既存の移動履歴を削除中...");
  const { error: delError } = await supabase
    .from("reservation_move_history")
    .delete()
    .gte("id", 0); // 全行削除
  if (delError) {
    console.error("DELETE失敗:", delError.message);
    return;
  }
  console.log("既存データ削除完了");

  // 全患者を取得
  const { data: patients, error: pErr } = await supabase
    .from("patients")
    .select("id, card_id, name")
    .order("id", { ascending: true });
  if (pErr || !patients) {
    console.error("患者取得失敗:", pErr?.message);
    return;
  }
  console.log(`患者数: ${patients.length}`);

  let seed = 200;
  const inserts: any[] = [];

  for (const patient of patients) {
    // この患者の過去予約（2026-01-01〜2026-02-27）でstaff_id + actual_staff_idありを取得
    const { data: resWithStaff } = await supabase
      .from("reservations")
      .select("id, date, time_slot, staff_id, actual_staff_id")
      .eq("patient_card_id", patient.card_id)
      .gte("date", "2026-01-01")
      .lt("date", "2026-02-28")
      .not("staff_id", "is", null)
      .not("actual_staff_id", "is", null)
      .order("date", { ascending: true });

    const candidates = resWithStaff || [];
    if (candidates.length === 0) continue;

    // ランダムに3件選択（3件未満なら全件）
    const shuffled = candidates.slice();
    for (let i = shuffled.length - 1; i > 0; i--) {
      const r = seededRandom(seed++);
      const j = Math.floor(r * (i + 1));
      const tmp = shuffled[i];
      shuffled[i] = shuffled[j];
      shuffled[j] = tmp;
    }
    const selected = shuffled.slice(0, Math.min(3, shuffled.length));

    for (const res of selected) {
      const fromStaff = res.staff_id as string;
      let toStaff = res.actual_staff_id as string;

      // from と to が同じ場合、別の担当医に変更
      if (toStaff === fromStaff) {
        const others = STAFF_SLUGS.filter((s) => s !== fromStaff);
        const idx = Math.floor(seededRandom(seed++) * others.length);
        toStaff = others[idx];
        // actual_staff_id も更新
        await supabase
          .from("reservations")
          .update({ actual_staff_id: toStaff })
          .eq("id", res.id);
      }

      // moved_at: 予約日の1〜3日前
      const resDate = new Date(res.date + "T10:00:00Z");
      const daysBack = 1 + Math.floor(seededRandom(seed++) * 3);
      const hours = Math.floor(seededRandom(seed++) * 8) + 9;
      const mins = Math.floor(seededRandom(seed++) * 60);
      const movedAt = new Date(resDate);
      movedAt.setDate(movedAt.getDate() - daysBack);
      movedAt.setUTCHours(hours, mins, 0, 0);

      inserts.push({
        reservation_id: res.id,
        from_staff_id: fromStaff,
        to_staff_id: toStaff,
        from_date: res.date,
        to_date: res.date,
        from_time: res.time_slot,
        to_time: res.time_slot,
        moved_at: movedAt.toISOString(),
      });
    }
  }

  console.log(`INSERT対象: ${inserts.length}件`);

  if (inserts.length === 0) {
    console.log("対象データがありません。seed-actual-staff.ts を先に実行してください。");
    return;
  }

  // バッチINSERT
  for (let i = 0; i < inserts.length; i += 50) {
    const batch = inserts.slice(i, i + 50);
    const { error: insertError } = await supabase
      .from("reservation_move_history")
      .insert(batch);
    if (insertError) {
      console.error(`INSERT失敗 (batch ${i}):`, insertError.message);
      return;
    }
  }

  const uniquePatients = new Set(inserts.map((i) => {
    // reservation_id から患者を逆引きはできないが、件数で確認
    return i.reservation_id;
  }));
  console.log(`INSERT成功: ${inserts.length}件（${uniquePatients.size}予約分）`);
  console.log("完了！");
}

main();
