import { create } from "zustand";
import type { PitchFrame } from "../../shared/types/pitch";

interface SessionState {
  frame: PitchFrame;
  setFrame: (frame: PitchFrame) => void;
  micStatus: string;
  setMicStatus: (status: string) => void;
  reset: () => void;
}

export const useSessionStore = create<SessionState>((set) => ({
  frame: { hz: null, midi: null, cents: null, confidence: 0, timestamp: 0, targetMidi: null, status: "WAITING" },
  setFrame: (frame) => set({ frame }),
  micStatus: "Stopped",
  setMicStatus: (micStatus) => set({ micStatus }),
  reset: () => set({
    frame: { hz: null, midi: null, cents: null, confidence: 0, timestamp: 0, targetMidi: null, status: "WAITING" },
  }),
}));
