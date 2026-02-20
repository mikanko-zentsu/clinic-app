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
    <div className="grid grid-cols-3 gap-4">
      {doctors.map((doctor) => {
        const isSelected = selectedId === doctor.id;

        return (
          <button
            key={doctor.id}
            type="button"
            onClick={() => onSelect(doctor)}
            className={cn(
              "relative flex flex-col items-center rounded-2xl border-2 pt-6 pb-5 px-3 text-center transition-all active:scale-[0.97] cursor-pointer",
              isSelected
                ? "border-sky-500 bg-sky-50 shadow-lg"
                : "border-[hsl(214_32%_91%)] bg-white hover:border-sky-300 hover:bg-sky-50/40 hover:shadow-md"
            )}
          >
            {/* Selected checkmark */}
            {isSelected && (
              <CheckCircle className="absolute top-2 right-2 h-5 w-5 text-sky-500" />
            )}

            {/* Photo */}
            <DoctorAvatar
              name={doctor.name}
              initials={doctor.initials}
              avatarColor={doctor.avatarColor}
              size="lg"
            />

            {/* Role badge */}
            <span
              className="mt-4 inline-block rounded-full px-3 py-0.5 text-xs font-bold text-white"
              style={{ backgroundColor: doctor.avatarColor }}
            >
              {doctor.role}
            </span>

            {/* Name */}
            <p className="mt-1.5 text-lg font-extrabold text-[hsl(222_47%_11%)] leading-tight">
              {doctor.name}
            </p>
            <p className="text-xs text-slate-400 mb-1">{doctor.nameKana}</p>

            {/* Specialty */}
            <p className="text-xs font-semibold text-sky-600 mb-3">{doctor.specialty}</p>

            {/* Divider */}
            <div className="w-full border-t border-slate-100 pt-3">
              {/* Available weekdays */}
              <p className="text-xs text-slate-400 mb-1.5">診療日</p>
              <div className="flex items-center justify-center gap-1 flex-wrap">
                {WEEKDAY_LABELS.map((label, idx) => {
                  const available = doctor.availableWeekdays.includes(idx);
                  return (
                    <span
                      key={label}
                      className={cn(
                        "inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold",
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
            </div>
          </button>
        );
      })}
    </div>
  );
}
