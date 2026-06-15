export const POINT_HEATMAP_THEMES = {
  temperature: {
    label: '温度',
    unit: '°C',
    min: -20,
    max: 40,
    lowColor: '#2F80ED',
    highColor: '#E53935',
    emptyColor: '#8A8F98',
    staleToleranceMs: 10 * 60 * 1000
  },
  humidity: {
    label: '湿度',
    unit: '%',
    min: 0,
    max: 100,
    lowColor: '#E53935',
    highColor: '#2F80ED',
    emptyColor: '#8A8F98',
    staleToleranceMs: 10 * 60 * 1000
  },
  illuminance: {
    label: '照度',
    unit: 'lx',
    min: 0,
    max: 1000,
    lowColor: '#455A64',
    highColor: '#FFD54F',
    emptyColor: '#8A8F98',
    staleToleranceMs: 10 * 60 * 1000
  },
  displacement: {
    label: '位移',
    unit: 'mm',
    min: 0,
    max: 100,
    lowColor: '#81C784',
    highColor: '#D32F2F',
    emptyColor: '#8A8F98',
    staleToleranceMs: 10 * 60 * 1000
  },
  vibration: {
    label: '震动',
    unit: 'mm/s',
    min: 0,
    max: 50,
    lowColor: '#4DB6AC',
    highColor: '#C2185B',
    emptyColor: '#8A8F98',
    staleToleranceMs: 10 * 60 * 1000
  },
  energy: {
    label: '能耗',
    unit: 'kWh',
    min: 0,
    max: 100,
    lowColor: '#AED581',
    highColor: '#F57C00',
    emptyColor: '#8A8F98',
    staleToleranceMs: 15 * 60 * 1000
  },
  electricity: {
    label: '电量',
    unit: 'kWh',
    min: 0,
    max: 100,
    lowColor: '#FFF176',
    highColor: '#F57C00',
    emptyColor: '#8A8F98',
    staleToleranceMs: 15 * 60 * 1000
  },
  water: {
    label: '用水',
    unit: 'm³',
    min: 0,
    max: 100,
    lowColor: '#B3E5FC',
    highColor: '#0277BD',
    emptyColor: '#8A8F98',
    staleToleranceMs: 15 * 60 * 1000
  },
  gas: {
    label: '燃气',
    unit: 'm³',
    min: 0,
    max: 100,
    lowColor: '#CFD8DC',
    highColor: '#6D4C41',
    emptyColor: '#8A8F98',
    staleToleranceMs: 15 * 60 * 1000
  }
};

export const getPointHeatmapTheme = (pointType) => (
  POINT_HEATMAP_THEMES[pointType] || null
);

export const hexToRgb = (hex) => {
  const normalized = String(hex || '').replace('#', '');
  const value = Number.parseInt(normalized.length === 3
    ? normalized.split('').map((char) => char + char).join('')
    : normalized, 16);
  if (!Number.isFinite(value)) return { r: 138, g: 143, b: 152 };
  return {
    r: (value >> 16) & 255,
    g: (value >> 8) & 255,
    b: value & 255
  };
};

export const interpolateThemeColor = (value, theme) => {
  if (!theme || !Number.isFinite(Number(value))) {
    return hexToRgb(theme?.emptyColor);
  }
  const min = Number(theme.min);
  const max = Number(theme.max);
  const span = max - min || 1;
  const ratio = Math.max(0, Math.min(1, (Number(value) - min) / span));
  const low = hexToRgb(theme.lowColor);
  const high = hexToRgb(theme.highColor);
  return {
    r: Math.round(low.r + (high.r - low.r) * ratio),
    g: Math.round(low.g + (high.g - low.g) * ratio),
    b: Math.round(low.b + (high.b - low.b) * ratio)
  };
};

export const findNearestSeriesPoint = (series, timeMs, toleranceMs = Infinity) => {
  if (!Array.isArray(series) || !series.length || !Number.isFinite(Number(timeMs))) return null;
  let best = null;
  let bestDelta = Infinity;
  series.forEach((point) => {
    const timestamp = Number(point?.timestamp);
    const value = Number(point?.value);
    if (!Number.isFinite(timestamp) || !Number.isFinite(value)) return;
    const delta = Math.abs(timestamp - Number(timeMs));
    if (delta < bestDelta) {
      best = { ...point, timestamp, value, delta };
      bestDelta = delta;
    }
  });
  return best && bestDelta <= toleranceMs ? best : null;
};
