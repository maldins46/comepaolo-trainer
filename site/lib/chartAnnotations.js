// Hand-rolled Chart.js v4 plugin objects (local, per-chart `plugins:[...]` entries — no
// chartjs-plugin-annotation dependency, keeps the app to one third-party script total).

export function verticalBand({ x, fill, labelColor, label }) {
  return {
    id: 'verticalBand',
    afterDatasetsDraw(chart) {
      const { ctx, chartArea, scales } = chart;
      const left = scales.x.getPixelForValue(x - 0.5);
      const right = scales.x.getPixelForValue(x + 0.5);
      ctx.save();
      ctx.fillStyle = fill;
      ctx.fillRect(left, chartArea.top, right - left, chartArea.bottom - chartArea.top);
      if (label) {
        ctx.fillStyle = labelColor;
        ctx.font = '11px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(label, (left + right) / 2, chartArea.top + 12);
      }
      ctx.restore();
    },
  };
}

export function verticalLine({ x, color, label }) {
  return {
    id: 'verticalLine',
    afterDatasetsDraw(chart) {
      const { ctx, chartArea, scales } = chart;
      const px = scales.x.getPixelForValue(x);
      ctx.save();
      ctx.strokeStyle = color;
      ctx.setLineDash([4, 3]);
      ctx.beginPath();
      ctx.moveTo(px, chartArea.top);
      ctx.lineTo(px, chartArea.bottom);
      ctx.stroke();
      if (label) {
        ctx.setLineDash([]);
        ctx.fillStyle = color;
        ctx.font = '10px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(label, px, chartArea.top - 2 >= 10 ? chartArea.top + 10 : chartArea.top + 10);
      }
      ctx.restore();
    },
  };
}
