"use client";

import { useState, useEffect } from "react";
import { DoctorAvatar } from "@/components/doctor-avatar";
import { cn } from "@/lib/utils";
import { CheckCircle } from "lucide-react";

export interface DoctorPublic {
  id: string;
  name: string;
  nameKana: string;
  role: string;
  specialty: string;
  avatarColor: string;
  initials: string;
  availableWeekdays: number[];
  bio: string;
}

const WEEKDAY_LABELS = ["日", "月", "火", "水", "木", "金", "土"];

interface DoctorSelectorProps {
  selectedId: string | null;
  onSelect: (doctor: DoctorPublic) => void;
}

export function DoctorSelector({ selectedId, onSelect }: DoctorSelectorProps) {
  const [doctors, setDoctors] = useState<DoctorPublic[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/patient/doctors")
      .then((r) => r.json())
      .then((data) => setDoctors(data.doctors))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="py-12 text-center text-slate-400">読み込み中...</div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {doctors.map((doctor) => {
        const isSelected = selectedId === doctor.id;

        return (
          <button
            key={doctor.id}
            type="button"
            onClick={() => onSelect(doctor)}
            className={cn(
              "relative flex items-center gap-5 rounded-2xl border-2 p-5 text-left transition-all active:scale-[0.98] cursor-pointer w-full",
              isSelected
                ? "border-sky-500 bg-sky-50 shadow-lg"
                : "border-[hsl(214_32%_91%)] bg-white hover:border-sky-300 hover:bg-sky-50/40 hover:shadow-md"
            )}
          >
            {/* Selected checkmark */}
            {isSelected && (
              <CheckCircle className="absolute top-3 right-3 h-5 w-5 text-sky-500" />
            )}

            {/* Avatar */}
            <div className="flex-shrink-0">
              <DoctorAvatar
                name={doctor.name}
                initials={doctor.initials}
                avatarColor={doctor.avatarColor}
                size="xs"
              />
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline gap-2 mb-2">
                <p className="text-lg font-extrabold text-[hsl(222_47%_11%)] leading-tight">
                  {doctor.name}
                </p>
                <span className="text-sm font-semibold text-slate-500">
                  {doctor.role}
                </span>
              </div>

              {/* Available weekdays */}
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs text-slate-400">診療日</span>
                {WEEKDAY_LABELS.map((label, idx) => {
                  const available = !doctor.availableWeekdays || doctor.availableWeekdays.includes(idx);
                  return (
                    <span
                      key={label}
                      className={cn(
                        "inline-flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold",
                        available
                          ? idx === 0
                            ? "bg-red-100 text-red-600"
                            : idx === 6
                            ? "bg-blue-100 text-blue-600"
                            : "bg-sky-100 text-sky-700"
                          : "bg-slate-100 text-slate-300"
                      )}
                    >
                      {label}
                    </span>
                  );
                })}
              </div>

              <p className="text-xs text-slate-500">
                {doctor.specialty}
                <span className="ml-2 text-slate-400">{doctor.nameKana}</span>
              </p>
            </div>
          </button>
        );
      })}
    </div>
  );
}
