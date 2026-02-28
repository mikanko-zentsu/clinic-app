"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { PageLayout } from "@/components/ui/page-layout";
import { NumPad } from "@/components/numpad";
import { ChevronLeft, Trash2 } from "lucide-react";

interface ApiReservation {
  id: string;
  reservationNumber: string;
  date: string;
  timeSlot: string;
  staffId: string | null;
  staffName: string | null;
  actualStaffId: string | null;
  actualStaffName: string | null;
  status: string;
  movedToStaffId: string | null;
  movedToStaffName: string | null;
  moveCount: number;
}

interface Reservation {
  id: string;
  reservationNumber: string;
  date: string;
  startTime: string;
  doctorId: string | null;
  doctorLabel: string;
  patientName: string | null;
  status: string;
  statusLabel: string;
}

type ViewState = "input" | "result";

function buildDoctorLabel(r: ApiReservation): string {
  if (!r.staffId) return "希望なし";
  if (r.moveCount > 0 && r.movedToStaffId && r.movedToStaffId !== r.staffId) {
    return `${r.staffName || r.staffId} 希望 → ${r.movedToStaffName || r.movedToStaffId} に変更`;
  }
  if (r.actualStaffId && r.actualStaffId !== r.staffId) {
    return `${r.staffName || r.staffId} 希望 → ${r.actualStaffName || r.actualStaffId} に変更`;
  }
  return `${r.staffName || r.staffId} 希望`;
}

function maskName(name: string): string {
  return name
    .split(" ")
    .map((part) => (part.length > 0 ? part[0] + "*".repeat(part.length - 1) : ""))
    .join(" ");
}

