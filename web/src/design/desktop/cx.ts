/** Joins class names, dropping falsy entries. Same helper as design/components.tsx. */
export const cx = (...a: (string | false | null | undefined)[]) => a.filter(Boolean).join(' ');
