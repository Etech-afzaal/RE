"use client";

import { useEffect, useRef, useCallback } from "react";
import styles from "./RichContentEditor.module.css";

const TOOLBAR_GROUPS = [
  [
    { cmd: "bold", label: "B", title: "Bold", className: styles.boldBtn },
    { cmd: "italic", label: "I", title: "Italic", className: styles.italicBtn },
    { cmd: "underline", label: "U", title: "Underline", className: styles.underlineBtn },
  ],
  [
    { action: "fontSize", value: "0.875em", label: "S", title: "Small text" },
    { action: "fontSize", value: "1em", label: "M", title: "Normal text" },
    { action: "fontSize", value: "1.25em", label: "L", title: "Large text" },
  ],
  [
    { block: "H1", label: "H1", title: "Heading 1" },
    { block: "H2", label: "H2", title: "Heading 2" },
    { block: "H3", label: "H3", title: "Heading 3" },
    { block: "P", label: "¶", title: "Paragraph" },
  ],
  [
    { cmd: "insertUnorderedList", label: "• List", title: "Bullet list" },
    { cmd: "insertOrderedList", label: "1. List", title: "Numbered list" },
    { cmd: "formatBlock", value: "blockquote", label: "❝", title: "Quote" },
  ],
  [
    { action: "insertTable", label: "▦ Table", title: "Insert table" },
    { action: "addRow", label: "+Row", title: "Add row below" },
    { action: "removeRow", label: "−Row", title: "Remove row" },
    { action: "addColumn", label: "+Col", title: "Add column right" },
    { action: "removeColumn", label: "−Col", title: "Remove column" },
    { action: "removeTable", label: "⊘ Table", title: "Remove entire table" },
  ],
  [
    { action: "undo", label: "↶ Undo", title: "Undo (Ctrl+Z)", className: styles.undoBtn },
    { action: "redo", label: "↷ Redo", title: "Redo (Ctrl+Y)", className: styles.redoBtn },
  ],
  [
    { action: "insertImage", label: "🖼 Image", title: "Insert image" },
    { action: "removeFormat", label: "⌫ Clear", title: "Clear formatting" },
  ],
];

const RESIZE_HANDLE_PX = 7;
const MIN_COL_WIDTH = 40;
const MIN_ROW_HEIGHT = 24;
const MAX_UNDO = 100;
const TYPING_SNAPSHOT_MS = 800;

/**
 * Lightweight rich-text editor built on contentEditable + execCommand.
 * Supports column width and row height resizing via drag handles on table borders.
 * Full undo/redo via snapshot stack — works for custom DOM operations too.
 *
 * @param {object} props
 * @param {string} props.value - Initial HTML content
 * @param {(html: string) => void} props.onChange - Called with current HTML on input
 * @param {string} [props.placeholder]
 * @param {string} [props.id]
 * @param {string} [props.imageUploadUrl] - POST endpoint that returns `{ url }` for inline images
 */
