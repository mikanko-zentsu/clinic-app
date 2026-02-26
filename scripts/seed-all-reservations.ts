import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import path from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const envPath = path.resolve(__dirname, "../.env.local");
readFileSync(envPath, "utf-8").split("\n").forEach((line) => {
  const match = line.match(/^([^#=]+)=(.*)$/);
  if (match) process.env[match[1].trim()] = match[2].trim();
});

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// 予約パターン
const pattern: Record<string, string[]> = {
  tanaka: ["09:00","09:20","10:00","10:20","11:00","11:40","16:00","16:40","17:20","18:00"],
  suzuki: ["09:20","09:40","10:40","11:20","12:00","16:20","17:00","17:40"],
  sato:   ["09:00","10:00","10:20","11:00","12:20","16:00","16:40","17:20","18:20"],
};

const cardIds = ["00001","00002","00003","11111","22222","33333"];
const TODAY = "2026-02-26";

function toDateStr(d: Date): string {
  return d.getFullYear() + "-" +
    String(d.getMonth() + 1).padStart(2, "0") + "-" +
    String(d.getDate()).padStart(2, "0");
}

// 過去日付のステータスを割り当て（92% visited, 5% unprocessed, 3% cancelled）
function assignPastStatus(idx: number): string {
  const r = idx % 100;
  if (r < 92) return "visited";
  if (r < 97) return "unprocessed";
  return "cancelled";
}

async function main() {
  const start = new Date(2026, 0, 1); // 2026-01-01
  const end = new Date(2026, 2, 31);  // 2026-03-31

  const rows: any[] = [];
  let cardIdx = 0;
  let pastIdx = 0;

  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const dow = d.getDay();
    if (dow === 0) continue; // 日曜除外

    const dateStr = toDateStr(d);
    const isPast = dateStr < TODAY;

    for (const [staffId, slots] of Object.entries(pattern)) {
      for (const time of slots) {
        rows.push({
          staff_id: staffId,
          date: dateStr,
          time_slot: time,
          patient_card_id: cardIds[cardIdx % cardIds.length],
          status: isPast ? assignPastStatus(pastIdx++) : "confirmed",
        });
        cardIdx++;
      }
    }
  }

  console.log(`Generated ${rows.length} reservations for ${toDateStr(start)} ~ ${toDateStr(end)}`);

  // 全既存データを削除
  const { error: delError } = await supabase
    .from("reservations")
    .delete()
    .neq("id", 0);

  if (delError) {
    console.error("Delete failed:", delError.message);
    process.exit(1);
  }
  console.log("All existing reservations deleted.");

  // Supabase insert は1000行制限があるのでバッチで投入
  const BATCH = 500;
  let inserted = 0;

  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH);
    const { data, error } = await supabase
      .from("reservations")
      .insert(batch)
      .select("id");

    if (error) {
      console.error(`Batch ${i / BATCH + 1} failed:`, error.message);
      process.exit(1);
    }
    inserted += data.length;
    process.stdout.write(`\r  Inserted: ${inserted} / ${rows.length}`);
  }

  console.log(`\nDone! ${inserted} reservations inserted.`);
}

main();
