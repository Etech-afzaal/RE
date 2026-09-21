"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import AgentPortalShell from "@/components/agent-portal/AgentPortalShell";
import LoadingSpinner from "@/components/LoadingSpinner";
import VideoPostForm from "@/components/agent-portal/VideoPostForm";
import styles from "./page.module.css";

export default function EditVideoPostPage() {
  const params = useParams();
  const router = useRouter();
  const { data: session, status } = useSession();
  const username = decodeURIComponent(params.estate_name || "");
  const videoPostId = Number(params.id);
  const base = `/re/${encodeURIComponent(username)}/dashboard`;
  const [videoPost, setVideoPost] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/agent/login");
      return;
    }
    if (status !== "authenticated") return;
    if (!Number.isInteger(videoPostId) || videoPostId <= 0) {
      setLoadError("Invalid video post.");
      setLoading(false);
      return;
    }
    (async () => {
      try {
        const res = await fetch(`/api/video-posts/${videoPostId}`);
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setLoadError(data.error || "Could not load video post.");
          return;
        }
        setVideoPost(data.videoPost || null);
      } catch {
        setLoadError("Network error. Please try again.");
      } finally {
        setLoading(false);
      }
    })();
  }, [status, router, videoPostId]);

  if (status === "loading" || loading) {
    return (
      <AgentPortalShell
        username={username}
        agentName={session?.user?.name || "Agent"}
        title="Edit Video Post"
        subtitle="Update your video"
      >
        <LoadingSpinner
          fullPage={false}
          label="Loading"
          hint="Loading video post…"
        />
      </AgentPortalShell>
    );
  }

  if (loadError || !videoPost) {
    return (
      <AgentPortalShell
        username={username}
        agentName={session?.user?.name}
        title="Edit Video Post"
        subtitle="Update your video"
      >
        <Link href={`${base}/video-posts`} className={styles.backLink}>
          ← Back to Video Posts
        </Link>
        <p className={styles.error}>{loadError || "Video post not found."}</p>
      </AgentPortalShell>
    );
  }

  return (
    <AgentPortalShell
      username={username}
      agentName={session?.user?.name}
      title="Edit Video Post"
      subtitle="Update your video"
    >
      <Link href={`${base}/video-posts`} className={styles.backLink}>
        ← Back to Video Posts
      </Link>
      <VideoPostForm
        mode="edit"
        videoPostId={videoPostId}
        initial={videoPost}
        base={base}
        username={username}
        agentName={session?.user?.name}
      />
    </AgentPortalShell>
  );
}
