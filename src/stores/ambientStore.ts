import { create } from "zustand";
import type { Rgb } from "@/utils/dominantColor";

interface AmbientStore {
  dominant: Rgb | null;
  setDominant: (rgb: Rgb | null) => void;
}

export const useAmbientStore = create<AmbientStore>((set) => ({
  dominant: null,
  setDominant: (dominant) => set({ dominant }),
}));
