import { Card } from "@/components/ui/card";

type Metric = {
  label: string;
  value: string;
  detail?: string;
};

export function MetricGrid({ metrics }: { metrics: Metric[] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {metrics.map((metric) => (
        <Card key={metric.label} className="p-4">
          <div className="text-sm text-muted">{metric.label}</div>
          <div className="mt-3 text-2xl font-semibold text-ink">{metric.value}</div>
          {metric.detail ? <div className="mt-2 text-xs text-muted">{metric.detail}</div> : null}
        </Card>
      ))}
    </div>
  );
}

