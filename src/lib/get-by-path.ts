/** Reads a nested value out of any JSON object using a dot-path like
 *  "data.from" or "sender.id" — this is what lets the generic WhatsApp
 *  Gateway trigger node adapt to whichever field names a given
 *  third-party provider (RapidAPI listing, Whapi.cloud, etc) happens to
 *  use in its webhook payload, without hardcoding one provider's shape. */
export function getByPath(obj: unknown, path: string): unknown {
  if (!path) return undefined;
  return path.split(".").reduce<unknown>((cur, key) => {
    if (cur && typeof cur === "object" && key in (cur as Record<string, unknown>)) {
      return (cur as Record<string, unknown>)[key];
    }
    return undefined;
  }, obj);
}
