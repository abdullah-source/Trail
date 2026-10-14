/* ---------------------------------------------------------------------------
   Trail desktop icons. Owned by design (see web/DESIGN-desktop.md §7).
   Every icon is a 16 x 16 pixel map drawn as inline SVG with crisp edges, so it
   renders sharp at 16, 32 and 48 px (whole multiples). Legend per cell:
     .  transparent      #  ink (currentColor)   w  sheet (the white of paper)
     g  chrome-deep      a  accent (signed blue)  t  typed green   p  pasted amber
   Edit the strings, not the paths: paths are derived at render time (and cached).
--------------------------------------------------------------------------- */
import type { CSSProperties, SVGProps } from 'react';

export type Ink = '#' | 'w' | 'g' | 'a' | 't' | 'p';
export const INK: Record<Ink, string> = {
  '#': 'currentColor',
  'w': 'var(--sheet)',
  'g': 'var(--chrome-deep)',
  'a': 'var(--accent)',
  't': 'var(--typed)',
  'p': 'var(--paste)'
};

export const PIXELS = {
  document: [
    '..##########....',
    '..#wwwwwwww##...',
    '..#wwwwwwww#w#..',
    '..#wwwwwwww####.',
    '..#ww######www#.',
    '..#wwwwwwwwwww#.',
    '..#ww#######ww#.',
    '..#wwwwwwwwwww#.',
    '..#ww#######ww#.',
    '..#wwwwwwwwwww#.',
    '..#ww#######ww#.',
    '..#wwwwwwwwwww#.',
    '..#ww#####wwww#.',
    '..#wwwwwwwwwww#.',
    '..#############.',
    '................',
  ],
  folder: [
    '................',
    '................',
    '.#######........',
    '.#ggggg#........',
    '##############..',
    '#wwwwwwwwwwwww#.',
    '#wgggggggggggw#.',
    '#wgggggggggggw#.',
    '#wgggggggggggw#.',
    '#wgggggggggggw#.',
    '#wgggggggggggw#.',
    '#wgggggggggggw#.',
    '#wwwwwwwwwwwww#.',
    '###############.',
    '................',
    '................',
  ],
  clock: [
    '.....######.....',
    '...##wwwwww##...',
    '..#wwwwwwwwww#..',
    '.#wwwww#wwwwww#.',
    '.#wwwww#wwwwww#.',
    '#wwwwww#wwwwwww#',
    '#wwwwww#wwwwwww#',
    '#wwwwww####wwww#',
    '#wwwwwwwwwwwwww#',
    '#wwwwwwwwwwwwww#',
    '#wwwwwwwwwwwwww#',
    '.#wwwwwwwwwwww#.',
    '.#wwwwwwwwwwww#.',
    '..#wwwwwwwwww#..',
    '...##wwwwww##...',
    '.....######.....',
  ],
  link: [
    '................',
    '................',
    '................',
    '................',
    '................',
    '..############..',
    '.#wwwww#wwwwww#.',
    '.#w....#w....w#.',
    '.#w....w#....w#.',
    '.#wwwwww#wwwww#.',
    '..############..',
    '................',
    '................',
    '................',
    '................',
    '................',
  ],
  key: [
    '................',
    '................',
    '................',
    '....######......',
    '...#wwwwww#.....',
    '..#ww####ww#....',
    '..#w#....#w#....',
    '..#w#....#w#....',
    '..#ww####ww#....',
    '...#wwwwww#.....',
    '....##ww##......',
    '......#w#.......',
    '......#w###.....',
    '......#www#.....',
    '......#w###.....',
    '......###.......',
  ],
  magnifier: [
    '................',
    '...#####........',
    '..#wwwww#.......',
    '.#wwwwwww#......',
    '.#wwwwwww#......',
    '.#wwwwwww#......',
    '.#wwwwwww#......',
    '.#wwwwwww#......',
    '..#wwwww##......',
    '...#####.##.....',
    '..........##....',
    '...........##...',
    '............##..',
    '.............##.',
    '................',
    '................',
  ],
  disk: [
    '.##############.',
    '.#gg########gg#.',
    '.#gg#wwww#w#gg#.',
    '.#gg#wwww#w#gg#.',
    '.#gg#wwww#w#gg#.',
    '.#gg########gg#.',
    '.#gggggggggggg#.',
    '.#gggggggggggg#.',
    '.#g##########g#.',
    '.#g#wwwwwwww#g#.',
    '.#g#wwwwwwww#g#.',
    '.#g#w######w#g#.',
    '.#g#w####www#g#.',
    '.#g#wwwwwwww#g#.',
    '.##############.',
    '................',
  ],
  warning: [
    '.......##.......',
    '.......##.......',
    '......#ww#......',
    '......#ww#......',
    '.....#wwww#.....',
    '.....#w##w#.....',
    '....#ww##ww#....',
    '....#ww##ww#....',
    '...#www##www#...',
    '...#www##www#...',
    '..#wwww##wwww#..',
    '..#wwwwwwwwww#..',
    '.#wwwww##wwwww#.',
    '.#wwwwwwwwwwww#.',
    '################',
    '................',
  ],
  check: [
    '................',
    '................',
    '................',
    '................',
    '.............##.',
    '............###.',
    '...........###..',
    '..##......###...',
    '..###....###....',
    '...###..###.....',
    '....######......',
    '.....####.......',
    '......##........',
    '................',
    '................',
    '................',
  ],
  cross: [
    '................',
    '................',
    '................',
    '...##......##...',
    '...###....###...',
    '....###..###....',
    '.....######.....',
    '......####......',
    '......####......',
    '.....######.....',
    '....###..###....',
    '...###....###...',
    '...##......##...',
    '................',
    '................',
    '................',
  ],
  mark: [
    '................',
    '.......##.......',
    '......#..#......',
    '......#..#..aa..',
    '......#..#..aa..',
    '.....#..#...aa..',
    '.....#..#...aa..',
    '.....#..#...aa..',
    '....#..#....aa..',
    '....#..#....aa..',
    '....#.#.....aa..',
    '....##......aa..',
    '....#..##.......',
    '.....##.........',
    '................',
    '................',
  ],
  play: [
    '................',
    '................',
    '................',
    '.....#..........',
    '.....##.........',
    '.....###........',
    '.....####.......',
    '.....#####......',
    '.....#####......',
    '.....####.......',
    '.....###........',
    '.....##.........',
    '.....#..........',
    '................',
    '................',
    '................',
  ],
  pause: [
    '................',
    '................',
    '................',
    '....###..###....',
    '....###..###....',
    '....###..###....',
    '....###..###....',
    '....###..###....',
    '....###..###....',
    '....###..###....',
    '....###..###....',
    '....###..###....',
    '....###..###....',
    '................',
    '................',
    '................',
  ],
  back: [
    '................',
    '................',
    '................',
    '...##.......#...',
    '...##......##...',
    '...##.....###...',
    '...##....####...',
    '...##...#####...',
    '...##...#####...',
    '...##....####...',
    '...##.....###...',
    '...##......##...',
    '...##.......#...',
    '................',
    '................',
    '................',
  ],
  sun: [
    '................',
    '.......##.......',
    '.......##.......',
    '..##........##..',
    '...#..####..#...',
    '.....#wwww#.....',
    '....#wwwwww#....',
    '##..#wwwwww#..##',
    '##..#wwwwww#..##',
    '....#wwwwww#....',
    '.....#wwww#.....',
    '...#..####..#...',
    '..##........##..',
    '.......##.......',
    '.......##.......',
    '................',
  ],
  moon: [
    '................',
    '................',
    '.....####.......',
    '...##wwww#......',
    '..#wwwww#.......',
    '.#wwwww#........',
    '.#wwww#.........',
    '#wwwww#.........',
    '#wwwww#.........',
    '.#wwww#.........',
    '.#wwwww#........',
    '..#wwwww#.......',
    '...##wwww#......',
    '.....####.......',
    '................',
    '................',
  ],
  grow: [
    '................',
    '................',
    '..#########.....',
    '..#wwwwwww#.....',
    '..#wwwwwww#.....',
    '..#wwwwwww#.....',
    '..#wwwwwww#.....',
    '..#wwww#######..',
    '..#wwww#wwwww#..',
    '..#wwww#wwwww#..',
    '..######wwwww#..',
    '.......#wwwww#..',
    '.......#wwwww#..',
    '.......#######..',
    '................',
    '................',
  ],
  radio: [
    '.....######.....',
    '...##wwwwww##...',
    '..#wwwwwwwwww#..',
    '.#wwwwwwwwwwww#.',
    '.#wwwwwwwwwwww#.',
    '#wwwwwwwwwwwwww#',
    '#wwwwwwwwwwwwww#',
    '#wwwwwwwwwwwwww#',
    '#wwwwwwwwwwwwww#',
    '#wwwwwwwwwwwwww#',
    '#wwwwwwwwwwwwww#',
    '.#wwwwwwwwwwww#.',
    '.#wwwwwwwwwwww#.',
    '..#wwwwwwwwww#..',
    '...##wwwwww##...',
    '.....######.....',
  ],
  radioOn: [
    '.....######.....',
    '...##wwwwww##...',
    '..#wwwwwwwwww#..',
    '.#wwwwwwwwwwww#.',
    '.#wwwwwwwwwwww#.',
    '#wwwww####wwwww#',
    '#wwww######wwww#',
    '#wwww######wwww#',
    '#wwww######wwww#',
    '#wwww######wwww#',
    '#wwwww####wwwww#',
    '.#wwwwwwwwwwww#.',
    '.#wwwwwwwwwwww#.',
    '..#wwwwwwwwww#..',
    '...##wwwwww##...',
    '.....######.....',
  ],
  arrowUp: [
    '................',
    '................',
    '................',
    '................',
    '.......##.......',
    '......####......',
    '.....######.....',
    '....########....',
    '...##########...',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
  ],
  forward: [
    '................',
    '................',
    '................',
    '...#.......##...',
    '...##......##...',
    '...###.....##...',
    '...####....##...',
    '...#####...##...',
    '...#####...##...',
    '...####....##...',
    '...###.....##...',
    '...##......##...',
    '...#.......##...',
    '................',
    '................',
    '................',
  ],
  arrowDown: [
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '...##########...',
    '....########....',
    '.....######.....',
    '......####......',
    '.......##.......',
    '................',
    '................',
    '................',
    '................',
  ],
  arrowRight: [
    '................',
    '................',
    '................',
    '.......#........',
    '.......##.......',
    '.......###......',
    '.......####.....',
    '.......#####....',
    '.......#####....',
    '.......####.....',
    '.......###......',
    '.......##.......',
    '.......#........',
    '................',
    '................',
    '................',
  ],
  arrowLeft: [
    '................',
    '................',
    '................',
    '........#.......',
    '.......##.......',
    '......###.......',
    '.....####.......',
    '....#####.......',
    '....#####.......',
    '.....####.......',
    '......###.......',
    '.......##.......',
    '........#.......',
    '................',
    '................',
    '................',
  ],
} as const satisfies Record<string, readonly string[]>;

