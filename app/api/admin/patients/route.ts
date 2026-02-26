import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const search = searchParams.get("search");

  try {
    let query = supabase
      .from("patients")
      .select("id, name, kana, dob, gender, zip, phone, address, notes, card_id");

    if (search) {
      query = query.or(`name.ilike.%${search}%,card_id.ilike.%${search}%`);
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ patients: data ?? [] });
  } catch {
    return NextResponse.json({ error: "患者一覧の取得に失敗しました" }, { status: 500 });
  }
}
