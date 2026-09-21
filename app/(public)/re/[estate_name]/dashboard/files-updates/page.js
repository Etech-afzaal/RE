"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import AgentPortalShell from "@/components/agent-portal/AgentPortalShell";
import LoadingSpinner from "@/components/LoadingSpinner";
import FilesUpdateForm from "@/components/agent-portal/FilesUpdateForm";
import ui from "@/components/agent-portal/portal.module.css";

export default function AgentFilesUpdatesPage() {
  const params = useParams();
  const router = useRouter();
  const { data: session, status } = useSession();
  const username = decodeURIComponent(params.estate_name || "");
  const base = `/re/${encodeURIComponent(username)}/dashboard`;
  const [filesUpdate, setFilesUpdate] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/agent/login");
      return;
    }
    if (status !== "authenticated") return;
    (async () => {
      try {
        const res = await fetch("/api/files-updates");
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setLoadError(data.error || "Could not load files update.");
          return;
        }
        setFilesUpdate(data.filesUpdate || null);
      } catch {
        setLoadError("Network error. Please try again.");
      } finally {
        setLoading(false);
      }
    })();
  }, [status, router]);

  if (status === "loading" || loading) {
    return (
      <AgentPortalShell
        username={username}
        agentName={session?.user?.name || "Agent"}
        title="Files Updates"
        subtitle="Your single live market update page"
      >
        <LoadingSpinner
          fullPage={false}
          label="Loading"
          hint="Loading files update…"
        />
      </AgentPortalShell>
    );
  }

  if (loadError) {
    return (
      <AgentPortalShell
        username={username}
        agentName={session?.user?.name}
        title="Files Updates"
        subtitle="Your single live market update page"
      >
        <p className={ui.error}>{loadError}</p>
      </AgentPortalShell>
    );
  }

  const isEditing = Boolean(filesUpdate);

  return (
    <AgentPortalShell
      username={username}
      agentName={session?.user?.name}
      title="Files Updates"
      subtitle={
        isEditing
          ? "Edit your live market update page"
          : "Create your live market update page"
      }
    >
      <FilesUpdateForm
        initial={filesUpdate}
        base={base}
        username={username}
        agentName={session?.user?.name}
      />
    </AgentPortalShell>
  );
}
