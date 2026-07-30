"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import AgentPortalShell from "@/components/agent-portal/AgentPortalShell";
import ActionMenu from "@/components/ActionMenu";
import Pagination from "@/components/Pagination";
import ui from "@/components/agent-portal/portal.module.css";

const TABS = [
  { id: "all", label: "All" },
  { id: "draft", label: "Draft" },
  { id: "pending_approval", label: "Pending Approval" },
  { id: "approved", label: "Approved" },
  { id: "rejected", label: "Rejected" },
  { id: "sold", label: "Sold" },
];

function formatPrice(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  return `PKR ${n.toLocaleString("en-PK")}`;
}

function statusClass(status) {
  if (status === "approved") return ui.badgeApproved;
  if (status === "pending_approval") return ui.badgePending;
  if (status === "draft") return ui.badgeDraft;
  if (status === "rejected") return ui.badgeRejected;
  if (status === "sold") return ui.badgeSold;
  return ui.badgeDraft;
}

function statusLabel(status) {
  return String(status || "draft").replace(/_/g, " ");
}

export default function AgentPropertiesPage() {
  const params = useParams();
  const router = useRouter();
  const { data: session, status } = useSession();
  const username = decodeURIComponent(params.estate_name || "");
  const base = `/re/${encodeURIComponent(username)}/adminarea`;
  const [tab, setTab] = useState("all");
  const [properties, setProperties] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalProperties, setTotalProperties] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [propertyToDelete, setPropertyToDelete] = useState(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const propertiesSectionRef = useRef(null);
  const shouldScrollRef = useRef(false);

  async function load(page = currentPage, selectedTab = tab) {
    setLoading(true);
    setError("");
    const params = new URLSearchParams({ page: String(page) });
    if (selectedTab !== "all") params.set("status", selectedTab);
    try {
      const res = await fetch(`/api/properties?${params}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Could not load properties.");
      }

      setProperties(Array.isArray(data.properties) ? data.properties : []);
      setCurrentPage(data.currentPage || 1);
      setTotalProperties(Number(data.totalProperties) || 0);
      setTotalPages(Number(data.totalPages) || 1);
    } catch (err) {
      setError(err.message || "Could not load properties.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/agent/login");
      return;
    }
    if (status === "authenticated") load();
  }, [status, router]);

  useEffect(() => {
    if (!loading && shouldScrollRef.current) {
      shouldScrollRef.current = false;
      propertiesSectionRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }
  }, [loading, properties]);

  function changePage(page) {
    if (page < 1 || page > totalPages || page === currentPage) return;
    shouldScrollRef.current = true;
    load(page);
  }

  function changeTab(nextTab) {
    setTab(nextTab);
    setCurrentPage(1);
    load(1, nextTab);
  }

  async function submitForApproval(property) {
    setBusyId(property.id);
    await fetch(`/api/properties/${property.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: property.title,
        description: property.description,
        size_value: property.size_value,
        size_unit: property.size_unit,
        price: property.price,
        location: property.location,
        status: "pending_approval",
      }),
    });
    await load();
    setBusyId(null);
  }

  async function deleteProperty() {
    if (!propertyToDelete) return;

    const id = propertyToDelete.id;
    setBusyId(id);
    setError("");
    try {
      const res = await fetch(`/api/properties/${id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Could not delete this property.");
      }

      const pageAfterDelete =
        properties.length === 1 && currentPage > 1
          ? currentPage - 1
          : currentPage;
      setPropertyToDelete(null);
      setSuccess("Property deleted successfully.");
      await load(pageAfterDelete);
    } catch (err) {
      setError(err.message || "Could not delete this property.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <AgentPortalShell
      username={username}
      agentName={session?.user?.name}
      title="Properties"
      subtitle="Manage drafts, submissions, and live listings"
      action={
        <Link href={`${base}/properties/create`} className={ui.btnPrimary}>
          Add Property
        </Link>
      }
    >
      <div className={ui.tabs}>
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`${ui.tab} ${tab === item.id ? ui.tabActive : ""}`}
            onClick={() => changeTab(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className={ui.panel} ref={propertiesSectionRef}>
        {error ? <p className={ui.error}>{error}</p> : null}
        {success ? <p className={ui.success}>{success}</p> : null}
        {loading ? (
          <p className={ui.empty}>Loading…</p>
        ) : properties.length === 0 ? (
          <p className={ui.empty}>No properties in this tab.</p>
        ) : (
          <>
            <p className={ui.paginationCount}>
              Showing {(currentPage - 1) * 10 + 1}&ndash;
              {Math.min(currentPage * 10, totalProperties)} of {totalProperties}{" "}
              properties
            </p>
            <div className={ui.tableWrap}>
              <table className={ui.table}>
              <thead>
                <tr>
                  <th>Property</th>
                  <th>Location</th>
                  <th>Status</th>
                  <th>Price</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {properties.map((property) => {
                  const image =
                    property.featuredImage?.image_url ||
                    property.images?.[0]?.image_url ||
                    null;
                  return (
                    <tr key={property.id}>
                      <td>
                        <div className={ui.propCell}>
                          {image ? (
                            <Image
                              src={image}
                              alt=""
                              width={52}
                              height={52}
                              className={ui.thumb}
                            />
                          ) : (
                            <div className={ui.thumbFallback}>P</div>
                          )}
                          <div>
                            <p className={ui.propTitle}>{property.title}</p>
                          </div>
                        </div>
                      </td>
                      <td>{property.location || "—"}</td>
                      <td>
                        <span
                          className={`${ui.badge} ${statusClass(property.status)}`}
                        >
                          {statusLabel(property.status)}
                        </span>
                      </td>
                      <td>{formatPrice(property.price)}</td>
                      <td>
                        <ActionMenu
                          ariaLabel={`Actions for ${property.title}`}
                          onView={
                            property.status === "approved"
                              ? () => window.open(`/re/${encodeURIComponent(username)}/${property.id}`, "_blank", "noopener,noreferrer")
                              : undefined
                          }
                          onEdit={() => router.push(`${base}/properties/${property.id}/edit`)}
                          onDelete={() => {
                            setError("");
                            setSuccess("");
                            setPropertyToDelete(property);
                          }}
                          deleteDisabled={busyId === property.id}
                          additionalActions={
                            property.status === "draft" || property.status === "rejected"
                              ? [{ label: "Submit", onSelect: () => submitForApproval(property), disabled: busyId === property.id }]
                              : []
                          }
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              </table>
            </div>
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={changePage}
            />
          </>
        )}
      </div>
      {propertyToDelete ? (
        <div className={ui.dialogBackdrop} role="presentation">
          <div
            className={ui.dialog}
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-property-title"
            aria-describedby="delete-property-description"
          >
            <h2 id="delete-property-title" className={ui.dialogTitle}>
              Delete Property?
            </h2>
            <p id="delete-property-description" className={ui.dialogText}>
              This action cannot be undone. This will permanently delete
              &ldquo;{propertyToDelete.title}&rdquo; and all associated data.
            </p>
            <div className={ui.dialogActions}>
              <button
                type="button"
                className={ui.btnGhost}
                disabled={busyId === propertyToDelete.id}
                onClick={() => setPropertyToDelete(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className={ui.btnDanger}
                disabled={busyId === propertyToDelete.id}
                onClick={deleteProperty}
              >
                {busyId === propertyToDelete.id ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </AgentPortalShell>
  );
}
