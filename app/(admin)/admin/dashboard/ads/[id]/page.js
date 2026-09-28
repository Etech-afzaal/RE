import Link from "next/link";
import { notFound } from "next/navigation";
import { getAdById, getAdStats } from "@/lib/ads/queries";
import { screensForFormat } from "@/lib/ads/formatSets";
import AdStatusActions from "./AdStatusActions";
import { SizePreview } from "../SizesPanel";
import {
  STATE_TONES,
  formatCtr,
  formatDateTime,
  formatNumber,
  formatPrice,
  stateLabel,
} from "../adUi";
import styles from "../ads.module.css";

export const metadata = { title: "Ad details · Super Admin" };

const TONE_CLASS = {
  success: styles.toneSuccess,
  info: styles.toneInfo,
  warning: styles.toneWarning,
  danger: styles.toneDanger,
  neutral: styles.toneNeutral,
  muted: styles.toneMuted,
};

const orUnlimited = (value) => (value ? formatNumber(value) : "Unlimited");

const SOURCE_TEXT = {
  upload: "Custom image",
  generated: "From main image",
};

const screenText = (code) => {
  const screens = screensForFormat(code);
  if (screens.length === 3) return "All screens";
  return screens.map((screen) => screen[0].toUpperCase() + screen.slice(1)).join(" & ");
};

