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
      resumeParsed: null, // extracted profile (name, skills, projects…) for greeting + detail modals
      resumeMeta: null, // { fileName, stats }
      profiling: null, // { score, byTopic } once the quiz is finished
      profilingSkipped: false, // user chose "I know my level"

      sidebarCollapsed: false,
      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
      toggleTheme: () => set((s) => ({ theme: s.theme === "dark" ? "light" : "dark" })),
      // New resume = new level to verify → reset profiling state too.
      setResume: (resumeId, ready = false) =>
        set({ resumeId, resumeReady: ready, resumeParsed: null, resumeMeta: null, profiling: null, profilingSkipped: false }),
      setResumeData: (parsed, meta) => set({ resumeParsed: parsed, resumeMeta: meta }),
      setProfiling: (result) => set({ profiling: result }),
      skipProfiling: () => set({ profilingSkipped: true }),
    }),
    { name: "careerpilot" } // localStorage key
  )
);
