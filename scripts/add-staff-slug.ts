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

async function main() {
  const updates = [
    { id: 11, slug: "tanaka" },
    { id: 12, slug: "suzuki" },
    { id: 13, slug: "sato" },
  ];
  for (const u of updates) {
    const { error } = await supabase
      .from("staff")
      .update({ slug: u.slug })
      .eq("id", u.id);
    if (error) console.error(`failed: ${u.id} ->`, error.message);
    else console.log(`updated: ${u.id} -> ${u.slug}`);
  }
}

main();
