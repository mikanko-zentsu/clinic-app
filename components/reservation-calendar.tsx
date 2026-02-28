"use client";

import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface DayCount {
  date: string;
  available: number;
  total: number;
}

interface ReservationCalendarProps {
  onSelectDate: (date: string) => void;
  doctorId?: string | null;
  hideCount?: boolean;
}

const WEEKDAYS = ["月", "火", "水", "木", "金", "土", "日"];

function formatYYYYMMDD(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function ReservationCalendar({ onSelectDate, doctorId, hideCount }: ReservationCalendarProps) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [viewDate, setViewDate] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [dayCounts, setDayCounts] = useState<Map<string, DayCount>>(new Map());
  const [loading, setLoading] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const viewYear = viewDate.getFullYear();
  const viewMonth = viewDate.getMonth() + 1;

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({
      year: String(viewYear),
      month: String(viewMonth),
      ...(doctorId ? { staffId: doctorId } : {}),
    });
    fetch(`/api/available-count?${params}`, { cache: 'no-store' })
      .then((r) => r.json())
      .then((data) => {
        const map = new Map<string, DayCount>();
        for (const d of data.days ?? []) {
          map.set(d.date, d);
        }
        setDayCounts(map);
      })
      .catch(() => setDayCounts(new Map()))
      .finally(() => setLoading(false));
  }, [viewYear, viewMonth, doctorId]);

  const canGoPrev = () => {
    const prev = new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1);
    const thisMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    return prev >= thisMonth;
  };

  const canGoNext = () => {
    const next = new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1);
    const maxMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1);
    return next <= maxMonth;
  };

  const goPrev = () => {
    if (canGoPrev()) {
      setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1));
    }
  };

  const goNext = () => {
    if (canGoNext()) {
      setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1));
    }
  };

  // Build grid: weeks starting Monday
  const firstDay = new Date(viewDate.getFullYear(), viewDate.getMonth(), 1);
  const lastDay = new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 0);

  // Monday-based day offset (0=Mon, 6=Sun)
  const firstDayOfWeek = (firstDay.getDay() + 6) % 7;
  const totalCells = Math.ceil((firstDayOfWeek + lastDay.getDate()) / 7) * 7;

  const cells: (Date | null)[] = [];
  for (let i = 0; i < totalCells; i++) {
    const dayIndex = i - firstDayOfWeek + 1;
    if (dayIndex < 1 || dayIndex > lastDay.getDate()) {
      cells.push(null);
    } else {
      cells.push(new Date(viewDate.getFullYear(), viewDate.getMonth(), dayIndex));
    }
  }

  const handleDayClick = (date: Date) => {
    const dateStr = formatYYYYMMDD(date);
    const info = dayCounts.get(dateStr);
    if (date < today) return;
    // Sunday or no total slots = closed
    if (!info || info.total === 0) return;
    // Full
    if (info.available <= 0) return;
    setSelectedDate(dateStr);
    onSelectDate(dateStr);
  };

  return (
    <div className="select-none">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <Button
          variant="outline"
          size="sm"
          onClick={goPrev}
          disabled={!canGoPrev()}
          className="gap-1"
        >
          <ChevronLeft className="h-4 w-4" />
          前月
        </Button>
        <span className="text-xl font-bold text-slate-800">
          {viewDate.getFullYear()}年{viewDate.getMonth() + 1}月
        </span>
        <Button
          variant="outline"
          size="sm"
          onClick={goNext}
          disabled={!canGoNext()}
          className="gap-1"
        >
          翌月
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Weekday headers */}
      <div className="grid grid-cols-7 mb-1">
        {WEEKDAYS.map((w, i) => (
          <div
            key={w}
            className={cn(
              "text-center text-sm font-semibold py-2",
              i === 5 ? "text-blue-500" : i === 6 ? "text-red-500" : "text-slate-500"
            )}
          >
            {w}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      {loading ? (
        <div className="py-12 text-center text-slate-400">読み込み中...</div>
      ) : (
        <div className="grid grid-cols-7 gap-1">
          {cells.map((date, idx) => {
            if (!date) {
              return <div key={`empty-${idx}`} />;
            }

            const dateStr = formatYYYYMMDD(date);
            const info = dayCounts.get(dateStr);
            const isPast = date < today;
            const isSelected = selectedDate === dateStr;
            const dayOfWeek = (date.getDay() + 6) % 7; // 0=Mon, 5=Sat, 6=Sun

            const isClosed = !info || info.total === 0;
            const isFull = !isClosed && info.available <= 0;
            const isFew = !isClosed && !isFull && info.available <= 3;
            const isAvailable = !isClosed && !isFull && !isFew;
            const isDisabled = isPast || isClosed || isFull;

            return (
              <button
                key={dateStr}
                type="button"
                onClick={() => !isDisabled && handleDayClick(date)}
                disabled={isDisabled}
                className={cn(
                  "relative flex flex-col items-center justify-start rounded-xl py-2 px-1 min-h-[72px] transition-all border-2",
                  isSelected
                    ? "border-sky-500 bg-sky-50"
                    : "border-transparent",
                  isDisabled
                    ? "cursor-not-allowed"
                    : "cursor-pointer hover:bg-slate-50 active:scale-95",
                  isPast
                    ? "bg-slate-100 opacity-60"
                    : isClosed
                    ? "bg-slate-100"
                    : isFull
                    ? "bg-red-50"
                    : isFew
                    ? "bg-amber-50"
                    : isAvailable
                    ? "bg-emerald-50"
                    : ""
                )}
              >
                <span
                  className={cn(
                    "text-sm font-bold",
                    isPast
                      ? "text-slate-400"
                      : dayOfWeek === 5
                      ? "text-blue-600"
                      : dayOfWeek === 6
                      ? "text-red-600"
                      : "text-slate-800"
                  )}
                >
                  {date.getDate()}
                </span>
                {isPast && (
                  <Badge variant="muted" className="mt-1 text-xs px-1 py-0 text-slate-400">
                    不可
                  </Badge>
                )}
                {!isPast && isClosed && (
                  <Badge variant="muted" className="mt-1 text-xs px-1 py-0">
                    休診
                  </Badge>
                )}
                {!isPast && isFull && (
                  <Badge variant="danger" className="mt-1 text-xs px-1 py-0">
                    満
                  </Badge>
                )}
                {!isPast && isFew && (
                  <span className="mt-1 text-xs font-bold text-amber-600">
                    {hideCount ? "△" : `残${info.available}`}
                  </span>
                )}
                {!isPast && isAvailable && (
                  <span className="mt-1 text-xs font-bold text-emerald-600">
                    {hideCount ? "○" : `残${info!.available}`}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