export default function RichContentEditor({
  value,
  onChange,
  placeholder = "Start writing your content here…",
  id,
  imageUploadUrl = "/api/files-updates/content-image",
}) {
  const editorRef = useRef(null);
  const fileInputRef = useRef(null);
  const lastValueRef = useRef(value || "");
  const resizeRef = useRef(null);
  const undoStackRef = useRef([]);
  const redoStackRef = useRef([]);
  const lastSnapshotRef = useRef(0);
  const isUndoRedoRef = useRef(false);

  const syncHtml = useCallback(() => {
    const el = editorRef.current;
    if (!el) return;
    const html = el.innerHTML;
    if (html !== lastValueRef.current) {
      lastValueRef.current = html;
      onChange?.(html);
    }
  }, [onChange]);

  /**
   * Push the current innerHTML onto the undo stack and clear the redo stack.
   * Called before every mutation so it can be reversed.
   */
  function pushUndo() {
    const el = editorRef.current;
    if (!el) return;
    const stack = undoStackRef.current;
    const html = el.innerHTML;
    if (stack.length > 0 && stack[stack.length - 1] === html) return;
    stack.push(html);
    if (stack.length > MAX_UNDO) stack.shift();
    redoStackRef.current = [];
    lastSnapshotRef.current = Date.now();
  }

  /**
   * Debounced snapshot for typing — only creates an undo entry after a pause
   * in typing so consecutive keystrokes don't flood the stack.
   */
  function pushUndoTyping() {
    const now = Date.now();
    if (now - lastSnapshotRef.current > TYPING_SNAPSHOT_MS) {
      pushUndo();
    }
  }

  function undo() {
    const stack = undoStackRef.current;
    if (stack.length === 0) return;
    const el = editorRef.current;
    if (!el) return;
    redoStackRef.current.push(el.innerHTML);
    const prev = stack.pop();
    isUndoRedoRef.current = true;
    el.innerHTML = prev;
    lastValueRef.current = prev;
    onChange?.(prev);
    isUndoRedoRef.current = false;
    focusEditor();
  }

  function redo() {
    const stack = redoStackRef.current;
    if (stack.length === 0) return;
    const el = editorRef.current;
    if (!el) return;
    undoStackRef.current.push(el.innerHTML);
    const next = stack.pop();
    isUndoRedoRef.current = true;
    el.innerHTML = next;
    lastValueRef.current = next;
    onChange?.(next);
    isUndoRedoRef.current = false;
    focusEditor();
  }

  useEffect(() => {
    const el = editorRef.current;
    if (!el) return;
    if (el.innerHTML !== lastValueRef.current) {
      el.innerHTML = lastValueRef.current;
    }
  }, []);

  function focusEditor() {
    const el = editorRef.current;
    if (!el) return;
    el.focus();
  }

  function exec(command, value = null) {
    pushUndo();
    focusEditor();
    try {
      document.execCommand(command, false, value);
    } catch {
      /* execCommand may be deprecated but still widely supported */
    }
    syncHtml();
  }

  function execBlock(tagName) {
    exec("formatBlock", tagName.toLowerCase());
  }

  function applyFontSize(size) {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
      return;
    }
    pushUndo();
    focusEditor();
    const range = selection.getRangeAt(0);
    const span = document.createElement("span");
    span.style.fontSize = size;
    try {
      range.surroundContents(span);
    } catch {
      // Selection spans partial elements — fall back to insertHTML
      const fragment = range.extractContents();
      span.appendChild(fragment);
      range.insertNode(span);
    }
    selection.removeAllRanges();
    const next = document.createRange();
    next.selectNodeContents(span);
    next.collapse(false);
    selection.addRange(next);
    syncHtml();
  }

  function ensureColgroup(table) {
    let colgroup = table.querySelector("colgroup");
    if (colgroup) return colgroup;
    const firstRow = table.querySelector("tr");
    if (!firstRow) return null;
    const colCount = firstRow.children.length;
    if (colCount === 0) return null;
    colgroup = document.createElement("colgroup");
    const evenWidth = (100 / colCount).toFixed(2);
    for (let i = 0; i < colCount; i++) {
      const col = document.createElement("col");
      col.style.width = evenWidth + "%";
      colgroup.appendChild(col);
    }
    table.insertBefore(colgroup, table.firstChild);
    return colgroup;
  }

  const DEFAULT_TABLE_HEADERS = [
    "Project",
    "Size",
    "Price",
    "Contact",
    "Updated At",
  ];

  function insertTable() {
    pushUndo();
    focusEditor();
    const cols = DEFAULT_TABLE_HEADERS.length;
    const rows = 3;
    const colWidth = (100 / cols).toFixed(2);
    let html = "<table><colgroup>";
    for (let c = 0; c < cols; c++) {
      html += `<col style="width:${colWidth}%">`;
    }
    html += "</colgroup><thead><tr>";
    for (let c = 0; c < cols; c++) {
      html += `<th>${DEFAULT_TABLE_HEADERS[c]}</th>`;
    }
    html += "</tr></thead><tbody>";
    for (let r = 0; r < rows; r++) {
      html += "<tr>";
      for (let c = 0; c < cols; c++) {
        html += "<td>&nbsp;</td>";
      }
      html += "</tr>";
    }
    html += "</tbody></table><p><br/></p>";

    try {
      document.execCommand("insertHTML", false, html);
    } catch {
      /* noop */
    }
    syncHtml();
  }

  function getCell() {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return null;
    let node = selection.anchorNode;
    while (node && node !== editorRef.current) {
      if (
        node.nodeType === Node.ELEMENT_NODE &&
        (node.tagName === "TD" || node.tagName === "TH")
      ) {
        return node;
      }
      node = node.parentNode;
    }
    return null;
  }

  function addRow() {
    const cell = getCell();
    if (!cell) return;
    pushUndo();
    const row = cell.parentNode;
    const colCount = row.children.length;
    const newRow = document.createElement("tr");
    for (let i = 0; i < colCount; i++) {
      const td = document.createElement("td");
      td.innerHTML = "&nbsp;";
      newRow.appendChild(td);
    }
    row.parentNode.insertBefore(newRow, row.nextSibling);
    syncHtml();
  }

  function removeRow() {
    const cell = getCell();
    if (!cell) return;
    const row = cell.parentNode;
    const tbody = row.parentNode;
    if (tbody.children.length <= 1) return;
    pushUndo();
    tbody.removeChild(row);
    syncHtml();
  }

  function addColumn() {
    const cell = getCell();
    if (!cell) return;
    pushUndo();
    const cellIndex = Array.from(cell.parentNode.children).indexOf(cell);
    const table = cell.closest("table");
    if (!table) return;

    const colgroup = ensureColgroup(table);
    if (colgroup) {
      const newCol = document.createElement("col");
      const existingCol = colgroup.children[cellIndex];
      newCol.style.width = existingCol
        ? existingCol.style.width
        : "33.33%";
      const refCol = colgroup.children[cellIndex + 1] || null;
      colgroup.insertBefore(newCol, refCol);
    }

    const rows = table.querySelectorAll("tr");
    rows.forEach((r) => {
      const newCell = document.createElement(
        r.parentNode.tagName === "THEAD" ? "th" : "td",
      );
      newCell.innerHTML = "&nbsp;";
      const ref = r.children[cellIndex + 1] || null;
      r.insertBefore(newCell, ref);
    });
    syncHtml();
  }

  function removeColumn() {
    const cell = getCell();
    if (!cell) return;
    const cellIndex = Array.from(cell.parentNode.children).indexOf(cell);
    const table = cell.closest("table");
    if (!table) return;
    const rows = table.querySelectorAll("tr");
    if (rows[0] && rows[0].children.length <= 1) return;

    pushUndo();
    const colgroup = table.querySelector("colgroup");
    if (colgroup && colgroup.children[cellIndex]) {
      colgroup.removeChild(colgroup.children[cellIndex]);
    }
    rows.forEach((r) => {
      const target = r.children[cellIndex];
      if (target) r.removeChild(target);
    });
    syncHtml();
  }

  function removeTable() {
    const cell = getCell();
    if (!cell) return;
    const table = cell.closest("table");
    if (!table) return;
    pushUndo();
    const p = document.createElement("p");
    p.innerHTML = "<br/>";
    table.parentNode.insertBefore(p, table.nextSibling);
    table.parentNode.removeChild(table);
    focusEditor();
    syncHtml();
  }

  function triggerImagePicker() {
    fileInputRef.current?.click();
  }

  async function handleImageChange(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    try {
      const fd = new FormData();
      fd.append("image", file);
      const res = await fetch(imageUploadUrl, {
        method: "POST",
        body: fd,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Could not upload image.");
      }
      pushUndo();
      focusEditor();
      const img = `<img src="${data.url}" alt="" class="${styles.editorImage}" />`;
      document.execCommand("insertHTML", false, img);
      syncHtml();
    } catch (err) {
      alert(err.message || "Could not upload image.");
    }
  }

  function handleToolbarAction(item) {
    if (item.action === "undo") {
      undo();
      return;
    }
    if (item.action === "redo") {
      redo();
      return;
    }
    if (item.cmd && item.value !== undefined) {
      exec(item.cmd, item.value);
    } else if (item.cmd) {
      exec(item.cmd);
    } else if (item.block) {
      execBlock(item.block);
    } else if (item.action === "insertTable") {
      insertTable();
    } else if (item.action === "addRow") {
      addRow();
    } else if (item.action === "removeRow") {
      removeRow();
    } else if (item.action === "addColumn") {
      addColumn();
    } else if (item.action === "removeColumn") {
      removeColumn();
    } else if (item.action === "removeTable") {
      removeTable();
    } else if (item.action === "insertImage") {
      triggerImagePicker();
    } else if (item.action === "fontSize") {
      applyFontSize(item.value);
    } else if (item.action === "removeFormat") {
      exec("removeFormat");
      exec("formatBlock", "p");
    }
  }

  // ---- Keyboard shortcuts: Ctrl+Z (undo), Ctrl+Y / Ctrl+Shift+Z (redo) ----
  function handleKeyDown(e) {
    const isCtrl = e.ctrlKey || e.metaKey;
    if (!isCtrl) return;
    const key = e.key.toLowerCase();
    if (key === "z" && !e.shiftKey) {
      e.preventDefault();
      undo();
    } else if (key === "y" || (key === "z" && e.shiftKey)) {
      e.preventDefault();
      redo();
    }
  }

  // ---- Column width + row height drag-resize ----
  useEffect(() => {
    const el = editorRef.current;
    if (!el) return;

    function isCell(node) {
      return (
        node &&
        node.nodeType === Node.ELEMENT_NODE &&
        (node.tagName === "TH" || node.tagName === "TD")
      );
    }

    function handleMouseDown(e) {
      const target = e.target;
      if (!isCell(target)) return;

      const rect = target.getBoundingClientRect();
      const offsetX = e.clientX - rect.right;
      const offsetY = e.clientY - rect.bottom;

      // Column width resize
      if (Math.abs(offsetX) <= RESIZE_HANDLE_PX) {
        const table = target.closest("table");
        if (!table) return;
        const cellIndex = Array.from(
          target.parentNode.children,
        ).indexOf(target);
        const colgroup = ensureColgroup(table);
        if (!colgroup) return;
        const col = colgroup.children[cellIndex];
        if (!col) return;

        pushUndo();
        resizeRef.current = {
          type: "col",
          col,
          startX: e.clientX,
          startWidth: rect.width,
        };
        e.preventDefault();
        e.stopPropagation();
        document.body.style.cursor = "col-resize";
        document.body.style.userSelect = "none";
        return;
      }

      // Row height resize
      if (Math.abs(offsetY) <= RESIZE_HANDLE_PX) {
        const row = target.parentNode;
        pushUndo();
        resizeRef.current = {
          type: "row",
          rowEl: row,
          startY: e.clientY,
          startHeight: rect.height,
        };
        e.preventDefault();
        e.stopPropagation();
        document.body.style.cursor = "row-resize";
        document.body.style.userSelect = "none";
      }
    }

    function handleHoverMove(e) {
      if (resizeRef.current) return;
      const target = e.target;
      if (!isCell(target)) {
        if (el.style.cursor) el.style.cursor = "";
        return;
      }
      const rect = target.getBoundingClientRect();
      const offsetX = e.clientX - rect.right;
      const offsetY = e.clientY - rect.bottom;
      if (Math.abs(offsetX) <= RESIZE_HANDLE_PX) {
        el.style.cursor = "col-resize";
      } else if (Math.abs(offsetY) <= RESIZE_HANDLE_PX) {
        el.style.cursor = "row-resize";
      } else {
        el.style.cursor = "";
      }
    }

    function handleDragMove(e) {
      if (!resizeRef.current) return;
      const r = resizeRef.current;
      if (r.type === "col") {
        const delta = e.clientX - r.startX;
        const newWidth = Math.max(MIN_COL_WIDTH, r.startWidth + delta);
        r.col.style.width = newWidth + "px";
      } else if (r.type === "row") {
        const delta = e.clientY - r.startY;
        const newHeight = Math.max(MIN_ROW_HEIGHT, r.startHeight + delta);
        r.rowEl.style.height = newHeight + "px";
      }
    }

    function handleMouseUp() {
      if (resizeRef.current) {
        resizeRef.current = null;
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
        el.style.cursor = "";
        syncHtml();
      }
    }

    el.addEventListener("mousedown", handleMouseDown);
    el.addEventListener("mousemove", handleHoverMove);
    document.addEventListener("mousemove", handleDragMove);
    document.addEventListener("mouseup", handleMouseUp);

    return () => {
      el.removeEventListener("mousedown", handleMouseDown);
      el.removeEventListener("mousemove", handleHoverMove);
      document.removeEventListener("mousemove", handleDragMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [syncHtml]);

  return (
    <div className={styles.editor} id={id}>
      <div className={styles.toolbar} role="toolbar" aria-label="Text formatting">
        {TOOLBAR_GROUPS.map((group, gi) => (
          <div key={gi} className={styles.toolbarGroup}>
            {group.map((item) => (
              <button
                key={item.cmd || item.block || item.action}
                type="button"
                className={`${styles.toolBtn} ${item.className || ""}`}
                title={item.title}
                aria-label={item.title}
                onClick={() => handleToolbarAction(item)}
                tabIndex={-1}
              >
                {item.label}
              </button>
            ))}
          </div>
        ))}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          hidden
          onChange={handleImageChange}
        />
      </div>
      <div
        ref={editorRef}
        className={styles.content}
        contentEditable
        suppressContentEditableWarning
        data-placeholder={placeholder}
        onInput={() => {
          if (isUndoRedoRef.current) return;
          pushUndoTyping();
          syncHtml();
        }}
        onBlur={syncHtml}
        onKeyDown={handleKeyDown}
        role="textbox"
        aria-multiline="true"
      />
    </div>
  );
}
