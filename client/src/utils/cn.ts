/** Joins truthy class names together. A minimal `clsx` substitute. */
export function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}
