"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import AgentPortalShell from "@/components/agent-portal/AgentPortalShell";
import AgentPropertyActionModals from "@/components/agent-portal/AgentPropertyActionModals";
import LoadingSpinner from "@/components/LoadingSpinner";
import Pagination from "@/components/Pagination";
import PropertyListingActions from "@/components/agent-portal/PropertyListingActions";
import { useAgentPropertyActions } from "@/components/agent-portal/useAgentPropertyActions";
import { formatPropertyLocation } from "@/lib/propertyLocation";
import { formatPropertyPrice } from "@/lib/formatPrice";
import {
  formatAddedDate,
  isFeaturedProperty,
  statusClass,
  statusLabel,
  statusNote,
} from "@/lib/agentPropertyListingHelpers";
import ui from "@/components/agent-portal/portal.module.css";
import styles from "./page.module.css";

const TABS = [
  { id: "all", label: "All" },
  { id: "draft", label: "Draft" },
  { id: "pending_approval", label: "Pending Approval" },
  { id: "approved", label: "Approved" },
  { id: "rejected", label: "Rejected" },
  { id: "sold", label: "Sold" },
];

function formatPrice(value, currency) {
  return formatPropertyPrice(value, currency, { fallback: "—" });
}

export default function AgentPropertiesPage() {
  const params = useParams();
  const router = useRouter();
  const { data: session, status } = useSession();
  const username = decodeURIComponent(params.estate_name || "");
  const base = `/re/${encodeURIComponent(username)}/dashboard`;
  const [tab, setTab] = useState("all");
  const [properties, setProperties] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalProperties, setTotalProperties] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [featuredCount, setFeaturedCount] = useState(0);
  const [featuredLimit, setFeaturedLimit] = useState(10);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const propertiesSectionRef = useRef(null);
  const shouldScrollRef = useRef(false);

  const load = useCallback(async (page = currentPage, selectedTab = tab) => {
    setLoading(true);
    setLoadError("");
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
      setFeaturedCount(Number(data.featuredCount) || 0);
      setFeaturedLimit(Number(data.featuredLimit) || 10);
    } catch (err) {
      setLoadError(err.message || "Could not load properties.");
    } finally {
      setLoading(false);
    }
  }, [currentPage, tab]);

  const actions = useAgentPropertyActions({
    onReload: (page) => load(page ?? currentPage, tab),
    getReloadPage: () =>
      properties.length === 1 && currentPage > 1 ? currentPage - 1 : currentPage,
  });

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/agent/login");
      return;
    }
    if (status !== "authenticated") return;

    // Dashboard stat cards link here with ?status=<tab>; anything unrecognised
    // falls back to the default "All" tab.
    const requested = new URLSearchParams(window.location.search).get("status");
    const initialTab = TABS.some((item) => item.id === requested)
      ? requested
      : "all";
    setTab(initialTab);
    load(1, initialTab);
  }, [status, router, load]);

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

      <div
        className={`${ui.panel} ${
          !loading && properties.length > 0 ? styles.listingPanel : ""
        }`}
        ref={propertiesSectionRef}
      >
        {loadError ? (
          <div className={ui.error}>
            <p className={ui.noticeTitle}>{loadError}</p>
          </div>
        ) : null}
        {actions.error ? (
          <div className={ui.error}>
            <p className={ui.noticeTitle}>{actions.error}</p>
            {actions.errorDetails.length > 0 ? (
              <ul className={ui.errorList}>
                {actions.errorDetails.map((detail) => (
                  <li key={detail}>{detail}</li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}
        {actions.success ? <p className={ui.success}>{actions.success}</p> : null}
        {loading ? (
          <LoadingSpinner
            fullPage={false}
            label="Loading"
            hint="Fetching properties…"
          />
        ) : properties.length === 0 ? (
          <p className={ui.empty}>No properties in this tab.</p>
        ) : (
          <>
            <p className={ui.paginationCount}>
              Showing {(currentPage - 1) * 10 + 1}&ndash;
              {Math.min(currentPage * 10, totalProperties)} of {totalProperties}{" "}
              properties
              {" · "}
              Featured: {featuredCount} / {featuredLimit}
            </p>
            <div className={`${ui.tableWrap} ${styles.tableArea}`}>
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
                  const editHref = `${base}/properties/${property.id}/edit`;
                  const isApproved = property.status === "approved";
                  const isRejected = property.status === "rejected";
                  const featured = isFeaturedProperty(property);
                  const linksToEdit = isApproved || isRejected;
                  const note = statusNote(property.status);
                  const addedOn = formatAddedDate(property.created_at);
                  return (
                    <tr key={property.id}>
                      <td data-label="Property">
                        <div className={ui.propCell}>
                          {image ? (
                            linksToEdit ? (
                              <Link
                                href={editHref}
                                className={ui.thumbButton}
                                aria-label={`Edit ${property.title}`}
                              >
                                <Image
                                  src={image}
                                  alt=""
                                  width={52}
                                  height={52}
                                  className={ui.thumb}
                                />
                              </Link>
                            ) : (
                              <Image
                                src={image}
                                alt=""
                                width={52}
                                height={52}
                                className={ui.thumb}
                              />
                            )
                          ) : linksToEdit ? (
                            <Link
                              href={editHref}
                              className={ui.thumbButton}
                              aria-label={`Edit ${property.title}`}
                            >
                              <div className={ui.thumbFallback}>P</div>
                            </Link>
                          ) : (
                            <div className={ui.thumbFallback}>P</div>
                          )}
                          <div>
                            {linksToEdit ? (
                              <Link
                                href={editHref}
                                className={`${ui.propTitle} ${ui.propTitleLink}`}
                              >
                                {property.title}
                              </Link>
                            ) : (
                              <p className={ui.propTitle}>{property.title}</p>
                            )}
                            {addedOn ? (
                              <p className={ui.propMeta}>Added: {addedOn}</p>
                            ) : null}
                            {featured && property.status === "approved" ? (
                              <p className={ui.propMeta}>Featured</p>
                            ) : null}
                          </div>
                        </div>
                      </td>
                      <td data-label="Location">{formatPropertyLocation(property) || "—"}</td>
                      <td data-label="Status">
                        <span
                          className={`${ui.badge} ${statusClass(property.status)}`}
                        >
                          {statusLabel(property.status)}
                        </span>
                        {note ? <p className={ui.statusNote}>{note}</p> : null}
                      </td>
                      <td data-label="Price">
                        {formatPrice(property.price, property.price_currency)}
                      </td>
                      <td data-label="Actions">
                        <PropertyListingActions
                          property={property}
                          username={username}
                          base={base}
                          busyId={actions.busyId}
                          onMarkSold={actions.markAsSold}
                          onSubmitForApproval={actions.submitForApproval}
                          onAddFeatured={actions.addToFeatured}
                          onRemoveFeatured={actions.removeFromFeatured}
                          onOpenLinks={actions.openLinks}
                          onOpenDelete={actions.openDelete}
                          onOpenCancelApproval={actions.openCancelApproval}
                        />
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
              />
            </div>
          </>
        )}
      </div>
      <AgentPropertyActionModals
        username={username}
        propertyToDelete={actions.propertyToDelete}
        propertyToCancelApproval={actions.propertyToCancelApproval}
        propertyForLinks={actions.propertyForLinks}
        busyId={actions.busyId}
        onCloseDelete={() => actions.setPropertyToDelete(null)}
        onConfirmDelete={actions.deleteProperty}
        onCloseCancelApproval={() => actions.setPropertyToCancelApproval(null)}
        onConfirmCancelApproval={actions.cancelApprovalRequest}
        onCloseLinks={() => actions.setPropertyForLinks(null)}
      />
    </AgentPortalShell>
  );
}
