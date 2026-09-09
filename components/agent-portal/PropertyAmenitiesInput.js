"use client";

import { useState } from "react";
import ui from "./portal.module.css";
import styles from "./PropertyInputs.module.css";

export default function PropertyAmenitiesInput({ value, options = [], onChange }) {
  const selected = Array.isArray(value) ? value : typeof value === "string" && value.trim() ? [value.trim()] : [];
  const [other, setOther] = useState(false);
  const [custom, setCustom] = useState("");
  const [error, setError] = useState("");
  const choices = [...new Set([...options.filter(option => !["Other", "Others"].includes(option)), ...selected])];
  function add() {
    const name = custom.trim();
    if (!name || name.length > 100 || !/^[\p{L}\p{N}\s&(),.'’/+\-]+$/u.test(name)) {
      setError("Enter an amenity using letters, numbers and ordinary punctuation (up to 100 characters).");
      return;
    }
    if (!selected.some(item => item.toLowerCase() === name.toLowerCase())) onChange([...selected, name]);
    setCustom(""); setError("");
  }
  return <details className={styles.amenities}>
    <summary className={ui.select}>{selected.length ? `${selected.length} amenities selected` : "Select amenities"}</summary>
    <div className={styles.amenitiesMenu}>
      {choices.map(option => <label key={option} className={styles.amenityOption}>
        <input type="checkbox" checked={selected.includes(option)} onChange={e => onChange(e.target.checked ? [...selected, option] : selected.filter(item => item !== option))} />{option}
      </label>)}
      <label className={styles.amenityOption}><input type="checkbox" checked={other} onChange={e => setOther(e.target.checked)} />Other</label>
      {other ? <div className={styles.customAmenity}>
        <input className={ui.input} value={custom} maxLength={100} aria-label="Custom amenity" placeholder="Add an amenity" onChange={e => { setCustom(e.target.value); setError(""); }} onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); add(); } }} />
        <button type="button" className={ui.btnSecondary} onClick={add}>Add</button>
      </div> : null}
      {error ? <p className={ui.fieldError} role="alert">{error}</p> : null}
    </div>
  </details>;
}
