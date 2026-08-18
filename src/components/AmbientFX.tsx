import { useEffect, useMemo, useRef, useState } from "react";
import { useAccessibility } from "@/context/AccessibilityContext";
import { useSeason } from "@/context/SeasonContext";

/**
 * Hyper-detailed ambient effects layer: aurora orbs, drifting dust motes,
 * twinkling sparkles, light rays, film grain and a cursor-tracked glow.
 * Client-only (mounted after hydration) so randomised values never mismatch SSR.
 */

const SEASON_SPARKS: Record<string, string[]> = {
  SPRING: ["#FF8AA6", "#FFC454", "#58D6B6", "#BA84FF", "#70DCFF"],
  SUMMER: ["#FFC454", "#FF8370", "#58D6B6", "#70DCFF", "#FF6FB5"],
  AUTUMN: ["#FF9A3C", "#FFC454", "#FF6F61", "#BA84FF", "#F2D74E"],
  WINTER: ["#70DCFF", "#A9C7FF", "#FFFFFF", "#BA84FF", "#58D6B6"],
};

const CONFETTI_COLORS = ["#FF8AA6", "#FFC454", "#58D6B6", "#BA84FF", "#70DCFF", "#FF8370"];

const RIBBONS = [
  { top: "8vh", rot: -10, dur: 28, color: "linear-gradient(90deg, rgba(255,196,84,0) 0%, rgba(255,196,84,0.55) 35%, rgba(255,138,166,0.5) 65%, rgba(255,138,166,0) 100%)" },
  { top: "44vh", rot: 6, dur: 36, color: "linear-gradient(90deg, rgba(88,214,182,0) 0%, rgba(88,214,182,0.5) 40%, rgba(112,220,255,0.45) 70%, rgba(112,220,255,0) 100%)" },
  { top: "76vh", rot: -6, dur: 44, color: "linear-gradient(90deg, rgba(186,132,255,0) 0%, rgba(186,132,255,0.5) 45%, rgba(255,138,166,0.42) 75%, rgba(255,138,166,0) 100%)" },
];


interface Spark {
  id: number;
  left: number;
  top: number;
  size: number;
  delay: number;
  duration: number;
  color: string;
}

interface Mote {
  id: number;
  left: number;
  size: number;
  delay: number;
  duration: number;
  drift: number;
  opacity: number;
}

export default function AmbientFX() {
  const { sensoryMode } = useAccessibility();
  const { season } = useSeason();
  const [mounted, setMounted] = useState(false);
  const glowRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!mounted || sensoryMode === "minimal") return;
    let frame = 0;
    const onMove = (e: PointerEvent) => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        const el = glowRef.current;
        if (el) el.style.transform = `translate3d(${e.clientX - 260}px, ${e.clientY - 260}px, 0)`;
      });
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => {
      window.removeEventListener("pointermove", onMove);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [mounted, sensoryMode]);

  const palette = SEASON_SPARKS[season] ?? SEASON_SPARKS.SPRING;

  const sparks = useMemo<Spark[]>(
    () =>
      Array.from({ length: 46 }, (_, i) => ({
        id: i,
        left: Math.random() * 100,
        top: Math.random() * 100,
        size: 2 + Math.random() * 7,
        delay: Math.random() * 9,
        duration: 3.5 + Math.random() * 6,
        color: palette[i % palette.length],
      })),
    [palette]
  );

  const motes = useMemo<Mote[]>(
    () =>
      Array.from({ length: 26 }, (_, i) => ({
        id: i,
        left: Math.random() * 100,
        size: 1.5 + Math.random() * 3.5,
        delay: Math.random() * 18,
        duration: 18 + Math.random() * 22,
        drift: (Math.random() - 0.5) * 160,
        opacity: 0.18 + Math.random() * 0.32,
      })),
    []
  );

  if (!mounted || sensoryMode === "minimal") return null;

  const lite = sensoryMode === "reduced";

  return (
    <div className="pointer-events-none fixed inset-0 z-[5] overflow-hidden" aria-hidden="true">
      {/* Aurora orbs */}
      <div className="fx-aurora fx-aurora-a" />
      <div className="fx-aurora fx-aurora-b" />
      <div className="fx-aurora fx-aurora-c" />

      {/* Diagonal light rays */}
      {!lite && (
        <div className="fx-rays">
          <span style={{ left: "12%", animationDelay: "0s" }} />
          <span style={{ left: "38%", animationDelay: "4s" }} />
          <span style={{ left: "64%", animationDelay: "8s" }} />
          <span style={{ left: "86%", animationDelay: "12s" }} />
        </div>
      )}

      {/* Dust motes rising */}
      {!lite &&
        motes.map((m) => (
          <span
            key={`mote-${m.id}`}
            className="fx-mote"
            style={
              {
                left: `${m.left}%`,
                width: m.size,
                height: m.size,
                animationDelay: `${m.delay}s`,
                animationDuration: `${m.duration}s`,
                "--fx-drift": `${m.drift}px`,
                "--fx-op": m.opacity,
              } as React.CSSProperties
            }
          />
        ))}

      {/* Sparkles */}
      {sparks.slice(0, lite ? 14 : sparks.length).map((s) => (
        <span
          key={`spark-${s.id}`}
          className="fx-spark"
          style={
            {
              left: `${s.left}%`,
              top: `${s.top}%`,
              width: s.size,
              height: s.size,
              animationDelay: `${s.delay}s`,
              animationDuration: `${s.duration}s`,
              "--fx-color": s.color,
            } as React.CSSProperties
          }
        />
      ))}

      {/* Cursor-tracked bloom */}
      {!lite && <div ref={glowRef} className="fx-cursor-glow" />}

      {/* Vignette + film grain */}
      <div className="fx-vignette" />
      <div className="fx-grain" />
    </div>
  );
}
