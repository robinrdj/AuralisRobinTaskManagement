export const downloadCSV = (filename: string, labels: string[], data: number[], label: string) => {
  const csvContent = [
    ["Date", label],
    ...labels.map((date, i) => [date, data[i]]),
  ]
    .map((row) => row.join(","))
    .join("\n");

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", filename);
  link.click();
};
