import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import path from "path";

// .env.local を手動で読み込む
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

const patients = [
  { card_id: "11111", name: "佐々木 健太", phone: "090-1111-1111" },
  { card_id: "22222", name: "田村 幸子", phone: "090-2222-2222" },
  { card_id: "33333", name: "伊藤 博", phone: "090-3333-3333" },
];

const reservations = [
  { staff_id: "tanaka", date: "2026-02-26", time_slot: "09:00", patient_card_id: "00001", status: "confirmed" },
  { staff_id: "tanaka", date: "2026-02-26", time_slot: "09:20", patient_card_id: "11111", status: "confirmed" },
  { staff_id: "suzuki", date: "2026-02-26", time_slot: "09:20", patient_card_id: "00002", status: "confirmed" },
  { staff_id: "suzuki", date: "2026-02-26", time_slot: "10:00", patient_card_id: "22222", status: "confirmed" },
  { staff_id: "sato",   date: "2026-02-26", time_slot: "09:00", patient_card_id: "00003", status: "confirmed" },
  { staff_id: "sato",   date: "2026-02-26", time_slot: "10:20", patient_card_id: "33333", status: "confirmed" },
];

async function main() {
  // 1. 患者データを投入（既存チェックしてなければinsert）
  for (const p of patients) {
    const { data: existing } = await supabase
      .from("patients")
      .select("card_id")
      .eq("card_id", p.card_id)
      .limit(1);

    if (existing && existing.length > 0) {
      console.log(`  skip (exists): ${p.card_id} ${p.name}`);
      continue;
    }

    const { error: pErr } = await supabase.from("patients").insert(p);
    if (pErr) {
      console.error(`  Patient insert failed (${p.card_id}):`, pErr.message);
    } else {
      console.log(`  inserted: ${p.card_id} -> ${p.name}`);
    }
  }

  // 2. 既存の同日予約を削除してから再投入
  const { error: delError } = await supabase
    .from("reservations")
    .delete()
    .eq("date", "2026-02-26");

  if (delError) {
    console.error("Delete failed:", delError.message);
    process.exit(1);
  }
  console.log("Existing reservations for 2026-02-26 deleted.");

  // 3. 予約データをinsert
  const { data, error } = await supabase
    .from("reservations")
    .insert(reservations)
    .select();

  if (error) {
    console.error("Insert failed:", error.message);
    process.exit(1);
  }

  console.log(`${data.length} reservations inserted:`);
  data.forEach((r) => console.log(`  ${r.staff_id} ${r.time_slot} -> ${r.patient_card_id}`));
}

main();