export type IconName = keyof typeof PIXELS;
export const ICON_NAMES = Object.keys(PIXELS) as IconName[];

type Path = { ink: Ink; d: string };
const cache = new Map<string, Path[]>();

/** Horizontal runs of one ink become one sub-path each: "M x y h n v1 h -n z". */
export function pixelPaths(rows: readonly string[]): Path[] {
  const key = rows.join('/');
  const hit = cache.get(key);
  if (hit) return hit;
  const acc = new Map<Ink, string>();
  rows.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      const c = row[x] as Ink | '.';
      if (c === '.') {
        x++;
        continue;
      }
      let n = 1;
      while (x + n < row.length && row[x + n] === c) n++;
      acc.set(c, (acc.get(c) || '') + `M${x} ${y}h${n}v1h-${n}z`);
      x += n;
    }
  });
  const out = [...acc].map(([ink, d]) => ({ ink, d }));
  cache.set(key, out);
  return out;
}

export type IconProps = Omit<SVGProps<SVGSVGElement>, 'name' | 'fill'> & {
  name: IconName;
  /** 16, 32 or 48 keep the pixels whole; other sizes are allowed but soften. */
  size?: number;
  /** Accessible name. Without one the icon is decorative (aria-hidden). */
  label?: string;
  /** Override an ink, e.g. { w: 'var(--paste)' } fills a warning triangle amber. */
  fill?: Partial<Record<Ink, string>>;
};

