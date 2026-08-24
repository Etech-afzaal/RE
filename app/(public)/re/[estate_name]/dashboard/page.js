"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import AgentPortalShell from "@/components/agent-portal/AgentPortalShell";
import ActionMenu from "@/components/ActionMenu";
import LoadingSpinner from "@/components/LoadingSpinner";
import { formatPropertyPrice } from "@/lib/formatPrice";
import { getPropertyUrl } from "@/lib/propertySlug";
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

/** Date-only label from properties.created_at, e.g. "30 Jul 2026". */
function formatAddedDate(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
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

export default function AgentAdminDashboardPage() {
  const params = useParams();
  const router = useRouter();
  const { data: session, status } = useSession();
  const username = decodeURIComponent(params.estate_name || "");
  const [properties, setProperties] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

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
      setLoading(true);
      const res = await fetch("/api/properties?stats=1");
      const data = await res.json().catch(() => ({}));
      if (cancelled) return;
      setProperties(Array.isArray(data.properties) ? data.properties : []);
      setStats(data.stats || null);
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [status, router]);

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
                  return (
                    <tr key={property.id}>
                      <td>
                        <div className={ui.propCell}>
                          {image ? (
                            isApproved ? (
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
                          ) : isApproved ? (
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
                            {isApproved ? (
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
                              <p className={ui.propMeta}>Added at {addedOn}</p>
                            ) : null}
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
                      <td>{formatPrice(property.price, property.price_currency)}</td>
                      <td data-label="Actions">
                        <ActionMenu
                          ariaLabel={`Actions for ${property.title}`}
                          onView={
                            property.status === "approved"
                              ? () =>
                                  window.open(
                                    getPropertyUrl(property, username),
                                    "_blank",
                                    "noopener,noreferrer",
                                  )
                              : () => router.push(`${base}/properties/${property.id}/edit`)
                          }
                          onEdit={
                            property.status === "pending_approval"
                              ? undefined
                              : () => router.push(`${base}/properties/${property.id}/edit`)
                          }
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
    </AgentPortalShell>
  );
}
