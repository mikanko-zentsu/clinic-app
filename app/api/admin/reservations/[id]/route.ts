import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { status, actual_staff_id } = body;

    const updateFields: Record<string, string | null> = {};
    if (status !== undefined) updateFields.status = status;
    if (actual_staff_id !== undefined) updateFields.actual_staff_id = actual_staff_id;

    if (Object.keys(updateFields).length === 0) {
      return NextResponse.json({ error: "更新フィールドがありません" }, { status: 400 });
    }

    let { error } = await supabase
      .from("reservations")
      .update(updateFields)
      .eq("id", id);

    // actual_staff_idカラムが未追加の場合、それを除外してリトライ
    if (error && actual_staff_id !== undefined) {
      delete updateFields.actual_staff_id;
      if (Object.keys(updateFields).length > 0) {
        const retry = await supabase
          .from("reservations")
          .update(updateFields)
          .eq("id", id);
        error = retry.error;
      } else {
        error = null;
      }
    }

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "予約の更新に失敗しました" }, { status: 500 });
  }
}
