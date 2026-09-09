"use client";

import { fieldsForSection } from "@/lib/propertyData";
import ui from "./portal.module.css";

export default function PropertyDataFields({ section, kind, data, onChange, errors = {} }) {
  return <div className={ui.row2}>
    {fieldsForSection(section, kind).map(({ key, label, options }) => {
      const value = data?.[key] ?? (key === "amenities" && options ? [] : "");
      const error = errors[`${section}.${key}`];
      const id = `${section}-${key}`;
      if (key === "amenities" && options) return <fieldset key={key} className={ui.field}>
        <legend className={ui.label}>{label}</legend>
        {options.map(option => <label key={option} className={ui.label}>
          <input type="checkbox" checked={Array.isArray(value) && value.includes(option)} onChange={e => onChange(key, e.target.checked ? [...value, option] : value.filter(v => v !== option))} /> {option}
        </label>)}
        <p className={ui.fieldMessage} role={error ? "alert" : undefined}>{error || ""}</p>
      </fieldset>;
      return <label key={key} className={ui.field}>
        <span className={ui.label}>{label}</span>
        {options ? <select className={ui.select} value={value} onChange={e => onChange(key, e.target.value)} aria-describedby={`${id}-error`} aria-invalid={Boolean(error)}>
          <option value="">Select {label.toLowerCase()}</option>
          {options.map(option => <option key={option} value={option}>{option}</option>)}
        </select> : <input className={`${ui.input} ${error ? ui.inputInvalid : ""}`} value={value} maxLength={500} placeholder={key === "plotDimensions" ? "e.g. 25 × 45 ft" : key === "dimension" ? "e.g. 30 × 75 ft" : undefined} onChange={e => onChange(key, e.target.value)} aria-describedby={`${id}-error`} aria-invalid={Boolean(error)} />}
        <p id={`${id}-error`} className={ui.fieldMessage} role={error ? "alert" : undefined}>{error || ""}</p>
      </label>;
    })}
  </div>;
}
