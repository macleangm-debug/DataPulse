import React from 'react';

// Sample data for charts preview
export const SAMPLE_BAR_DATA = [
  { name: 'Q1', value: 65 },
  { name: 'Q2', value: 85 },
  { name: 'Q3', value: 45 },
  { name: 'Q4', value: 75 },
  { name: 'Q5', value: 55 },
];

// Bar Chart Component (SVG preview)
export const BarChartPreview = ({ theme, data = SAMPLE_BAR_DATA }) => {
  const maxValue = Math.max(...data.map(d => d.value));
  
  return (
    <div className="h-40 flex items-end justify-center gap-3 p-4">
      {data.map((item, i) => (
        <div key={i} className="flex flex-col items-center gap-1">
          <div 
            className="w-10 rounded-t transition-all duration-300"
            style={{ 
              height: `${(item.value / maxValue) * 100}px`,
              backgroundColor: i % 2 === 0 ? theme.primary : theme.accent 
            }}
          />
          <span className="text-xs text-gray-500">{item.name}</span>
        </div>
      ))}
    </div>
  );
};

// Pie Chart Component (SVG preview)
export const PieChartPreview = ({ theme }) => {
  return (
    <div className="h-40 flex items-center justify-center">
      <svg viewBox="0 0 100 100" className="w-32 h-32">
        {/* Primary slice - 60% */}
        <circle
          cx="50" cy="50" r="40"
          fill="transparent"
          stroke={theme.primary}
          strokeWidth="20"
          strokeDasharray="150.8 251.33"
          transform="rotate(-90 50 50)"
        />
        {/* Accent slice - 25% */}
        <circle
          cx="50" cy="50" r="40"
          fill="transparent"
          stroke={theme.accent}
          strokeWidth="20"
          strokeDasharray="62.83 251.33"
          strokeDashoffset="-150.8"
          transform="rotate(-90 50 50)"
        />
        {/* Secondary slice - 15% */}
        <circle
          cx="50" cy="50" r="40"
          fill="transparent"
          stroke={theme.secondary}
          strokeWidth="20"
          strokeDasharray="37.7 251.33"
          strokeDashoffset="-213.63"
          transform="rotate(-90 50 50)"
        />
      </svg>
    </div>
  );
};

// Line Chart Component (SVG preview)
export const LineChartPreview = ({ theme }) => {
  const points = [10, 40, 30, 60, 45, 70, 55];
  const width = 200;
  const height = 100;
  const padding = 10;
  
  const maxVal = Math.max(...points);
  const pointsStr = points.map((p, i) => {
    const x = padding + (i / (points.length - 1)) * (width - 2 * padding);
    const y = height - padding - (p / maxVal) * (height - 2 * padding);
    return `${x},${y}`;
  }).join(' ');
  
  return (
    <div className="h-40 flex items-center justify-center">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-32">
        <polyline
          fill="none"
          stroke={theme.primary}
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
          points={pointsStr}
        />
        {points.map((p, i) => {
          const x = padding + (i / (points.length - 1)) * (width - 2 * padding);
          const y = height - padding - (p / maxVal) * (height - 2 * padding);
          return (
            <circle key={i} cx={x} cy={y} r="4" fill={theme.accent} />
          );
        })}
      </svg>
    </div>
  );
};

// Data Table Preview
export const DataTablePreview = ({ theme }) => {
  const tableData = [
    { category: 'North Region', value: '245,000', share: '32%' },
    { category: 'South Region', value: '189,000', share: '24%' },
    { category: 'East Region', value: '156,000', share: '21%' },
    { category: 'West Region', value: '178,000', share: '23%' },
  ];
  
  return (
    <div className="overflow-hidden rounded-lg border border-gray-200">
      <div 
        className="grid grid-cols-3 text-xs font-semibold text-white"
        style={{ backgroundColor: theme.primary }}
      >
        <div className="p-2 border-r border-white/20">Category</div>
        <div className="p-2 border-r border-white/20 text-right">Value</div>
        <div className="p-2 text-right">Share</div>
      </div>
      {tableData.map((row, i) => (
        <div 
          key={i} 
          className={`grid grid-cols-3 text-xs ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}
        >
          <div className="p-2 border-r border-gray-100 text-gray-700">{row.category}</div>
          <div className="p-2 border-r border-gray-100 text-right text-gray-600">{row.value}</div>
          <div className="p-2 text-right font-semibold" style={{ color: theme.accent }}>{row.share}</div>
        </div>
      ))}
    </div>
  );
};
