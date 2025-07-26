export interface ExcelData {
  sheets: { [key: string]: any[] };
  fileName: string;
  uploadedAt: string;
}

export interface ChatMessage {
  id: string;
  type: 'user' | 'assistant';
  content: string;
  timestamp: string;
  chart?: ChartData;
  showChart?: boolean;
}

export interface ChartData {
  type: 'bar' | 'line' | 'pie' | 'area';
  data: any[];
  config: {
    xKey?: string;
    yKey?: string;
    dataKey?: string;
    nameKey?: string;
    title: string;
    xLabel?: string;
    yLabel?: string;
  };
}

export interface ParsedExcelData {
  data: any[];
  headers: string[];
  sheetName: string;
}