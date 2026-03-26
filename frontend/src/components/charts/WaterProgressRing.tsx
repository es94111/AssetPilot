interface Props {
  current: number;
  target: number;
  size?: number;
}

export default function WaterProgressRing({ current, target, size = 120 }: Props) {
  const pct = Math.min(current / target, 1);
  const radius = (size - 12) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - pct);

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#E2E8F0"
          strokeWidth={8}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#3B82F6"
          strokeWidth={8}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-all duration-500"
        />
      </svg>
      <div className="absolute text-center">
        <div className="text-lg font-bold text-text">{current}</div>
        <div className="text-xs text-text-muted">/ {target} ml</div>
      </div>
    </div>
  );
}