export function Icon({ name, size = 16, label, fill, className, style, ...rest }: IconProps) {
  const inks = fill ? { ...INK, ...fill } : INK;
  const s: CSSProperties = { display: 'inline-block', verticalAlign: 'middle', flexShrink: 0, ...style };
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      shapeRendering="crispEdges"
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      focusable="false"
      className={className}
      style={s}
      {...rest}
    >
      {pixelPaths(PIXELS[name]).map((p) => (
        <path key={p.ink} fill={inks[p.ink]} d={p.d} />
      ))}
    </svg>
  );
}

type Short = Omit<IconProps, 'name'>;
export const DocumentIcon = (p: Short) => <Icon name="document" {...p} />;
export const FolderIcon = (p: Short) => <Icon name="folder" {...p} />;
export const ClockIcon = (p: Short) => <Icon name="clock" {...p} />;
export const LinkIcon = (p: Short) => <Icon name="link" {...p} />;
export const KeyIcon = (p: Short) => <Icon name="key" {...p} />;
export const MagnifierIcon = (p: Short) => <Icon name="magnifier" {...p} />;
export const DiskIcon = (p: Short) => <Icon name="disk" {...p} />;
export const WarningIcon = (p: Short) => <Icon name="warning" {...p} />;
export const CheckIcon = (p: Short) => <Icon name="check" {...p} />;
export const CrossIcon = (p: Short) => <Icon name="cross" {...p} />;
export const MarkIcon = (p: Short) => <Icon name="mark" {...p} />;
export const PlayIcon = (p: Short) => <Icon name="play" {...p} />;
export const PauseIcon = (p: Short) => <Icon name="pause" {...p} />;
export const BackIcon = (p: Short) => <Icon name="back" {...p} />;
export const SunIcon = (p: Short) => <Icon name="sun" {...p} />;
export const MoonIcon = (p: Short) => <Icon name="moon" {...p} />;
export const GrowIcon = (p: Short) => <Icon name="grow" {...p} />;
export const ForwardIcon = (p: Short) => <Icon name="forward" {...p} />;

export default Icon;
