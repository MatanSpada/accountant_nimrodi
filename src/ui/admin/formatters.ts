export function formatAmountAgorot(amountAgorot: number) {
  return new Intl.NumberFormat("he-IL", {
    style: "currency",
    currency: "ILS"
  }).format(amountAgorot / 100);
}

export function formatAmountForMessage(amountAgorot: number) {
  return `${new Intl.NumberFormat("he-IL", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amountAgorot / 100)} ₪`;
}

export function formatDateTime(value: string | null) {
  if (!value) {
    return "—";
  }

  return new Intl.DateTimeFormat("he-IL", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

export function escapeHtml(value: string | null | undefined) {
  if (!value) {
    return "";
  }

  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
