import type { SVGProps } from 'react';

/* Line icons on a 24 grid, 1.5 stroke, round joins, currentColor: engraved, not filled.
   They name parts of the product only. Decorative (aria-hidden) unless given a label. */

const P: Record<string, string> = {
  document: 'M7 3.5h7l4 4V20a.5.5 0 0 1-.5.5h-10A.5.5 0 0 1 6.5 20V4a.5.5 0 0 1 .5-.5ZM14 3.5V8h4M9.5 12h5M9.5 15h5M9.5 18h3',
  session: 'M12 20.5a8.5 8.5 0 1 0 0-17 8.5 8.5 0 0 0 0 17ZM12 7.5V12l3 2',
  paste: 'M9 4.5H7a1 1 0 0 0-1 1V20a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V5.5a1 1 0 0 0-1-1h-2M9.5 3h5a.5.5 0 0 1 .5.5v2a.5.5 0 0 1-.5.5h-5a.5.5 0 0 1-.5-.5v-2a.5.5 0 0 1 .5-.5ZM9.5 11h5M9.5 14.5h5M9.5 18h3',
  signature: 'M4 19.5c2-.2 3-2.8 4.5-2.8s1.2 2.6 3 2.6 2.2-1.9 3.5-1.9 1.4 1.5 3 1.5M14.5 4.5l5 5L12 17l-4 1 1-4 7.5-7.5Z',
  log: 'M5 4.5h12.5a1 1 0 0 1 1 1V20a.5.5 0 0 1-.5.5H6a1 1 0 0 1-1-1v-15ZM5 17.5h13.5M8.5 8h6.5M8.5 11h6.5M8.5 14h4',
  check: 'M5 12.5l4.5 4.5L19 7.5',
  cross: 'M6.5 6.5l11 11M17.5 6.5l-11 11',
  arrow: 'M4.5 12h15M13.5 6l6 6-6 6',
  external: 'M14 4.5h5.5V10M19.5 4.5 11 13M17.5 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7.5a1 1 0 0 1 1-1h5',
  copy: 'M8.5 8.5h10a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1h-10a1 1 0 0 1-1-1v-10a1 1 0 0 1 1-1ZM5.5 15.5h-1a1 1 0 0 1-1-1v-10a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1',
  upload: 'M12 15.5V4M7 8.5l5-5 5 5M4.5 15v4a1 1 0 0 0 1 1h13a1 1 0 0 0 1-1v-4',
  shield: 'M12 3.5 19 6v5.5c0 4.4-3 7.7-7 9-4-1.3-7-4.6-7-9V6l7-2.5ZM8.5 12l2.5 2.5 4.5-4.5',
  lock: 'M6.5 10.5h11a1 1 0 0 1 1 1V20a.5.5 0 0 1-.5.5H6a.5.5 0 0 1-.5-.5v-8.5a1 1 0 0 1 1-1ZM8.5 10.5V8a3.5 3.5 0 1 1 7 0v2.5',
  key: 'M14.5 13.5a5 5 0 1 0-4.6-3.1L3.5 16.8V20.5h3.5v-2h2v-2h2l1.3-1.3a5 5 0 0 0 2.2.3ZM16.5 7.5h.01',
  link: 'M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1',
  search: 'M10.5 17.5a7 7 0 1 0 0-14 7 7 0 0 0 0 14ZM20.5 20.5l-5-5',
  menu: 'M4 7.5h16M4 12h16M4 16.5h16',
  close: 'M6 6l12 12M18 6 6 18',
  sun: 'M12 16.5a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9ZM12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4',
  moon: 'M19.5 14.5A8 8 0 0 1 9.5 4.5a8 8 0 1 0 10 10Z',
  play: 'M8 5.5v13l10.5-6.5L8 5.5Z',
  pause: 'M8 5.5v13M16 5.5v13',
  info: 'M12 20.5a8.5 8.5 0 1 0 0-17 8.5 8.5 0 0 0 0 17ZM12 11v5.5M12 7.75h.01',
  warning: 'M12 4 21 19.5H3L12 4ZM12 10v4.5M12 17h.01',
  students: 'M3 9l9-4.5L21 9l-9 4.5L3 9ZM7 11v4.5c1.5 1.3 3 2 5 2s3.5-.7 5-2V11M21 9v5',
  research: 'M9.5 3.5h5M10.5 3.5v6L5 18.5a1.3 1.3 0 0 0 1.1 2h11.8a1.3 1.3 0 0 0 1.1-2l-5.5-9v-6M7.5 14.5h9',
  legal: 'M12 3.5v17M7 20.5h10M4.5 7.5h15M7 7.5 4 14a3 3 0 0 0 6 0L7 7.5ZM17 7.5 14 14a3 3 0 0 0 6 0l-3-6.5',
  writers: 'M4 20h16M6 16.5 16.5 6a2.1 2.1 0 0 1 3 3L9 19.5l-3.5 1 .5-4Z',
};

export type IconName = keyof typeof P | 'mark';
export const ICON_NAMES = Object.keys(P) as IconName[];

export type IconProps = Omit<SVGProps<SVGSVGElement>, 'name'> & { name: IconName; size?: number; label?: string; strokeWidth?: number };

export function Icon({ name, size = 20, label, strokeWidth = 1.5, ...rest }: IconProps) {
  if (name === 'mark') return <Mark size={size} label={label} {...rest} />;
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      focusable="false"
      {...rest}
    >
      <path d={P[name]} />
    </svg>
  );
}

/** The crop-mark logo: four printer's corners around a registration mark. */
export function Mark({ size = 24, label, className, ...rest }: Omit<SVGProps<SVGSVGElement>, 'name'> & { size?: number; label?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="square"
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      focusable="false"
      className={['mark', className].filter(Boolean).join(' ')}
      {...rest}
    >
      <path d="M1.5 7V1.5H7M17 1.5h5.5V7M22.5 17v5.5H17M7 22.5H1.5V17" />
      <circle cx="12" cy="12" r="4.25" strokeWidth={1.25} />
      <path d="M12 5.5v13M5.5 12h13" strokeWidth={1} />
    </svg>
  );
}
