"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Eye, MoreHorizontal, SquarePen, Trash2 } from "lucide-react";
import styles from "./ActionMenu.module.css";

/**
 * A compact, keyboard-accessible menu for property row actions.
 * Additional actions use the same shape as the built-in actions:
 * { label, onSelect, icon: Icon, destructive, disabled }.
 */
export default function ActionMenu({
  onView,
  onEdit,
  onDelete,
  deleteDisabled = false,
  additionalActions = [],
  ariaLabel = "Property actions",
}) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState(null);
  const triggerRef = useRef(null);
  const menuRef = useRef(null);
  const menuId = useId();

  const items = [
    onView && { label: "View", icon: Eye, onSelect: onView },
    onEdit && { label: "Edit", icon: SquarePen, onSelect: onEdit },
    ...additionalActions,
    onDelete && { label: "Delete", icon: Trash2, onSelect: onDelete, destructive: true, disabled: deleteDisabled },
  ].filter(Boolean);

  function updatePosition() {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;
    setPosition({ top: rect.bottom + 8, right: Math.max(8, window.innerWidth - rect.right) });
  }

  function closeMenu({ restoreFocus = false } = {}) {
    setOpen(false);
    if (restoreFocus) triggerRef.current?.focus();
  }

  useEffect(() => {
    if (!open) return undefined;

    updatePosition();
    const closeOnOutsideClick = (event) => {
      if (!menuRef.current?.contains(event.target) && !triggerRef.current?.contains(event.target)) {
        closeMenu();
      }
    };
    const closeOnEscape = (event) => {
      if (event.key === "Escape") closeMenu({ restoreFocus: true });
    };
    const refreshPosition = () => updatePosition();

    document.addEventListener("mousedown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    window.addEventListener("resize", refreshPosition);
    window.addEventListener("scroll", refreshPosition, true);
    return () => {
      document.removeEventListener("mousedown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
      window.removeEventListener("resize", refreshPosition);
      window.removeEventListener("scroll", refreshPosition, true);
    };
  }, [open]);

  function selectAction(action) {
    closeMenu();
    action.onSelect();
  }

  function handleTriggerKeyDown(event) {
    if (["ArrowDown", "ArrowUp"].includes(event.key)) {
      event.preventDefault();
      setOpen(true);
      requestAnimationFrame(() => {
        const buttons = menuRef.current?.querySelectorAll("button");
        buttons?.[event.key === "ArrowUp" ? buttons.length - 1 : 0]?.focus();
      });
    }
  }

  function handleMenuKeyDown(event) {
    const buttons = Array.from(menuRef.current?.querySelectorAll("button") || []);
    const index = buttons.indexOf(document.activeElement);
    if (!buttons.length || !["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const nextIndex = event.key === "Home" ? 0 : event.key === "End" ? buttons.length - 1 : (index + (event.key === "ArrowDown" ? 1 : -1) + buttons.length) % buttons.length;
    buttons[nextIndex]?.focus();
  }

  return (
    <div className={styles.root}>
      <button
        ref={triggerRef}
        type="button"
        className={styles.trigger}
        aria-label={ariaLabel}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => setOpen((current) => !current)}
        onKeyDown={handleTriggerKeyDown}
      >
        <MoreHorizontal size={20} aria-hidden="true" />
      </button>
      {open && position && typeof document !== "undefined"
        ? createPortal(
            <div
              ref={menuRef}
              id={menuId}
              className={styles.menu}
              role="menu"
              aria-label={ariaLabel}
              style={position}
              onKeyDown={handleMenuKeyDown}
            >
              {items.map((action) => {
                const Icon = action.icon;
                return (
                  <button
                    key={action.label}
                    type="button"
                    role="menuitem"
                    className={`${styles.item} ${action.destructive ? styles.danger : ""}`}
                    disabled={action.disabled}
                    onClick={() => selectAction(action)}
                  >
                    {Icon ? <Icon size={18} aria-hidden="true" /> : null}
                    <span>{action.label}</span>
                  </button>
                );
              })}
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
