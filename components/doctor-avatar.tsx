import { UserRound } from "lucide-react";

interface DoctorAvatarProps {
  name: string;
  initials: string;
  avatarColor: string;
  size?: "sm" | "md" | "lg";
}

const sizeMap = {
  sm: { outer: "w-14 h-14", iconSize: 30, borderWidth: 2 },
  md: { outer: "w-20 h-20", iconSize: 44, borderWidth: 3 },
  lg: { outer: "w-32 h-32", iconSize: 72, borderWidth: 3 },
};

export function DoctorAvatar({ avatarColor, size = "md" }: DoctorAvatarProps) {
  const { outer, iconSize, borderWidth } = sizeMap[size];

  return (
    <div
      className={`${outer} rounded-full flex items-center justify-center flex-shrink-0 bg-slate-50 overflow-hidden`}
      style={{
        border: `${borderWidth}px solid ${avatarColor}`,
        boxShadow: `0 0 0 1px ${avatarColor}22`,
      }}
    >
      {/* Shoulder area (bottom arc) */}
      <div className="relative w-full h-full flex flex-col items-center justify-end overflow-hidden">
        {/* Head */}
        <div
          className="absolute rounded-full"
          style={{
            backgroundColor: avatarColor,
            opacity: 0.85,
            width: iconSize * 0.42,
            height: iconSize * 0.42,
            top: "22%",
            left: "50%",
            transform: "translateX(-50%)",
          }}
        />
        {/* Shoulders */}
        <div
          className="absolute rounded-full"
          style={{
            backgroundColor: avatarColor,
            opacity: 0.7,
            width: iconSize * 0.9,
            height: iconSize * 0.7,
            bottom: "-20%",
            left: "50%",
            transform: "translateX(-50%)",
          }}
        />
      </div>
    </div>
  );
}
