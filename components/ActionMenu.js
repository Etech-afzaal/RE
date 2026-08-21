"use client";

import { useEffect, useId, useRef, useState } from "react";
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
  const [opensUpward, setOpensUpward] = useState(false);
  const triggerRef = useRef(null);
  const menuRef = useRef(null);
  const menuId = useId();
  const viewportGap = 8;

  const items = [
    onView && { label: "View", icon: Eye, onSelect: onView },
    onEdit && { label: "Edit", icon: SquarePen, onSelect: onEdit },
    ...additionalActions,
    onDelete && { label: "Delete", icon: Trash2, onSelect: onDelete, destructive: true, disabled: deleteDisabled },
  ].filter(Boolean);

  function getMenuBoundaryRect() {
    const trigger = triggerRef.current;
    if (!trigger) return null;

    // Property pages render actions in a table wrapped by the scrollable list
    // container; the legacy dashboard uses a list. Resolve either at runtime so
    // this shared component remains bounded to its own rows on every dashboard.
    const table = trigger.closest("table");
    if (table?.parentElement) return table.parentElement.getBoundingClientRect();
    return trigger.closest("ul")?.getBoundingClientRect() || null;
  }

  function updatePosition() {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;

    const menuRect = menuRef.current?.getBoundingClientRect();
    const menuHeight = menuRect?.height || 0;
    const boundary = getMenuBoundaryRect();
    const boundaryTop = boundary?.top ?? 0;
    // Use the list's real bottom rather than the visible viewport bottom.
    // The menu is anchored to its row, so a menu farther down the page can be
    // reached by normal scrolling; only the final rows need to flip upward.
    const boundaryBottom = boundary?.bottom ?? window.innerHeight - viewportGap;
    const spaceBelow = boundaryBottom - rect.bottom - viewportGap;
    const spaceAbove = rect.top - boundaryTop - viewportGap;

    // Never let a partial upward menu cross the list's top edge into the page
    // header. If neither side fits, keep it below its own trigger instead.
    setOpensUpward(
      menuHeight > 0 &&
        spaceBelow < menuHeight &&
        spaceAbove >= menuHeight,
    );
  }

  function closeMenu({ restoreFocus = false } = {}) {
    setOpen(false);
    if (restoreFocus) triggerRef.current?.focus();
  }

  useEffect(() => {
    if (!open) return undefined;

    updatePosition();
    const frame = window.requestAnimationFrame(updatePosition);
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
      window.cancelAnimationFrame(frame);
      document.removeEventListener("mousedown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
      window.removeEventListener("resize", refreshPosition);
      window.removeEventListener("scroll", refreshPosition, true);
    };
  }, [open]);

  function openMenu() {
    setOpensUpward(false);
    setOpen(true);
  }

  function selectAction(action) {
    closeMenu();
    action.onSelect();
  }

  function handleTriggerKeyDown(event) {
    if (["ArrowDown", "ArrowUp"].includes(event.key)) {
      event.preventDefault();
      openMenu();
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
        onClick={() => {
          if (open) closeMenu();
          else openMenu();
        }}
        onKeyDown={handleTriggerKeyDown}
      >
        <MoreHorizontal size={20} aria-hidden="true" />
      </button>
      {open ? (
        <div
          ref={menuRef}
          id={menuId}
          className={`${styles.menu} ${opensUpward ? styles.menuUpward : ""}`}
          role="menu"
          aria-label={ariaLabel}
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
        </div>
      ) : null}
    </div>
  );
}
