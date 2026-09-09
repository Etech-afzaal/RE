"use client";

import PropertyNumberInput from "./PropertyNumberInput";
import ui from "./portal.module.css";
import styles from "./PropertyInputs.module.css";

export default function PlotSizeInput({ value, unit, onChange, onUnitChange, disabled, invalid, describedBy, step = 1 }) {
  return <div className={`${ui.priceField} ${invalid ? ui.priceFieldInvalid : ""}`}>
    <PropertyNumberInput value={value} onChange={onChange} placeholder="Enter size" className={ui.priceAmountInput} min={0} max={999999} step={step} disabled={disabled} aria-label="Plot size" aria-invalid={Boolean(invalid)} aria-describedby={describedBy} />
    <select className={`${ui.priceCurrencyBtn} ${styles.unitSelect}`} value={unit || "marla"} onChange={e => onUnitChange(e.target.value)} disabled={disabled} aria-label="Plot size unit">
      <option value="marla">Marla</option><option value="kanal">Kanal</option><option value="sqft">Sqft</option>
    </select>
  </div>;
}