export default async function AdDetailPage({ params, searchParams }) {
  const ad = await getAdById(params.id);
  if (!ad) notFound();
  const stats = await getAdStats(ad.id, 30);

  const last30 = stats.daily.reduce(
    (sum, day) => ({
      impressions: sum.impressions + day.impressions,
      clicks: sum.clicks + day.clicks,
    }),
    { impressions: 0, clicks: 0 },
  );
  const maxDaily = Math.max(1, ...stats.daily.map((day) => day.impressions));

  return (
    <div className={styles.page}>
      <div className={styles.shell}>
        <Link href="/admin/dashboard/ads" className={styles.backLink}>
          ← All ads
        </Link>

        <div className={styles.header}>
          <div>
            <p className={styles.kicker}>
              Ad #{ad.id} ·{" "}
              <span className={`${styles.badge} ${ad.tier === "paid" ? styles.tierPaid : styles.tierFree}`}>
                {ad.tier === "paid" ? "Paid / Featured" : "Free"}
              </span>{" "}
              <span className={`${styles.badge} ${TONE_CLASS[STATE_TONES[ad.display_state]]}`}>
                {stateLabel(ad.display_state)}
              </span>
            </p>
            <h1 className={styles.title}>{ad.title}</h1>
            {ad.display_reason && <p className={styles.fieldError}>{ad.display_reason}</p>}
          </div>
          <AdStatusActions ad={ad} notice={searchParams?.notice || ""} />
        </div>


        <div className={styles.statGrid}>
          <Stat value={formatNumber(ad.total_impressions)} label="Impressions (all time)" />
          <Stat value={formatNumber(ad.total_clicks)} label="Clicks (all time)" />
          <Stat value={formatCtr(ad.total_impressions, ad.total_clicks)} label="Click-through rate" />
          <Stat value={formatNumber(ad.today_impressions)} label="Impressions today" />
        </div>

        <div className={styles.grid2} style={{ alignItems: "start" }}>
          <section className={styles.card}>
            <h2 className={styles.cardTitle}>
              {ad.creatives.length === 1 ? "1 size" : `${ad.creatives.length} sizes`}
            </h2>
            <p className={styles.cardHint}>
              Each screen gets the size that fits it. All sizes share this ad&apos;s schedule,
              limits and stats.
            </p>
            <div className={styles.stack}>
              {ad.creatives.map((size) => (
                <div key={size.format_id} className={styles.field}>
                  <span className={styles.label}>
                    {size.format_name} <span className={styles.mono}>{size.width}×{size.height}</span>
                    <span className={styles.optional}>
                      {" "}
                      · {screenText(size.format_code) || size.format_type} ·{" "}
                      {size.image_url
                        ? SOURCE_TEXT[size.source] || "Image"
                        : ad.property_image
                          ? "Property photo"
                          : "No image"}
                      {size.format_is_active ? "" : " · format turned off"}
                    </span>
                  </span>
                  <SizePreview format={size} src={size.image_url || ad.property_image} fit="cover" />
                  <code className={styles.help}>format={size.format_code}</code>
                </div>
              ))}
            </div>

            <dl className={styles.definition} style={{ marginTop: 16 }}>
              <dt>Headline</dt>
              <dd>{ad.headline || ad.property_title || "—"}</dd>
              <dt>Button text</dt>
              <dd>{ad.cta_text || (ad.property_id ? "View property (default)" : "—")}</dd>
              <dt>Click goes to</dt>
              <dd className={styles.mono}>{ad.destination_url || "Not clickable"}</dd>
              <dt>Linked property</dt>
              <dd>
                {ad.property_id ? (
                  <>
                    #{ad.property_id} · {ad.property_title}
                    <div className={styles.cellSub}>
                      {ad.property_location} ·{" "}
                      {formatPrice(ad.property_price, ad.property_price_currency)} ·{" "}
                      {ad.property_agent_name} ·{" "}
                      {ad.property_is_hidden ? "hidden" : ad.property_status.replace(/_/g, " ")}
                    </div>
                  </>
                ) : (
                  "None"
                )}
              </dd>
            </dl>
          </section>

          <section className={styles.card}>
            <h2 className={styles.cardTitle}>Delivery</h2>
            <dl className={styles.definition} style={{ marginTop: 12 }}>
              <dt>Runs</dt>
              <dd>
                {formatDateTime(ad.start_at)} → {formatDateTime(ad.end_at)}
              </dd>
              <dt>Priority / weight</dt>
              <dd>
                {ad.priority} / {ad.weight}
              </dd>
              <dt>Max impressions</dt>
              <dd>{orUnlimited(ad.max_impressions)}</dd>
              <dt>Max clicks</dt>
              <dd>{orUnlimited(ad.max_clicks)}</dd>
              <dt>Impressions / day</dt>
              <dd>{orUnlimited(ad.daily_impression_cap)}</dd>
              <dt>Per visitor / 24h</dt>
              <dd>{orUnlimited(ad.viewer_cap_24h)}</dd>
            </dl>

            <h2 className={styles.cardTitle} style={{ marginTop: 24 }}>
              Advertiser
            </h2>
            <dl className={styles.definition} style={{ marginTop: 12 }}>
              <dt>Name</dt>
              <dd>{ad.advertiser_name || "—"}</dd>
              <dt>Contact</dt>
              <dd>{ad.advertiser_contact || "—"}</dd>
              {ad.tier === "paid" && (
                <>
                  <dt>Amount paid</dt>
                  <dd>{ad.amount_paid != null ? formatPrice(ad.amount_paid, "PKR") : "—"}</dd>
                  <dt>Payment ref</dt>
                  <dd>{ad.payment_ref || "—"}</dd>
                </>
              )}
              <dt>Notes</dt>
              <dd style={{ whiteSpace: "pre-wrap" }}>{ad.notes || "—"}</dd>
            </dl>
          </section>
        </div>

        <div className={styles.grid2} style={{ alignItems: "start" }}>
          <section className={styles.card}>
            <h2 className={styles.cardTitle}>Last 30 days</h2>
            <p className={styles.cardHint}>
              {formatNumber(last30.impressions)} impressions · {formatNumber(last30.clicks)} clicks ·
              CTR {formatCtr(last30.impressions, last30.clicks)}
            </p>
            {stats.daily.length === 0 ? (
              <p className={styles.help}>No impressions recorded yet.</p>
            ) : (
              <div className={styles.tableWrap} style={{ boxShadow: "none" }}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th style={{ width: "40%" }}></th>
                      <th className={styles.num}>Impr.</th>
                      <th className={styles.num}>Clicks</th>
                      <th className={styles.num}>CTR</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.daily.map((day) => (
                      <tr key={day.stat_date}>
                        <td className={styles.mono}>{day.stat_date}</td>
                        <td style={{ verticalAlign: "middle" }}>
                          <div
                            className={styles.bar}
                            style={{ width: `${(day.impressions / maxDaily) * 100}%` }}
                          />
                        </td>
                        <td className={styles.num}>{formatNumber(day.impressions)}</td>
                        <td className={styles.num}>{formatNumber(day.clicks)}</td>
                        <td className={styles.num}>{formatCtr(day.impressions, day.clicks)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <div>
            <section className={styles.card}>
              <h2 className={styles.cardTitle}>By size (all time)</h2>
              <p className={styles.cardHint}>Which size was on screen: desktop vs tablet vs mobile.</p>
              {stats.sizes.length === 0 ? (
                <p className={styles.help}>No size data yet.</p>
              ) : (
                <div className={styles.tableWrap} style={{ boxShadow: "none" }}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th>Size</th>
                        <th className={styles.num}>Impr.</th>
                        <th className={styles.num}>Clicks</th>
                        <th className={styles.num}>CTR</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stats.sizes.map((row) => (
                        <tr key={row.format_id}>
                          <td>
                            {row.format_code ? (
                              <>
                                {row.format_name}{" "}
                                <span className={styles.mono}>
                                  {row.width}×{row.height}
                                </span>
                              </>
                            ) : (
                              "(not recorded)"
                            )}
                          </td>
                          <td className={styles.num}>{formatNumber(row.impressions)}</td>
                          <td className={styles.num}>{formatNumber(row.clicks)}</td>
                          <td className={styles.num}>{formatCtr(row.impressions, row.clicks)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <section className={styles.card}>
              <h2 className={styles.cardTitle}>By placement (all time)</h2>
              <p className={styles.cardHint}>
                Placement is the name the frontend sends with each request, e.g. home_top.
              </p>
              {stats.placements.length === 0 ? (
                <p className={styles.help}>No placement data yet.</p>
              ) : (
                <div className={styles.tableWrap} style={{ boxShadow: "none" }}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th>Placement</th>
                        <th className={styles.num}>Impr.</th>
                        <th className={styles.num}>Clicks</th>
                        <th className={styles.num}>CTR</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stats.placements.map((row) => (
                        <tr key={row.placement}>
                          <td className={styles.mono}>{row.placement || "(not set)"}</td>
                          <td className={styles.num}>{formatNumber(row.impressions)}</td>
                          <td className={styles.num}>{formatNumber(row.clicks)}</td>
                          <td className={styles.num}>{formatCtr(row.impressions, row.clicks)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({ value, label }) {
  return (
    <div className={styles.summaryItem}>
      <div className={styles.summaryValue}>{value}</div>
      <div className={styles.summaryLabel}>{label}</div>
    </div>
  );
}
