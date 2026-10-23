"use client";

/**
 * ThemedSelect: a drop-in replacement for the native <select> that never shows the browser/OS dropdown.
 *
 * It takes the same props and children as <select> (value, onChange, name, id, disabled, className, <option>,
 * <optgroup>) and calls onChange with an event-like object ({ target: { value, name, id } }), so existing code
 * keeps working: just rename <select> to <ThemedSelect>. The trigger is a <button> that keeps the caller's
 * className (so every existing form style still applies); the list opens in a portal styled with the site theme
 * variables (--primary, --secondary, --card, --foreground, --radius), so it follows the colours set in
 * Admin > Appearance on the public site and in the dashboard.
 *
 * Accessibility: combobox + listbox roles, aria-activedescendant, full keyboard support (arrows, Home/End, Enter,
 * Space, Escape, Tab, type-ahead). A hidden input keeps native form submission working when `name` is set.
 *
 * `required` is only announced to assistive tech (aria-required): there is no native validation popup (that would be
 * browser UI again), so a form that needs a choice must check it itself and show its own message.
 */

import React, { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown } from "lucide-react";

// ─── children -> options ────────────────────────────────────────────────────────────────────────

function textOf(node) {
  if (node === null || node === undefined || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textOf).join("");
  if (React.isValidElement(node)) return textOf(node.props.children);
  return "";
}

/** Flattens <option>/<optgroup>/fragments/arrays into [{ kind: 'option'|'group', ... }]. */
function parseChildren(children, out = [], group = null) {
  React.Children.forEach(children, (child) => {
    if (!React.isValidElement(child)) return;
    if (child.type === React.Fragment) return parseChildren(child.props.children, out, group);
    if (child.type === "optgroup") {
      out.push({ kind: "group", label: String(child.props.label ?? ""), disabled: !!child.props.disabled });
      return parseChildren(child.props.children, out, { disabled: !!child.props.disabled });
    }
    if (child.type === "option") {
      const label = textOf(child.props.children);
      const value = child.props.value !== undefined && child.props.value !== null ? String(child.props.value) : label;
      out.push({ kind: "option", value, label, disabled: !!child.props.disabled || !!group?.disabled });
    }
  });
  return out;
}

// ─── component ──────────────────────────────────────────────────────────────────────────────────

const GAP = 4;
const EDGE = 8;

