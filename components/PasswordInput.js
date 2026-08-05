"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import styles from "./PasswordInput.module.css";

/**
 * Password field with an in-input show/hide toggle.
 * Forwards standard input props; visibility is managed internally.
 */
export default function PasswordInput({
  className = "",
  style,
  disabled,
  ...props
}) {
  const [visible, setVisible] = useState(false);

  return (
    <div className={styles.field}>
      <input
        {...props}
        type={visible ? "text" : "password"}
        disabled={disabled}
        className={`${styles.input} ${className}`.trim()}
        style={{ ...style, paddingRight: "2.9rem" }}
      />
      <button
        type="button"
        className={styles.toggle}
        disabled={disabled}
        onClick={() => setVisible((current) => !current)}
        aria-label={visible ? "Hide password" : "Show password"}
        aria-pressed={visible}
      >
        {visible ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
      </button>
    </div>
  );
}
