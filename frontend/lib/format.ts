export function formatEnergy(mwh: number): string {
  return `${mwh.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} MWh/day`;
}

export function formatCurrency(amount: number): string {
  return `$${amount.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

export function formatPercent(value: number): string {
  // Convert 0..1 to percentage or leave as is if already 0..100
  const pct = value <= 1 ? value * 100 : value;
  return `${pct.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 1 })}%`;
}

export function formatDateTime(isoString: string): string {
  if (!isoString) return "—";
  try {
    const d = new Date(isoString);
    return d.toLocaleString("en-US", {
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      timeZone: "UTC",
      timeZoneName: "short"
    });
  } catch {
    return isoString;
  }
}
export function formatTimeOnly(isoString: string): string {
  if (!isoString) return "—";
  try {
    const d = new Date(isoString);
    return d.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
      timeZone: "UTC"
    });
  } catch {
    return isoString;
  }
}
