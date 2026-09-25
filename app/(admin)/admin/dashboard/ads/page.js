"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Ban,
  Gift,
  ImageIcon,
  Layers,
  Radio,
  Search,
  SlidersHorizontal,
} from "lucide-react";
import LoadingSpinner from "@/components/LoadingSpinner";
import AdsDialog from "./AdsDialog";
import AdsPager from "./AdsPager";
import {
  STATE_TONES,
  formatCtr,
  formatDateTime,
  formatNumber,
  formatShortDateTime,
  stateLabel,
} from "./adUi";
import styles from "./adsList.module.css";

const PAGE_SIZE = 10;

const TONE_CLASS = {
  success: styles.toneSuccess,
  info: styles.toneInfo,
  warning: styles.toneWarning,
  danger: styles.toneDanger,
  neutral: styles.toneNeutral,
  muted: styles.toneNeutral,
};
// Drafts use the warm tone from the design.
const toneFor = (state) => (state === "draft" ? styles.toneWarm : TONE_CLASS[STATE_TONES[state]]);

const SORTS = {
  newest: { label: "Newest first", compare: (a, b) => b.id - a.id },
  priority: {
    label: "Serving order",
    compare: (a, b) =>
      (a.tier === "paid" ? 0 : 1) - (b.tier === "paid" ? 0 : 1) ||
      b.priority - a.priority ||
      b.weight - a.weight,
  },
  impressions: { label: "Most impressions", compare: (a, b) => b.total_impressions - a.total_impressions },
  ctr: {
    label: "Best CTR",
    compare: (a, b) =>
      (b.total_impressions ? b.total_clicks / b.total_impressions : -1) -
      (a.total_impressions ? a.total_clicks / a.total_impressions : -1),
  },
  ending: {
    label: "Ending soonest",
    compare: (a, b) =>
      (a.end_at ? Date.parse(a.end_at) : Infinity) - (b.end_at ? Date.parse(b.end_at) : Infinity),
  },
};

