"use client";

import styles from "./PropertyInputs.module.css";

export default function PropertyNumberInput({ value, onChange, max = 999999.99, min = 0, step = 0.01, className, disabled = false, ...props }) {
  const change = raw => {
    if (raw === "" || (/^\d+(?:\.\d{0,2})?$/.test(raw) && (step !== 1 || !raw.includes(".")) && Number(raw) <= max)) onChange(raw);
  };
  const adjust = amount => onChange(String(Math.min(max, Math.max(min, Math.round(((Number(value) || 0) + amount) * 100) / 100))));
  const paste = e => {
    const text = e.clipboardData.getData("text");
    // Number inputs accept exponent notation; keydown does not validate pasted text.
    if (!(step === 1 ? /^\d+$/ : /^\d+(?:\.\d{0,2})?$/).test(text)) e.preventDefault();
  };
  return <div className={styles.numberControl}>
    <input {...props} type="number" className={`${className || ""} ${styles.numberInput}`} value={value ?? ""} min={min} max={max} step={step} disabled={disabled} inputMode={step === 1 ? "numeric" : "decimal"} onKeyDown={e => { if (["e", "E", "+", "-"].includes(e.key)) e.preventDefault(); }} onPaste={paste} onChange={e => change(e.target.value)} />
    <span className={styles.steppers}>
      <button type="button" aria-label="Increase value" disabled={disabled || Number(value) >= max} onClick={() => adjust(1)}>▴</button>
      <button type="button" aria-label="Decrease value" disabled={disabled || value === "" || Number(value) <= min} onClick={() => adjust(-1)}>▾</button>
    </span>
  </div>;
}
