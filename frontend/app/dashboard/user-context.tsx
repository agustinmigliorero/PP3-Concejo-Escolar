"use client";

import { createContext, useContext } from "react";
import type { UserInfo } from "@/lib/api";

interface UserContextValue {
  user: UserInfo | null;
}

export const UserContext = createContext<UserContextValue>({ user: null });

export function useUser() {
  return useContext(UserContext);
}
