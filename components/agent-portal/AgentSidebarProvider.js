"use client";

import { createContext, useContext } from "react";
import { useSidebarCollapsed } from "@/lib/useSidebarCollapsed";

const AgentSidebarContext = createContext(null);

export default function AgentSidebarProvider({ children }) {
  const sidebar = useSidebarCollapsed("agent.sidebarCollapsed");
  return (
    <AgentSidebarContext.Provider value={sidebar}>
      {children}
    </AgentSidebarContext.Provider>
  );
}

export function useAgentSidebar() {
  return useContext(AgentSidebarContext);
}