export default function AdsListPage() {
  const [ads, setAds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState(null);
  const [confirmArchive, setConfirmArchive] = useState(null);
  const [search, setSearch] = useState("");
  const [tier, setTier] = useState("all");
  const [state, setState] = useState("all");
  const [formatCode, setFormatCode] = useState("all");
  const [showMore, setShowMore] = useState(false);
  const [adType, setAdType] = useState("all");
  const [sort, setSort] = useState("newest");
  const [showArchived, setShowArchived] = useState(false);
  const [page, setPage] = useState(1);

  const loadAds = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/ads${showArchived ? "?archived=1" : ""}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !Array.isArray(data.ads)) {
        throw new Error(data.error || "Could not load ads. Refresh the page to try again.");
      }
      setAds(data.ads);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [showArchived]);

  useEffect(() => {
    loadAds();
  }, [loadAds]);

  async function changeStatus(ad, status) {
    setBusyId(ad.id);
    try {
      const res = await fetch(`/api/admin/ads/${ad.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const verb =
          status === "archived" ? "archived" : status === "active" ? "turned ON" : "turned OFF";
        throw new Error(`“${ad.title}” couldn't be ${verb}: ${data.error || "please try again."}`);
      }
      setAds((current) =>
        status === "archived" && !showArchived
          ? current.filter((item) => item.id !== ad.id)
          : current.map((item) => (item.id === ad.id ? data.ad : item)),
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  }

  const formats = useMemo(() => {
    const seen = new Map();
    ads.forEach((ad) => seen.set(ad.format_code, ad));
    return [...seen.values()];
  }, [ads]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return ads
      .filter((ad) => {
        if (tier !== "all" && ad.tier !== tier) return false;
        if (state !== "all" && ad.display_state !== state) return false;
        if (formatCode !== "all" && ad.format_code !== formatCode) return false;
        if (adType === "property" && !ad.property_id) return false;
        if (adType === "image" && ad.property_id) return false;
        if (!term) return true;
        return [ad.title, ad.advertiser_name, ad.property_title, ad.headline, ad.payment_ref]
          .filter(Boolean)
          .some((value) => value.toLowerCase().includes(term));
      })
      .sort(SORTS[sort].compare);
  }, [ads, search, tier, state, formatCode, adType, sort]);

  // Back to page 1 whenever the result set changes shape.
  useEffect(() => {
    setPage(1);
  }, [search, tier, state, formatCode, adType, sort, showArchived]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageAds = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const counts = useMemo(() => {
    const live = ads.filter((ad) => ad.display_state === "live");
    return {
      live: live.length,
      livePaid: live.filter((ad) => ad.tier === "paid").length,
      liveFree: live.filter((ad) => ad.tier === "free").length,
      blocked: ads.filter((ad) => ad.display_state === "blocked").length,
    };
  }, [ads]);

  const moreFilterCount = (adType !== "all" ? 1 : 0) + (sort !== "newest" ? 1 : 0);

  return (
    <div className={styles.page}>
      <div className={styles.stats}>
        <StatCard icon={Radio} value={counts.live} label="Live now" />
        <StatCard icon={Layers} value={counts.livePaid} label="Live paid / featured" />
        <StatCard icon={Gift} value={counts.liveFree} label="Live free" />
        <StatCard icon={Ban} value={counts.blocked} label="Blocked (needs attention)" />
      </div>

      <section className={styles.panel} aria-label="Ads">
        <div className={styles.filters}>
          <div className={styles.search}>
            <Search size={18} className={styles.searchIcon} aria-hidden="true" />
            <input
              type="search"
              className={styles.input}
              placeholder="Search title, advertiser, property, payment ref…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Search ads"
            />
          </div>
          <select
            className={styles.select}
            value={tier}
            onChange={(e) => setTier(e.target.value)}
            aria-label="Tier"
          >
            <option value="all">All tiers</option>
            <option value="paid">Paid / Featured</option>
            <option value="free">Free</option>
          </select>
          <select
            className={styles.select}
            value={state}
            onChange={(e) => setState(e.target.value)}
            aria-label="State"
          >
            <option value="all">All states</option>
            {Object.keys(STATE_TONES)
              .filter((key) => showArchived || key !== "archived")
              .map((key) => (
                <option key={key} value={key}>
                  {stateLabel(key)}
                </option>
              ))}
          </select>
          <select
            className={styles.select}
            value={formatCode}
            onChange={(e) => setFormatCode(e.target.value)}
            aria-label="Format"
          >
            <option value="all">All formats</option>
            {formats.map((ad) => (
              <option key={ad.format_code} value={ad.format_code}>
                {ad.format_name} ({ad.format_width}×{ad.format_height})
              </option>
            ))}
          </select>
          <button
            type="button"
            className={`${styles.moreButton} ${showMore ? styles.moreButtonOpen : ""}`}
            aria-expanded={showMore}
            aria-controls="ads-more-filters"
            onClick={() => setShowMore((open) => !open)}
          >
            <SlidersHorizontal size={16} aria-hidden="true" />
            More filters
            {moreFilterCount > 0 && <span className={styles.moreCount}>{moreFilterCount}</span>}
          </button>
        </div>

        {showMore && (
          <div id="ads-more-filters" className={styles.moreFilters}>
            <label className={styles.moreField}>
              <span>Ad type</span>
              <select
                className={styles.select}
                value={adType}
                onChange={(e) => setAdType(e.target.value)}
              >
                <option value="all">All ads</option>
                <option value="property">Linked to a property</option>
                <option value="image">Image only</option>
              </select>
            </label>
            <label className={styles.moreField}>
              <span>Sort by</span>
              <select
                className={styles.select}
                value={sort}
                onChange={(e) => setSort(e.target.value)}
              >
                {Object.entries(SORTS).map(([key, option]) => (
                  <option key={key} value={key}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            {moreFilterCount > 0 && (
              <button
                type="button"
                className={styles.clearFilters}
                onClick={() => {
                  setAdType("all");
                  setSort("newest");
                }}
              >
                Reset
              </button>
            )}
          </div>
        )}

        <label className={styles.archivedToggle}>
          <button
            type="button"
            role="switch"
            aria-checked={showArchived}
            className={`${styles.switch} ${showArchived ? styles.switchOn : ""}`}
            onClick={() => {
              setLoading(true);
              setShowArchived((value) => !value);
            }}
          />
          Show archived ads
        </label>

        {loading ? (
          <LoadingSpinner fullPage={false} label="Loading" hint="Fetching ads…" />
        ) : (
          <>
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>On</th>
                    <th>Ad</th>
                    <th>Tier</th>
                    <th>Format</th>
                    <th>State</th>
                    <th>Schedule</th>
                    <th className={styles.center}>Priority</th>
                    <th className={styles.center}>Impr.</th>
                    <th className={styles.center}>Clicks</th>
                    <th className={styles.center}>CTR</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {pageAds.length === 0 ? (
                    <tr>
                      <td colSpan={11} className={styles.empty}>
                        {ads.length === 0 ? (
                          <>
                            No ads yet.{" "}
                            <Link href="/admin/dashboard/ads/new" className={styles.adTitle}>
                              Create the first one
                            </Link>
                          </>
                        ) : (
                          "No ads match these filters."
                        )}
                      </td>
                    </tr>
                  ) : (
                    pageAds.map((ad) => (
                      <AdRow
                        key={ad.id}
                        ad={ad}
                        busy={busyId === ad.id}
                        onStatus={(status) => changeStatus(ad, status)}
                        onArchive={() => setConfirmArchive(ad)}
                      />
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className={styles.footer}>
              <span>
                Showing {pageAds.length} of {filtered.length} {filtered.length === 1 ? "ad" : "ads"}
              </span>
              <AdsPager page={currentPage} totalPages={totalPages} onChange={setPage} label="Ads pages" />
            </div>
          </>
        )}
      </section>

      {confirmArchive && (
        <AdsDialog
          title="Archive this ad?"
          message={`“${confirmArchive.title}” will stop serving and move to archived ads. Its stats and payment notes are kept, and you can restore it later.`}
          closeLabel="Cancel"
          action={{
            label: "Archive ad",
            tone: "danger",
            onClick: () => {
              const ad = confirmArchive;
              setConfirmArchive(null);
              changeStatus(ad, "archived");
            },
          }}
          onClose={() => setConfirmArchive(null)}
        />
      )}

      {error && (
        <AdsDialog title="Something went wrong" message={error} onClose={() => setError("")} />
      )}
    </div>
  );
}

function StatCard({ icon: Icon, value, label }) {
  return (
    <div className={styles.statCard}>
      <span className={styles.statIcon}>
        <Icon size={24} aria-hidden="true" />
      </span>
      <div>
        <div className={styles.statValue}>{value}</div>
        <div className={styles.statLabel}>{label}</div>
      </div>
    </div>
  );
}

function AdRow({ ad, busy, onStatus, onArchive }) {
  const isOn = ad.status === "active";
  const archived = ad.status === "archived";
  const thumb = ad.image_url || ad.property_image;

  return (
    <tr>
      <td>
        {archived ? (
          <span className={styles.sub}>—</span>
        ) : (
          <button
            type="button"
            role="switch"
            aria-checked={isOn}
            aria-label={`${isOn ? "Turn off" : "Turn on"} ${ad.title}`}
            className={`${styles.switch} ${isOn ? styles.switchOn : ""}`}
            disabled={busy}
            onClick={() => onStatus(isOn ? "paused" : "active")}
          />
        )}
      </td>
      <td>
        <div className={styles.adCell}>
          {thumb ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={thumb} alt="" className={styles.thumb} />
          ) : (
            <span className={styles.thumb}>
              <ImageIcon size={20} aria-hidden="true" />
            </span>
          )}
          <div>
            <Link href={`/admin/dashboard/ads/${ad.id}`} className={styles.adTitle}>
              {ad.title}
            </Link>
            <span className={styles.sub}>
              {ad.property_title || (ad.image_url ? "Image ad" : "No image yet")}
              {ad.advertiser_name ? ` · ${ad.advertiser_name}` : ""}
            </span>
          </div>
        </div>
      </td>
      <td>
        <span className={`${styles.pill} ${ad.tier === "paid" ? styles.pillPaid : styles.pillFree}`}>
          {ad.tier === "paid" ? "Paid" : "Free"}
        </span>
      </td>
      <td className={styles.nowrap}>
        {ad.format_name}
        <span className={styles.sub}>
          {ad.format_width}×{ad.format_height}
        </span>
      </td>
      <td>
        <span className={`${styles.pill} ${toneFor(ad.display_state)}`}>
          {stateLabel(ad.display_state)}
        </span>
        {ad.display_reason && <span className={styles.stateReason}>{ad.display_reason}</span>}
      </td>
      <td className={styles.nowrap} title={`${formatDateTime(ad.start_at)} → ${formatDateTime(ad.end_at)}`}>
        {formatShortDateTime(ad.start_at)}
        <span className={styles.sub}>→ {formatShortDateTime(ad.end_at)}</span>
      </td>
      <td className={styles.center}>
        {ad.priority}
        <span className={styles.sub}>w {ad.weight}</span>
      </td>
      <td className={styles.center}>{formatNumber(ad.total_impressions)}</td>
      <td className={styles.center}>{formatNumber(ad.total_clicks)}</td>
      <td className={styles.center}>{formatCtr(ad.total_impressions, ad.total_clicks)}</td>
      <td>
        <div className={styles.actions}>
          {archived ? (
            <button
              type="button"
              className={styles.actionButton}
              disabled={busy}
              onClick={() => onStatus("paused")}
            >
              Restore
            </button>
          ) : (
            <>
              <Link href={`/admin/dashboard/ads/${ad.id}/edit`} className={styles.actionButton}>
                Edit
              </Link>
              <button
                type="button"
                className={`${styles.actionButton} ${styles.actionDanger}`}
                disabled={busy}
                onClick={onArchive}
              >
                Archive
              </button>
            </>
          )}
        </div>
      </td>
    </tr>
  );
}
