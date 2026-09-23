"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { ChevronDown, Eye, Phone, X } from "lucide-react";
import AgentPortalShell from "@/components/agent-portal/AgentPortalShell";
import LoadingSpinner from "@/components/LoadingSpinner";
import Pagination from "@/components/Pagination";
import LocationAutocomplete from "@/components/agent-portal/LocationAutocomplete";
import AgentInquiryForm from "@/components/AgentInquiryForm";
import { getPropertyUrl } from "@/lib/propertySlug";
import { formatPropertyPrice } from "@/lib/formatPrice";
import { sanitizeSearchInput } from "@/lib/validators/common";
import ui from "@/components/agent-portal/portal.module.css";
import styles from "./page.module.css";

const SUBTYPE_OPTIONS = [
  { value: "all", label: "All" },
  { value: "house", label: "House" },
  { value: "apartment", label: "Apartment" },
  { value: "plot", label: "Plot" },
  { value: "shop", label: "Shop" },
  { value: "commercial", label: "Commercial" },
];

function dash(value) {
  const text = String(value || "").trim();
  return text || "—";
}

function formatPrice(value, currency) {
  return formatPropertyPrice(value, currency, { fallback: "—" });
}

function agentDisplayName(property) {
  return (
    String(property?.agent_name || "").trim() ||
    String(property?.company_name || "").trim() ||
    String(property?.estate_name || "").trim() ||
    "Agent"
  );
}

function formatRangeLabel(min, max, emptyLabel, unitSuffix = "") {
  const hasMin = String(min || "").trim() !== "";
  const hasMax = String(max || "").trim() !== "";
  if (!hasMin && !hasMax) return emptyLabel;
  const suffix = unitSuffix ? ` ${unitSuffix}` : "";
  if (hasMin && hasMax) return `${min} – ${max}${suffix}`;
  if (hasMin) return `From ${min}${suffix}`;
  return `Up to ${max}${suffix}`;
}

