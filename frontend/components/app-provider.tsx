"use client";

import React from "react";
import { FarmProvider } from "../context/farm-context";

export function AppClientProvider({ children }: { children: React.ReactNode }) {
  return <FarmProvider>{children}</FarmProvider>;
}
