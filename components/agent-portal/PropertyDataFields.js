"use client";

import { fieldsForSection } from "@/lib/propertyData";
import ui from "./portal.module.css";
import PropertyNumberInput from "./PropertyNumberInput";
import PropertyAmenitiesInput from "./PropertyAmenitiesInput";
import { Fragment } from "react";

export default function PropertyDataFields({ section, kind, data, onChange, errors = {}, leadingField, trailingField, fieldKeys, unwrapped = false }) {
  const fields = fieldsForSection(section, kind).filter(field => !fieldKeys || fieldKeys.includes(field.key));
  const Wrapper = unwrapped ? Fragment : "div";
  const orderedFields = leadingField && section === "landInfo"
    ? ["plotPosition", "front", "dimension", "depth", "roadWidth"].map(key => fields.find(field => field.key === key))
    : fields;
  return <Wrapper {...(unwrapped ? {} : { className: ui.row2 })}>
    {leadingField}
    {orderedFields.map(({ key, label, options }) => {
      const value = data?.[key] ?? (key === "amenities" && options ? [] : "");
      const error = errors[`${section}.${key}`];
      const id = `${section}-${key}`;
      if (key === "amenities") return <fieldset key={key} className={ui.field} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
        <legend className={ui.label}>{label}</legend>
        <PropertyAmenitiesInput key={`${kind}-${section}`} value={value} options={options || ["Electricity", "Gas", "Sewerage", "Water", "Lounge", "Others"]} onChange={value => onChange(key, value)} />
        <p className={ui.fieldMessage} role={error ? "alert" : undefined}>{error || ""}</p>
      </fieldset>;
      return <label key={key} className={ui.field}>
        <span className={ui.label}>{label}</span>
        {["front", "depth", "roadWidth", "coveredArea", "floors", "lounge", "kitchens"].includes(key) ? <PropertyNumberInput className={ui.input} value={key === "roadWidth" ? String(value).replace(/ ft\+?$/, "") : value} step={["floors", "lounge", "kitchens"].includes(key) ? 1 : 0.01} max={["floors", "lounge", "kitchens"].includes(key) ? 99 : 999999.99} placeholder={{ front: "Enter front in ft", depth: "Enter depth in ft", roadWidth: "Enter road width in ft" }[key]} onChange={value => onChange(key, value)} aria-describedby={`${id}-error`} aria-invalid={Boolean(error)} /> : options ? <select className={ui.select} value={value} onChange={e => onChange(key, e.target.value)} aria-describedby={`${id}-error`} aria-invalid={Boolean(error)}>
          <option value="">Select {label.toLowerCase()}</option>
          {options.map(option => <option key={option} value={option}>{option}</option>)}
        </select> : <input className={`${ui.input} ${error ? ui.inputInvalid : ""}`} value={value} maxLength={500} placeholder={key === "plotDimensions" ? "e.g. 25 × 45 ft" : key === "dimension" ? "e.g. 30 × 75 ft" : undefined} onChange={e => onChange(key, e.target.value)} aria-describedby={`${id}-error`} aria-invalid={Boolean(error)} />}
        <p id={`${id}-error`} className={ui.fieldMessage} role={error ? "alert" : undefined}>{error || ""}</p>
      </label>;
    })}
    {trailingField}
  </Wrapper>;
}
