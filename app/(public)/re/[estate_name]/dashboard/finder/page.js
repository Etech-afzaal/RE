"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import AgentPortalShell from "@/components/agent-portal/AgentPortalShell";
import LoadingSpinner from "@/components/LoadingSpinner";
import Pagination from "@/components/Pagination";
import FilePropertyPlaceholder from "@/components/FilePropertyPlaceholder";
import PlotPropertyPlaceholder from "@/components/PlotPropertyPlaceholder";
import ClearableSearchInput from "@/components/ClearableSearchInput";
import { getPropertyUrl } from "@/lib/propertySlug";
import { formatPropertyLocation } from "@/lib/propertyLocation";
import { formatPropertyPrice } from "@/lib/formatPrice";
import { propertySubtypeLabel } from "@/lib/propertyTaxonomy";
import { normalizePropertySubtype } from "@/lib/propertyTaxonomy";
import { formatAddedDate } from "@/lib/agentPropertyListingHelpers";
import {
  isFileProperty,
  publicPropertyCardTypeLabel,
} from "@/lib/publicPropertyData";
import { sanitizeSearchInput } from "@/lib/validators/common";
import ui from "@/components/agent-portal/portal.module.css";
import styles from "./page.module.css";

const TYPE_FILTERS = [
  { value: "all", label: "All Types" },
  { value: "sale", label: "For Sale" },
  { value: "rent", label: "For Rent" },
  { value: "plot", label: "Plots" },
];

function formatPrice(value, currency) {
  return formatPropertyPrice(value, currency, { fallback: "—" });
}

