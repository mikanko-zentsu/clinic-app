"use client";

import { useState, useEffect, useMemo, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageLayout } from "@/components/ui/page-layout";
import { NumPad } from "@/components/numpad";
import { ReservationCalendar } from "@/components/reservation-calendar";
import { DoctorSelector, type DoctorPublic } from "@/components/doctor-selector";
import { DoctorAvatar } from "@/components/doctor-avatar";
import { CheckCircle, ChevronLeft, Clock, Printer } from "lucide-react";

type Step = "doctor" | "calendar" | "time" | "card" | "confirm" | "complete";

interface Slot {
  startTime: string;
  endTime: string;
  capacity: number;
  reservedCount: number;
}

interface SlotsResponse {
  date: string;
  closed: boolean;
  reason?: string;
  slots: Slot[];
}

const STEP_ORDER_DOCTOR: Step[] = ["doctor", "calendar", "time", "card", "confirm", "complete"];
const STEP_ORDER_DATE: Step[] = ["calendar", "time", "card", "confirm", "complete"];

const STEP_LABELS_DOCTOR: { key: Step; label: string }[] = [
  { key: "doctor", label: "担当医" },
  { key: "calendar", label: "日付" },
  { key: "time", label: "時間" },
  { key: "card", label: "診察券" },
  { key: "confirm", label: "確認" },
];

const STEP_LABELS_DATE: { key: Step; label: string }[] = [
  { key: "calendar", label: "日付" },
  { key: "time", label: "時間" },
  { key: "card", label: "診察券" },
  { key: "confirm", label: "確認" },
];

