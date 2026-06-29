export const eur = new Intl.NumberFormat("pt-PT", {
  style: "currency",
  currency: "EUR",
});

export const number = new Intl.NumberFormat("pt-PT", {
  maximumFractionDigits: 2,
});

export const monthLabel = (month: string) => month.toLocaleUpperCase("pt-PT");

export const shortDate = (dateIso: string) =>
  new Intl.DateTimeFormat("pt-PT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(`${dateIso}T00:00:00`));
