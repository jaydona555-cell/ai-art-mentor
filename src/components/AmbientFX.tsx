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
      Array.from({ length: 90 }, (_, i) => ({
        id: i,
        left: Math.random() * 100,
        top: Math.random() * 100,
        size: 3 + Math.random() * 11,
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

  const bokeh = useMemo(
    () =>
      Array.from({ length: 18 }, (_, i) => ({
        id: i,
        left: Math.random() * 100,
        top: Math.random() * 100,
        size: 40 + Math.random() * 150,
        delay: Math.random() * 12,
        duration: 16 + Math.random() * 20,
        dx: (Math.random() - 0.5) * 160,
        dy: -40 - Math.random() * 120,
        opacity: 0.08 + Math.random() * 0.14,
        color: palette[(i + 2) % palette.length],
      })),
    [palette]
  );

  const confetti = useMemo(
    () =>
      Array.from({ length: 30 }, (_, i) => ({
        id: i,
        left: Math.random() * 100,
        w: 3 + Math.random() * 5,
        h: 6 + Math.random() * 10,
        delay: Math.random() * 16,
        duration: 10 + Math.random() * 14,
        drift: (Math.random() - 0.5) * 220,
        color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
      })),
    []
  );

  if (!mounted || sensoryMode === "minimal") return null;

  const lite = sensoryMode === "reduced";

  return (
    <>
    {/* Colour layers sit behind the content so text stays crisp */}
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden" aria-hidden="true">
      {/* Prismatic colour wash */}

      {!lite && <div className="fx-wash" />}

      {/* Aurora orbs */}
      <div className="fx-aurora fx-aurora-a" />
      <div className="fx-aurora fx-aurora-b" />
      <div className="fx-aurora fx-aurora-c" />
      {!lite && <div className="fx-aurora fx-aurora-d" />}
      {!lite && <div className="fx-aurora fx-aurora-e" />}

      {/* Silky colour ribbons */}
      {!lite &&
        RIBBONS.map((r, i) => (
          <div
            key={`ribbon-${i}`}
            className="fx-ribbon"
            style={
              {
                top: r.top,
                backgroundImage: r.color,
                animationDuration: `${r.dur}s`,
                animationDelay: `${i * 3}s`,
                "--fx-rot": `${r.rot}deg`,
              } as React.CSSProperties
            }
          />
        ))}

      {/* Bokeh colour orbs */}
      {bokeh.slice(0, lite ? 6 : bokeh.length).map((b) => (
        <span
          key={`bokeh-${b.id}`}
          className="fx-bokeh"
          style={
            {
              left: `${b.left}%`,
              top: `${b.top}%`,
              width: b.size,
              height: b.size,
              animationDelay: `${b.delay}s`,
              animationDuration: `${b.duration}s`,
              "--fx-color": b.color,
              "--fx-dx": `${b.dx}px`,
              "--fx-dy": `${b.dy}px`,
              "--fx-op": b.opacity,
            } as React.CSSProperties
          }
        />
      ))}

      {/* Glitter confetti */}
      {!lite &&
        confetti.map((c) => (
          <span
            key={`confetti-${c.id}`}
            className="fx-confetti"
            style={
              {
                left: `${c.left}%`,
                width: c.w,
                height: c.h,
                animationDelay: `${c.delay}s`,
                animationDuration: `${c.duration}s`,
                "--fx-drift": `${c.drift}px`,
                "--fx-color": c.color,
              } as React.CSSProperties
            }
          />
        ))}

      {/* Vignette */}
      <div className="fx-vignette" />
    </div>

    {/* Sparkle layers float above the content */}
    <div className="pointer-events-none fixed inset-0 z-[5] overflow-hidden" aria-hidden="true">
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

      {/* Film grain */}
      <div className="fx-grain" />
    </div>
    </>
  );
}
