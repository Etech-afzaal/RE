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

function formatBlogDate(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default function AgentBlogsPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session, status } = useSession();
  const username = decodeURIComponent(params.estate_name || "");
  const base = `/re/${encodeURIComponent(username)}/dashboard`;
  const [tab, setTab] = useState("all");
  const [blogs, setBlogs] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalBlogs, setTotalBlogs] = useState(0);
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
        const res = await fetch(`/api/blogs?${query}`);
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(data.error || "Could not load blogs.");
        }
        setBlogs(Array.isArray(data.blogs) ? data.blogs : []);
        setCurrentPage(data.currentPage || 1);
        setTotalBlogs(Number(data.totalBlogs) || 0);
        setTotalPages(Number(data.totalPages) || 1);
      } catch (err) {
        setLoadError(err.message || "Could not load blogs.");
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
      router.replace(`${base}/blogs`, { scroll: false });
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
  }, [loading, blogs]);

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
      const res = await fetch(`/api/blogs/${deleteTarget.id}`, {
        method: "DELETE",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Could not delete blog.");
      }
      setDeleteTarget(null);
      setActionSuccess("Blog deleted.");
      const reloadPage =
        blogs.length === 1 && currentPage > 1 ? currentPage - 1 : currentPage;
      await load(reloadPage, tab, debouncedSearch);
    } catch (err) {
      setActionError(err.message || "Could not delete blog.");
    } finally {
      setDeleting(false);
    }
  }

  async function updateStatus(blog, nextStatus) {
    setActionError("");
    try {
      const res = await fetch(`/api/blogs/${blog.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Could not update blog status.");
      setActionSuccess(nextStatus === "published" ? "Blog published." : "Blog unpublished.");
      await load(currentPage, tab, debouncedSearch);
    } catch (err) {
      setActionError(err.message || "Could not update blog status.");
    }
  }

  if (status === "loading") {
    return (
      <AgentPortalShell
        username={username}
        agentName={session?.user?.name || "Agent"}
        title="Blogs"
        subtitle="Publish articles that appear on your public website"
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
      title="Blogs"
      subtitle="Publish articles that appear on your public website"
      action={
        <Link href={`${base}/blogs/create`} className={ui.btnPrimary}>
          Add Blog
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
            aria-label="Search blogs by title"
          />
        </label>
      </div>

      <div
        className={`${ui.panel} ${
          !loading && blogs.length > 0 ? styles.listingPanel : ""
        }`}
        ref={listSectionRef}
      >
        {loading ? (
          <LoadingSpinner
            fullPage={false}
            label="Loading"
            hint="Fetching blogs…"
          />
        ) : blogs.length === 0 ? (
          <p className={ui.empty}>
            {debouncedSearch
              ? "No blogs match your search."
              : "No blogs yet. Create your first article."}
          </p>
        ) : (
          <>
            <p className={ui.paginationCount}>
              Showing {(currentPage - 1) * PAGE_SIZE + 1}&ndash;
              {Math.min(currentPage * PAGE_SIZE, totalBlogs)} of {totalBlogs}{" "}
              blogs
            </p>
            <div className={`${ui.tableWrap} ${styles.tableArea}`}>
              <table className={ui.table}>
                <thead>
                  <tr>
                    <th>Title</th>
                    <th>Status</th>
                    <th>Updated</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {blogs.map((blog) => {
                    const editHref = `${base}/blogs/${blog.id}/edit`;
                    const isPublished = blog.status === "published";
                    return (
                      <tr key={blog.id}>
                        <td data-label="Title">
                          <div className={ui.propCell}>
                            {blog.cover_image ? (
                              <Link
                                href={editHref}
                                className={styles.coverThumbLink}
                                aria-label={`Edit ${blog.title}`}
                              >
                                <Image src={blog.cover_image} alt="" width={64} height={44} className={styles.coverThumb} />
                              </Link>
                            ) : null}
                            <div>
                              <Link
                                href={editHref}
                                className={`${ui.propTitle} ${ui.propTitleLink} ${styles.titleLink}`}
                              >
                                {blog.title}
                              </Link>
                              {blog.short_description ? (
                                <p className={ui.propMeta}>
                                  {blog.short_description.slice(0, 80)}
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
                        <td data-label="Updated">
                          {formatBlogDate(blog.updated_at) || "—"}
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
                              onClick={() => updateStatus(blog, isPublished ? "draft" : "published")}
                            >
                              {isPublished ? (
                                <Undo2 size={16} aria-hidden="true" />
                              ) : (
                                <Send size={16} aria-hidden="true" />
                              )}
                              {isPublished ? "Unpublish" : "Publish"}
                            </button>
                            <button
                              type="button"
                              className={`${ui.btnDanger} ${styles.actionButton}`}
                              onClick={() => setDeleteTarget(blog)}
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
                ariaLabel="Blogs pagination"
              />
            </div>
          </>
        )}
      </div>

      {deleteTarget ? (
        <div className={ui.dialogBackdrop} role="presentation">
          <div className={ui.dialog} role="dialog" aria-modal="true">
            <h2 className={ui.dialogTitle}>Delete Blog?</h2>
            <p className={ui.dialogText}>
              &ldquo;{deleteTarget.title}&rdquo; will be permanently removed.
              This action cannot be undone.
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
