'use client';

import {
  useEffect,
  useId,
  useRef,
  useState,
  ReactNode,
  PointerEvent,
  KeyboardEvent,
  FocusEvent,
} from 'react';

interface PopoverProps {
  button: ReactNode;
  content: ReactNode | string;
  label?: string;
}

const Popover = ({ button, content, label }: PopoverProps) => {
  const tooltipId = useId();
  const rootRef = useRef<HTMLSpanElement>(null);
  const [isHovered, setIsHovered] = useState(false);
  const [isHoverSuppressed, setIsHoverSuppressed] = useState(false);
  const [isKeyboardFocused, setIsKeyboardFocused] = useState(false);
  const [isPinnedOpen, setIsPinnedOpen] = useState(false);

  const isVisible = isHovered || isKeyboardFocused || isPinnedOpen;
  const accessibleLabel =
    label ?? (typeof content === 'string' ? content : undefined);

  useEffect(() => {
    if (!isPinnedOpen) {
      return undefined;
    }

    function closeOnOutsidePointer(event: MouseEvent | TouchEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setIsPinnedOpen(false);
      }
    }

    function closeOnEscape(event: globalThis.KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsPinnedOpen(false);
      }
    }

    document.addEventListener('pointerdown', closeOnOutsidePointer);
    document.addEventListener('keydown', closeOnEscape);

    return () => {
      document.removeEventListener('pointerdown', closeOnOutsidePointer);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [isPinnedOpen]);

  function closeFromKeyboard(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key !== 'Escape') {
      return;
    }

    event.stopPropagation();
    setIsHovered(false);
    setIsKeyboardFocused(false);
    setIsPinnedOpen(false);
  }

  return (
    <span
      ref={rootRef}
      className="relative inline-flex"
      onPointerEnter={(event: PointerEvent<HTMLSpanElement>) => {
        if (event.pointerType === 'mouse' && !isHoverSuppressed) {
          setIsHovered(true);
        }
      }}
      onPointerLeave={(event: PointerEvent<HTMLSpanElement>) => {
        if (event.pointerType === 'mouse') {
          setIsHovered(false);
          setIsHoverSuppressed(false);
        }
      }}
    >
      <button
        type="button"
        aria-label={accessibleLabel}
        aria-controls={tooltipId}
        aria-describedby={isVisible ? tooltipId : undefined}
        aria-expanded={isVisible}
        onClick={() => {
          if (isPinnedOpen) {
            setIsHovered(false);
            setIsKeyboardFocused(false);
            setIsHoverSuppressed(true);
          }
          setIsPinnedOpen((isOpen) => !isOpen);
        }}
        onFocus={(event: FocusEvent<HTMLButtonElement>) => {
          setIsKeyboardFocused(event.currentTarget.matches(':focus-visible'));
        }}
        onBlur={() => setIsKeyboardFocused(false)}
        onKeyDown={closeFromKeyboard}
        className="inline-flex size-7 cursor-help items-center justify-center rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-300"
      >
        {button}
      </button>
      <span
        id={tooltipId}
        role="tooltip"
        aria-hidden={!isVisible}
        className={`pointer-events-none absolute top-full right-0 z-40 mt-2 w-48 rounded-lg border border-gray-300 bg-gray-300/95 p-2 text-sm text-black shadow-lg transition-opacity duration-150 ${
          isVisible ? 'visible opacity-100' : 'invisible opacity-0'
        }`}
      >
        {content}
      </span>
    </span>
  );
};

export default Popover;
