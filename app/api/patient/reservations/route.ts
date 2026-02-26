import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const date = searchParams.get("date");
  const doctorId = searchParams.get("doctorId");

  if (!date) {
    return NextResponse.json({ error: "date は必須です" }, { status: 400 });
  }

  try {
    let query = supabase
      .from("reservations")
      .select("id, patient_card_id, patient_name, time_slot, staff_id, status")
      .eq("date", date)
      .eq("status", "confirmed");

    if (doctorId) {
      query = query.eq("staff_id", doctorId);
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const reservations = (data ?? []).map((r) => ({
      id: r.id,
      patientId: r.patient_card_id,
      patientName: r.patient_name ?? "",
      time: r.time_slot?.substring(0, 5),
      doctorId: r.staff_id,
      status: r.status,
    }));

    return NextResponse.json({ reservations });
  } catch {
    return NextResponse.json({ error: "予約の取得に失敗しました" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { patientId, patientName, doctorId, date, time } = body;

    if (!patientId || !doctorId || !date || !time) {
      return NextResponse.json(
        { error: "patientId, doctorId, date, time は必須です" },
        { status: 400 }
      );
    }

    // 重複チェック：同日・同医師・同時間にconfirmedの予約があるか
    const { data: existing, error: checkError } = await supabase
      .from("reservations")
      .select("id")
      .eq("date", date)
      .eq("staff_id", doctorId)
      .eq("time_slot", time)
      .eq("status", "confirmed");

    if (checkError) {
      return NextResponse.json({ error: checkError.message }, { status: 500 });
    }

    if (existing && existing.length > 0) {
      return NextResponse.json(
        { error: "この時間帯はすでに予約が入っています" },
        { status: 409 }
      );
    }

    // 予約を作成
    const { data: inserted, error: insertError } = await supabase
      .from("reservations")
      .insert({
        patient_card_id: patientId,
        patient_name: patientName ?? null,
        staff_id: doctorId,
        date: date,
        time_slot: time,
        status: "confirmed",
      })
      .select()
      .single();

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, reservation: inserted }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "予約の作成に失敗しました" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { reservationId } = body;

    if (!reservationId) {
      return NextResponse.json(
        { error: "reservationId は必須です" },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from("reservations")
      .update({ status: "cancelled" })
      .eq("id", reservationId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "予約のキャンセルに失敗しました" }, { status: 500 });
  }
}
