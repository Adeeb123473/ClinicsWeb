import type { ReactNode, SVGProps } from "react";

/** Minimal stroke-icon set used in navigation and layout chrome. */
type IconProps = SVGProps<SVGSVGElement>;

function base(children: ReactNode) {
  return function Icon(props: IconProps) {
    return (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.75}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        {...props}
      >
        {children}
      </svg>
    );
  };
}

export const GridIcon = base(
  <>
    <rect x="3" y="3" width="8" height="8" rx="2" />
    <rect x="13" y="3" width="8" height="8" rx="2" />
    <rect x="3" y="13" width="8" height="8" rx="2" />
    <rect x="13" y="13" width="8" height="8" rx="2" />
  </>,
);

export const UsersIcon = base(
  <>
    <circle cx="9" cy="8" r="3.25" />
    <path d="M2.75 20a6.25 6.25 0 0 1 12.5 0" />
    <path d="M15.5 5.5a3.25 3.25 0 0 1 0 6.3" />
    <path d="M17.5 14a6.2 6.2 0 0 1 3.75 6" />
  </>,
);

export const CalendarIcon = base(
  <>
    <rect x="3" y="4.5" width="18" height="16" rx="2.5" />
    <path d="M3 9.5h18" />
    <path d="M8 2.5v4M16 2.5v4" />
  </>,
);

export const ClipboardIcon = base(
  <>
    <rect x="5" y="4" width="14" height="17" rx="2" />
    <rect x="8.5" y="2.5" width="7" height="3.5" rx="1" />
    <path d="M8.5 11h7M8.5 15h7" />
  </>,
);

export const ChartIcon = base(
  <>
    <path d="M4 20V10M12 20V4M20 20v-7" />
    <path d="M2.5 20h19" />
  </>,
);

export const SettingsIcon = base(
  <>
    <circle cx="12" cy="12" r="3.25" />
    <path d="M12 2.5v2.2M12 19.3v2.2M4.9 4.9l1.55 1.55M17.55 17.55l1.55 1.55M2.5 12h2.2M19.3 12h2.2M4.9 19.1l1.55-1.55M17.55 6.45l1.55-1.55" />
  </>,
);

export const HistoryIcon = base(
  <>
    <path d="M3 12a9 9 0 1 0 3-6.7" />
    <path d="M3 4v5h5" />
    <path d="M12 7.5V12l3 2" />
  </>,
);

export const StethoscopeIcon = base(
  <>
    <path d="M6 3v6.5a4.5 4.5 0 0 0 9 0V3" />
    <path d="M19 10v2a5.5 5.5 0 0 1-11 0v-1" />
    <circle cx="19" cy="8" r="2" />
  </>,
);

export const ActivityIcon = base(<path d="M3 12h4l2.5 7L14 5l2 7h5" />);

export const CreditCardIcon = base(
  <>
    <rect x="2.5" y="5.5" width="19" height="13" rx="2.25" />
    <path d="M2.5 10h19" />
  </>,
);

export const ChevronLeftIcon = base(<path d="M14.5 5 8 12l6.5 7" />);

export const LogoutIcon = base(
  <>
    <path d="M9 4.5H6.5a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2H9" />
    <path d="M15.5 16.5 20 12l-4.5-4.5" />
    <path d="M20 12H9" />
  </>,
);
