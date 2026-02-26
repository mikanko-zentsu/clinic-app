import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  "https://ibdhcyvridkliivwquxi.supabase.co",
  "sb_publishable_rUXidQJDGZaCPOo9T9a_Qw_ypLc-hvn"
);

const STAFF = ["tanaka", "suzuki", "sato"];
const PATIENT_CARD_IDS = [
  "00001", "00002", "00003", "10234", "10567",
  "11111", "12345", "20018", "20345", "22222",
  "30451", "30789", "33333", "41207", "55023",
  "62891", "71344", "83006", "94512", "99999",
];
const SLOT_MINUTES = [
  "09:00","09:20","09:40","10:00","10:20","10:40","11:00","11:20","11:40","12:00","12:20","12:40",
  "16:00","16:20","16:40","17:00","17:20","17:40","18:00","18:20","18:40","19:00","19:20","19:40"
];
const FILL_RATE = 0.7;

function seededRandom(seed: number): number {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

function getDatesInRange(start: string, end: string): string[] {
  const dates: string[] = [];
  const current = new Date(start);
  const endDate = new Date(end);
  while (current <= endDate) {
    const dow = current.getDay();
    if (dow !== 0) { // 日曜除外
      dates.push(current.toISOString().split("T")[0]);
    }
    current.setDate(current.getDate() + 1);
  }
  return dates;
}

async function main() {
  console.log("既存データを削除中...");
  const { error: deleteError } = await supabase
    .from("reservations")
    .delete()
    .gte("date", "2026-01-01")
    .lte("date", "2026-03-31");
  if (deleteError) {
    console.error("削除エラー:", deleteError);
    return;
  }
  console.log("削除完了");

  const dates = getDatesInRange("2026-01-01", "2026-03-31");
  const records: object[] = [];
  let seed = 1;

  for (const date of dates) {
    // 全スロット×担当医の組み合わせを生成
    const allCombinations: { staff: string; slot: string }[] = [];
    for (const slot of SLOT_MINUTES) {
      for (const staff of STAFF) {
        allCombinations.push({ staff, slot });
      }
    }

    // シャッフル（Fisher-Yates, seeded）
    for (let i = allCombinations.length - 1; i > 0; i--) {
      const j = Math.floor(seededRandom(seed++) * (i + 1));
      [allCombinations[i], allCombinations[j]] = [allCombinations[j], allCombinations[i]];
    }

    // シャッフルされた順に FILL_RATE の確率で予約を割り当て（患者は1日1回まで）
    const usedPatientsForDate = new Set<string>();
    for (const { staff, slot } of allCombinations) {
      if (usedPatientsForDate.size >= PATIENT_CARD_IDS.length) break;
      const rand = seededRandom(seed++);
      if (rand < FILL_RATE) {
        const candidates = PATIENT_CARD_IDS.filter(id => !usedPatientsForDate.has(id));
        const patientIndex = Math.floor(seededRandom(seed++) * candidates.length);
        const patientId = candidates[patientIndex];
        usedPatientsForDate.add(patientId);
        records.push({
          date,
          staff_id: staff,
          time_slot: slot + ":00",
          patient_card_id: patientId,
          status: "confirmed",
        });
      }
    }
  }

  console.log(`挿入するレコード数: ${records.length}`);

  // 500件ずつ分割して挿入
  for (let i = 0; i < records.length; i += 500) {
    const batch = records.slice(i, i + 500);
    const { error } = await supabase.from("reservations").insert(batch);
    if (error) {
      console.error(`挿入エラー (${i}〜):`, error);
      return;
    }
    console.log(`${i + batch.length}件 挿入完了`);
  }

  console.log("完了！");
}

main();
