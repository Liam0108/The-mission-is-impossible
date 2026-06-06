type ExportValue = string | number | null | undefined;

export type AnalysisExport = {
  title: string;
  setupFilters: Record<string, ExportValue>;
  sampleSize: ExportValue;
  tp1Probability: ExportValue;
  beProbability: ExportValue;
  slProbability: ExportValue;
  averageR: ExportValue;
  maxLosingStreak: ExportValue;
  bestManagementRule: ExportValue;
  pocRiskWarning: ExportValue;
  conclusionNotes: ExportValue;
};

function valueText(value: ExportValue) {
  return value === null || value === undefined || value === "" ? "N/A" : String(value);
}

function csvEscape(value: ExportValue) {
  const text = valueText(value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, "\"\"")}"` : text;
}

function download(filename: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function rows(data: AnalysisExport): Array<[string, ExportValue]> {
  return [
    ["title", data.title],
    ["setup_filters", Object.entries(data.setupFilters).map(([key, value]) => `${key}: ${valueText(value)}`).join("; ")],
    ["sample_size", data.sampleSize],
    ["tp1_probability", data.tp1Probability],
    ["be_probability", data.beProbability],
    ["sl_probability", data.slProbability],
    ["average_r", data.averageR],
    ["max_losing_streak", data.maxLosingStreak],
    ["best_management_rule", data.bestManagementRule],
    ["poc_risk_warning", data.pocRiskWarning],
    ["conclusion_notes", data.conclusionNotes]
  ];
}

export function exportAnalysisCsv(data: AnalysisExport, filename = "fabio-research-export.csv") {
  const content = ["field,value", ...rows(data).map(([field, value]) => `${csvEscape(field)},${csvEscape(value)}`)].join("\n");
  download(filename, content, "text/csv;charset=utf-8");
}

export function exportAnalysisMarkdown(data: AnalysisExport, filename = "fabio-research-export.md") {
  const filters = Object.entries(data.setupFilters)
    .map(([key, value]) => `- ${key}: ${valueText(value)}`)
    .join("\n");
  const content = `# ${data.title}

## Setup Filters
${filters || "- N/A"}

## Historical Summary
- Sample size: ${valueText(data.sampleSize)}
- TP1 probability: ${valueText(data.tp1Probability)}
- BE probability: ${valueText(data.beProbability)}
- SL probability: ${valueText(data.slProbability)}
- Average R: ${valueText(data.averageR)}
- Max losing streak: ${valueText(data.maxLosingStreak)}

## Management
- Best management rule: ${valueText(data.bestManagementRule)}

## POC Risk
- ${valueText(data.pocRiskWarning)}

## Conclusion Notes
${valueText(data.conclusionNotes)}
`;
  download(filename, content, "text/markdown;charset=utf-8");
}
