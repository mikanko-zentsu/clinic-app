import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const date = searchParams.get("date");
  const month = searchParams.get("month"); // YYYY-MM

  if (!date && !month) {
    return NextResponse.json({ error: "date または month は必須です" }, { status: 400 });
  }

  try {
    let query = supabase
      .from("reservations")
      .select("id, patient_card_id, staff_id, date, time_slot, status");

    let newPatients = 0;

    if (month && /^\d{4}-\d{2}$/.test(month)) {
      const [y, m] = month.split("-").map(Number);
      const daysInMonth = new Date(y, m, 0).getDate();
      const startDate = `${month}-01`;
      const endDate = `${month}-${String(daysInMonth).padStart(2, "0")}`;
      query = query.gte("date", startDate).lte("date", endDate).limit(5000);

      // 新患数: 対象月に予約があり、それ以前に予約が一切ない患者数
      // 対象月の患者一覧は query 実行後に算出（下で計算）
    } else if (date) {
      query = query.eq("date", date).neq("status", "cancelled").order("id", { ascending: true });
    } else {
      return NextResponse.json({ error: "Invalid params" }, { status: 400 });
    }

    const { data, error } = await query;

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

    const staffCount = staffRes.data?.length ?? 3;

    // 新患数算出（month モードのみ）
    if (month && cardIds.length > 0) {
      const startDate = `${month}-01`;
      // 対象月より前に予約がある患者を取得
      const { data: priorData } = await supabase
        .from("reservations")
        .select("patient_card_id")
        .in("patient_card_id", cardIds)
        .lt("date", startDate);
      const priorSet = new Set((priorData ?? []).map((r) => r.patient_card_id));
      newPatients = cardIds.filter((id) => !priorSet.has(id)).length;
    }

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

    return NextResponse.json({ reservations, staffCount, newPatients });
  } catch {
    return NextResponse.json({ error: "予約一覧の取得に失敗しました" }, { status: 500 });
  }
}
