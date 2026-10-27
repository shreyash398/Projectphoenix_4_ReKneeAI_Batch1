import React from 'react';
import { Target, ShieldCheck, Sparkles } from 'lucide-react';

interface KneeVisualProps {
  dayPostOp?: number;
  focusArea?: string;
  className?: string;
  compact?: boolean;
}

export const KneeVisual: React.FC<KneeVisualProps> = ({
  dayPostOp = 14,
  focusArea = 'Right Knee Protocol',
  className = '',
  compact = false,
}) => {
  return (
    <div
      className={`relative flex flex-col items-center justify-center overflow-hidden rounded-3xl bg-gradient-to-b from-slate-50/80 via-white to-slate-50/50 border border-slate-200/80 p-5 ${compact ? 'h-[300px]' : 'h-[380px] sm:h-[420px]'
        } ${className}`}
    >
      {/* Background medical grid & radial glow */}
      <div className="absolute inset-0 bg-[radial-gradient(#0D9488_1px,transparent_1px)] [background-size:20px_20px] opacity-[0.07] pointer-events-none" />
      <div className="absolute w-56 h-56 rounded-full bg-teal-calm/10 blur-3xl pointer-events-none top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />

      {/* Top Protocol Status Pill */}
      <div className="absolute top-4 left-4 z-10 flex items-center gap-2 bg-white/90 backdrop-blur-md px-3 py-1.5 rounded-full border border-slate-200/80 shadow-soft text-xs text-navy-900">
        <span className="w-2 h-2 rounded-full bg-teal-calm animate-pulse" />
        <span className="font-semibold">{focusArea}</span>
        <span className="text-slate-400">·</span>
        <span className="text-slate-500 font-medium">Day {dayPostOp}</span>
      </div>

      {/* Verified Safety Badge on top-right */}
      <div className="absolute top-4 right-4 z-10 hidden sm:flex items-center gap-1.5 bg-teal-light/80 border border-teal-border px-2.5 py-1 rounded-full text-[11px] font-medium text-teal-hover">
        <ShieldCheck className="w-3.5 h-3.5 text-teal-calm" />
        <span>Care Team Monitored</span>
      </div>

      {/* Central Stylized Anatomy SVG */}
      <svg
        viewBox="0 0 320 400"
        className="w-full h-full max-h-[340px] drop-shadow-sm select-none"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id="bodyGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#E2E8F0" />
            <stop offset="50%" stopColor="#CBD5E1" />
            <stop offset="100%" stopColor="#94A3B8" />
          </linearGradient>
          <linearGradient id="activeJointGlow" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#14B8A6" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#0D9488" stopOpacity="0.95" />
          </linearGradient>
          <radialGradient id="beaconGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#0D9488" stopOpacity="0.4" />
            <stop offset="60%" stopColor="#14B8A6" stopOpacity="0.15" />
            <stop offset="100%" stopColor="#0D9488" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Subtle Background Target Arcs */}
        <circle cx="120" cy="210" r="32" stroke="#0D9488" strokeWidth="1" strokeDasharray="3 3" opacity="0.35" />
        <circle cx="120" cy="210" r="48" stroke="#0D9488" strokeWidth="0.75" strokeDasharray="4 4" opacity="0.2" />
        <circle cx="120" cy="210" r="64" stroke="#0D9488" strokeWidth="0.5" strokeDasharray="6 6" opacity="0.15" />

        {/* Pelvis / Hips outline */}
        <path
          d="M 100 40 C 130 35, 190 35, 220 40 C 235 55, 230 75, 215 90 C 185 92, 135 92, 105 90 C 90 75, 85 55, 100 40 Z"
          fill="url(#bodyGradient)"
          opacity="0.45"
          stroke="#94A3B8"
          strokeWidth="1.5"
        />

        {/* LEFT LEG (Observer Right) - Neutral Leg */}
        <path
          d="M 185 92 C 190 125, 195 160, 198 200 C 195 210, 195 220, 198 230 C 200 270, 196 320, 194 360 C 205 365, 210 375, 205 380 C 190 380, 180 375, 180 360 C 180 320, 182 270, 180 230 C 178 220, 178 210, 180 200 C 175 160, 168 125, 165 92 Z"
          fill="url(#bodyGradient)"
          opacity="0.4"
          stroke="#CBD5E1"
          strokeWidth="1.5"
        />
        {/* Left Knee Joint Marker - Neutral */}
        <ellipse cx="189" cy="215" rx="8" ry="7" fill="#CBD5E1" opacity="0.6" />

        {/* RIGHT LEG (Observer Left) - Target Surgical Leg */}
        {/* Thigh (Femur section) */}
        <path
          d="M 135 92 C 130 125, 124 160, 122 195 C 129 198, 132 205, 131 215 C 130 225, 126 230, 120 235 C 114 230, 110 225, 109 215 C 108 205, 111 198, 118 195 C 116 160, 122 125, 135 92 Z"
          fill="url(#bodyGradient)"
          opacity="0.6"
          stroke="#94A3B8"
          strokeWidth="1.5"
        />

        {/* Shin & Calves (Tibia / Fibula section) */}
        <path
          d="M 120 235 C 122 270, 124 320, 126 360 C 115 365, 110 375, 115 380 C 130 380, 140 375, 140 360 C 138 320, 132 270, 130 235 Z"
          fill="url(#bodyGradient)"
          opacity="0.6"
          stroke="#94A3B8"
          strokeWidth="1.5"
        />

        {/* TARGET RIGHT KNEE HERO FOCUS AREA */}
        {/* Beacon halo */}
        <circle cx="120" cy="215" r="40" fill="url(#beaconGlow)" />

        {/* Outer targeting bracket ring */}
        <circle
          cx="120"
          cy="215"
          r="22"
          stroke="#0D9488"
          strokeWidth="2"
          strokeDasharray="4 2"
          className="animate-[spin_18s_linear_infinite]"
        />

        {/* Patella / Joint Capsule Focus Pill */}
        <ellipse
          cx="120"
          cy="215"
          rx="12"
          ry="11"
          fill="url(#activeJointGlow)"
          className="drop-shadow-md"
        />
        <circle cx="120" cy="215" r="4.5" fill="#FFFFFF" />

        {/* Dynamic Angle / Alignment Vector Guide */}
        <path
          d="M 120 170 L 120 215 L 128 260"
          stroke="#0D9488"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity="0.75"
        />

        {/* Horizontal Crosshair Marker Lines */}
        <line x1="85" y1="215" x2="100" y2="215" stroke="#0D9488" strokeWidth="1.5" strokeLinecap="round" />
        <line x1="140" y1="215" x2="155" y2="215" stroke="#0D9488" strokeWidth="1.5" strokeLinecap="round" />
        <line x1="120" y1="180" x2="120" y2="195" stroke="#0D9488" strokeWidth="1.5" strokeLinecap="round" />
        <line x1="120" y1="235" x2="120" y2="250" stroke="#0D9488" strokeWidth="1.5" strokeLinecap="round" />

        {/* Interactive Callout Line to Joint */}
        <path
          d="M 120 215 L 60 160 L 25 160"
          stroke="#0D9488"
          strokeWidth="1.5"
          strokeDasharray="3 2"
          opacity="0.8"
        />
        <circle cx="25" cy="160" r="3" fill="#0D9488" />

        {/* Right-side alignment callout */}
        <path
          d="M 120 215 L 180 160 L 230 160"
          stroke="#94A3B8"
          strokeWidth="1"
          strokeDasharray="3 2"
          opacity="0.5"
        />
        <circle cx="230" cy="160" r="2.5" fill="#94A3B8" />
      </svg>

      {/* Left Callout Card */}
      <div className="absolute left-3 top-[32%] sm:left-6 z-10 bg-white/95 backdrop-blur-md px-3 py-2 rounded-xl border border-slate-200/90 shadow-soft text-left max-w-[130px] sm:max-w-[150px]">
        <div className="flex items-center gap-1 text-[10px] font-bold text-teal-calm uppercase tracking-wider">
          <Target className="w-3 h-3" />
          <span>Active Focus</span>
        </div>
        <p className="text-xs font-semibold text-navy-900 mt-0.5">Right Patella</p>
        <p className="text-[10px] text-slate-500 leading-tight">Extension & Flexion Protocol</p>
      </div>

      {/* Right Callout Card */}
      <div className="absolute right-3 top-[32%] sm:right-6 z-10 bg-white/95 backdrop-blur-md px-3 py-2 rounded-xl border border-slate-200/90 shadow-soft text-left max-w-[130px] sm:max-w-[150px]">
        <div className="flex items-center gap-1 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
          <Sparkles className="w-3 h-3 text-teal-calm" />
          <span>Mobility Goal</span>
        </div>
        <p className="text-xs font-semibold text-navy-900 mt-0.5">Target ROM: 90°</p>
        <p className="text-[10px] text-slate-500 leading-tight">Guided Seated Reps</p>
      </div>

      {/* Bottom Visual Caption Bar */}
      <div className="absolute bottom-3 inset-x-4 flex items-center justify-between bg-white/90 backdrop-blur-md px-3.5 py-2 rounded-2xl border border-slate-200/80 shadow-soft text-xs text-navy-900">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-500" />
          <span className="text-[11px] font-medium text-slate-600">Recovery Status: On Track</span>
        </div>
        <span className="text-[11px] font-semibold text-teal-calm">Post-Operative Plan Active</span>
      </div>
    </div>
  );
};