export default function CheckPage() {
  const router = useRouter();
  const [view, setView] = useState<ViewState>("input");
  const [cardNumber, setCardNumber] = useState("");
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [cancelling, setCancelling] = useState<string | null>(null);
  const [confirmTarget, setConfirmTarget] = useState<Reservation | null>(null);

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr + "T00:00:00");
    const weekdays = ["日", "月", "火", "水", "木", "金", "土"];
    return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日（${weekdays[d.getDay()]}）`;
  };

  const statusLabel = (s: string) => {
    if (s === "visited") return "来院済";
    if (s === "unprocessed") return "未処理";
    return "予約済";
  };

  const handleSearch = async () => {
    if (!cardNumber) {
      setError("診察券番号を入力してください");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/patients/${cardNumber}/reservations`);
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "予約情報の取得に失敗しました");
        return;
      }
      const patientName = data.patient?.name ? maskName(data.patient.name) : null;
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const filtered = (data.reservations as ApiReservation[])
        .filter((r) => r.status !== "cancelled" && new Date(r.date + "T00:00:00") >= today)
        .sort((a, b) => {
          const cmp = a.date.localeCompare(b.date);
          if (cmp !== 0) return cmp;
          return (a.timeSlot || "").localeCompare(b.timeSlot || "");
        })
        .map((r) => ({
          id: r.id,
          reservationNumber: r.reservationNumber,
          date: r.date,
          startTime: r.timeSlot,
          doctorId: r.staffId,
          doctorLabel: buildDoctorLabel(r),
          patientName,
          status: r.status,
          statusLabel: statusLabel(r.status),
        }));
      setReservations(filtered);
      setView("result");
    } catch {
      setError("通信エラーが発生しました");
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async (reservationNumber: string) => {
    const target = reservations.find((r) => r.reservationNumber === reservationNumber);
    setConfirmTarget(null);
    setCancelling(reservationNumber);
    try {
      const res = await fetch("/api/patient/reservations", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reservationId: target?.id }),
      });
      if (!res.ok) {
        setError("予約の取消に失敗しました");
        return;
      }
      // localStorage から予約済みデータを削除
      if (target) {
        const slotKey = `reservation_${target.doctorId ?? "none"}_${target.date}_${target.startTime}`;
        localStorage.removeItem(slotKey);
      }
      setReservations((prev) => prev.filter((r) => r.reservationNumber !== reservationNumber));
    } catch {
      setError("通信エラーが発生しました");
    } finally {
      setCancelling(null);
    }
  };

  // Input view
  if (view === "input") {
    return (
      <PageLayout title="予約確認" description="診察券番号を入力してください">
        <div className="max-w-xs mx-auto">
          <NumPad value={cardNumber} onChange={setCardNumber} maxLength={32} />
        </div>

        {error && <p className="mt-4 text-center text-red-600 font-semibold">{error}</p>}

        <div className="mt-6 flex flex-col gap-3">
          <Button size="lg" onClick={handleSearch} disabled={!cardNumber || loading} className="w-full">
            {loading ? "検索中..." : "予約を検索する"}
          </Button>
          <Button variant="ghost" onClick={() => router.push("/")} className="w-full">
            <ChevronLeft className="h-4 w-4 mr-1" />
            トップに戻る
          </Button>
        </div>
      </PageLayout>
    );
  }

  // Result view
  return (
    <>
      <PageLayout title="予約確認" description="予約情報">
        {reservations.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-slate-500 text-lg">予約が見つかりませんでした</p>
          </div>
        ) : (
          <div className="space-y-4">
            {reservations.map((r) => (
              <div
                key={r.reservationNumber}
                className="rounded-xl bg-[hsl(210_40%_98%)] border border-[hsl(214_32%_91%)] divide-y divide-[hsl(214_32%_91%)]"
              >
                <div className="flex items-center px-5 py-3">
                  <span className="w-28 text-sm font-semibold text-slate-500 flex-shrink-0">予約日時</span>
                  <span className="text-[hsl(222_47%_11%)] font-bold">
                    {formatDate(r.date)}　{r.startTime}〜
                  </span>
                </div>
                <div className="flex items-center px-5 py-3">
                  <span className="w-28 text-sm font-semibold text-slate-500 flex-shrink-0">担当医</span>
                  <span className="text-[hsl(222_47%_11%)] font-bold">{r.doctorLabel}</span>
                </div>
                {r.patientName && (
                  <div className="flex items-center px-5 py-3">
                    <span className="w-28 text-sm font-semibold text-slate-500 flex-shrink-0">お名前</span>
                    <span className="text-[hsl(222_47%_11%)] font-bold">{r.patientName}</span>
                  </div>
                )}
                <div className="flex items-center px-5 py-3">
                  <span className="w-28 text-sm font-semibold text-slate-500 flex-shrink-0">予約番号</span>
                  <span className="text-sky-600 font-black text-xl tracking-wider">{r.reservationNumber}</span>
                </div>
                {r.status === "confirmed" && (
                <div className="px-5 py-3">
                  <Button
                    variant="outline"
                    className="w-full text-red-600 border-red-200 hover:bg-red-50 gap-2"
                    onClick={() => setConfirmTarget(r)}
                    disabled={cancelling === r.reservationNumber}
                  >
                    <Trash2 className="w-4 h-4" />
                    {cancelling === r.reservationNumber ? "取消中..." : "予約取消"}
                  </Button>
                </div>
                )}
              </div>
            ))}
          </div>
        )}

        {error && <p className="mt-4 text-center text-red-600 font-semibold">{error}</p>}

        <div className="mt-6">
          <Button size="lg" onClick={() => router.push("/")} className="w-full">
            確認終了
          </Button>
        </div>
      </PageLayout>

      {/* Cancel confirmation modal */}
      {confirmTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-sm bg-white rounded-2xl shadow-xl p-6">
            <h2 className="text-xl font-bold text-[hsl(222_47%_11%)] mb-4 text-center">
              予約を取り消しますか？
            </h2>

            <div className="rounded-xl bg-[hsl(210_40%_98%)] border border-[hsl(214_32%_91%)] divide-y divide-[hsl(214_32%_91%)] mb-6">
              <div className="flex items-center px-4 py-3">
                <span className="w-24 text-sm font-semibold text-slate-500 flex-shrink-0">日時</span>
                <span className="text-[hsl(222_47%_11%)] font-bold">
                  {formatDate(confirmTarget.date)}　{confirmTarget.startTime}〜
                </span>
              </div>
              <div className="flex items-center px-4 py-3">
                <span className="w-24 text-sm font-semibold text-slate-500 flex-shrink-0">担当医</span>
                <span className="text-[hsl(222_47%_11%)] font-bold">
                  {confirmTarget.doctorLabel}
                </span>
              </div>
              <div className="flex items-center px-4 py-3">
                <span className="w-24 text-sm font-semibold text-slate-500 flex-shrink-0">予約番号</span>
                <span className="text-sky-600 font-black text-lg tracking-wider">{confirmTarget.reservationNumber}</span>
              </div>
            </div>

            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setConfirmTarget(null)}
              >
                閉じる
              </Button>
              <Button
                className="flex-1 bg-red-600 hover:bg-red-700 text-white"
                onClick={() => handleCancel(confirmTarget.reservationNumber)}
              >
                取り消す
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
