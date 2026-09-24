"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Building2, ChevronDown, Eye, Home, MapPinned, Phone, X } from "lucide-react";
import AgentPortalShell from "@/components/agent-portal/AgentPortalShell";
import LoadingSpinner from "@/components/LoadingSpinner";
import Pagination from "@/components/Pagination";
import LocationAutocomplete from "@/components/agent-portal/LocationAutocomplete";
import AgentInquiryForm from "@/components/AgentInquiryForm";
import { getPropertyUrl } from "@/lib/propertySlug";
import { formatPropertyPrice } from "@/lib/formatPrice";
import { propertySubtypeLabel } from "@/lib/propertyTaxonomy";
import { publicPropertyCardTypeLabel } from "@/lib/publicPropertyData";
import { sanitizeSearchInput } from "@/lib/validators/common";
import ui from "@/components/agent-portal/portal.module.css";
import styles from "./page.module.css";

const PROPERTY_TYPE_TABS = [
  {
    value: "homes",
    label: "Homes",
    allLabel: "All Homes",
    icon: Home,
    options: [
      { value: "all", label: "All Homes", icon: Home },
      { value: "house", label: "House", icon: Home },
      { value: "apartment", label: "Apartment", icon: Building2 },
    ],
  },
  {
    value: "plots",
    label: "Plots",
    allLabel: "All Plots",
    icon: MapPinned,
    options: [
      { value: "all", label: "All Plots", icon: MapPinned },
      { value: "residential_plot", label: "Residential Plot", icon: MapPinned },
      { value: "commercial_plot", label: "Commercial Plot", icon: MapPinned },
      { value: "file", label: "Plot File", icon: MapPinned },
    ],
  },
  {
    value: "commercial",
    label: "Commercial",
    allLabel: "All Commercial",
    icon: Building2,
    options: [
      { value: "all", label: "All Commercial", icon: Building2 },
      { value: "shop", label: "Shop", icon: Building2 },
      { value: "commercial", label: "Plaza", icon: Building2 },
      { value: "commercial", label: "Office", icon: Building2 },
      { value: "commercial", label: "Other Commercial", icon: Building2 },
    ],
  },
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

function formatSizeValue(value) {
  const text = String(value ?? "").trim();
  if (!text) return "";
  const number = Number(text);
  if (!Number.isFinite(number)) return text;
  return String(number);
}

function formatSizeUnit(value) {
  const unit = String(value || "marla").trim().toLowerCase();
  return unit === "sqft" ? "Sqft" : unit ? unit[0].toUpperCase() + unit.slice(1) : "Marla";
}

function formatRangeLabel(min, max, emptyLabel, unitSuffix = "", valueFormatter = (value) => value) {
  const hasMin = String(min || "").trim() !== "";
  const hasMax = String(max || "").trim() !== "";
  if (!hasMin && !hasMax) return emptyLabel;
  const suffix = unitSuffix ? ` ${unitSuffix}` : "";
  const formattedMin = valueFormatter(min);
  const formattedMax = valueFormatter(max);
  if (hasMin && hasMax) return `${formattedMin} – ${formattedMax}${suffix}`;
  if (hasMin) return `From ${formattedMin}${suffix}`;
  return `Up to ${formattedMax}${suffix}`;
}

function RangeFilterDropdown({
  label,
  emptyLabel,
  unitHint,
  appliedMin,
  appliedMax,
  unit,
  units,
  onUnitChange,
  valueFormatter,
  alignRight = false,
  onApply,
  onReset,
}) {
  const wrapRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [draftMin, setDraftMin] = useState(appliedMin || "0");
  const [draftMax, setDraftMax] = useState(appliedMax);

  useEffect(() => {
    if (!open) return;
    setDraftMin(appliedMin || "0");
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
    unit,
    valueFormatter,
  );
  const active = String(appliedMin || "").trim() || String(appliedMax || "").trim();

  function handleDone() {
    onApply(String(draftMin || "0").trim(), String(draftMax || "").trim());
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
          <div className={`${styles.rangePanel} ${alignRight ? styles.rangePanelRight : ""}`} role="dialog" aria-label={label}>
            <div className={styles.rangeInputs}>
              <label className={styles.rangeInputField}>
                <span>Min</span>
                <input
                  className={ui.input}
                  type="number"
                  min="0"
                  step="any"
                  inputMode="decimal"
                  placeholder="0"
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
                  placeholder="Any"
                  value={draftMax}
                  onChange={(e) => setDraftMax(e.target.value)}
                />
              </label>
            </div>
            {units?.length ? (
              <label className={styles.rangeUnit}>
                <span>Unit</span>
                <select className={ui.select} value={unit} onChange={(e) => onUnitChange?.(e.target.value)}>
                  {units.map((option) => <option key={option} value={option}>{option}</option>)}
                </select>
              </label>
            ) : unitHint ? <p className={styles.rangeHint}>Values in {unitHint}</p> : null}
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
  const [block, setBlock] = useState("");
  const [propertyNumber, setPropertyNumber] = useState("");
  const [statusFilter, setStatusFilter] = useState("sale");
  const [category, setCategory] = useState("homes");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [minSize, setMinSize] = useState("");
  const [maxSize, setMaxSize] = useState("");
  const [sizeUnit, setSizeUnit] = useState("Marla");
  const [subtype, setSubtype] = useState("all");
  const [propertyTypeTab, setPropertyTypeTab] = useState("homes");
  const [propertyTypeSelection, setPropertyTypeSelection] = useState("All Homes");
  const [propertyTypeOpen, setPropertyTypeOpen] = useState(false);
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
  const propertyTypeWrapRef = useRef(null);
  const listSectionRef = useRef(null);

  const filters = useMemo(
    () => ({
      city: sanitizeSearchInput(city).value,
      area: sanitizeSearchInput(area).value,
      block: sanitizeSearchInput(block).value,
      propertyNumber: sanitizeSearchInput(propertyNumber).value,
      status: statusFilter,
      category,
      minPrice: String(minPrice || "").trim(),
      maxPrice: String(maxPrice || "").trim(),
      minSize: String(minSize || "").trim(),
      maxSize: String(maxSize || "").trim(),
      sizeUnit,
      subtype,
      agentId,
    }),
    [city, area, block, propertyNumber, statusFilter, category, minPrice, maxPrice, minSize, maxSize, sizeUnit, subtype, agentId],
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
      if (activeFilters.block) qs.set("block", activeFilters.block);
      if (activeFilters.propertyNumber) qs.set("propertyNumber", activeFilters.propertyNumber);
      qs.set("status", activeFilters.status);
      if (activeFilters.category) qs.set("category", activeFilters.category);
      if (activeFilters.minPrice) qs.set("minPrice", activeFilters.minPrice);
      if (activeFilters.maxPrice) qs.set("maxPrice", activeFilters.maxPrice);
      if (activeFilters.minSize) qs.set("minSize", activeFilters.minSize);
      if (activeFilters.maxSize) qs.set("maxSize", activeFilters.maxSize);
      qs.set("sizeUnit", activeFilters.sizeUnit);
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
      if (!city && data.defaultCity) setCity(data.defaultCity);
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
    function handleClickOutside(event) {
      if (
        propertyTypeWrapRef.current &&
        !propertyTypeWrapRef.current.contains(event.target)
      ) {
        setPropertyTypeOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
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
    setBlock("");
    setPropertyNumber("");
    setStatusFilter("sale");
    setCategory("homes");
    setMinPrice("");
    setMaxPrice("");
    setMinSize("");
    setMaxSize("");
    setSizeUnit("Marla");
    setSubtype("all");
    setPropertyTypeTab("homes");
    setPropertyTypeSelection("All Homes");
    setPropertyTypeOpen(false);
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

  const activePropertyTypeTab =
    PROPERTY_TYPE_TABS.find((tab) => tab.value === propertyTypeTab) ||
    PROPERTY_TYPE_TABS[0];
  const propertyTypeLabel = propertyTypeSelection;

  function selectPropertyType(option) {
    const isAll = option.value === "all";
    setCategory(isAll ? activePropertyTypeTab.value : "");
    setSubtype(option.value);
    setPropertyTypeSelection(option.label);
    setPropertyTypeOpen(false);
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
        <div className={`${styles.filtersRow} ${styles.filtersRowPrimary}`}>
          <label className={styles.filterField}>
            <span className={styles.filterLabel}>Status</span>
            <select className={`${ui.select} ${styles.statusSelect}`} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="sale">For Sale</option>
              <option value="rent">For Rent</option>
            </select>
          </label>

          <div className={styles.filterField} ref={propertyTypeWrapRef}>
            <span className={styles.filterLabel}>Property Type</span>
            <div className={styles.propertyTypeControl}>
              <button
                type="button"
                className={`${styles.rangeTrigger} ${propertyTypeOpen ? styles.rangeTriggerActive : ""}`}
                aria-expanded={propertyTypeOpen}
                aria-haspopup="dialog"
                onClick={() => setPropertyTypeOpen((previous) => !previous)}
              >
                <span className={styles.rangeTriggerText}>{propertyTypeLabel}</span>
                <ChevronDown size={16} aria-hidden="true" />
              </button>
              {propertyTypeOpen ? (
                <div className={styles.propertyTypePanel} role="dialog" aria-label="Property Type">
                  <div className={styles.propertyTypeTabs} role="tablist" aria-label="Property categories">
                    {PROPERTY_TYPE_TABS.map((tab) => {
                      const TabIcon = tab.icon;
                      return (
                        <button
                          key={tab.value}
                          type="button"
                          role="tab"
                          aria-selected={propertyTypeTab === tab.value}
                          className={`${styles.propertyTypeTab} ${propertyTypeTab === tab.value ? styles.propertyTypeTabActive : ""}`}
                          onClick={() => setPropertyTypeTab(tab.value)}
                        >
                          <TabIcon size={15} aria-hidden="true" />
                          {tab.label}
                        </button>
                      );
                    })}
                  </div>
                  <div className={styles.propertyTypeOptions} role="tabpanel">
                    {activePropertyTypeTab.options.map((option) => {
                      const OptionIcon = option.icon;
                      const selected = propertyTypeSelection === option.label;
                      return (
                        <button
                          key={`${activePropertyTypeTab.value}-${option.label}`}
                          type="button"
                          className={`${styles.propertyTypeOption} ${selected ? styles.propertyTypeOptionSelected : ""}`}
                          aria-pressed={selected}
                          onClick={() => selectPropertyType(option)}
                        >
                          <OptionIcon size={17} aria-hidden="true" />
                          <span>{option.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : null}
            </div>
          </div>

          <div className={styles.filterField} ref={agentWrapRef}>
            <span className={styles.filterLabel}>Agent</span>
            <div className={styles.agentControl}>
              <input
                className={ui.input}
                value={agentQuery}
                placeholder="Search agent"
                onFocus={() => setAgentMenuOpen(true)}
                onChange={(e) => { setAgentQuery(e.target.value); setAgentMenuOpen(true); if (agentId) { setAgentId(""); setAgentLabel(""); } }}
                autoComplete="off"
              />
              {agentId ? <button type="button" className={styles.clearAgentBtn} aria-label="Clear agent filter" onClick={clearAgent}><X size={14} /></button> : null}
              {agentMenuOpen ? (
                <ul className={styles.agentDropdown} role="listbox">
                  {agentOptions.length === 0 ? <li className={styles.agentEmpty}>No agents found</li> : agentOptions.map((agent) => <li key={agent.id}><button type="button" className={styles.agentOption} onMouseDown={(e) => { e.preventDefault(); selectAgent(agent); }}><span className={styles.agentOptionName}>{agent.name}</span>{agent.company ? <span className={styles.agentOptionMeta}>{agent.company}</span> : null}</button></li>)}
                </ul>
              ) : null}
            </div>
            {agentLabel ? <p className={styles.selectedAgent}>Selected: {agentLabel}</p> : null}
          </div>
        </div>

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

          <label className={styles.filterField}>
            <span className={styles.filterLabel}>Block/Sector</span>
            <input className={ui.input} value={block} onChange={(e) => setBlock(e.target.value)} placeholder={area ? "Search block/sector" : "Select area first"} disabled={!area.trim()} />
          </label>

          <label className={styles.filterField}>
            <span className={styles.filterLabel}>Property/Plot No</span>
            <input className={ui.input} value={propertyNumber} onChange={(e) => setPropertyNumber(e.target.value)} placeholder="e.g. 123" />
          </label>

          <RangeFilterDropdown
            label="Size"
            emptyLabel="Any size"
            unitHint="Marla"
            unit={sizeUnit}
            units={["Marla", "Kanal", "Sqft"]}
            onUnitChange={setSizeUnit}
            valueFormatter={formatSizeValue}
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
            alignRight
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
                  <th>Block/Sector</th>
                  <th>Property/Plot No</th>
                  <th>Property Type</th>
                  <th>Size</th>
                  <th>Price</th>
                  <th>Offered By</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {results.map((property) => {
                  const viewHref = getPropertyUrl(property);
                  const agentHref = property.username || property.estate_name
                    ? `/re/${encodeURIComponent(property.username || property.estate_name)}`
                    : "#";
                  const propertyType = publicPropertyCardTypeLabel(
                    property,
                    propertySubtypeLabel(property.property_subtype) || dash(property.property_subtype),
                  );
                  const sizeLabel = property.size_value == null
                    ? "—"
                    : `${formatSizeValue(property.size_value)} ${formatSizeUnit(property.size_unit)}`;
                  function openProperty() {
                    if (viewHref !== "#") window.open(viewHref, "_blank", "noopener,noreferrer");
                  }
                  return (
                    <tr key={property.id}>
                      <td data-label="City" onClick={openProperty} className={styles.clickableCell}>{dash(property.city)}</td>
                      <td data-label="Area" onClick={openProperty} className={styles.clickableCell}>{dash(property.area)}</td>
                      <td data-label="Block/Sector" onClick={openProperty} className={styles.clickableCell}>{dash(property.phase)}</td>
                      <td data-label="Property/Plot No" onClick={openProperty} className={styles.clickableCell}>{dash(property.address)}</td>
                      <td data-label="Property Type" onClick={openProperty} className={styles.clickableCell}>{propertyType}</td>
                      <td data-label="Size" onClick={openProperty} className={styles.clickableCell}>{sizeLabel}</td>
                      <td data-label="Price" onClick={openProperty} className={styles.clickableCell}>
                        {formatPrice(property.price, property.price_currency)}
                      </td>
                      <td data-label="Offered By">
                        {agentHref !== "#" ? <a href={agentHref} target="_blank" rel="noopener noreferrer" onClick={(event) => event.stopPropagation()}>{agentDisplayName(property)}</a> : agentDisplayName(property)}
                      </td>
                      <td data-label="Action">
                        <div className={styles.actionRow}>
                          <button
                            type="button"
                            className={styles.iconBtn}
                            aria-label={`Contact ${agentDisplayName(property)}`}
                            title="Contact Agent"
                            onClick={(event) => { event.stopPropagation(); setContactTarget(property); }}
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
                            onClick={(event) => event.stopPropagation()}
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
