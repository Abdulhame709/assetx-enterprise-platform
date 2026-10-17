'use client';

import { KeyboardEvent, useCallback, useEffect, useRef, useState } from 'react';

const ITEM_SELECTOR = '[role="menuitem"]:not([disabled]), [data-menu-focusable]:not([disabled])';

/**
 * Shared behaviour for dropdown menus (row actions, user menu, column picker):
 * closes on outside click and Escape (focus returns to the trigger), opens with
 * ArrowDown/ArrowUp from the trigger and moves between items with the arrow keys.
 */
export function useMenu() {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const close = useCallback((restoreFocus = true) => {
    setOpen(false);
    if (restoreFocus) triggerRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onPointer);
    return () => document.removeEventListener('mousedown', onPointer);
  }, [open]);

  const items = useCallback(
    () => Array.from(menuRef.current?.querySelectorAll<HTMLElement>(ITEM_SELECTOR) ?? []),
    [],
  );

  const focusItem = useCallback(
    (target: 'first' | 'last' | 'next' | 'prev') => {
      const list = items();
      if (list.length === 0) return;
      const at = list.indexOf(document.activeElement as HTMLElement);
      const index =
        target === 'first' ? 0
        : target === 'last' ? list.length - 1
        : target === 'next' ? (at + 1) % list.length
        : (at <= 0 ? list.length : at) - 1;
      list[index].focus();
    },
    [items],
  );

  const onTriggerKeyDown = (event: KeyboardEvent) => {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    event.preventDefault();
    setOpen(true);
    // Wait for the menu to mount before moving focus into it.
    requestAnimationFrame(() => focusItem(event.key === 'ArrowDown' ? 'first' : 'last'));
  };

  const onMenuKeyDown = (event: KeyboardEvent) => {
    switch (event.key) {
      case 'Escape': event.preventDefault(); close(); break;
      case 'ArrowDown': event.preventDefault(); focusItem('next'); break;
      case 'ArrowUp': event.preventDefault(); focusItem('prev'); break;
      case 'Home': event.preventDefault(); focusItem('first'); break;
      case 'End': event.preventDefault(); focusItem('last'); break;
      case 'Tab': setOpen(false); break;
      default:
    }
  };

  return { open, setOpen, close, rootRef, triggerRef, menuRef, onTriggerKeyDown, onMenuKeyDown };
}
