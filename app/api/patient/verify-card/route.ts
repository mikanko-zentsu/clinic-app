import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

/**
 * 姓・名それぞれの1文字目のみ残し、残りを「*」でマスクする
 * 例: "山田 花子" → "山* 花*"
 *     "鈴木 一郎" → "鈴* 一*"
 */
function maskName(name: string): string {
  return name
    .split(" ")
    .map((part) => (part.length > 0 ? part[0] + "*".repeat(part.length - 1) : ""))
    .join(" ");
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const cardNumber = searchParams.get("cardNumber");

    if (!cardNumber) {
      return NextResponse.json({ error: "診察券番号が必要です" }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("patients")
      .select("id, name")
      .eq("card_id", cardNumber)
      .single();

    if (error || !data) {
      if (error?.code === "PGRST116") {
        // 該当レコードなし
        return NextResponse.json({ error: "診察券番号が見つかりません" }, { status: 404 });
      }
      return NextResponse.json({ error: error?.message ?? "検索に失敗しました" }, { status: 500 });
    }

    return NextResponse.json({
      patientId: data.id,
      maskedName: maskName(data.name),
    });
  } catch {
    return NextResponse.json({ error: "診察券の照合に失敗しました" }, { status: 500 });
  }
}
