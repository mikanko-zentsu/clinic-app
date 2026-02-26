import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET(_req: NextRequest) {
  try {
    const { data, error } = await supabase
      .from("staff")
      .select("id, name, role, color, slug");

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ staff: data ?? [] });
  } catch {
    return NextResponse.json({ error: "スタッフ一覧の取得に失敗しました" }, { status: 500 });
  }
}
