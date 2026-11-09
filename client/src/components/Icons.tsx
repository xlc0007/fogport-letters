import type { SVGProps } from "react";

export type IconName =
  | "arrow"
  | "close"
  | "pin"
  | "bag"
  | "chevron"
  | "spark"
  | "clock"
  | "book"
  | "quill"
  | "back"
  | "home"
  | "save";

interface IconProps extends SVGProps<SVGSVGElement> {
  name: IconName;
  size?: number;
}

export function Icon({ name, size = 16, ...props }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      {name === "arrow" && <path d="M4 12h15m-6-6 6 6-6 6" />}
      {name === "close" && <path d="M6 6l12 12M18 6 6 18" />}
      {name === "pin" && (
        <>
          <path d="M12 21s6.5-5.7 6.5-11a6.5 6.5 0 1 0-13 0C5.5 15.3 12 21 12 21Z" />
          <circle cx="12" cy="10" r="2.2" />
        </>
      )}
      {name === "bag" && (
        <>
          <path d="M5 8.5h14l-1 11H6l-1-11Z" />
          <path d="M9 9V6.8a3 3 0 0 1 6 0V9" />
        </>
      )}
      {name === "chevron" && <path d="m7 10 5 5 5-5" />}
      {name === "spark" && (
        <path d="M12 3.5c.6 5 2.9 7.3 7.5 8.5-4.6 1.2-6.9 3.5-7.5 8.5-.6-5-2.9-7.3-7.5-8.5 4.6-1.2 6.9-3.5 7.5-8.5Z" />
      )}
      {name === "clock" && (
        <>
          <circle cx="12" cy="12" r="8" />
          <path d="M12 7.5V12l3 2" />
        </>
      )}
      {name === "book" && (
        <>
          <path d="M5 5.5A2.5 2.5 0 0 1 7.5 3H19v15.5H7.5A2.5 2.5 0 0 0 5 21V5.5Z" />
          <path d="M5 18.5A2.5 2.5 0 0 1 7.5 16H19M9 7h6" />
        </>
      )}
      {name === "quill" && (
        <>
          <path d="M20 4c-6.4.7-10.3 4.4-12.5 9.5L6 18" />
          <path d="M14.5 7.5c-4 .8-6.4 3.1-7.5 6.9 3.3.4 6.9-1.1 9.2-3.8" />
          <path d="M4 21c1.2-1.3 2.2-2.2 3.8-3" />
        </>
      )}
      {name === "back" && <path d="M20 12H5m6-6-6 6 6 6" />}
      {name === "home" && (
        <>
          <path d="m4 10 8-7 8 7v10H4V10Z" />
          <path d="M9 20v-6h6v6" />
        </>
      )}
      {name === "save" && (
        <>
          <path d="M6 3h12v18l-6-4-6 4V3Z" />
          <path d="M9 3v5h6V3" />
        </>
      )}
    </svg>
  );
}
