import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { TelemetryData } from '../types';

interface TelemetryChartProps {
  data: TelemetryData[];
  dataKey: keyof TelemetryData;
  color: string;
  color2?: string; // Comparison color
  label: string;
}

const TelemetryChart: React.FC<TelemetryChartProps> = ({ data, dataKey, color, label }) => {
  return (
    <div className="w-full h-48 bg-slate-800/50 rounded border border-slate-700 p-2 mb-2">
      <h4 className="text-xs font-bold text-slate-400 uppercase mb-2 ml-2">{label}</h4>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
          <XAxis dataKey="time" hide />
          <YAxis 
            domain={['auto', 'auto']} 
            tick={{ fill: '#94a3b8', fontSize: 10 }} 
            tickLine={false}
            axisLine={false}
          />
          <Tooltip 
            contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', color: '#fff' }}
            itemStyle={{ color: '#fff' }}
            labelStyle={{ display: 'none' }}
          />
          <Line 
            type="monotone" 
            dataKey={dataKey} 
            stroke={color} 
            strokeWidth={2} 
            dot={false} 
            animationDuration={300}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

export default TelemetryChart;