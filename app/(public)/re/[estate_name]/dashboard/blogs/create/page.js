"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useSession } from "next-auth/react";
import AgentPortalShell from "@/components/agent-portal/AgentPortalShell";
import LoadingSpinner from "@/components/LoadingSpinner";
import BlogForm from "@/components/agent-portal/BlogForm";
import styles from "./page.module.css";

export default function CreateBlogPage() {
  const params = useParams();
  const { data: session, status } = useSession();
  const username = decodeURIComponent(params.estate_name || "");
  const base = `/re/${encodeURIComponent(username)}/dashboard`;

  if (status === "loading") {
    return (
      <AgentPortalShell
        username={username}
        agentName={session?.user?.name || "Agent"}
        title="Add Blog"
        subtitle="Write a new article for your public website"
      >
        <LoadingSpinner
          fullPage={false}
          label="Loading"
          hint="Checking your account…"
        />
      </AgentPortalShell>
    );
  }

  return (
    <AgentPortalShell
      username={username}
      agentName={session?.user?.name}
      title="Add Blog"
      subtitle="Write a new article for your public website"
    >
      <Link href={`${base}/blogs`} className={styles.backLink}>
        ← Back to Blogs
      </Link>
      <BlogForm mode="create" base={base} username={username} agentName={session?.user?.name} />
    </AgentPortalShell>
  );
}
