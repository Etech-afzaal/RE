"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import AgentPortalShell from "@/components/agent-portal/AgentPortalShell";
import AgentPropertyActionModals from "@/components/agent-portal/AgentPropertyActionModals";
import LoadingSpinner from "@/components/LoadingSpinner";
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

/** `id` matches the stats payload key; `status` filters the properties list. */
const STAT_CARDS = [
  { id: "total", label: "Total Properties", status: null },
  { id: "approved", label: "Approved", status: "approved" },
  { id: "pending_approval", label: "Pending Approval", status: "pending_approval" },
  { id: "draft", label: "Draft", status: "draft" },
];

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good Morning";
  if (h < 17) return "Good Afternoon";
  return "Good Evening";
}

function formatPrice(value, currency) {
  return formatPropertyPrice(value, currency, { fallback: "—" });
}

export default function AgentAdminDashboardPage() {
  const params = useParams();
  const router = useRouter();
  const { data: session, status } = useSession();
  const username = decodeURIComponent(params.estate_name || "");
  const [properties, setProperties] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/properties?stats=1");
    const data = await res.json().catch(() => ({}));
    setProperties(Array.isArray(data.properties) ? data.properties : []);
    setStats(data.stats || null);
    setLoading(false);
  }, []);

  const actions = useAgentPropertyActions({ onReload: loadDashboard });

  const firstName = useMemo(() => {
    const name = session?.user?.name || "Agent";
    return String(name).split(" ")[0];
  }, [session]);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/agent/login");
      return;
    }
    if (status !== "authenticated") return;

    let cancelled = false;
    (async () => {
      await loadDashboard();
      if (cancelled) return;
    })();

    return () => {
      cancelled = true;
    };
  }, [status, router, loadDashboard]);

  const recent = properties.slice(0, 8);
  const base = `/re/${encodeURIComponent(username)}/dashboard`;

  return (
    <AgentPortalShell
      username={username}
      agentName={session?.user?.name}
      title={`${greeting()}, ${firstName}`}
      subtitle="Manage your properties and grow your business"
      action={
        <Link href={`${base}/properties/create`} className={ui.btnPrimary}>
          Add New Property
        </Link>
      }
    >
      <div className={ui.gridStats}>
        {STAT_CARDS.map((card) => (
          <Link
            key={card.id}
            href={
              card.status
                ? `${base}/properties?status=${card.status}`
                : `${base}/properties`
            }
            className={`${ui.statCard} ${ui.statCardLink}`}
          >
            <p className={ui.statLabel}>{card.label}</p>
            <p className={ui.statValue}>
              {stats?.[card.id] ?? (loading ? "…" : 0)}
            </p>
          </Link>
        ))}
      </div>

      <div className={ui.panel}>
        <div className={ui.panelHeader}>
          <h2 className={ui.panelTitle}>Recent Properties</h2>
          <Link href={`${base}/properties`} className={ui.btnGhost}>
            View All
          </Link>
        </div>
        {actions.error ? (
          <div className={ui.error} style={{ margin: "1rem 1.1rem 0" }}>
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
        {actions.success ? (
          <p className={ui.success} style={{ margin: "1rem 1.1rem 0" }}>
            {actions.success}
          </p>
        ) : null}
        {loading ? (
          <LoadingSpinner
            fullPage={false}
            label="Loading"
            hint="Fetching properties…"
          />
        ) : recent.length === 0 ? (
          <div className={ui.empty}>
            <p className={ui.muted}>No properties yet.</p>
            <Link
              href={`${base}/properties/create`}
              className={ui.btnPrimary}
              style={{ marginTop: "1rem" }}
            >
              Add your first property
            </Link>
          </div>
        ) : (
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
                {recent.map((property) => {
                  const image =
                    property.featuredImage?.image_url ||
                    property.images?.[0]?.image_url ||
                    null;
                  const addedOn = formatAddedDate(property.created_at);
                  const editHref = `${base}/properties/${property.id}/edit`;
                  const isApproved = property.status === "approved";
                  const isRejected = property.status === "rejected";
                  const featured = isFeaturedProperty(property);
                  const linksToEdit = isApproved || isRejected;
                  const note = statusNote(property.status);
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
                            {featured && isApproved ? (
                              <p className={ui.propMeta}>Featured</p>
                            ) : null}
                          </div>
                        </div>
                      </td>
                      <td data-label="Location">
                        {formatPropertyLocation(property) || "—"}
                      </td>
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
