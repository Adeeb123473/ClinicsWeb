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

export const PlusIcon = base(
  <>
    <path d="M12 5v14" />
    <path d="M5 12h14" />
  </>,
);

export const SearchIcon = base(
  <>
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.5-3.5" />
  </>,
);

export const CheckIcon = base(<path d="M5 12.5 10 17.5 19.5 6.5" />);

export const XIcon = base(
  <>
    <path d="M6 6l12 12" />
    <path d="M18 6 6 18" />
  </>,
);

export const PrintIcon = base(
  <>
    <path d="M7 9V4h10v5" />
    <path d="M7 18H5a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2h-2" />
    <rect x="7" y="15" width="10" height="6" rx="1" />
  </>,
);

export const BellIcon = base(
  <>
    <path d="M18 9a6 6 0 0 0-12 0c0 5-2 7-2 7h16s-2-2-2-7" />
    <path d="M10.5 20a1.8 1.8 0 0 0 3 0" />
  </>,
);

export const ClockIcon = base(
  <>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 7.5V12l3 2" />
  </>,
);

export const PillIcon = base(
  <>
    <rect x="3" y="8" width="18" height="8" rx="4" transform="rotate(45 12 12)" />
    <path d="M8.5 8.5 15.5 15.5" />
  </>,
);

export const FlaskIcon = base(
  <>
    <path d="M9 3h6" />
    <path d="M10 3v6l-5 9a2 2 0 0 0 1.8 3h10.4a2 2 0 0 0 1.8-3l-5-9V3" />
    <path d="M7 15h10" />
  </>,
);

export const EditIcon = base(
  <>
    <path d="M4 20h4l10-10-4-4L4 16v4Z" />
    <path d="m13.5 6.5 4 4" />
  </>,
);

export const TrashIcon = base(
  <>
    <path d="M4 7h16" />
    <path d="M9 7V4.5h6V7" />
    <path d="M6 7l1 13h10l1-13" />
  </>,
);

export const ChevronRightIcon = base(<path d="M9.5 5 16 12l-6.5 7" />);

export const AlertIcon = base(
  <>
    <path d="M12 3 2.5 20h19L12 3Z" />
    <path d="M12 9v5" />
    <path d="M12 17.5h.01" />
  </>,
);

export const UserPlusIcon = base(
  <>
    <circle cx="9" cy="8" r="3.5" />
    <path d="M3.5 20a5.5 5.5 0 0 1 11 0" />
    <path d="M18 8v6" />
    <path d="M15 11h6" />
  </>,
);

export const DownloadIcon = base(
  <>
    <path d="M12 4v11" />
    <path d="m7.5 11 4.5 4.5 4.5-4.5" />
    <path d="M5 20h14" />
  </>,
);

export const HeartPulseIcon = base(
  <>
    <path d="M12 20s-7-4.5-9.5-9A5 5 0 0 1 12 6a5 5 0 0 1 9.5 5c-.4.8-1 1.6-1.7 2.4" />
    <path d="M13 13h3l1.5-2.5L20 15h1.5" />
  </>,
);
