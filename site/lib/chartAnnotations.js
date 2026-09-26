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

// Decorative markers only: a small tick + dot per decision, colored by action. The actual
// `reason` text lives in an adjacent HTML table, not a hover tooltip (avoids synthetic-dataset
// complexity for a personal, single-user tool).
export function decisionMarker({ points, colorFor }) {
  return {
    id: 'decisionMarker',
    afterDatasetsDraw(chart) {
      const { ctx, chartArea, scales } = chart;
      ctx.save();
      for (const p of points) {
        const px = scales.x.getPixelForValue(p.week + 0.5);
        if (px < chartArea.left || px > chartArea.right) continue;
        ctx.fillStyle = colorFor(p.action);
        ctx.beginPath();
        ctx.moveTo(px, chartArea.top);
        ctx.lineTo(px, chartArea.top + 8);
        ctx.lineWidth = 2;
        ctx.strokeStyle = colorFor(p.action);
        ctx.stroke();
        ctx.arc(px, chartArea.top + 8, 3, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    },
  };
}
