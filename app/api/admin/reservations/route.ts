import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const date = searchParams.get("date");

  if (!date) {
    return NextResponse.json({ error: "date は必須です" }, { status: 400 });
  }

  try {
    const { data, error } = await supabase
      .from("reservations")
      .select("id, patient_card_id, staff_id, date, time_slot, status")
      .eq("date", date)
      .neq("status", "cancelled");

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // 患者名・スタッフ名を一括取得
    const cardIds = [...new Set((data ?? []).map((r) => r.patient_card_id))];

    const [patientsRes, staffRes] = await Promise.all([
      cardIds.length > 0
        ? supabase.from("patients").select("card_id, name").in("card_id", cardIds)
        : { data: [], error: null },
      supabase.from("staff").select("slug, name"),
    ]);

    const patientMap: Record<string, string> = {};
    (patientsRes.data ?? []).forEach((p: any) => { patientMap[p.card_id] = p.name; });

    const staffMap: Record<string, string> = {};
    (staffRes.data ?? []).forEach((s: any) => { staffMap[s.slug] = s.name; });

    const reservations = (data ?? []).map((r) => ({
      id: r.id,
      patientId: r.patient_card_id,
      patientName: patientMap[r.patient_card_id] ?? "",
      staffId: r.staff_id,
      staffName: staffMap[r.staff_id] ?? "",
      date: r.date,
      time: r.time_slot,
      status: r.status,
    }));

    return NextResponse.json({ reservations });
  } catch {
    return NextResponse.json({ error: "予約一覧の取得に失敗しました" }, { status: 500 });
  }
}