function RangeFilterDropdown({
  label,
  emptyLabel,
  unitHint,
  appliedMin,
  appliedMax,
  onApply,
  onReset,
}) {
  const wrapRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [draftMin, setDraftMin] = useState(appliedMin);
  const [draftMax, setDraftMax] = useState(appliedMax);

  useEffect(() => {
    if (!open) return;
    setDraftMin(appliedMin);
    setDraftMax(appliedMax);
  }, [open, appliedMin, appliedMax]);

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(event) {
      if (wrapRef.current && !wrapRef.current.contains(event.target)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  const summary = formatRangeLabel(
    appliedMin,
    appliedMax,
    emptyLabel,
    unitHint,
  );
  const active = String(appliedMin || "").trim() || String(appliedMax || "").trim();

  function handleDone() {
    onApply(String(draftMin || "").trim(), String(draftMax || "").trim());
    setOpen(false);
  }

  function handleReset() {
    setDraftMin("");
    setDraftMax("");
    onReset();
    setOpen(false);
  }

  return (
    <div className={styles.filterField} ref={wrapRef}>
      <span className={styles.filterLabel}>{label}</span>
      <div className={styles.rangeControl}>
        <button
          type="button"
          className={`${styles.rangeTrigger} ${active ? styles.rangeTriggerActive : ""}`}
          aria-expanded={open}
          aria-haspopup="dialog"
          onClick={() => setOpen((prev) => !prev)}
        >
          <span className={styles.rangeTriggerText}>{summary}</span>
          <ChevronDown size={16} aria-hidden="true" />
        </button>
        {open ? (
          <div className={styles.rangePanel} role="dialog" aria-label={label}>
            <div className={styles.rangeInputs}>
              <label className={styles.rangeInputField}>
                <span>Min</span>
                <input
                  className={ui.input}
                  type="number"
                  min="0"
                  step="any"
                  inputMode="decimal"
                  placeholder="Min"
                  value={draftMin}
                  onChange={(e) => setDraftMin(e.target.value)}
                />
              </label>
              <label className={styles.rangeInputField}>
                <span>Max</span>
                <input
                  className={ui.input}
                  type="number"
                  min="0"
                  step="any"
                  inputMode="decimal"
                  placeholder="Max"
                  value={draftMax}
                  onChange={(e) => setDraftMax(e.target.value)}
                />
              </label>
            </div>
            {unitHint ? (
              <p className={styles.rangeHint}>Values in {unitHint}</p>
            ) : null}
            <div className={styles.rangeActions}>
              <button
                type="button"
                className={ui.btnGhost}
                onClick={handleReset}
              >
                Reset
              </button>
              <button
                type="button"
                className={ui.btnPrimary}
                onClick={handleDone}
              >
                Done
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
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
  const [nearbyApplied, setNearbyApplied] = useState(false);

  const [city, setCity] = useState("");
  const [area, setArea] = useState("");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [minSize, setMinSize] = useState("");
  const [maxSize, setMaxSize] = useState("");
  const [subtype, setSubtype] = useState("all");
  const [agentId, setAgentId] = useState("");
  const [agentLabel, setAgentLabel] = useState("");
  const [agentQuery, setAgentQuery] = useState("");
  const [agentOptions, setAgentOptions] = useState([]);
  const [agentMenuOpen, setAgentMenuOpen] = useState(false);

  const [contactTarget, setContactTarget] = useState(null);

  const shouldScrollRef = useRef(false);
  const debounceRef = useRef(null);
  const agentDebounceRef = useRef(null);
  const agentWrapRef = useRef(null);
  const listSectionRef = useRef(null);

  const filters = useMemo(
    () => ({
      city: sanitizeSearchInput(city).value,
      area: sanitizeSearchInput(area).value,
      minPrice: String(minPrice || "").trim(),
      maxPrice: String(maxPrice || "").trim(),
      minSize: String(minSize || "").trim(),
      maxSize: String(maxSize || "").trim(),
      subtype,
      agentId,
    }),
    [city, area, minPrice, maxPrice, minSize, maxSize, subtype, agentId],
  );

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/agent/login");
    }
  }, [status, router]);

  const load = useCallback(async (page, activeFilters) => {
    setLoading(true);
    try {
      const qs = new URLSearchParams();
      qs.set("page", String(page));
      if (activeFilters.city) qs.set("city", activeFilters.city);
      if (activeFilters.area) qs.set("area", activeFilters.area);
      if (activeFilters.minPrice) qs.set("minPrice", activeFilters.minPrice);
      if (activeFilters.maxPrice) qs.set("maxPrice", activeFilters.maxPrice);
      if (activeFilters.minSize) qs.set("minSize", activeFilters.minSize);
      if (activeFilters.maxSize) qs.set("maxSize", activeFilters.maxSize);
      if (activeFilters.subtype && activeFilters.subtype !== "all") {
        qs.set("subtype", activeFilters.subtype);
      }
      if (activeFilters.agentId) qs.set("agentId", activeFilters.agentId);

      const res = await fetch(`/api/properties/finder?${qs}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setResults([]);
        setTotalPages(1);
        setTotalProperties(0);
        setNearbyApplied(false);
        return;
      }
      setResults(Array.isArray(data.properties) ? data.properties : []);
      setCurrentPage(data.currentPage || 1);
      setTotalPages(data.totalPages || 1);
      setTotalProperties(data.totalProperties || 0);
      setNearbyApplied(Boolean(data.nearbyApplied));
    } catch {
      setResults([]);
      setTotalPages(1);
      setTotalProperties(0);
      setNearbyApplied(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (status !== "authenticated") return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      shouldScrollRef.current = false;
      load(1, filters);
    }, 280);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [status, filters, load]);

  useEffect(() => {
    if (!loading && shouldScrollRef.current) {
      listSectionRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
      shouldScrollRef.current = false;
    }
  }, [loading, currentPage]);

  useEffect(() => {
    function handleClickOutside(event) {
      if (
        agentWrapRef.current &&
        !agentWrapRef.current.contains(event.target)
      ) {
        setAgentMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (!agentMenuOpen) return;
    if (agentDebounceRef.current) clearTimeout(agentDebounceRef.current);
    agentDebounceRef.current = setTimeout(async () => {
      try {
        const qs = new URLSearchParams({
          mode: "agents",
          q: sanitizeSearchInput(agentQuery).value,
        });
        const res = await fetch(`/api/properties/finder?${qs}`);
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setAgentOptions([]);
          return;
        }
        setAgentOptions(Array.isArray(data.agents) ? data.agents : []);
      } catch {
        setAgentOptions([]);
      }
    }, 200);
    return () => {
      if (agentDebounceRef.current) clearTimeout(agentDebounceRef.current);
    };
  }, [agentMenuOpen, agentQuery]);

  function handlePageChange(page) {
    shouldScrollRef.current = true;
    load(page, filters);
  }

  function clearFilters() {
    setCity("");
    setArea("");
    setMinPrice("");
    setMaxPrice("");
    setMinSize("");
    setMaxSize("");
    setSubtype("all");
    setAgentId("");
    setAgentLabel("");
    setAgentQuery("");
  }

  function selectAgent(agent) {
    setAgentId(String(agent.id));
    setAgentLabel(agent.name);
    setAgentQuery(agent.name);
    setAgentMenuOpen(false);
  }

  function clearAgent() {
    setAgentId("");
    setAgentLabel("");
    setAgentQuery("");
  }

  if (status === "loading" || status === "unauthenticated") {
    return (
      <LoadingSpinner
        fullPage
        label="Loading"
        hint="Opening Property Finder…"
      />
    );
  }

  return (
    <AgentPortalShell
      username={username}
      agentName={session?.user?.name}
      title="Property Finder"
      subtitle="Discover platform-wide listings with marketplace filters."
    >
      <section className={styles.filtersCard} aria-label="Property filters">
        <div className={styles.filtersRow}>
          <label className={styles.filterField}>
            <span className={styles.filterLabel}>City</span>
            <LocationAutocomplete
              className={ui.input}
              value={city}
              onChange={(e) => {
                setCity(e.target.value);
                setArea("");
              }}
              placeholder="Search city"
              types={["(cities)"]}
              country="pk"
            />
          </label>

          <label className={styles.filterField}>
            <span className={styles.filterLabel}>Area</span>
            <LocationAutocomplete
              className={ui.input}
              value={area}
              onChange={(e) => setArea(e.target.value)}
              placeholder={city ? "Search area" : "Select city first"}
              types={["geocode"]}
              country="pk"
              locationBias={city || null}
              disabled={!city.trim()}
            />
          </label>

          <RangeFilterDropdown
            label="Size"
            emptyLabel="Any size"
            unitHint="Marla"
            appliedMin={minSize}
            appliedMax={maxSize}
            onApply={(nextMin, nextMax) => {
              setMinSize(nextMin);
              setMaxSize(nextMax);
            }}
            onReset={() => {
              setMinSize("");
              setMaxSize("");
            }}
          />

          <RangeFilterDropdown
            label="Price"
            emptyLabel="Any price"
            appliedMin={minPrice}
            appliedMax={maxPrice}
            onApply={(nextMin, nextMax) => {
              setMinPrice(nextMin);
              setMaxPrice(nextMax);
            }}
            onReset={() => {
              setMinPrice("");
              setMaxPrice("");
            }}
          />

          <label className={styles.filterField}>
            <span className={styles.filterLabel}>Property Type</span>
            <select
              className={ui.select}
              value={subtype}
              onChange={(e) => setSubtype(e.target.value)}
            >
              {SUBTYPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <div className={styles.filterField} ref={agentWrapRef}>
            <span className={styles.filterLabel}>Agent</span>
            <div className={styles.agentControl}>
              <input
                className={ui.input}
                value={agentQuery}
                placeholder="Search agent"
                onFocus={() => setAgentMenuOpen(true)}
                onChange={(e) => {
                  setAgentQuery(e.target.value);
                  setAgentMenuOpen(true);
                  if (agentId) {
                    setAgentId("");
                    setAgentLabel("");
                  }
                }}
                autoComplete="off"
              />
              {agentId ? (
                <button
                  type="button"
                  className={styles.clearAgentBtn}
                  aria-label="Clear agent filter"
                  onClick={clearAgent}
                >
                  <X size={14} />
                </button>
              ) : null}
              {agentMenuOpen ? (
                <ul className={styles.agentDropdown} role="listbox">
                  {agentOptions.length === 0 ? (
                    <li className={styles.agentEmpty}>No agents found</li>
                  ) : (
                    agentOptions.map((agent) => (
                      <li key={agent.id}>
                        <button
                          type="button"
                          className={styles.agentOption}
                          onMouseDown={(e) => {
                            e.preventDefault();
                            selectAgent(agent);
                          }}
                        >
                          <span className={styles.agentOptionName}>
                            {agent.name}
                          </span>
                          {agent.company ? (
                            <span className={styles.agentOptionMeta}>
                              {agent.company}
                            </span>
                          ) : null}
                        </button>
                      </li>
                    ))
                  )}
                </ul>
              ) : null}
            </div>
            {agentLabel ? (
              <p className={styles.selectedAgent}>Selected: {agentLabel}</p>
            ) : null}
          </div>
        </div>

        <div className={styles.filterActions}>
          <button type="button" className={ui.btnGhost} onClick={clearFilters}>
            Clear filters
          </button>
        </div>
      </section>

      <section ref={listSectionRef} className={ui.panel}>
        <div className={styles.resultsHeader}>
          <div>
            <h2 className={styles.resultsTitle}>Property Results</h2>
            <p className={ui.paginationCount}>
              {loading
                ? "Loading…"
                : `${totalProperties} ${
                    totalProperties === 1 ? "property" : "properties"
                  }`}
              {!loading && nearbyApplied
                ? " · Nearby based on your location"
                : ""}
            </p>
          </div>
        </div>

        {loading ? (
          <LoadingSpinner
            fullPage={false}
            label="Loading"
            hint="Fetching marketplace listings…"
          />
        ) : results.length === 0 ? (
          <p className={styles.empty}>
            No properties match these filters. Try adjusting city, area, or
            price.
          </p>
        ) : (
          <div className={ui.tableWrap}>
            <table className={ui.table}>
              <thead>
                <tr>
                  <th>City</th>
                  <th>Area</th>
                  <th>Phase</th>
                  <th>Block/Sector</th>
                  <th>Property/Plot No</th>
                  <th>Price</th>
                  <th>Offered By</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {results.map((property) => {
                  const viewHref = getPropertyUrl(property);
                  return (
                    <tr key={property.id}>
                      <td data-label="City">{dash(property.city)}</td>
                      <td data-label="Area">{dash(property.area)}</td>
                      <td data-label="Phase">{dash(property.phase)}</td>
                      <td data-label="Block/Sector">—</td>
                      <td data-label="Property/Plot No">
                        {dash(property.address)}
                      </td>
                      <td data-label="Price">
                        {formatPrice(property.price, property.price_currency)}
                      </td>
                      <td data-label="Offered By">
                        {agentDisplayName(property)}
                      </td>
                      <td data-label="Action">
                        <div className={styles.actionRow}>
                          <button
                            type="button"
                            className={styles.iconBtn}
                            aria-label={`Contact ${agentDisplayName(property)}`}
                            title="Contact Agent"
                            onClick={() => setContactTarget(property)}
                          >
                            <Phone size={16} />
                          </button>
                          <Link
                            href={viewHref}
                            className={styles.iconBtn}
                            aria-label={`View ${property.title || "property"}`}
                            title="View Property"
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <Eye size={16} />
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {!loading && totalPages > 1 ? (
          <div className={styles.paginationWrap}>
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={handlePageChange}
              ariaLabel="Property finder pagination"
            />
          </div>
        ) : null}
      </section>

      {contactTarget ? (
        <div className={ui.dialogBackdrop} role="presentation">
          <div
            className={`${ui.dialog} ${ui.dialogWide}`}
            role="dialog"
            aria-modal="true"
            aria-labelledby="finder-contact-title"
          >
            <div className={styles.contactHeader}>
              <div>
                <p className={styles.contactKicker}>Contact Agent</p>
                <h3 id="finder-contact-title" className={ui.dialogTitle}>
                  {agentDisplayName(contactTarget)}
                </h3>
                {contactTarget.title ? (
                  <p className={styles.contactProperty}>
                    About: {contactTarget.title}
                  </p>
                ) : null}
              </div>
              <button
                type="button"
                className={ui.btnGhost}
                onClick={() => setContactTarget(null)}
              >
                Close
              </button>
            </div>
            {contactTarget.agent_phone ? (
              <a
                className={styles.callLink}
                href={`tel:${String(contactTarget.agent_phone).replace(/\s/g, "")}`}
              >
                Call {contactTarget.agent_phone}
              </a>
            ) : null}
            <AgentInquiryForm
              agentId={contactTarget.agent_id}
              propertyId={contactTarget.id}
              variant="website"
              kicker="Send a message"
              heading={`Message ${agentDisplayName(contactTarget)}`}
            />
          </div>
        </div>
      ) : null}
    </AgentPortalShell>
  );
}
