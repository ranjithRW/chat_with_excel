import React from 'react';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  AreaChart,
  Area,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';
import { BarChart3, PieChart as PieChartIcon } from 'lucide-react';
import { ChartData } from '../types';

interface ChartRendererProps {
  chartData: ChartData;
  currentChartType?: 'bar' | 'line' | 'pie' | 'area';
  onChartTypeChange?: (type: 'bar' | 'line' | 'pie' | 'area') => void;
}

const COLORS = [
  '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6',
  '#06B6D4', '#84CC16', '#F97316', '#EC4899', '#6366F1'
];

// --- MODIFIED: Function signature now accepts all props ---
export const ChartRenderer: React.FC<ChartRendererProps> = ({ 
  chartData,
  currentChartType,
  onChartTypeChange 
}) => {
  const { data, config } = chartData;
  const activeChartType = currentChartType || chartData.type;

  // Custom label formatter for better readability
  const formatLabel = (value: any) => {
    if (typeof value === 'string' && value.length > 15) {
      return value.substring(0, 12) + '...';
    }
    return value;
  };

  // Custom tooltip formatter
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg">
          <p className="font-medium text-gray-900">{label}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} style={{ color: entry.color }}>
              {`${entry.name}: ${entry.value.toLocaleString()}`}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  const renderChart = () => {
    switch (activeChartType) {
      case 'bar':
        return (
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey={config.xKey} 
                angle={-45}
                textAnchor="end"
                height={80}
                interval={0}
                tickFormatter={formatLabel}
              />
              <YAxis />
              <Tooltip content={<CustomTooltip />} />
              <Legend />
              <Bar dataKey={config.yKey} fill="#3B82F6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        );

      case 'line':
        return (
          <ResponsiveContainer width="100%" height={400}>
            <LineChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey={config.xKey} tickFormatter={formatLabel} />
              <YAxis />
              <Tooltip content={<CustomTooltip />} />
              <Legend />
              <Line 
                type="monotone" 
                dataKey={config.yKey} 
                stroke="#3B82F6" 
                strokeWidth={2}
                dot={{ fill: '#3B82F6' }}
              />
            </LineChart>
          </ResponsiveContainer>
        );

      case 'pie':
        // Convert bar chart data to pie chart format if needed
        const pieData = data.map(item => ({
          name: item.name || item[config.xKey || 'name'],
          value: item.value || item[config.yKey || 'value']
        }));
        
        return (
          <ResponsiveContainer width="100%" height={400}>
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${formatLabel(name)} ${(percent * 100).toFixed(0)}%`}
                outerRadius={120}
                fill="#8884d8"
                dataKey="value"
                nameKey="name"
              >
                {pieData.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
            </PieChart>
          </ResponsiveContainer>
        );

      case 'area':
        return (
          <ResponsiveContainer width="100%" height={400}>
            <AreaChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey={config.xKey} tickFormatter={formatLabel} />
              <YAxis />
              <Tooltip content={<CustomTooltip />} />
              <Legend />
              <Area 
                type="monotone" 
                dataKey={config.yKey} 
                stroke="#3B82F6" 
                fill="#3B82F6"
                fillOpacity={0.3}
              />
            </AreaChart>
          </ResponsiveContainer>
        );

      default:
        return <div className="text-center py-8 text-gray-500">Unsupported chart type</div>;
    }
  };

  return (
    <div className="bg-white p-4 rounded-lg border">
      <h3 className="text-lg font-semibold text-gray-900 mb-4 text-center">
        {config.title}
      </h3>
      
      {/* Chart Type Toggle Buttons */}
      {onChartTypeChange && (chartData.type === 'bar' || activeChartType === 'bar' || activeChartType === 'pie') && (
        <div className="flex justify-center mb-4 space-x-2">
          <button
            onClick={() => onChartTypeChange('bar')}
            className={`flex items-center space-x-2 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
              activeChartType === 'bar'
                ? 'bg-blue-600 text-white shadow-md'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            <span>Bar Chart</span>
          </button>
          <button
            onClick={() => onChartTypeChange('pie')}
            className={`flex items-center space-x-2 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
              activeChartType === 'pie'
                ? 'bg-blue-600 text-white shadow-md'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            <PieChartIcon className="w-4 h-4" />
            <span>Pie Chart</span>
          </button>
        </div>
      )}
      
      {renderChart()}
      <div className="mt-2 text-xs text-gray-500 text-center">
        {data.length} data points displayed
      </div>
    </div>
  );
};