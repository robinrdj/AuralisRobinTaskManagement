export const formatToIndianDate = (isoDate: string): string => {
  const date = new Date(isoDate);
  const dd = String(date.getDate()).padStart(2, "0");
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const yyyy = date.getFullYear();
  return `${dd}-${mm}-${yyyy}`;
};

export const indianToISODate = (indianDate: string): string => {
  const [dd, mm, yyyy] = indianDate.split("-");
  return `${yyyy}-${mm}-${dd}`;
};
