"use client";

import { Suspense } from "react";
import { SessionProvider } from "next-auth/react";
import NavigationLoader from "@/components/NavigationLoader";

export default function Providers({ children }) {
  return (
    <SessionProvider>
      <Suspense fallback={null}>
        <NavigationLoader />
      </Suspense>
      {children}
    </SessionProvider>
  );
}