function StepIndicator({ current, mode }: { current: Step; mode: "doctor" | "date" }) {
  const stepOrder = mode === "doctor" ? STEP_ORDER_DOCTOR : STEP_ORDER_DATE;
  const stepLabels = mode === "doctor" ? STEP_LABELS_DOCTOR : STEP_LABELS_DATE;
  const currentIndex = stepOrder.indexOf(current);

  return (
    <div className="flex items-center justify-center gap-0 mb-6 px-2">
      {stepLabels.map((s, idx) => {
        const stepIndex = stepOrder.indexOf(s.key);
        const isDone = stepIndex < currentIndex;
        const isCurrent = stepIndex === currentIndex;

        return (
          <div key={s.key} className="flex items-center">
            <div className="flex flex-col items-center">
              <div
                className={`
                  w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors
                  ${isDone
                    ? "bg-sky-500 text-white"
                    : isCurrent
                    ? "bg-sky-500 text-white ring-4 ring-sky-100"
                    : "bg-slate-200 text-slate-400"
                  }
                `}
              >
                {isDone ? "✓" : idx + 1}
              </div>
              <span
                className={`mt-1 text-xs font-medium ${isCurrent ? "text-sky-700" : isDone ? "text-sky-500" : "text-slate-400"}`}
              >
                {s.label}
              </span>
            </div>
            {idx < stepLabels.length - 1 && (
              <div
                className={`w-8 h-0.5 mb-4 mx-1 transition-colors ${stepIndex < currentIndex ? "bg-sky-400" : "bg-slate-200"}`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

function ReserveContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const mode = (searchParams.get("mode") === "date" ? "date" : "doctor") as "doctor" | "date";

  const [step, setStep] = useState<Step>(mode === "date" ? "calendar" : "doctor");
  const [selectedDoctor, setSelectedDoctor] = useState<DoctorPublic | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [cardNumber, setCardNumber] = useState<string>("");
  const [maskedName, setMaskedName] = useState<string | null>(null);
  const [reservationNumber, setReservationNumber] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(10);
  const [slots, setSlots] = useState<SlotsResponse | null>(null);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [verifying, setVerifying] = useState(false);

  // Fetch slots when reaching time step
  useEffect(() => {
    if (step === "time" && selectedDate) {
      setSlotsLoading(true);
      setSlots(null);
      const params = new URLSearchParams({ date: selectedDate });
      if (selectedDoctor) params.set("doctorId", selectedDoctor.id);
      fetch(`/api/patient/reservations/slots?${params}`)
        .then((r) => r.json())
        .then((data) => setSlots(data))
        .catch(() => setError("スロット情報の取得に失敗しました"))
        .finally(() => setSlotsLoading(false));
    }
  }, [step, selectedDate, selectedDoctor]);

  // Countdown on complete
  useEffect(() => {
    if (step !== "complete") return;
    const timer = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          clearInterval(timer);
          router.push("/");
          return 0;
        }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [step, router]);

  // Split slots into morning/afternoon
  const { morningSlots, afternoonSlots } = useMemo(() => {
    if (!slots?.slots) return { morningSlots: [], afternoonSlots: [] };
    return {
      morningSlots: slots.slots.filter((s) => {
        const [h] = s.startTime.split(":").map(Number);
        return h < 13;
      }),
      afternoonSlots: slots.slots.filter((s) => {
        const [h] = s.startTime.split(":").map(Number);
        return h >= 13;
      }),
    };
  }, [slots]);

  // Navigation
  const goBack = () => {
    setError(null);
    if (step === "doctor") router.push("/");
    else if (step === "calendar") {
      if (mode === "doctor") setStep("doctor");
      else router.push("/");
    }
    else if (step === "time") setStep("calendar");
    else if (step === "card") setStep("time");
    else if (step === "confirm") setStep("card");
    else router.push("/");
  };

  // Handlers
  const handleDoctorSelect = (doctor: DoctorPublic) => {
    setSelectedDoctor(doctor);
    setError(null);
    setTimeout(() => setStep("calendar"), 250);
  };

  const handleDateSelect = (date: string) => {
    setSelectedDate(date);
    setError(null);
    setTimeout(() => setStep("time"), 250);
  };

  const handleTimeSelect = (slot: Slot) => {
    if (slot.reservedCount >= slot.capacity) return;
    setSelectedTime(slot.startTime);
    setStep("card");
    setError(null);
  };

  const handleCardVerify = async () => {
    if (!cardNumber) { setError("診察券番号を入力してください"); return; }
    setVerifying(true);
    setError(null);
    try {
      const res = await fetch(`/api/patient/verify-card?cardNumber=${cardNumber}`);
      const data = await res.json();
      if (!res.ok || !data.valid) {
        setError(data.error ?? "診察券番号が見つかりません");
        return;
      }
      setMaskedName(data.maskedName);
      setStep("confirm");
    } catch {
      setError("通信エラーが発生しました。もう一度お試しください。");
    } finally {
      setVerifying(false);
    }
  };

  const handleConfirm = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/patient/reservations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cardNumber,
          date: selectedDate,
          startTime: selectedTime,
          doctorId: selectedDoctor?.id ?? null,
          doctorName: selectedDoctor?.name ?? null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "予約の登録に失敗しました");
        return;
      }
      setReservationNumber(data.reservation.reservationNumber);
      setCountdown(10);
      setStep("complete");
    } catch {
      setError("通信エラーが発生しました。もう一度お試しください。");
    } finally {
      setSubmitting(false);
    }
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr + "T00:00:00");
    const weekdays = ["日", "月", "火", "水", "木", "金", "土"];
    return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日（${weekdays[d.getDay()]}）`;
  };

  // Doctor banner (reused in calendar/time steps)
  const DoctorBanner = selectedDoctor ? (
    <div className="flex items-center gap-3 mb-5 p-3 rounded-xl bg-sky-50 border border-sky-100">
      <DoctorAvatar
        name={selectedDoctor.name}
        initials={selectedDoctor.initials}
        avatarColor={selectedDoctor.avatarColor}
        size="sm"
      />
      <div>
        <p className="font-bold text-[hsl(222_47%_11%)]">{selectedDoctor.name}</p>
        <p className="text-xs text-slate-500">{selectedDoctor.specialty}</p>
      </div>
    </div>
  ) : null;

  return (
    <>
      {/* ── Step: Doctor ── */}
      {step === "doctor" && (
        <PageLayout title="担当医を選択してください" description="ご希望の担当医をタップしてください">
          <StepIndicator current={step} mode={mode} />
          <DoctorSelector selectedId={selectedDoctor?.id ?? null} onSelect={handleDoctorSelect} />

          {error && <p className="mt-4 text-center text-red-600 font-semibold">{error}</p>}

          <div className="mt-6">
            <Link href="/" className="block">
              <Button variant="ghost" className="w-full">
                <ChevronLeft className="h-4 w-4 mr-1" />
                トップに戻る
              </Button>
            </Link>
          </div>
        </PageLayout>
      )}

      {/* ── Step: Calendar ── */}
      {step === "calendar" && (
        <PageLayout
          title="日付を選択してください"
          description={selectedDoctor ? `担当: ${selectedDoctor.name} ${selectedDoctor.role}` : "予約したい日をタップしてください"}
        >
          <StepIndicator current={step} mode={mode} />
          {DoctorBanner}
          <ReservationCalendar onSelectDate={handleDateSelect} doctorId={selectedDoctor?.id} />

          {error && <p className="mt-4 text-center text-red-600 font-semibold">{error}</p>}

          <div className="mt-6">
            <Button variant="ghost" onClick={goBack} className="w-full">
              <ChevronLeft className="h-4 w-4 mr-1" />
              戻る
            </Button>
          </div>
        </PageLayout>
      )}

      {/* ── Step: Time ── */}
      {step === "time" && (
        <PageLayout
          title="時間を選択してください"
          description={selectedDate ? formatDate(selectedDate) : ""}
        >
          <StepIndicator current={step} mode={mode} />
          {DoctorBanner}

          {slotsLoading && <p className="py-12 text-center text-slate-400">読み込み中...</p>}

          {!slotsLoading && slots?.closed && (
            <div className="py-8 text-center">
              <p className="text-slate-600 font-semibold text-lg">{slots.reason ?? "この日は休診日です"}</p>
            </div>
          )}

          {!slotsLoading && slots && !slots.closed && (
            <div className="space-y-6">
              {morningSlots.length > 0 && (
                <div>
                  <h3 className="text-sm font-bold text-slate-500 tracking-wide mb-3 flex items-center gap-2">
                    <Clock className="h-4 w-4" />午前
                  </h3>
                  <div className="grid grid-cols-3 gap-2">
                    {morningSlots.map((slot) => {
                      const remaining = slot.capacity - slot.reservedCount;
                      const isFull = remaining <= 0;
                      return (
                        <button
                          key={slot.startTime}
                          type="button"
                          onClick={() => !isFull && handleTimeSelect(slot)}
                          disabled={isFull}
                          className={`flex flex-col items-center justify-center rounded-xl p-3 border-2 transition-all
                            ${isFull
                              ? "border-red-100 bg-red-50 opacity-50 cursor-not-allowed"
                              : "border-sky-200 bg-sky-50 hover:bg-sky-100 active:scale-95 cursor-pointer"
                            }`}
                        >
                          <span className="text-lg font-bold text-[hsl(222_47%_11%)]">{slot.startTime}</span>

                          {isFull
                            ? <Badge variant="danger" className="mt-1">満</Badge>
                            : mode === "date" ? <Badge variant="success" className="mt-1">残 {remaining}</Badge> : null
                          }
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {afternoonSlots.length > 0 && (
                <div>
                  <h3 className="text-sm font-bold text-slate-500 tracking-wide mb-3 flex items-center gap-2">
                    <Clock className="h-4 w-4" />午後
                  </h3>
                  <div className="grid grid-cols-3 gap-2">
                    {afternoonSlots.map((slot) => {
                      const remaining = slot.capacity - slot.reservedCount;
                      const isFull = remaining <= 0;
                      return (
                        <button
                          key={slot.startTime}
                          type="button"
                          onClick={() => !isFull && handleTimeSelect(slot)}
                          disabled={isFull}
                          className={`flex flex-col items-center justify-center rounded-xl p-3 border-2 transition-all
                            ${isFull
                              ? "border-red-100 bg-red-50 opacity-50 cursor-not-allowed"
                              : "border-sky-200 bg-sky-50 hover:bg-sky-100 active:scale-95 cursor-pointer"
                            }`}
                        >
                          <span className="text-lg font-bold text-[hsl(222_47%_11%)]">{slot.startTime}</span>

                          {isFull
                            ? <Badge variant="danger" className="mt-1">満</Badge>
                            : mode === "date" ? <Badge variant="success" className="mt-1">残 {remaining}</Badge> : null
                          }
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {error && <p className="mt-4 text-center text-red-600 font-semibold">{error}</p>}

          <div className="mt-6">
            <Button variant="ghost" onClick={goBack} className="w-full">
              <ChevronLeft className="h-4 w-4 mr-1" />戻る
            </Button>
          </div>
        </PageLayout>
      )}

      {/* ── Step: Card ── */}
      {step === "card" && (
        <PageLayout title="診察券番号を入力してください" description="番号をタップして入力してください">
          <StepIndicator current={step} mode={mode} />
          <div className="max-w-xs mx-auto">
            <NumPad value={cardNumber} onChange={setCardNumber} maxLength={32} />
          </div>

          {error && <p className="mt-4 text-center text-red-600 font-semibold">{error}</p>}

          <div className="mt-6 flex flex-col gap-3">
            <Button size="lg" onClick={handleCardVerify} disabled={!cardNumber || verifying} className="w-full">
              {verifying ? "確認中..." : "確認する"}
            </Button>
            <Button variant="ghost" onClick={goBack} className="w-full">
              <ChevronLeft className="h-4 w-4 mr-1" />戻る
            </Button>
          </div>
        </PageLayout>
      )}

      {/* ── Step: Confirm ── */}
      {step === "confirm" && (
        <PageLayout title="予約内容を確認してください">
          <StepIndicator current={step} mode={mode} />

          <div className="space-y-4">
            <div className="rounded-xl bg-[hsl(210_40%_98%)] border border-[hsl(214_32%_91%)] divide-y divide-[hsl(214_32%_91%)]">
              {selectedDoctor && (
                <div className="flex items-center px-5 py-4 gap-3">
                  <span className="w-28 text-sm font-semibold text-slate-500 flex-shrink-0">担当医</span>
                  <div className="flex items-center gap-3">
                    <DoctorAvatar
                      name={selectedDoctor.name}
                      initials={selectedDoctor.initials}
                      avatarColor={selectedDoctor.avatarColor}
                      size="sm"
                    />
                    <div>
                      <p className="font-bold text-[hsl(222_47%_11%)]">{selectedDoctor.name}</p>
                      <p className="text-xs text-slate-500">{selectedDoctor.specialty}</p>
                    </div>
                  </div>
                </div>
              )}
              <div className="flex items-center px-5 py-4">
                <span className="w-28 text-sm font-semibold text-slate-500">日付</span>
                <span className="text-[hsl(222_47%_11%)] font-bold">{selectedDate ? formatDate(selectedDate) : "—"}</span>
              </div>
              <div className="flex items-center px-5 py-4">
                <span className="w-28 text-sm font-semibold text-slate-500">時間</span>
                <span className="text-[hsl(222_47%_11%)] font-bold">{selectedTime}</span>
              </div>
              <div className="flex items-center px-5 py-4">
                <span className="w-28 text-sm font-semibold text-slate-500">お名前</span>
                <span className="text-[hsl(222_47%_11%)] font-bold">{maskedName}</span>
              </div>
              <div className="flex items-center px-5 py-4">
                <span className="w-28 text-sm font-semibold text-slate-500">診察券番号</span>
                <span className="text-[hsl(222_47%_11%)] font-bold font-mono">{cardNumber}</span>
              </div>
            </div>
            <p className="text-center text-slate-500 text-sm pt-2">
              上記の内容で予約を確定します。よろしいですか？
            </p>
          </div>

          {error && <p className="mt-4 text-center text-red-600 font-semibold">{error}</p>}

          <div className="mt-6 flex flex-col gap-3">
            <Button size="lg" onClick={handleConfirm} disabled={submitting} className="w-full">
              {submitting ? "予約中..." : "予約を確定する"}
            </Button>
            <Button variant="ghost" onClick={goBack} className="w-full">
              <ChevronLeft className="h-4 w-4 mr-1" />戻る
            </Button>
          </div>
        </PageLayout>
      )}

      {/* ── Step: Complete ── */}
      {step === "complete" && (
        <div className="min-h-screen flex flex-col items-center justify-center bg-[hsl(210_40%_98%)] px-4">
          <div className="w-full max-w-xl text-center">
            <div className="flex justify-center mb-6">
              <CheckCircle className="w-20 h-20 text-sky-500" />
            </div>
            <h1 className="text-3xl font-extrabold text-[hsl(222_47%_11%)] mb-2">
              予約が完了しました
            </h1>

            {selectedDoctor && (
              <div className="flex items-center justify-center gap-3 mb-3">
                <DoctorAvatar
                  name={selectedDoctor.name}
                  initials={selectedDoctor.initials}
                  avatarColor={selectedDoctor.avatarColor}
                  size="sm"
                />
                <span className="text-slate-700 font-semibold">{selectedDoctor.name} {selectedDoctor.role}</span>
              </div>
            )}

            <p className="text-slate-500 mb-8">
              {selectedDate ? formatDate(selectedDate) : ""}{selectedTime ? `　${selectedTime}〜` : ""}
            </p>

            <div className="bg-white rounded-2xl border border-[hsl(214_32%_91%)] shadow-sm p-8 mb-4">
              <p className="text-sm text-slate-500 mb-2">予約番号</p>
              <p className="text-6xl font-black text-sky-600 tracking-widest">
                {reservationNumber}
              </p>
            </div>

            {/* Print button */}
            <Button
              variant="secondary"
              className="w-full mb-6 gap-3 text-xl py-8 rounded-2xl"
              onClick={() => window.print()}
            >
              <Printer className="w-6 h-6" />
              印刷する
            </Button>

            <p className="text-slate-400 text-sm">{countdown}秒後にトップページへ戻ります</p>
            <Button variant="outline" className="mt-4" onClick={() => router.push("/")}>
              今すぐ戻る
            </Button>
          </div>
        </div>
      )}

      {/* ── 印刷専用コンテンツ（@media print でのみ表示）── */}
      {step === "complete" && (
        <div id="reservation-print" style={{ display: "none" }}>
          <div style={{ borderBottom: "2px solid #000", paddingBottom: "12px", marginBottom: "20px" }}>
            <h1 style={{ fontSize: "20px", fontWeight: "bold", margin: "0 0 4px 0" }}>
              健援堂鍼灸整骨院
            </h1>
            <p style={{ fontSize: "13px", color: "#555", margin: 0 }}>予約完了のお知らせ</p>
          </div>

          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "15px" }}>
            <tbody>
              <tr style={{ borderBottom: "1px solid #ddd" }}>
                <td style={{ padding: "10px 0", fontWeight: "bold", width: "120px", color: "#555" }}>予約番号</td>
                <td style={{ padding: "10px 0", fontSize: "24px", fontWeight: "900", letterSpacing: "0.1em" }}>
                  {reservationNumber}
                </td>
              </tr>
              <tr style={{ borderBottom: "1px solid #ddd" }}>
                <td style={{ padding: "10px 0", fontWeight: "bold", color: "#555" }}>予約日時</td>
                <td style={{ padding: "10px 0" }}>
                  {selectedDate ? formatDate(selectedDate) : ""}
                  {selectedTime ? `　${selectedTime}〜` : ""}
                </td>
              </tr>
              {selectedDoctor && (
                <tr style={{ borderBottom: "1px solid #ddd" }}>
                  <td style={{ padding: "10px 0", fontWeight: "bold", color: "#555" }}>担当医</td>
                  <td style={{ padding: "10px 0" }}>
                    {selectedDoctor.name}　{selectedDoctor.role}
                  </td>
                </tr>
              )}
              <tr>
                <td style={{ padding: "10px 0", fontWeight: "bold", color: "#555" }}>電話番号</td>
                <td style={{ padding: "10px 0" }}>03-0000-0000</td>
              </tr>
            </tbody>
          </table>

          <p style={{ marginTop: "28px", fontSize: "12px", color: "#888", textAlign: "center" }}>
            お時間になりましたら受付にお声がけください。
          </p>
        </div>
      )}
    </>
  );
}

export default function ReservePage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-slate-400">読み込み中...</div>}>
      <ReserveContent />
    </Suspense>
  );
}
