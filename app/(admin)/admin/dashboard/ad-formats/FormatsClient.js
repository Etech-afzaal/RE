"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  AppWindow,
  Check,
  ChevronDown,
  Code,
  Info,
  LayoutGrid,
  MoveHorizontal,
  MoveVertical,
  Newspaper,
  Plus,
  RectangleHorizontal,
  RectangleVertical,
  Search,
  Smartphone,
  Square,
  SquarePen,
  SquarePlus,
  Tag,
  TriangleAlert,
  X,
} from "lucide-react";
import LoadingSpinner from "@/components/LoadingSpinner";
import ui from "@/components/admin/adminUi.module.css";
import AdsDialog from "../ads/AdsDialog";
import AdsPager from "../ads/AdsPager";
import { formatNumber } from "../ads/adUi";
import styles from "../ads/adsList.module.css";

const PAGE_SIZE = 10;

const TYPES = {
  banner: { label: "banner", className: styles.typeBanner },
  native: { label: "native", className: styles.typeNative },
  sidebar: { label: "sidebar", className: styles.typeSidebar },
  popup: { label: "popup", className: styles.typePopup },
};

const EMPTY = { code: "", name: "", format_type: "banner", width: "", height: "", is_active: true };

async function saveFormat(body, id) {
  const res = await fetch(id ? `/api/admin/ad-formats/${id}` : "/api/admin/ad-formats", {
    method: id ? "PUT" : "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const error = new Error(data.error || "Could not save the format.");
    error.fields = data.fields || {};
    throw error;
  }
  return data.format;
}

export default function FormatsClient() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [formats, setFormats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(null); // null | { format: object|null }
  const [confirmOff, setConfirmOff] = useState(null);
  const [deleting, setDeleting] = useState(null); // format picked for deletion
  const [busyId, setBusyId] = useState(null);
  const [search, setSearch] = useState("");
  const [type, setType] = useState("all");
  const [size, setSize] = useState("all");
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(1);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/ad-formats");
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !Array.isArray(data.formats)) {
        throw new Error(data.error || "Could not load formats. Refresh the page to try again.");
      }
      setFormats(data.formats);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // The top-bar "New format" button links here with ?new=1.
  useEffect(() => {
    if (searchParams.get("new") === "1") {
      setEditing({ format: null });
      router.replace(pathname);
    }
  }, [searchParams, pathname, router]);

  async function toggleActive(format, confirmed = false) {
    if (format.is_active && format.active_count > 0 && !confirmed) {
      setConfirmOff(format);
      return;
    }
    setBusyId(format.id);
    try {
      await saveFormat(
        {
          code: format.code,
          name: format.name,
          format_type: format.format_type,
          width: format.width,
          height: format.height,
          is_active: !format.is_active,
        },
        format.id,
      );
      await load();
    } catch (err) {
      setError(`“${format.name}” couldn't be turned ${format.is_active ? "off" : "on"}: ${err.message}`);
    } finally {
      setBusyId(null);
    }
  }

  async function deleteFormat(format) {
    setBusyId(format.id);
    try {
      const res = await fetch(`/api/admin/ad-formats/${format.id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "please try again.");
      await load();
    } catch (err) {
      setError(`“${format.name}” couldn't be deleted: ${err.message}`);
    } finally {
      setBusyId(null);
    }
  }

  const sizes = useMemo(
    () =>
      [...new Set(formats.map((format) => `${format.width}×${format.height}`))].sort(
        (a, b) => parseInt(b, 10) - parseInt(a, 10),
      ),
    [formats],
  );

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return formats.filter((format) => {
      if (type !== "all" && format.format_type !== type) return false;
      if (size !== "all" && `${format.width}×${format.height}` !== size) return false;
      if (status === "on" && !format.is_active) return false;
      if (status === "off" && format.is_active) return false;
      if (!term) return true;
      return [format.name, format.code, format.format_type].some((value) =>
        value.toLowerCase().includes(term),
      );
    });
  }, [formats, search, type, size, status]);

  useEffect(() => {
    setPage(1);
  }, [search, type, size, status]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const firstIndex = (currentPage - 1) * PAGE_SIZE;
  const pageFormats = filtered.slice(firstIndex, firstIndex + PAGE_SIZE);

  return (
    <div className={styles.page}>
      <div className={styles.infoBanner}>
        <Info size={26} className={styles.infoIcon} aria-hidden="true" />
        <p>
          The frontend asks for ads by <strong>code</strong>. Turning a format off stops every ad
          in it from serving.
          <br />
          Fill shows how requests were answered over the last 7 days — the grey part is unsold
          space.
        </p>
      </div>

      <section className={styles.panel} aria-label="Ad formats">
        <div className={`${styles.filters} ${styles.filtersFormats}`}>
          <div className={styles.search}>
            <Search size={18} className={styles.searchIcon} aria-hidden="true" />
            <input
              type="search"
              className={styles.input}
              placeholder="Search format, code or type…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Search formats"
            />
          </div>
          <select
            className={styles.select}
            value={type}
            onChange={(e) => setType(e.target.value)}
            aria-label="Type"
          >
            <option value="all">All types</option>
            {Object.keys(TYPES).map((key) => (
              <option key={key} value={key}>
                {key[0].toUpperCase() + key.slice(1)}
              </option>
            ))}
          </select>
          <select
            className={styles.select}
            value={size}
            onChange={(e) => setSize(e.target.value)}
            aria-label="Size"
          >
            <option value="all">All sizes</option>
            {sizes.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
          <select
            className={styles.select}
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            aria-label="Status"
          >
            <option value="all">All status</option>
            <option value="on">On</option>
            <option value="off">Off</option>
          </select>
        </div>

        {loading ? (
          <LoadingSpinner fullPage={false} label="Loading" hint="Fetching formats…" />
        ) : (
          <>
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>On</th>
                    <th>Format</th>
                    <th>Code</th>
                    <th>Type</th>
                    <th>Size</th>
                    <th>Ads (on)</th>
                    <th>Fill (last 7 days)</th>
                    <th className={styles.center}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {pageFormats.length === 0 ? (
                    <tr>
                      <td colSpan={8} className={styles.empty}>
                        {formats.length === 0 ? "No formats yet." : "No formats match these filters."}
                      </td>
                    </tr>
                  ) : (
                    pageFormats.map((format) => (
                      <FormatRow
                        key={format.id}
                        format={format}
                        busy={busyId === format.id}
                        onToggle={() => toggleActive(format)}
                        onEdit={() => setEditing({ format })}
                        onDelete={() => setDeleting(format)}
                      />
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className={styles.footer}>
              <span>
                {filtered.length === 0
                  ? "Showing 0 formats"
                  : `Showing ${firstIndex + 1}–${firstIndex + pageFormats.length} of ${filtered.length} ${
                      filtered.length === 1 ? "format" : "formats"
                    }`}
              </span>
              <AdsPager
                page={currentPage}
                totalPages={totalPages}
                onChange={setPage}
                label="Format pages"
              />
            </div>
          </>
        )}
      </section>

      {editing && (
        <FormatDialog
          format={editing.format}
          onClose={() => setEditing(null)}
          onSaved={async () => {
            setEditing(null);
            await load();
          }}
        />
      )}

      {confirmOff && (
        <AdsDialog
          title={`Turn off “${confirmOff.name}”?`}
          message={`${confirmOff.active_count} ad${confirmOff.active_count === 1 ? " is" : "s are"} ON in this format and will stop serving until you turn it back on.`}
          closeLabel="Cancel"
          action={{
            label: "Turn format off",
            tone: "danger",
            onClick: () => {
              const format = confirmOff;
              setConfirmOff(null);
              toggleActive(format, true);
            },
          }}
          onClose={() => setConfirmOff(null)}
        />
      )}

      {deleting && deleting.total_ad_count === 0 && (
        <AdsDialog
          title={`Delete “${deleting.name}”?`}
          message={`The frontend will no longer get ads for “${deleting.code}”, and its fill stats are removed. This can't be undone.`}
          closeLabel="Cancel"
          action={{
            label: "Delete format",
            tone: "danger",
            onClick: () => {
              const format = deleting;
              setDeleting(null);
              deleteFormat(format);
            },
          }}
          onClose={() => setDeleting(null)}
        />
      )}

      {deleting && deleting.total_ad_count > 0 && (
        <AdsDialog
          title={`“${deleting.name}” can't be deleted`}
          message={`${deleting.total_ad_count} ad${deleting.total_ad_count === 1 ? " uses" : "s use"} this format (archived ads included), and deleting it would break ${deleting.total_ad_count === 1 ? "that ad" : "those ads"} and their stats.${
            deleting.is_active ? " Turn the format off instead to stop it serving." : " It's already turned off, so it isn't serving."
          }`}
          closeLabel={deleting.is_active ? "Cancel" : "OK"}
          action={
            deleting.is_active
              ? {
                  label: "Turn format off",
                  onClick: () => {
                    const format = deleting;
                    setDeleting(null);
                    toggleActive(format);
                  },
                }
              : null
          }
          onClose={() => setDeleting(null)}
        />
      )}

      {error && (
        <AdsDialog title="Something went wrong" message={error} onClose={() => setError("")} />
      )}
    </div>
  );
}

function FormatIcon({ format }) {
  let Icon = Square;
  if (format.format_type === "native") Icon = Newspaper;
  else if (format.format_type === "popup") Icon = AppWindow;
  else if (format.code.includes("mobile")) Icon = Smartphone;
  else if (format.width / format.height >= 2) Icon = RectangleHorizontal;
  else if (format.height / format.width >= 1.5) Icon = RectangleVertical;

  return (
    <span className={styles.formatIcon}>
      <Icon size={20} aria-hidden="true" />
    </span>
  );
}

function FormatRow({ format, busy, onToggle, onEdit, onDelete }) {
  const requests = format.paid_fills_7d + format.free_fills_7d + format.no_fills_7d;
  const pct = (value) => (requests ? (value / requests) * 100 : 0);
  const typeMeta = TYPES[format.format_type] || TYPES.banner;

  return (
    <tr>
      <td>
        <button
          type="button"
          role="switch"
          aria-checked={format.is_active}
          aria-label={`${format.is_active ? "Turn off" : "Turn on"} ${format.name}`}
          className={`${styles.switch} ${format.is_active ? styles.switchOn : ""}`}
          disabled={busy}
          onClick={onToggle}
        />
      </td>
      <td>
        <div className={styles.formatCell}>
          <FormatIcon format={format} />
          {format.name}
        </div>
      </td>
      <td className={styles.code}>{format.code}</td>
      <td>
        <span className={`${styles.pill} ${styles.typePill} ${typeMeta.className}`}>
          {typeMeta.label}
        </span>
      </td>
      <td className={styles.nowrap}>
        {format.width}×{format.height}
      </td>
      <td className={styles.nowrap} title={`${format.ad_count} ads, ${format.active_count} ON`}>
        {format.ad_count} ({format.active_count})
      </td>
      <td>
        <div className={styles.fillCell}>
          <span className={styles.fillTrack} title="Paid / Free / Unsold">
            <span className={styles.fillPaid} style={{ width: `${pct(format.paid_fills_7d)}%` }} />
            <span className={styles.fillFree} style={{ width: `${pct(format.free_fills_7d)}%` }} />
          </span>
          <span className={styles.fillText}>
            {requests === 0
              ? "No requests"
              : `${formatNumber(requests)} req · ${Math.round(pct(format.paid_fills_7d))}% paid · ${Math.round(
                  pct(format.free_fills_7d),
                )}% free · ${Math.round(pct(format.no_fills_7d))}% unsold`}
          </span>
        </div>
      </td>
      <td className={styles.center}>
        <div className={styles.actions} style={{ justifyContent: "center" }}>
          <button
            type="button"
            className={styles.actionButton}
            onClick={onEdit}
            disabled={busy}
            aria-label={`Edit ${format.name}`}
          >
            Edit
          </button>
          <button
            type="button"
            className={`${styles.actionButton} ${styles.actionDanger}`}
            onClick={onDelete}
            disabled={busy}
            aria-label={`Delete ${format.name}`}
            title={
              format.total_ad_count > 0
                ? `Used by ${format.total_ad_count} ad${format.total_ad_count === 1 ? "" : "s"}`
                : "Delete this format"
            }
          >
            Delete
          </button>
        </div>
      </td>
    </tr>
  );
}

function FormatDialog({ format, onClose, onSaved }) {
  const isNew = !format;
  const inUse = Boolean(format?.ad_count);
  const [draft, setDraft] = useState(() =>
    format
      ? {
          code: format.code,
          name: format.name,
          format_type: format.format_type,
          width: String(format.width),
          height: String(format.height),
          is_active: format.is_active,
        }
      : EMPTY,
  );
  const [fieldErrors, setFieldErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const firstFieldRef = useRef(null);

  useEffect(() => {
    firstFieldRef.current?.focus();
    const closeOnEscape = (event) => {
      if (event.key === "Escape" && !saving) onClose();
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [onClose, saving]);

  const set = (key, value) => {
    setDraft((current) => ({ ...current, [key]: value }));
    setFieldErrors((current) => ({ ...current, [key]: undefined }));
  };

  async function submit(event) {
    event.preventDefault();
    setSaving(true);
    setFormError("");
    setFieldErrors({});
    try {
      await saveFormat(draft, format?.id);
      await onSaved();
    } catch (err) {
      const fields = err.fields || {};
      setFieldErrors(fields);
      // Field problems are shown under each field; the box only summarises.
      const fieldCount = Object.keys(fields).length;
      setFormError(
        fieldCount > 1
          ? "Fix the highlighted fields and try again."
          : fieldCount === 1
            ? ""
            : err.message,
      );
      setSaving(false);
    }
  }

  const HeaderIcon = isNew ? SquarePlus : SquarePen;

  return (
    <div
      className={ui.dialogBackdrop}
      role="presentation"
      onClick={(event) => {
        if (event.target === event.currentTarget && !saving) onClose();
      }}
    >
      <form
        className={styles.formatModal}
        role="dialog"
        aria-modal="true"
        aria-labelledby="format-dialog-title"
        aria-describedby="format-dialog-subtitle"
        onSubmit={submit}
        noValidate
      >
        <header className={styles.modalHeader}>
          <span className={styles.modalIcon} aria-hidden="true">
            <HeaderIcon size={26} />
          </span>
          <div className={styles.modalHeading}>
            <h2 id="format-dialog-title" className={styles.modalTitle}>
              {isNew ? "New format" : `Edit “${format.name}”`}
            </h2>
            <p id="format-dialog-subtitle" className={styles.modalSubtitle}>
              {isNew
                ? "Add a size the frontend can request ads in."
                : "Changes apply to every ad in this format."}
            </p>
          </div>
          <button
            type="button"
            className={styles.modalClose}
            onClick={onClose}
            aria-label="Close"
            disabled={saving}
          >
            <X size={22} aria-hidden="true" />
          </button>
        </header>

        <div className={styles.modalBody}>
          {inUse && (
            <p className={styles.modalNotice}>
              <TriangleAlert size={18} aria-hidden="true" />
              <span>
                {format.ad_count} ad{format.ad_count === 1 ? " uses" : "s use"} this format.
                Changing the code breaks frontend slots that request the old code, and the size
                can&apos;t change while ads have uploaded images.
              </span>
            </p>
          )}

          <div className={styles.modalGrid}>
            <ModalField id="format-name" label="Name" error={fieldErrors.name}>
              <IconInput icon={Tag}>
                <input
                  id="format-name"
                  ref={firstFieldRef}
                  className={styles.modalInput}
                  value={draft.name}
                  onChange={(e) => set("name", e.target.value)}
                  placeholder="Leaderboard"
                  aria-invalid={Boolean(fieldErrors.name)}
                />
              </IconInput>
            </ModalField>

            <ModalField
              id="format-code"
              label="Code"
              help="Lowercase letters, numbers and _"
              error={fieldErrors.code}
            >
              <IconInput icon={Code}>
                <input
                  id="format-code"
                  className={styles.modalInput}
                  value={draft.code}
                  onChange={(e) => set("code", e.target.value.toLowerCase())}
                  placeholder="leaderboard_728x90"
                  aria-invalid={Boolean(fieldErrors.code)}
                  aria-describedby="format-code-help"
                  autoComplete="off"
                  spellCheck={false}
                />
              </IconInput>
            </ModalField>

            <ModalField id="format-type" label="Type" error={fieldErrors.format_type}>
              <IconInput icon={LayoutGrid} select>
                <select
                  id="format-type"
                  className={`${styles.modalInput} ${styles.modalSelect}`}
                  value={draft.format_type}
                  onChange={(e) => set("format_type", e.target.value)}
                >
                  <option value="banner">Banner</option>
                  <option value="sidebar">Sidebar</option>
                  <option value="native">Native (listing card)</option>
                  <option value="popup">Popup</option>
                </select>
              </IconInput>
            </ModalField>

            <div className={styles.modalSizeRow}>
              <ModalField id="format-width" label="Width (px)" error={fieldErrors.width}>
                <IconInput icon={MoveHorizontal}>
                  <input
                    id="format-width"
                    type="number"
                    min={10}
                    inputMode="numeric"
                    className={styles.modalInput}
                    value={draft.width}
                    onChange={(e) => set("width", e.target.value)}
                    placeholder="e.g. 728"
                    aria-invalid={Boolean(fieldErrors.width)}
                  />
                </IconInput>
              </ModalField>
              <ModalField id="format-height" label="Height (px)" error={fieldErrors.height}>
                <IconInput icon={MoveVertical}>
                  <input
                    id="format-height"
                    type="number"
                    min={10}
                    inputMode="numeric"
                    className={styles.modalInput}
                    value={draft.height}
                    onChange={(e) => set("height", e.target.value)}
                    placeholder="e.g. 90"
                    aria-invalid={Boolean(fieldErrors.height)}
                  />
                </IconInput>
              </ModalField>
            </div>
          </div>

          {formError && (
            <p className={styles.modalError} role="alert">
              {formError}
            </p>
          )}
        </div>

        <footer className={styles.modalFooter}>
          <button
            type="button"
            className={styles.modalCancel}
            onClick={onClose}
            disabled={saving}
          >
            Cancel
          </button>
          <button type="submit" className={styles.modalSubmit} disabled={saving}>
            {isNew ? <Plus size={20} aria-hidden="true" /> : <Check size={20} aria-hidden="true" />}
            {saving ? "Saving…" : isNew ? "Create format" : "Save changes"}
          </button>
        </footer>
      </form>
    </div>
  );
}

function ModalField({ id, label, help, error, children }) {
  return (
    <div className={styles.modalField}>
      <label htmlFor={id} className={styles.modalLabel}>
        {label}
        <span className={styles.modalRequired} aria-hidden="true">
          *
        </span>
      </label>
      {children}
      {help && (
        <span id={`${id}-help`} className={styles.modalHelp}>
          {help}
        </span>
      )}
      {error && <span className={styles.modalFieldError}>{error}</span>}
    </div>
  );
}

function IconInput({ icon: Icon, select = false, children }) {
  return (
    <div className={styles.iconInput}>
      <Icon size={20} className={styles.iconInputIcon} aria-hidden="true" />
      {children}
      {select && <ChevronDown size={20} className={styles.iconInputChevron} aria-hidden="true" />}
    </div>
  );
}
