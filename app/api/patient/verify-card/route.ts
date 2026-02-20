import { NextRequest, NextResponse } from "next/server";

// Mock patient database（姓と名をスペースで区切って保持）
const MOCK_PATIENTS: Record<string, string> = {
  "00001": "山田 太郎",
  "00002": "田中 花子",
  "00003": "佐藤 次郎",
  "12345": "鈴木 一郎",
  "99999": "高橋 美咲",
};

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
  const { searchParams } = new URL(req.url);
  const cardNumber = searchParams.get("cardNumber");

  if (!cardNumber) {
    return NextResponse.json({ error: "診察券番号が必要です" }, { status: 400 });
  }

  const fullName = MOCK_PATIENTS[cardNumber];

  if (!fullName) {
    // デモ用：4桁以上の数字はすべて受け付ける
    if (/^\d{4,}$/.test(cardNumber)) {
      return NextResponse.json({ valid: true, maskedName: maskName("山田 太郎") });
    }
    return NextResponse.json(
      { valid: false, error: "診察券番号が見つかりません" },
      { status: 404 }
    );
  }

  return NextResponse.json({ valid: true, maskedName: maskName(fullName) });
}
