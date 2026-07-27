/** Fügt Klassennamen zusammen und lässt leere Werte weg. */
export function classNames(
  ...values: (string | false | null | undefined)[]
): string {
  return values.filter(Boolean).join(" ");
}
