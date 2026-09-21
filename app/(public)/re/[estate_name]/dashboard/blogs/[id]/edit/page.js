"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import AgentPortalShell from "@/components/agent-portal/AgentPortalShell";
import LoadingSpinner from "@/components/LoadingSpinner";
import BlogForm from "@/components/agent-portal/BlogForm";
import styles from "./page.module.css";

export default function EditBlogPage() {
  const params = useParams();
  const router = useRouter();
  const { data: session, status } = useSession();
  const username = decodeURIComponent(params.estate_name || "");
  const blogId = Number(params.id);
  const base = `/re/${encodeURIComponent(username)}/dashboard`;
  const [blog, setBlog] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/agent/login");
      return;
    }
    if (status !== "authenticated") return;
    if (!Number.isInteger(blogId) || blogId <= 0) {
      setLoadError("Invalid blog.");
      setLoading(false);
      return;
    }
    (async () => {
      try {
        const res = await fetch(`/api/blogs/${blogId}`);
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setLoadError(data.error || "Could not load blog.");
          return;
        }
        setBlog(data.blog || null);
      } catch {
        setLoadError("Network error. Please try again.");
      } finally {
        setLoading(false);
      }
    })();
  }, [status, router, blogId]);

  if (status === "loading" || loading) {
    return (
      <AgentPortalShell
        username={username}
        agentName={session?.user?.name || "Agent"}
        title="Edit Blog"
        subtitle="Update your article"
      >
        <LoadingSpinner
          fullPage={false}
          label="Loading"
          hint="Loading blog…"
        />
      </AgentPortalShell>
    );
  }

  if (loadError || !blog) {
    return (
      <AgentPortalShell
        username={username}
        agentName={session?.user?.name}
        title="Edit Blog"
        subtitle="Update your article"
      >
        <Link href={`${base}/blogs`} className={styles.backLink}>
          ← Back to Blogs
        </Link>
        <p className={styles.error}>{loadError || "Blog not found."}</p>
      </AgentPortalShell>
    );
  }

  return (
    <AgentPortalShell
      username={username}
      agentName={session?.user?.name}
      title="Edit Blog"
      subtitle="Update your article"
    >
      <Link href={`${base}/blogs`} className={styles.backLink}>
        ← Back to Blogs
      </Link>
      <BlogForm
        mode="edit"
        blogId={blogId}
        initial={blog}
        base={base}
        username={username}
        agentName={session?.user?.name}
      />
    </AgentPortalShell>
  );
}