export default function ThemedSelect({
  value,
  defaultValue,
  onChange,
  onBlur,
  onFocus,
  name,
  id,
  className = "",
  style,
  disabled = false,
  required = false,
  autoFocus = false,
  title,
  children,
  placeholder,
  ...rest
}) {
  const uid = useId();
  const listId = `${uid}-list`;
  const triggerRef = useRef(null);
  const popupRef = useRef(null);
  const typeAhead = useRef({ text: "", at: 0 });

  const controlled = value !== undefined;
  const [inner, setInner] = useState(defaultValue !== undefined && defaultValue !== null ? String(defaultValue) : "");
  const current = controlled ? (value === null ? "" : String(value)) : inner;

  const items = useMemo(() => {
    const list = parseChildren(children);
    let n = 0;
    list.forEach((it) => {
      if (it.kind === "option") it.index = n++;
    });
    return list;
  }, [children]);
  const options = useMemo(() => items.filter((i) => i.kind === "option"), [items]);
  const selected = options.find((o) => o.value === current);
  const isPlaceholder = !selected || selected.value === "";
  const shownLabel = selected ? selected.label : placeholder || "";

  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [pos, setPos] = useState(null);

  const enabledIndexes = useMemo(() => options.map((o, i) => (o.disabled ? -1 : i)).filter((i) => i >= 0), [options]);

  const emit = useCallback(
    (nextValue) => {
      if (!controlled) setInner(nextValue);
      if (typeof onChange === "function") {
        const target = { value: nextValue, name, id, type: "select-one", tagName: "SELECT" };
        onChange({ target, currentTarget: target, type: "change", preventDefault() {}, stopPropagation() {}, persist() {} });
      }
    },
    [controlled, onChange, name, id]
  );

  const hide = useCallback(() => {
    setOpen(false);
    setPos(null); // so the next open never flashes in a stale place
  }, []);

  const close = useCallback((refocus = true) => {
    hide();
    if (refocus && triggerRef.current) triggerRef.current.focus({ preventScroll: true });
  }, [hide]);

  const choose = useCallback(
    (index) => {
      const opt = options[index];
      if (!opt || opt.disabled) return;
      if (opt.value !== current) emit(opt.value);
      close();
    },
    [options, current, emit, close]
  );

  const openList = useCallback(() => {
    if (disabled) return;
    const idx = options.findIndex((o) => o.value === current && !o.disabled);
    setActiveIndex(idx >= 0 ? idx : enabledIndexes[0] ?? -1);
    setOpen(true);
  }, [disabled, options, current, enabledIndexes]);

  // Position the popup under (or above) the trigger; keep it attached while the page scrolls or resizes.
  const reposition = useCallback(() => {
    const t = triggerRef.current;
    if (!t) return;
    const r = t.getBoundingClientRect();
    if (r.bottom < 0 || r.top > window.innerHeight) {
      hide(); // trigger scrolled out of view
      return;
    }
    const popupH = popupRef.current ? popupRef.current.offsetHeight : 0;
    const below = window.innerHeight - r.bottom - EDGE;
    const above = r.top - EDGE;
    const flip = popupH > below && above > below;
    const maxHeight = Math.max(120, Math.min(320, flip ? above - GAP : below - GAP));
    const width = Math.max(r.width, 160);
    let left = r.left;
    if (left + width > window.innerWidth - EDGE) left = Math.max(EDGE, window.innerWidth - EDGE - width);
    setPos({
      left,
      minWidth: width,
      maxWidth: Math.min(window.innerWidth - 2 * EDGE, 480),
      maxHeight,
      ...(flip ? { bottom: window.innerHeight - r.top + GAP } : { top: r.bottom + GAP }),
      fontFamily: getComputedStyle(t).fontFamily,
    });
  }, [hide]);

  useLayoutEffect(() => {
    if (!open) return undefined;
    reposition();
    const onMove = () => reposition();
    window.addEventListener("resize", onMove);
    window.addEventListener("scroll", onMove, true);
    return () => {
      window.removeEventListener("resize", onMove);
      window.removeEventListener("scroll", onMove, true);
    };
  }, [open, reposition, options.length]);

  // second pass once the popup is mounted and has a real height (to decide above/below)
  const positioned = pos !== null;
  useLayoutEffect(() => {
    if (open && positioned && popupRef.current) reposition();
  }, [open, positioned, reposition]);


  // click / touch outside closes
  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => {
      if (popupRef.current?.contains(e.target) || triggerRef.current?.contains(e.target)) return;
      hide();
    };
    document.addEventListener("mousedown", onDown, true);
    document.addEventListener("touchstart", onDown, true);
    return () => {
      document.removeEventListener("mousedown", onDown, true);
      document.removeEventListener("touchstart", onDown, true);
    };
  }, [open, hide]);

  // keep the active option scrolled into view
  useEffect(() => {
    if (!open || activeIndex < 0 || !popupRef.current) return;
    const el = popupRef.current.querySelector(`[data-index="${activeIndex}"]`);
    if (el && el.scrollIntoView) el.scrollIntoView({ block: "nearest" });
  }, [open, activeIndex]);

  const move = (dir) => {
    if (!enabledIndexes.length) return;
    const pos0 = enabledIndexes.indexOf(activeIndex);
    const next = pos0 === -1 ? (dir > 0 ? 0 : enabledIndexes.length - 1) : (pos0 + dir + enabledIndexes.length) % enabledIndexes.length;
    setActiveIndex(enabledIndexes[next]);
  };

  const onKeyDown = (e) => {
    if (disabled) return;
    const k = e.key;
    if (!open) {
      if (k === "ArrowDown" || k === "ArrowUp" || k === "Enter" || k === " ") {
        e.preventDefault();
        openList();
      }
      return;
    }
    if (k === "ArrowDown") { e.preventDefault(); move(1); }
    else if (k === "ArrowUp") { e.preventDefault(); move(-1); }
    else if (k === "Home") { e.preventDefault(); setActiveIndex(enabledIndexes[0] ?? -1); }
    else if (k === "End") { e.preventDefault(); setActiveIndex(enabledIndexes[enabledIndexes.length - 1] ?? -1); }
    else if (k === "Enter" || k === " ") { e.preventDefault(); choose(activeIndex); }
    else if (k === "Escape") { e.preventDefault(); e.stopPropagation(); close(); }
    else if (k === "Tab") { hide(); }
    else if (k.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      const now = Date.now();
      const ta = typeAhead.current;
      ta.text = now - ta.at > 600 ? k.toLowerCase() : ta.text + k.toLowerCase();
      ta.at = now;
      const from = ta.text.length === 1 ? activeIndex + 1 : activeIndex;
      const order = [...options.keys()];
      const rotated = [...order.slice(Math.max(from, 0)), ...order.slice(0, Math.max(from, 0))];
      const hit = rotated.find((i) => !options[i].disabled && options[i].label.toLowerCase().startsWith(ta.text));
      if (hit !== undefined) setActiveIndex(hit);
    }
  };

  // Reserve the width of the widest option (like a native select does) so the trigger does not jump around.
  const sizer = options.length > 0 && options.length <= 40;

  const popup =
    open && typeof document !== "undefined" && pos
      ? createPortal(
          <div
            ref={popupRef}
            id={listId}
            role="listbox"
            aria-label={rest["aria-label"] || title || undefined}
            className="pairo-select-popup"
            style={pos}
            onClick={(e) => e.stopPropagation()} // never reach modal overlays etc. through the React tree
          >
            {items.map((item, i) => {
              if (item.kind === "group") {
                return (
                  <div key={`g-${i}`} className="pairo-select-group" role="presentation">
                    {item.label}
                  </div>
                );
              }
              const idx = item.index;
              const isSel = item.value === current;
              return (
                <div
                  key={`o-${idx}`}
                  id={`${uid}-opt-${idx}`}
                  role="option"
                  data-index={idx}
                  data-active={idx === activeIndex ? "true" : undefined}
                  data-empty={item.value === "" ? "true" : undefined}
                  aria-selected={isSel}
                  aria-disabled={item.disabled || undefined}
                  className="pairo-select-option"
                  onMouseDown={(e) => e.preventDefault()} // keep focus on the trigger (the list scrollbar still works)
                  onMouseEnter={() => !item.disabled && setActiveIndex(idx)}
                  onClick={() => choose(idx)}
                >
                  <span className="pairo-select-option-label">{item.label || " "}</span>
                  {isSel && <Check className="pairo-select-check" aria-hidden="true" />}
                </div>
              );
            })}
          </div>,
          document.body
        )
      : null;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        id={id}
        title={title}
        style={style}
        disabled={disabled}
        autoFocus={autoFocus}
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-activedescendant={open && activeIndex >= 0 ? `${uid}-opt-${activeIndex}` : undefined}
        aria-required={required || undefined}
        aria-label={rest["aria-label"]}
        aria-labelledby={rest["aria-labelledby"]}
        aria-describedby={rest["aria-describedby"]}
        data-testid={rest["data-testid"]}
        data-placeholder={isPlaceholder ? "true" : undefined}
        className={`${className} pairo-select-trigger`}
        onClick={() => (open ? close(false) : openList())}
        onKeyDown={onKeyDown}
        onFocus={onFocus}
        onBlur={onBlur}
      >
        <span className="pairo-select-value">
          {sizer && (
            <span className="pairo-select-sizer" aria-hidden="true">
              {options.map((o, i) => (
                <span key={i}>{o.label || " "}</span>
              ))}
            </span>
          )}
          <span className="pairo-select-shown">{shownLabel || " "}</span>
        </span>
        <ChevronDown className="pairo-select-chevron" aria-hidden="true" data-open={open ? "true" : undefined} />
      </button>
      {name ? <input type="hidden" name={name} value={current} /> : null}
      {popup}
    </>
  );
}