export default function PropertyFinderPage() {
  const params = useParams();
  const router = useRouter();
  const { data: session, status } = useSession();
  const username = decodeURIComponent(params.estate_name || "");

  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalProperties, setTotalProperties] = useState(0);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [copiedId, setCopiedId] = useState(null);
  const shouldScrollRef = useRef(false);
  const debounceRef = useRef(null);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/agent/login");
    }
  }, [status, router]);

  const load = useCallback(async (page, opts = {}) => {
    setLoading(true);
    try {
      const qs = new URLSearchParams();
      qs.set("page", String(page));
      if (opts.search) qs.set("search", opts.search);
      if (opts.type && opts.type !== "all") qs.set("type", opts.type);
      const res = await fetch(`/api/properties/finder?${qs}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setResults([]);
        setTotalPages(1);
        setTotalProperties(0);
        return;
      }
      setResults(data.properties || []);
      setCurrentPage(data.currentPage || 1);
      setTotalPages(data.totalPages || 1);
      setTotalProperties(data.totalProperties || 0);
    } catch {
      setResults([]);
      setTotalPages(1);
      setTotalProperties(0);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(1, { search, type: typeFilter });
  }, [load, search, typeFilter]);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  function handleSearchChange(value) {
    setSearchInput(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setSearch(sanitizeSearchInput(value).value);
    }, 300);
  }

  function handlePageChange(page) {
    shouldScrollRef.current = true;
    load(page, { search, type: typeFilter });
  }

  function copyLink(property) {
    const url = `${window.location.origin}${getPropertyUrl(property)}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopiedId(property.id);
      setTimeout(() => setCopiedId(null), 1800);
    }).catch(() => {});
  }

  if (status === "loading" || status === "unauthenticated") {
    return (
      <AgentPortalShell
        username={username}
        agentName={session?.user?.name}
        title="Property Finder"
        subtitle="Discover properties across the platform"
      >
        <LoadingSpinner fullPage label="Loading" hint="Preparing Property Finder…" />
      </AgentPortalShell>
    );
  }

  return (
    <AgentPortalShell
      username={username}
      agentName={session?.user?.name}
      title="Property Finder"
      subtitle="Discover properties across the platform"
    >
      <div className={styles.page}>
        <div className={styles.toolbar}>
          <div className={styles.searchWrap}>
            <ClearableSearchInput
              type="search"
              value={searchInput}
              onChange={(e) => handleSearchChange(e.target.value)}
              placeholder="Search by title, area, city, or agent name"
              aria-label="Search properties"
            />
          </div>
          <select
            className={styles.filterSelect}
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            aria-label="Filter by type"
          >
            {TYPE_FILTERS.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>

        {loading ? (
          <p className={styles.loadingText}>Loading properties…</p>
        ) : results.length === 0 ? (
          <div className={styles.empty}>No properties found.</div>
        ) : (
          <>
            <p className={styles.resultCount}>
              {totalProperties} {totalProperties === 1 ? "property" : "properties"} found
            </p>
            <div className={styles.grid}>
              {results.map((property) => (
                <FinderCard
                  key={property.id}
                  property={property}
                  onCopy={copyLink}
                  copied={copiedId === property.id}
                />
              ))}
            </div>
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={handlePageChange}
              ariaLabel="Property Finder pagination"
            />
          </>
        )}
      </div>
    </AgentPortalShell>
  );
}

function FinderCard({ property, onCopy, copied }) {
  const location = formatPropertyLocation(property) || "";
  const title = property.title || location || "Property";
  const propertyUrl = getPropertyUrl(property);
  const agentUrl = `/re/${encodeURIComponent(property.username || property.estate_name || "")}`;
  const agentName = property.agent_name || property.company_name || property.estate_name || "Agent";
  const company = property.company_name || property.estate_name || "";
  const listedAt = formatAddedDate(property.created_at);
  const subtypeLabel = propertySubtypeLabel(normalizePropertySubtype(property.property_subtype));
  const cardTypeLabel = publicPropertyCardTypeLabel(property, subtypeLabel);

  return (
    <div className={styles.card}>
      <div className={styles.cardLeft}>
        <Link href={propertyUrl} className={styles.cardLink}>
          <div className={styles.media}>
            {property.status === "sold" || property.status === "under_contract" ? (
              <span className={`${styles.statusBadge} ${property.status === "sold" ? styles.statusBadgeSold : styles.statusBadgeUnderContract}`}>
                {property.status === "sold" ? "Sold" : "Under Contract"}
              </span>
            ) : null}
            {property.featuredImage ? (
              <Image
                src={property.featuredImage.image_url}
                alt={title}
                fill
                sizes="(max-width: 768px) 100vw, 50vw"
                className={styles.image}
              />
            ) : (
              isFileProperty(property) ? <FilePropertyPlaceholder fill /> :
              property.property_type === "plot" ? <PlotPropertyPlaceholder fill /> :
              <div className={styles.fallback} />
            )}
          </div>
        </Link>
        <div className={styles.cardInfo}>
          <Link href={propertyUrl} className={styles.cardLink}>
            <h3 className={styles.title}>{title}</h3>
          </Link>
          {location ? <p className={styles.location}>{location}</p> : null}
          <div className={styles.attrs}>
            {cardTypeLabel ? <span className={styles.attr}>{cardTypeLabel}</span> : null}
            {property.property_type ? <span className={styles.attr}>{property.property_type === "sale" ? "For Sale" : property.property_type === "rent" ? "For Rent" : "Plot"}</span> : null}
            {listedAt ? <span className={styles.attr}>Listed {listedAt}</span> : null}
          </div>
          <p className={styles.price}>{formatPrice(property.price, property.price_currency)}</p>
        </div>
      </div>
      <div className={styles.cardRight}>
        <p className={styles.listedLabel}>Listed By</p>
        {property.profile_image ? (
          <Image
            src={property.profile_image}
            alt={agentName}
            width={40}
            height={40}
            className={styles.agentAvatar}
          />
        ) : (
          <span className={styles.agentAvatarFallback}>{agentName.charAt(0)}</span>
        )}
        <p className={styles.agentName}>{agentName}</p>
        {company ? <p className={styles.agentCompany}>{company}</p> : null}
        {property.office_address ? <p className={styles.agentLocation}>{property.office_address}</p> : null}
        <Link href={agentUrl} className={styles.profileLink} target="_blank" rel="noopener noreferrer">
          View Profile
        </Link>
        <Link href={propertyUrl} className={styles.viewBtn}>
          View Property
        </Link>
        <button
          type="button"
          className={styles.copyBtn}
          onClick={() => onCopy(property)}
        >
          {copied ? "Copied!" : "Copy Link"}
        </button>
      </div>
    </div>
  );
}
