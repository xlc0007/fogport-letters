import { useEffect, useId, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Icon } from "./Icons";

interface OverlayProps {
  eyebrow: string;
  title: string;
  onClose: () => void;
  children: ReactNode;
  variant?: "sheet" | "dialog";
}

export function Overlay({ eyebrow, title, onClose, children, variant = "dialog" }: OverlayProps) {
  const titleId = useId();
  const panelRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    const focusTimer = window.setTimeout(() => panelRef.current?.focus(), 30);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
      window.clearTimeout(focusTimer);
    };
  }, [onClose]);

  return createPortal(
    <div
      className={`overlay ${variant === "sheet" ? "overlay-sheet" : ""}`}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <section
        ref={panelRef}
        className={`overlay-panel ${variant === "sheet" ? "sheet-panel" : "dialog-panel"}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
      >
        <header className="overlay-header">
          <div>
            <p className="eyebrow">{eyebrow}</p>
            <h2 id={titleId}>{title}</h2>
          </div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="关闭">
            <Icon name="close" size={18} />
          </button>
        </header>
        <div className="overlay-body">{children}</div>
      </section>
    </div>,
    document.body,
  );
}
