// Global app state (zustand) — tiny alternative to Redux.
// `persist` saves it to localStorage, so your resume and theme survive refreshes.
import { create } from "zustand";
import { persist } from "zustand/middleware";

export const useAppStore = create(
  persist(
    (set) => ({
      theme: "dark", // "dark" | "light"
      resumeId: null, // the active resume — shared across pages
      resumeReady: false, // true once the AI ingestion pipeline finished
      profiling: null, // { score, byTopic } once the quiz is finished
      profilingSkipped: false, // user chose "I know my level"

      toggleTheme: () => set((s) => ({ theme: s.theme === "dark" ? "light" : "dark" })),
      // New resume = new level to verify → reset profiling state too.
      setResume: (resumeId, ready = false) =>
        set({ resumeId, resumeReady: ready, profiling: null, profilingSkipped: false }),
      setProfiling: (result) => set({ profiling: result }),
      skipProfiling: () => set({ profilingSkipped: true }),
    }),
    { name: "careerpilot" } // localStorage key
  )
);
