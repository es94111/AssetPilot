"use client";

import { useEffect, useState } from "react";

/**
 * AssetPilot 品牌入場動畫。
 *
 * 於 App 啟動時顯示一次（以 sessionStorage 記錄，同一工作階段只播放一次），
 * 播放完畢後淡出移除。使用純 CSS keyframes，搭配 prefers-reduced-motion
 * 尊重使用者減少動畫的偏好。
 */
export default function SplashIntro() {
  const [phase, setPhase] = useState<"idle" | "show" | "done">("idle");

  useEffect(() => {
    // 同一工作階段只播放一次；已播放過則直接跳過。
    let played = false;
    try {
      played = sessionStorage.getItem("assetpilot-splash-played") === "1";
    } catch {
      /* ignore */
    }
    if (played) {
      setPhase("done");
      return;
    }

    setPhase("show");
    const timer = window.setTimeout(() => {
      setPhase("done");
      try {
        sessionStorage.setItem("assetpilot-splash-played", "1");
      } catch {
        /* ignore */
      }
    }, 2100);
    return () => window.clearTimeout(timer);
  }, []);

  if (phase === "idle") return null;

  return (
    <div
      className={`splash-overlay ${phase === "done" ? "is-done" : ""}`}
      aria-hidden="true"
    >
      <div className="splash-blob splash-blob-1" />
      <div className="splash-blob splash-blob-2" />
      <div className="splash-blob splash-blob-3" />

      <div className="splash-box">
        <div className="splash-logo">
          <svg viewBox="0 0 512 512" width="60" height="60" role="img">
            <defs>
              <linearGradient id="splashBar1" x1="0" y1="1" x2="0" y2="0">
                <stop offset="0" stopColor="#a5b4fc" />
                <stop offset="1" stopColor="#ffffff" />
              </linearGradient>
              <linearGradient id="splashBar2" x1="0" y1="1" x2="0" y2="0">
                <stop offset="0" stopColor="#c4b5fd" />
                <stop offset="1" stopColor="#ffffff" />
              </linearGradient>
              <linearGradient id="splashCoin" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stopColor="#fbbf24" />
                <stop offset="1" stopColor="#f59e0b" />
              </linearGradient>
            </defs>
            <rect
              x="80"
              y="300"
              width="60"
              height="130"
              rx="12"
              fill="url(#splashBar1)"
              opacity="0.9"
            />
            <rect
              x="165"
              y="240"
              width="60"
              height="190"
              rx="12"
              fill="url(#splashBar2)"
              opacity="0.95"
            />
            <rect
              x="250"
              y="180"
              width="60"
              height="250"
              rx="12"
              fill="#ffffff"
            />
            <polyline
              points="110,280 195,215 280,150 380,105"
              fill="none"
              stroke="#ffffff"
              strokeWidth="12"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <circle
              cx="395"
              cy="300"
              r="62"
              fill="url(#splashCoin)"
              stroke="#ffffff"
              strokeWidth="8"
            />
            <text
              x="395"
              y="324"
              textAnchor="middle"
              fontFamily="Arial, sans-serif"
              fontWeight="bold"
              fontSize="68"
              fill="#ffffff"
            >
              $
            </text>
          </svg>
        </div>

        <div className="splash-ring" />

        <div className="splash-name">
          Asset<span>Pilot</span>
        </div>
        <div className="splash-tagline">Your Assets, Your Control</div>

        <div className="splash-bar">
          <i />
          <i />
          <i />
          <i />
          <i />
        </div>
      </div>

      <div className="splash-progress" />
    </div>
  );
}
