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

      toggleTheme: () => set((s) => ({ theme: s.theme === "dark" ? "light" : "dark" })),
      setResume: (resumeId, ready = false) => set({ resumeId, resumeReady: ready }),
    }),
    { name: "careerpilot" } // localStorage key
  )
);
