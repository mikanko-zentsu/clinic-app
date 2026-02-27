import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const date = searchParams.get("date");
  const doctorId = searchParams.get("doctorId");
  const cardNumber = searchParams.get("cardNumber");

  try {
    // cardNumber指定: 患者の全予約を返す（checkページ用）
    if (cardNumber) {
      let query = supabase
        .from("reservations")
        .select("id, patient_card_id, patient_name, date, time_slot, staff_id, status")
        .eq("patient_card_id", cardNumber)
        .neq("status", "cancelled")
        .order("date", { ascending: true })
        .order("time_slot", { ascending: true });

      if (date) {
        query = query.eq("date", date);
      }

      const { data, error } = await query;
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      // スタッフ名をマッピング
      const { data: staffList } = await supabase
        .from("staff")
        .select("id, slug, name");
      const staffMap = new Map<string, string>();
      for (const s of staffList ?? []) {
        staffMap.set(String(s.id), s.name);
        if (s.slug) staffMap.set(s.slug, s.name);
      }

      // 患者名をマスク
      const { data: patient } = await supabase
        .from("patients")
        .select("name")
        .eq("card_id", cardNumber)
        .single();

      const maskedName = patient?.name
        ? patient.name.replace(/^(.).*/, "$1〇〇")
        : null;

      const statusLabel = (s: string) => {
        if (s === "visited") return "来院済";
        if (s === "unprocessed") return "未処理";
        return "予約済";
      };

      const reservations = (data ?? []).map((r) => ({
        id: r.id,
        reservationNumber: "R" + String(r.id).substring(0, 8),
        cardNumber: r.patient_card_id,
        date: r.date,
        startTime: r.time_slot?.substring(0, 5),
        doctorId: r.staff_id,
        doctorName: staffMap.get(String(r.staff_id)) ?? r.staff_id,
        maskedName,
        status: r.status,
        statusLabel: statusLabel(r.status),
      }));

      return NextResponse.json({ reservations });
    }

    // date指定: 日付ベースの予約一覧（従来の動作）
    if (!date) {
      return NextResponse.json({ error: "date または cardNumber は必須です" }, { status: 400 });
    }

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
