import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  "https://ibdhcyvridkliivwquxi.supabase.co",
  "sb_publishable_rUXidQJDGZaCPOo9T9a_Qw_ypLc-hvn"
);

async function main() {
  // テーブルが既に存在するかテスト
  const { error: testError } = await supabase
    .from("reservation_move_history")
    .select("id")
    .limit(1);

  if (!testError) {
    console.log("reservation_move_history テーブルは既に存在します");
    return;
  }

  console.log("テーブルが存在しません。Supabase SQL Editorで以下を実行してください:");
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

-- RLSポリシー（anon keyで読み書き可能に）
ALTER TABLE reservation_move_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for anon" ON reservation_move_history FOR ALL USING (true) WITH CHECK (true);
`);

  // REST APIでテーブル作成はできないので、insertで存在確認のみ
  // テーブルは手動でSQL Editorから作成する必要がある
  // ただし、rpc経由でSQLを実行できるか試みる
  const { error: rpcError } = await supabase.rpc("exec_sql", {
    sql: `
      CREATE TABLE IF NOT EXISTS reservation_move_history (
        id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        reservation_id bigint,
        moved_at timestamptz DEFAULT now(),
        from_date date,
        from_time time,
        from_staff_id text,
        to_date date,
        to_time time,
        to_staff_id text
      );
    `,
  });

  if (rpcError) {
    console.log("RPC経由のテーブル作成は利用できません:", rpcError.message);
    console.log("上記のSQLをSupabase SQL Editorで手動実行してください。");
    console.log("URL: https://supabase.com/dashboard/project/ibdhcyvridkliivwquxi/sql");
  } else {
    console.log("テーブル作成成功！");
  }
}

main();
