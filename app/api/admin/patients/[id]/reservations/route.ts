import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // まず患者のcard_idを取得
    const { data: patient, error: patientError } = await supabase
      .from("patients")
      .select("card_id, name")
      .eq("id", id)
      .single();

    if (patientError || !patient) {
      return NextResponse.json({ error: "患者が見つかりません" }, { status: 404 });
    }

    // card_idに紐づく全予約を取得（2026年3月末まで）
    // actual_staff_idカラムが存在しない場合にも対応
    let data: any[] | null = null;
    let hasActualStaff = true;
    {
      const res = await supabase
        .from("reservations")
        .select("id, date, time_slot, staff_id, actual_staff_id, status, patient_name")
        .eq("patient_card_id", patient.card_id)
        .lte("date", "2026-03-31")
        .order("date", { ascending: true })
        .order("time_slot", { ascending: true });
      if (res.error) {
        // actual_staff_idカラムが未追加の場合、カラムなしで再取得
        hasActualStaff = false;
        const res2 = await supabase
          .from("reservations")
          .select("id, date, time_slot, staff_id, status, patient_name")
          .eq("patient_card_id", patient.card_id)
          .lte("date", "2026-03-31")
          .order("date", { ascending: true })
          .order("time_slot", { ascending: true });
        if (res2.error) {
          return NextResponse.json({ error: res2.error.message }, { status: 500 });
        }
        data = res2.data;
      } else {
        data = res.data;
      }
    }

    // スタッフ情報を取得して名前をマッピング
    const { data: staffList } = await supabase
      .from("staff")
      .select("id, slug, name");

    const staffMap = new Map<string, string>();
    for (const s of staffList ?? []) {
      staffMap.set(String(s.id), s.name);
      if (s.slug) staffMap.set(s.slug, s.name);
    }

    // 移動履歴を取得（テーブルが存在しない場合も安全にスキップ）
    const resIds = (data ?? []).map((r: any) => r.id);
    type MoveHistoryRow = { reservation_id: number; to_staff_id: string | null; moved_at: string };
    const moveHistoryMap = new Map<number, MoveHistoryRow[]>();
    if (resIds.length > 0) {
      try {
        const { data: historyData } = await supabase
          .from("reservation_move_history")
          .select("reservation_id, to_staff_id, moved_at")
          .in("reservation_id", resIds)
          .order("moved_at", { ascending: true });
        if (historyData) {
          for (const h of historyData as MoveHistoryRow[]) {
            if (!moveHistoryMap.has(h.reservation_id)) {
              moveHistoryMap.set(h.reservation_id, []);
            }
            moveHistoryMap.get(h.reservation_id)!.push(h);
          }
        }
      } catch {
        // reservation_move_historyテーブルが存在しない場合はスキップ
      }
    }

    const reservations = (data ?? []).map((r: any) => {
      const history = moveHistoryMap.get(r.id) || [];
      const lastMove = history.length > 0 ? history[history.length - 1] : null;
      const actualStaffId = hasActualStaff ? (r.actual_staff_id || null) : null;
      return {
        id: r.id,
        reservationNumber: "R" + String(r.id).substring(0, 8),
        date: r.date,
        timeSlot: r.time_slot?.substring(0, 5),
        staffId: r.staff_id,
        staffName: r.staff_id ? (staffMap.get(String(r.staff_id)) ?? r.staff_id) : null,
        actualStaffId,
        actualStaffName: actualStaffId ? (staffMap.get(String(actualStaffId)) ?? actualStaffId) : null,
        status: r.status,
        movedToStaffId: lastMove?.to_staff_id || null,
        movedToStaffName: lastMove?.to_staff_id ? (staffMap.get(String(lastMove.to_staff_id)) ?? lastMove.to_staff_id) : null,
        moveCount: history.length,
      };
    });

    return NextResponse.json({ patient: { id, name: patient.name, card_id: patient.card_id }, reservations });
  } catch {
    return NextResponse.json({ error: "予約一覧の取得に失敗しました" }, { status: 500 });
  }
}
