import { create } from "zustand";

export interface SessionUser {
  userId: string;
  sessionKey: string;
  /** Private encryption key */
  exportKey: string;
  email: string;
}
export interface SessionStore {
  user: SessionUser | undefined;

  setUser: (user: SessionUser | undefined) => void;
}

export const useSessionStore = create<SessionStore>()((set) => ({
  user: undefined,
  setUser: (user) => set((state) => ({ ...state, user })),
}));
