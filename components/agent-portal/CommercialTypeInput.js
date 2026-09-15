"use client";

import { useRef, useState } from "react";
import { hasHtmlOrScript } from "@/lib/validators/common";
import ui from "./portal.module.css";
import styles from "./PropertyInputs.module.css";

export default function CommercialTypeInput({ value, customValue = "", options, onChange, error }) {
  const [other, setOther] = useState(false);
  const [custom, setCustom] = useState("");
  const [added, setAdded] = useState([]);
  const [inputError, setInputError] = useState("");
  const dropdown = useRef(null);
  const presets = options.filter(option => option !== "Other");
  const choices = [...new Set(["", ...presets, ...added, ...(customValue ? [customValue] : [])])];
  const selected = value === "Other" ? customValue : value;

  function select(name) {
    onChange(!name || presets.includes(name) ? name : "Other", presets.includes(name) ? "" : name);
    setOther(false);
    setInputError("");
    if (dropdown.current) dropdown.current.open = false;
  }

  function add() {
    const name = custom.trim();
    if (!name || name.length > 500 || hasHtmlOrScript(name)) {
      setInputError("Enter a commercial type without HTML (up to 500 characters).");
      return;
    }
    const existing = choices.find(option => option.toLowerCase() === name.toLowerCase());
    const next = existing || name;
    if (!existing) setAdded(previous => [...previous, next]);
    select(next);
    setCustom("");
  }

  return <details ref={dropdown} className={styles.amenities}>
    <summary className={`${ui.select} ${error ? ui.inputInvalid : ""}`}>{selected || "Select commercial type"}</summary>
    <div className={styles.amenitiesMenu}>
      {choices.map(option => <label key={option} className={styles.amenityOption}>
        <input type="radio" name="commercial-type" value={option} checked={!other && selected === option} onChange={() => select(option)} style={{ accentColor: "var(--gold)" }} />{option || "Select commercial type"}
      </label>)}
      <label className={styles.amenityOption}>
        <input type="radio" name="commercial-type" value="Other" checked={other} onChange={() => { setOther(true); setInputError(""); }} style={{ accentColor: "var(--gold)" }} />Other
      </label>
      {other ? <div className={styles.customAmenity}>
        <input className={ui.input} aria-label="Custom commercial type" placeholder="Add a commercial type" maxLength={500} value={custom} onChange={event => { setCustom(event.target.value); setInputError(""); }} onKeyDown={event => { if (event.key === "Enter") { event.preventDefault(); add(); } }} />
        <button type="button" className={ui.btnSecondary} onClick={add}>Add</button>
      </div> : null}
      {inputError ? <p className={ui.fieldError} role="alert">{inputError}</p> : null}
    </div>
  </details>;
}
