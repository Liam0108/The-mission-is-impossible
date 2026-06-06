"use client";

import { createChart, ColorType, type IChartApi } from "lightweight-charts";
import { useEffect, useRef } from "react";

type Point = { date: string; equity: number };

export function PerformanceCurve({ data }: { data: Point[] }) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!ref.current) return;
    const muted = getComputedStyle(document.documentElement)
      .getPropertyValue("--muted")
      .trim()
      .split(/\s+/)
      .join(", ");

    let chart: IChartApi | null = createChart(ref.current, {
      height: 280,
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: `rgb(${muted})`
      },
      grid: {
        vertLines: { color: "rgba(148, 163, 184, 0.12)" },
        horzLines: { color: "rgba(148, 163, 184, 0.12)" }
      },
      rightPriceScale: { borderVisible: false },
      timeScale: { borderVisible: false },
      crosshair: { horzLine: { visible: false } }
    });

    const series = chart.addAreaSeries({
      lineColor: "rgb(45, 212, 191)",
      topColor: "rgba(45, 212, 191, 0.18)",
      bottomColor: "rgba(45, 212, 191, 0)",
      lineWidth: 2
    });

    series.setData(data.map((point) => ({ time: point.date, value: point.equity })));
    chart.timeScale().fitContent();

    const resize = () => {
      if (ref.current && chart) {
        chart.applyOptions({ width: ref.current.clientWidth });
      }
    };
    resize();
    window.addEventListener("resize", resize);

    return () => {
      window.removeEventListener("resize", resize);
      chart?.remove();
      chart = null;
    };
  }, [data]);

  if (!data.length) {
    return <div className="flex h-[280px] items-center justify-center text-sm text-muted">No trades logged</div>;
  }

  return <div ref={ref} className="h-[280px] w-full" />;
}
