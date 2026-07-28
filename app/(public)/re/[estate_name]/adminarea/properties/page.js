"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import AgentPortalShell from "@/components/agent-portal/AgentPortalShell";
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
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);

  async function load() {
    setLoading(true);
    const res = await fetch("/api/properties");
    const data = await res.json().catch(() => ({}));
    setProperties(Array.isArray(data.properties) ? data.properties : []);
    setLoading(false);
  }

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/agent/login");
      return;
    }
    if (status === "authenticated") load();
  }, [status, router]);

  const filtered = useMemo(() => {
    if (tab === "all") return properties;
    return properties.filter((p) => p.status === tab);
  }, [properties, tab]);

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

  async function deleteProperty(id) {
    if (!window.confirm("Delete this property? This cannot be undone.")) return;
    setBusyId(id);
    await fetch(`/api/properties/${id}`, { method: "DELETE" });
    await load();
    setBusyId(null);
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
            onClick={() => setTab(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className={ui.panel}>
        {loading ? (
          <p className={ui.empty}>Loading…</p>
        ) : filtered.length === 0 ? (
          <p className={ui.empty}>No properties in this tab.</p>
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
                {filtered.map((property) => {
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
                        <div className={ui.actions}>
                          {property.status === "approved" ? (
                            <Link
                              href={`/re/${encodeURIComponent(username)}/${property.id}`}
                              className={ui.btnGhost}
                              target="_blank"
                            >
                              View
                            </Link>
                          ) : null}
                          <Link
                            href={`${base}/properties/${property.id}/edit`}
                            className={ui.btnGhost}
                          >
                            {property.status === "draft"
                              ? "Continue Editing"
                              : "Edit"}
                          </Link>
                          {property.status === "draft" ||
                          property.status === "rejected" ? (
                            <button
                              type="button"
                              className={ui.btnGhost}
                              disabled={busyId === property.id}
                              onClick={() => submitForApproval(property)}
                            >
                              Submit
                            </button>
                          ) : null}
                          {property.status === "draft" ? (
                            <button
                              type="button"
                              className={ui.btnDanger}
                              disabled={busyId === property.id}
                              onClick={() => deleteProperty(property.id)}
                            >
                              Delete
                            </button>
                          ) : null}
                        </div>
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
