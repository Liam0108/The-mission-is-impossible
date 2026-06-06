import type { PerformanceGroup } from "@/lib/types";
import { formatPct, formatR } from "@/lib/utils";

export function PerformanceTable({ rows }: { rows: PerformanceGroup[] }) {
  if (!rows.length) {
    return <div className="py-8 text-center text-sm text-muted">No data</div>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[420px] text-left text-sm">
        <thead className="text-xs uppercase tracking-normal text-muted">
          <tr className="border-b border-stroke">
            <th className="py-3 font-medium">Name</th>
            <th className="py-3 font-medium">Trades</th>
            <th className="py-3 font-medium">Win Rate</th>
            <th className="py-3 font-medium">Expectancy</th>
            <th className="py-3 text-right font-medium">Net R</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.name} className="border-b border-stroke last:border-0">
              <td className="py-3 font-medium text-ink">{row.name}</td>
              <td className="py-3 text-muted">{row.trades}</td>
              <td className="py-3 text-muted">{formatPct(row.win_rate)}</td>
              <td className="py-3 text-muted">{formatR(row.expectancy)}</td>
              <td className="py-3 text-right font-medium text-ink">{formatR(row.result_r)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

