"use client";

import ClearableSearchInput from "@/components/ClearableSearchInput";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { FilePenLine, Send, Trash2, Undo2 } from "lucide-react";
import AgentPortalShell from "@/components/agent-portal/AgentPortalShell";
import LoadingSpinner from "@/components/LoadingSpinner";
import Pagination from "@/components/Pagination";
import AgentMessagePopup from "@/components/agent-portal/AgentMessagePopup";
import ui from "@/components/agent-portal/portal.module.css";
import styles from "./page.module.css";

const TABS = [
  { id: "all", label: "All" },
  { id: "draft", label: "Draft" },
  { id: "published", label: "Published" },
];

const PAGE_SIZE = 10;

function formatVideoPostDate(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function ThumbCell({ videoPost }) {
  if (videoPost.thumbnail_url) {
    return (
      <div className={styles.thumb}>
        <Image
          src={videoPost.thumbnail_url}
          alt=""
          fill
          sizes="64px"
          className={styles.thumbImage}
        />
      </div>
    );
  }
  return (
    <div className={styles.thumb}>
      <div className={styles.thumbFallback}>
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <rect x="3" y="6" width="18" height="12" rx="2.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
          <path d="M10.5 9.5v4l3-2-3-2Z" fill="currentColor" />
        </svg>
      </div>
    </div>
  );
}

export default function AgentVideoPostsPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session, status } = useSession();
  const username = decodeURIComponent(params.estate_name || "");
  const base = `/re/${encodeURIComponent(username)}/dashboard`;
  const [tab, setTab] = useState("all");
  const [videoPosts, setVideoPosts] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalVideoPosts, setTotalVideoPosts] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [actionError, setActionError] = useState("");
  const [actionSuccess, setActionSuccess] = useState("");
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const listSectionRef = useRef(null);
  const shouldScrollRef = useRef(false);
  const skipSearchReloadRef = useRef(true);

  const load = useCallback(
    async (page = 1, selectedTab = "all", searchQuery = "") => {
      setLoading(true);
      setLoadError("");
      const query = new URLSearchParams({ page: String(page) });
      if (selectedTab !== "all") query.set("status", selectedTab);
      const trimmed = String(searchQuery || "").trim();
      if (trimmed) query.set("search", trimmed);
      try {
        const res = await fetch(`/api/video-posts?${query}`);
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(data.error || "Could not load video posts.");
        }
        setVideoPosts(Array.isArray(data.videoPosts) ? data.videoPosts : []);
        setCurrentPage(data.currentPage || 1);
        setTotalVideoPosts(Number(data.totalVideoPosts) || 0);
        setTotalPages(Number(data.totalPages) || 1);
      } catch (err) {
        setLoadError(err.message || "Could not load video posts.");
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    const notice = searchParams.get("notice");
    if (notice) {
      setActionSuccess(notice);
      router.replace(`${base}/video-posts`, { scroll: false });
    }
  }, [base, router, searchParams]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(search.trim());
    }, 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    if (status !== "authenticated") return;
    if (skipSearchReloadRef.current) {
      skipSearchReloadRef.current = false;
      return;
    }
    setCurrentPage(1);
    load(1, tab, debouncedSearch);
  }, [debouncedSearch, status, tab, load]);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/agent/login");
      return;
    }
    if (status !== "authenticated") return;
    load(1, tab);
  }, [status, router, load, tab]);

  useEffect(() => {
    if (!loading && shouldScrollRef.current) {
      shouldScrollRef.current = false;
      listSectionRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }
  }, [loading, videoPosts]);

  function changePage(page) {
    if (page < 1 || page > totalPages || page === currentPage) return;
    shouldScrollRef.current = true;
    load(page, tab, debouncedSearch);
  }

  function changeTab(nextTab) {
    setTab(nextTab);
    setCurrentPage(1);
    skipSearchReloadRef.current = true;
    load(1, nextTab, debouncedSearch);
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    setActionError("");
    try {
      const res = await fetch(`/api/video-posts/${deleteTarget.id}`, {
        method: "DELETE",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Could not delete video post.");
      }
      setDeleteTarget(null);
      setActionSuccess("Video post deleted.");
      const reloadPage =
        videoPosts.length === 1 && currentPage > 1 ? currentPage - 1 : currentPage;
      await load(reloadPage, tab, debouncedSearch);
    } catch (err) {
      setActionError(err.message || "Could not delete video post.");
    } finally {
      setDeleting(false);
    }
  }

  async function updateStatus(videoPost, nextStatus) {
    setActionError("");
    try {
      const res = await fetch(`/api/video-posts/${videoPost.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Could not update video post status.");
      setActionSuccess(nextStatus === "published" ? "Video post published." : "Video post unpublished.");
      await load(currentPage, tab, debouncedSearch);
    } catch (err) {
      setActionError(err.message || "Could not update video post status.");
    }
  }

  if (status === "loading") {
    return (
      <AgentPortalShell
        username={username}
        agentName={session?.user?.name || "Agent"}
        title="Video Posts"
        subtitle="Publish video content on your public website"
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
      title="Video Posts"
      subtitle="Publish video content on your public website"
      action={
        <Link href={`${base}/video-posts/create`} className={ui.btnPrimary}>
          Add Video
        </Link>
      }
    >
      <AgentMessagePopup
        message={actionError || loadError || actionSuccess}
        tone={actionError || loadError ? "error" : "success"}
        onClose={() => {
          setActionError("");
          setLoadError("");
          setActionSuccess("");
        }}
      />
      <div className={styles.tabsRow}>
        <div className={`${ui.tabs} ${styles.tabsRowTabs}`}>
          {TABS.map((item) => (
            <button
              key={item.id}
              data-status={item.id}
              type="button"
              className={`${ui.tab} ${tab === item.id ? ui.tabActive : ""}`}
              onClick={() => changeTab(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>
        <label className={styles.searchWrap}>
          <span className={styles.searchIcon} aria-hidden="true">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="1.8" />
              <path
                d="M16 16 20 20"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
            </svg>
          </span>
          <ClearableSearchInput
            type="search"
            className={styles.searchInput}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by title"
            aria-label="Search video posts by title"
          />
        </label>
      </div>

      <div
        className={`${ui.panel} ${
          !loading && videoPosts.length > 0 ? styles.listingPanel : ""
        }`}
        ref={listSectionRef}
      >
        {loading ? (
          <LoadingSpinner
            fullPage={false}
            label="Loading"
            hint="Fetching video posts…"
          />
        ) : videoPosts.length === 0 ? (
          <p className={ui.empty}>
            {debouncedSearch
              ? "No video posts match your search."
              : "No video posts yet. Upload your first video."}
          </p>
        ) : (
          <>
            <p className={ui.paginationCount}>
              Showing {(currentPage - 1) * PAGE_SIZE + 1}&ndash;
              {Math.min(currentPage * PAGE_SIZE, totalVideoPosts)} of{" "}
              {totalVideoPosts} videos
            </p>
            <div className={`${ui.tableWrap} ${styles.tableArea}`}>
              <table className={ui.table}>
                <thead>
                  <tr>
                    <th>Title</th>
                    <th>Status</th>
                    <th>Created</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {videoPosts.map((videoPost) => {
                    const editHref = `${base}/video-posts/${videoPost.id}/edit`;
                    const isPublished = videoPost.status === "published";
                    return (
                      <tr key={videoPost.id}>
                        <td data-label="Title">
                          <div className={styles.videoTitleCell}>
                            <Link
                              href={editHref}
                              className={styles.thumbLink}
                              aria-label={`Edit ${videoPost.title}`}
                            >
                              <ThumbCell videoPost={videoPost} />
                            </Link>
                            <div>
                              <Link
                                href={editHref}
                                className={`${ui.propTitle} ${ui.propTitleLink} ${styles.titleLink}`}
                              >
                                {videoPost.title}
                              </Link>
                              {videoPost.description ? (
                                <p className={ui.propMeta}>
                                  {videoPost.description.slice(0, 80)}
                                </p>
                              ) : null}
                            </div>
                          </div>
                        </td>
                        <td data-label="Status">
                          <span
                            className={`${ui.badge} ${
                              isPublished ? ui.badgeApproved : ui.badgeDraft
                            }`}
                          >
                            {isPublished ? "Published" : "Draft"}
                          </span>
                        </td>
                        <td data-label="Created">
                          {formatVideoPostDate(videoPost.created_at) || "—"}
                        </td>
                        <td data-label="Actions">
                          <div className={styles.rowActions}>
                            <Link
                              href={editHref}
                              className={`${ui.btnGhost} ${styles.actionButton}`}
                            >
                              <FilePenLine size={16} aria-hidden="true" />
                              Edit
                            </Link>
                            <button
                              type="button"
                              className={`${ui.btnGhost} ${styles.actionButton}`}
                              onClick={() => updateStatus(videoPost, isPublished ? "draft" : "published")}
                            >
                              {isPublished ? <Undo2 size={16} aria-hidden="true" /> : <Send size={16} aria-hidden="true" />}
                              {isPublished ? "Unpublish" : "Publish"}
                            </button>
                            <button
                              type="button"
                              className={`${ui.btnDanger} ${styles.actionButton}`}
                              onClick={() => setDeleteTarget(videoPost)}
                            >
                              <Trash2 size={16} aria-hidden="true" />
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className={styles.paginationSlot}>
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={changePage}
                ariaLabel="Video posts pagination"
              />
            </div>
          </>
        )}
      </div>

      {deleteTarget ? (
        <div className={ui.dialogBackdrop} role="presentation">
          <div className={ui.dialog} role="dialog" aria-modal="true">
            <h2 className={ui.dialogTitle}>Delete Video Post?</h2>
            <p className={ui.dialogText}>
              &ldquo;{deleteTarget.title}&rdquo; will be permanently removed along
              with its video file. This action cannot be undone.
            </p>
            <div className={ui.dialogActions}>
              <button
                type="button"
                className={ui.btnGhost}
                disabled={deleting}
                onClick={() => setDeleteTarget(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className={ui.btnDanger}
                disabled={deleting}
                onClick={confirmDelete}
              >
                {deleting ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </AgentPortalShell>
  );
}
