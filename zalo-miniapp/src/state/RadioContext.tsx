import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { RadioBulletin } from "@/types";

/** Tốc độ phát khả dụng (WBS #17) */
export const playbackSpeeds = [1, 1.5, 2] as const;

/** Bước tua nhanh/lùi (giây) */
export const skipSeconds = 15;

interface RadioValue {
  bulletin: RadioBulletin | null;
  playing: boolean;
  /** Vị trí phát tính bằng giây */
  position: number;
  duration: number;
  progress: number;
  speed: number;
  play: (b: RadioBulletin) => void;
  toggle: () => void;
  seek: (seconds: number) => void;
  skip: (seconds: number) => void;
  cycleSpeed: () => void;
  stop: () => void;
}

const RadioContext = createContext<RadioValue | null>(null);

/**
 * Trình phát truyền thanh toàn app — GIẢ LẬP bằng interval (Phase 1).
 * Tích hợp ngoài: thay bằng thẻ <audio> nguồn thật từ file storage (P3-24),
 * giữ nguyên interface để màn hình không phải sửa.
 */
export function RadioProvider({ children }: { children: ReactNode }) {
  const [bulletin, setBulletin] = useState<RadioBulletin | null>(null);
  const [playing, setPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const [speed, setSpeed] = useState<number>(playbackSpeeds[0]);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const duration = bulletin?.durationSeconds ?? 0;

  useEffect(() => {
    if (!playing) {
      if (timer.current) clearInterval(timer.current);
      timer.current = null;
      return;
    }
    timer.current = setInterval(() => {
      setPosition((p) => {
        const next = p + 0.5 * speed;
        if (next >= duration) {
          setPlaying(false);
          return duration;
        }
        return next;
      });
    }, 500);
    return () => {
      if (timer.current) clearInterval(timer.current);
      timer.current = null;
    };
  }, [playing, speed, duration]);

  const play = useCallback((b: RadioBulletin) => {
    setBulletin((cur) => {
      if (cur?.id !== b.id) setPosition(0);
      return b;
    });
    setPlaying(true);
  }, []);

  const toggle = useCallback(() => setPlaying((p) => !p), []);

  const seek = useCallback(
    (seconds: number) => setPosition(Math.min(Math.max(seconds, 0), duration)),
    [duration],
  );

  const skip = useCallback(
    (seconds: number) => setPosition((p) => Math.min(Math.max(p + seconds, 0), duration)),
    [duration],
  );

  const cycleSpeed = useCallback(
    () => setSpeed((s) => playbackSpeeds[(playbackSpeeds.indexOf(s as 1 | 1.5 | 2) + 1) % playbackSpeeds.length]),
    [],
  );

  const stop = useCallback(() => {
    setPlaying(false);
    setBulletin(null);
    setPosition(0);
  }, []);

  const value = useMemo<RadioValue>(
    () => ({
      bulletin,
      playing,
      position,
      duration,
      progress: duration === 0 ? 0 : Math.min(position / duration, 1),
      speed,
      play,
      toggle,
      seek,
      skip,
      cycleSpeed,
      stop,
    }),
    [bulletin, playing, position, duration, speed, play, toggle, seek, skip, cycleSpeed, stop],
  );

  return <RadioContext.Provider value={value}>{children}</RadioContext.Provider>;
}

export function useRadio(): RadioValue {
  const ctx = useContext(RadioContext);
  if (!ctx) throw new Error("useRadio phải nằm trong RadioProvider");
  return ctx;
}

/** Nhãn tốc độ: 1 -> "1x", 1.5 -> "1.5x" */
export function speedLabel(speed: number): string {
  return Number.isInteger(speed) ? `${speed}x` : `${speed}x`;
}
