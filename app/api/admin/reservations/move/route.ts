import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { reservationId, fromDate, fromTime, fromStaffId, toDate, toTime, toStaffId } = body;

    if (!reservationId) {
      return NextResponse.json({ error: "reservationId は必須です" }, { status: 400 });
    }

    // 予約のdate/time_slot/staff_idを更新（同日移動のケースもある）
    const updateFields: Record<string, string | null> = {};
    if (toTime !== undefined) updateFields.time_slot = toTime;
    if (toDate !== undefined) updateFields.date = toDate;
    // staff_idは希望担当医（preference）なので移動では変更しない
    // ガントの列移動は表示上の配置であり、staff_id（希望）は変わらない

    if (Object.keys(updateFields).length > 0) {
      const { error: updateError } = await supabase
        .from("reservations")
        .update(updateFields)
        .eq("id", reservationId);

      if (updateError) {
        return NextResponse.json({ error: updateError.message }, { status: 500 });
      }
    }

    // 移動履歴を保存
    const { error: historyError } = await supabase
      .from("reservation_move_history")
      .insert({
        reservation_id: reservationId,
        from_date: fromDate || null,
        from_time: fromTime || null,
        from_staff_id: fromStaffId || null,
        to_date: toDate || null,
        to_time: toTime || null,
        to_staff_id: toStaffId || null,
      });

    if (historyError) {
      console.error("移動履歴の保存に失敗:", historyError.message);
      // 履歴保存失敗は移動自体の失敗にはしない
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "予約の移動に失敗しました" }, { status: 500 });
  }
}
