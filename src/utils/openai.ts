import OpenAI from 'openai';
import { ExcelData, ChartData } from '../types';

export class OpenAIService {
  private openai: OpenAI;

  constructor() {
    const apiKey = import.meta.env.VITE_OPENAI_API_KEY;
    
    if (!apiKey) {
      throw new Error('OpenAI API key not found. Please add VITE_OPENAI_API_KEY to your .env file.');
    }
    
    this.openai = new OpenAI({
      apiKey,
      dangerouslyAllowBrowser: true
    });
  }

  async analyzeData(question: string, data: ExcelData): Promise<{ text: string; chart?: ChartData }> {
    try {
      const dataContext = this.prepareDataContext(data);
      const processedData = this.preprocessQuery(question, data);
      
      const prompt = `
You are an expert data analyst. Analyze the following Excel data and answer the user's question.

Data Context:
File: ${data.fileName}
Sheets and Data:
${dataContext}

${processedData ? `Processed Data for Query:
${processedData}
` : ''}
User Question: ${question}

Instructions:
1. ALWAYS analyze the question to determine if filtering, sorting, or aggregation is needed.
2. Provide a clear, human-readable text summary of your findings. Include specific numbers, percentages, and data points.
3. If the user asks for a visualization, or if the data analysis would strongly benefit from a chart, you MUST include a chart specification.
4. Chart types to consider:
   - Bar charts: for comparisons, rankings, categories (e.g., "Top 5 products by sales").
   - Line charts: for trends over time, continuous data.
   - Pie charts: for proportions of a whole (e.g., "Sales distribution by region").
   - Area charts: for cumulative data or stacked comparisons over time.
5. For Pokemon datasets, recognize common attributes: Attack, Defense, HP, Speed, etc., and create engaging chart titles like "Top 5 Pokemon by Attack Power".
6. CRITICAL: Your response format MUST be as follows:
   - First, provide the complete text summary.
   - After the text, on a new line, add the chart specification block.

Example Response Format:
The top 5 Pokemon by Attack points are:
1. Deoxys with 345 Attack points
2. Mewtwo with 300 Attack points
3. Rampardos with 295 Attack points
4. Archeops with 292 Attack points
5. Slaking with 290 Attack points

CHART_SPEC: {
  "type": "bar",
  "title": "Top 5 Pokemon by Attack Points",
  "data": [{"name":"Deoxys","value":345},{"name":"Mewtwo","value":300},{"name":"Rampardos","value":295},{"name":"Archeops","value":292},{"name":"Slaking","value":290}],
  "xKey": "name",
  "yKey": "value"
}

Answer the question now:`;

      const completion = await this.openai.chat.completions.create({
        model: "gpt-4",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.2,
        max_tokens: 1500
      });

      const response = completion.choices[0]?.message?.content || '';
      return this.parseResponse(response);
    } catch (error) {
      console.error('OpenAI API error:', error);
      throw new Error('Failed to analyze data. Please check your API key and try again.');
    }
  }

  private preprocessQuery(question: string, data: ExcelData): string | null {
    const lowerQuestion = question.toLowerCase();
    
    // Handle aggregation queries
    if (lowerQuestion.includes('sum') || lowerQuestion.includes('total') || lowerQuestion.includes('average') || lowerQuestion.includes('mean')) {
      return this.processAggregationQuery(question, data);
    }
    
    // Handle comparison queries
    if (lowerQuestion.includes('compare') || lowerQuestion.includes('vs') || lowerQuestion.includes('versus') || lowerQuestion.includes('between')) {
      return this.processComparisonQuery(question, data);
    }
    
    // Handle trend queries
    if (lowerQuestion.includes('trend') || lowerQuestion.includes('over time') || lowerQuestion.includes('growth') || lowerQuestion.includes('change')) {
      return this.processTrendQuery(question, data);
    }
    
    // Handle "top N" queries
    const topMatch = lowerQuestion.match(/top\s+(\d+)/);
    if (topMatch) {
      const topN = parseInt(topMatch[1]);
      return this.processTopNQuery(question, data, topN);
    }
    
    // Handle "bottom N" queries
    const bottomMatch = lowerQuestion.match(/bottom\s+(\d+)|worst\s+(\d+)|lowest\s+(\d+)/);
    if (bottomMatch) {
      const bottomN = parseInt(bottomMatch[1] || bottomMatch[2] || bottomMatch[3]);
      return this.processBottomNQuery(question, data, bottomN);
    }
    
    // Handle filtering queries
    if (lowerQuestion.includes('filter') || lowerQuestion.includes('where') || lowerQuestion.includes('only')) {
      return this.processFilterQuery(question, data);
    }
    
    // Handle sorting queries
    if (lowerQuestion.includes('sort') || lowerQuestion.includes('order') || lowerQuestion.includes('rank')) {
      return this.processSortQuery(question, data);
    }
    
    return null;
  }
  
  private processAggregationQuery(question: string, data: ExcelData): string {
    let result = 'Aggregation Analysis:\n\n';
    
    Object.entries(data.sheets).forEach(([sheetName, rows]) => {
      if (rows.length === 0) return;
      
      const headers = Object.keys(rows[0]);
      const numericColumns = headers.filter(header => 
        rows.some(row => !isNaN(parseFloat(row[header])) && isFinite(row[header]))
      );
      
      if (numericColumns.length > 0) {
        result += `Sheet: ${sheetName}\n`;
        
        numericColumns.forEach(column => {
          const values = rows
            .map(row => parseFloat(row[column]))
            .filter(val => !isNaN(val) && isFinite(val));
          
          if (values.length > 0) {
            const sum = values.reduce((a, b) => a + b, 0);
            const avg = sum / values.length;
            const max = Math.max(...values);
            const min = Math.min(...values);
            
            result += `${column}:\n`;
            result += `  Total: ${sum.toLocaleString()}\n`;
            result += `  Average: ${avg.toFixed(2)}\n`;
            result += `  Maximum: ${max.toLocaleString()}\n`;
            result += `  Minimum: ${min.toLocaleString()}\n`;
            result += `  Count: ${values.length}\n\n`;
          }
        });
      }
    });
    
    return result;
  }
  
  private processComparisonQuery(question: string, data: ExcelData): string {
    let result = 'Comparison Analysis:\n\n';
    
    Object.entries(data.sheets).forEach(([sheetName, rows]) => {
      if (rows.length === 0) return;
      
      const headers = Object.keys(rows[0]);
      const categoryColumns = headers.filter(header => 
        typeof rows[0][header] === 'string' && 
        new Set(rows.map(row => row[header])).size < rows.length * 0.5
      );
      const numericColumns = headers.filter(header => 
        rows.some(row => !isNaN(parseFloat(row[header])) && isFinite(row[header]))
      );
      
      if (categoryColumns.length > 0 && numericColumns.length > 0) {
        const categoryCol = categoryColumns[0];
        const numericCol = this.findRelevantColumn(question, numericColumns) || numericColumns[0];
        
        const grouped = rows.reduce((acc, row) => {
          const category = row[categoryCol];
          const value = parseFloat(row[numericCol]);
          
          if (!isNaN(value) && category) {
            if (!acc[category]) acc[category] = [];
            acc[category].push(value);
          }
          return acc;
        }, {} as Record<string, number[]>);
        
        result += `Sheet: ${sheetName}\nComparison by ${categoryCol} (${numericCol}):\n`;
        
        Object.entries(grouped).forEach(([category, values]) => {
          const sum = values.reduce((a, b) => a + b, 0);
          const avg = sum / values.length;
          result += `${category}: Total=${sum.toLocaleString()}, Average=${avg.toFixed(2)}, Count=${values.length}\n`;
        });
        result += '\n';
      }
    });
    
    return result;
  }
  
  private processTrendQuery(question: string, data: ExcelData): string {
    let result = 'Trend Analysis:\n\n';
    
    Object.entries(data.sheets).forEach(([sheetName, rows]) => {
      if (rows.length === 0) return;
      
      const headers = Object.keys(rows[0]);
      const dateColumns = headers.filter(header => 
        rows.some(row => !isNaN(Date.parse(row[header])))
      );
      const numericColumns = headers.filter(header => 
        rows.some(row => !isNaN(parseFloat(row[header])) && isFinite(row[header]))
      );
      
      if (dateColumns.length > 0 && numericColumns.length > 0) {
        const dateCol = dateColumns[0];
        const numericCol = this.findRelevantColumn(question, numericColumns) || numericColumns[0];
        
        const sortedData = rows
          .filter(row => !isNaN(Date.parse(row[dateCol])) && !isNaN(parseFloat(row[numericCol])))
          .sort((a, b) => new Date(a[dateCol]).getTime() - new Date(b[dateCol]).getTime())
          .map(row => ({
            date: new Date(row[dateCol]).toLocaleDateString(),
            value: parseFloat(row[numericCol])
          }));
        
        result += `Sheet: ${sheetName}\nTrend over time (${dateCol} vs ${numericCol}):\n`;
        sortedData.slice(0, 10).forEach(item => {
          result += `${item.date}: ${item.value.toLocaleString()}\n`;
        });
        result += `\nTotal data points: ${sortedData.length}\n\n`;
      }
    });
    
    return result;
  }
  
  private processTopNQuery(question: string, data: ExcelData, topN: number): string {
    let result = `Top ${topN} Analysis:\n\n`;
    
    Object.entries(data.sheets).forEach(([sheetName, rows]) => {
      if (rows.length === 0) return;
      
      const headers = Object.keys(rows[0]);
      const numericColumns = headers.filter(header => 
        rows.some(row => !isNaN(parseFloat(row[header])) && isFinite(row[header]))
      );
      
      if (numericColumns.length > 0) {
        const relevantColumn = this.findRelevantColumn(question, numericColumns);
        
        if (relevantColumn) {
          const sorted = [...rows]
            .filter(row => row[relevantColumn] != null && row[relevantColumn] !== '')
            .filter(row => !isNaN(parseFloat(row[relevantColumn])) && isFinite(parseFloat(row[relevantColumn])))
            .sort((a, b) => parseFloat(b[relevantColumn]) - parseFloat(a[relevantColumn]))
            .slice(0, topN);
          
          result += `Sheet: ${sheetName}\nTop ${topN} by ${relevantColumn}:\n`;
          sorted.forEach((row, index) => {
            const identifier = this.getRowIdentifier(row, headers);
            const value = parseFloat(row[relevantColumn]);
            result += `${index + 1}. ${identifier}: ${value.toLocaleString()}\n`;
          });
          result += '\n';
        }
      }
    });
    
    return result;
  }
  
  private processBottomNQuery(question: string, data: ExcelData, bottomN: number): string {
    let result = `Bottom ${bottomN} Analysis:\n\n`;
    
    Object.entries(data.sheets).forEach(([sheetName, rows]) => {
      if (rows.length === 0) return;
      
      const headers = Object.keys(rows[0]);
      const numericColumns = headers.filter(header => 
        rows.some(row => !isNaN(parseFloat(row[header])) && isFinite(row[header]))
      );
      
      if (numericColumns.length > 0) {
        const relevantColumn = this.findRelevantColumn(question, numericColumns);
        
        if (relevantColumn) {
          const sorted = [...rows]
            .filter(row => row[relevantColumn] != null && row[relevantColumn] !== '')
            .sort((a, b) => parseFloat(a[relevantColumn]) - parseFloat(b[relevantColumn]))
            .slice(0, bottomN);
          
          result += `Sheet: ${sheetName}\nBottom ${bottomN} by ${relevantColumn}:\n`;
          sorted.forEach((row, index) => {
            const identifier = this.getRowIdentifier(row, headers);
            result += `${index + 1}. ${identifier}: ${row[relevantColumn]}\n`;
          });
          result += '\n';
        }
      }
    });
    
    return result;
  }
  
  private processFilterQuery(question: string, data: ExcelData): string {
    let result = 'Filtered Data Analysis:\n\n';
    
    Object.entries(data.sheets).forEach(([sheetName, rows]) => {
      if (rows.length === 0) return;
      
      let filteredRows = [...rows];
      const headers = Object.keys(rows[0]);
      const filterTerms = this.extractFilterTerms(question);
      
      if (filterTerms.length > 0) {
        filteredRows = rows.filter(row => {
          return filterTerms.some(term => 
            Object.values(row).some(value => 
              String(value).toLowerCase().includes(term.toLowerCase())
            )
          );
        });
      }
      
      result += `Sheet: ${sheetName}\n`;
      result += `Total rows: ${rows.length}, Filtered rows: ${filteredRows.length}\n`;
      
      if (filteredRows.length > 0) {
        result += `Sample filtered data:\n`;
        filteredRows.slice(0, 5).forEach((row, index) => {
          const identifier = this.getRowIdentifier(row, headers);
          result += `${index + 1}. ${identifier}\n`;
        });
      }
      result += '\n';
    });
    
    return result;
  }
  
  private extractFilterTerms(question: string): string[] {
    const terms: string[] = [];
    
    const quotedMatches = question.match(/"([^"]+)"/g);
    if (quotedMatches) {
      terms.push(...quotedMatches.map(match => match.replace(/"/g, '')));
    }
    
    const filterPatterns = [
      /where\s+(\w+)/g,
      /only\s+(\w+)/g,
      /filter\s+by\s+(\w+)/g,
      /containing\s+(\w+)/g
    ];
    
    filterPatterns.forEach(pattern => {
      const matches = question.toLowerCase().match(pattern);
      if (matches) {
        terms.push(...matches.map(match => match.split(/\s+/).pop() || ''));
      }
    });
    
    return terms.filter(term => term.length > 2);
  }
  
  private processSortQuery(question: string, data: ExcelData): string {
    let result = 'Sorted Data Analysis:\n\n';
    
    Object.entries(data.sheets).forEach(([sheetName, rows]) => {
      if (rows.length === 0) return;
      
      const headers = Object.keys(rows[0]);
      const numericColumns = headers.filter(header => 
        rows.some(row => !isNaN(parseFloat(row[header])) && isFinite(row[header]))
      );
      
      if (numericColumns.length > 0) {
        const relevantColumn = this.findRelevantColumn(question, numericColumns);
        
        if (relevantColumn) {
          const isAscending = question.toLowerCase().includes('ascending') || 
                             question.toLowerCase().includes('lowest') ||
                             question.toLowerCase().includes('smallest');
          
          const sorted = [...rows]
            .filter(row => row[relevantColumn] != null && row[relevantColumn] !== '')
            .sort((a, b) => {
              const aVal = parseFloat(a[relevantColumn]);
              const bVal = parseFloat(b[relevantColumn]);
              return isAscending ? aVal - bVal : bVal - aVal;
            });
          
          result += `Sheet: ${sheetName}\nSorted by ${relevantColumn} (${isAscending ? 'ascending' : 'descending'}):\n`;
          sorted.slice(0, 20).forEach((row, index) => {
            const identifier = this.getRowIdentifier(row, headers);
            result += `${index + 1}. ${identifier}: ${row[relevantColumn]}\n`;
          });
          result += '\n';
        }
      }
    });
    
    return result;
  }
  
  private findRelevantColumn(question: string, columns: string[]): string | null {
    const lowerQuestion = question.toLowerCase();
    
    const keywords = {
      'attack': ['attack', 'atk', 'att', 'physical attack', 'physical_attack'],
      'defense': ['defense', 'def', 'defence', 'physical defense', 'physical_defense'],
      'hp': ['hp', 'health', 'hitpoints', 'hit points', 'health points'],
      'speed': ['speed', 'spd', 'velocity', 'agility'],
      'special attack': ['special attack', 'sp attack', 'sp_attack', 'spatk', 'special_attack'],
      'special defense': ['special defense', 'sp defense', 'sp_defense', 'spdef', 'special_defense'],
      'type': ['type', 'pokemon_type', 'element', 'category'],
      'name': ['name', 'pokemon', 'pokemon_name', 'title'],
      'generation': ['generation', 'gen', 'series'],
      'legendary': ['legendary', 'legend', 'rare'],
      'sales': ['sales', 'revenue', 'amount', 'total', 'value', 'sold'],
      'price': ['price', 'cost', 'amount', 'value', 'rate'],
      'quantity': ['quantity', 'qty', 'count', 'number', 'units'],
      'revenue': ['revenue', 'sales', 'income', 'earnings', 'turnover'],
      'profit': ['profit', 'margin', 'earnings', 'gain'],
      'score': ['score', 'rating', 'points', 'grade'],
      'age': ['age', 'years', 'old'],
      'weight': ['weight', 'mass', 'kg', 'pounds'],
      'height': ['height', 'length', 'tall', 'cm'],
      'date': ['date', 'time', 'when', 'day', 'month', 'year'],
      'category': ['category', 'type', 'class', 'group'],
      'region': ['region', 'area', 'location', 'place'],
      'product': ['product', 'item', 'goods'],
      'customer': ['customer', 'client', 'user'],
      'order': ['order', 'purchase', 'transaction']
    };
    
    for (const [keyword, variations] of Object.entries(keywords)) {
      if (lowerQuestion.includes(keyword)) {
        for (const variation of variations) {
          const matchingColumn = columns.find(col => 
            col.toLowerCase().includes(variation)
          );
          if (matchingColumn) return matchingColumn;
        }
      }
    }
    
    return columns[0] || null;
  }
  
  private getRowIdentifier(row: any, headers: string[]): string {
    const identifierColumns = ['name', 'pokemon', 'pokemon_name', 'title', 'product', 'item', 'category', 'region', 'id'];
    
    for (const idCol of identifierColumns) {
      const matchingHeader = headers.find(h => h.toLowerCase().includes(idCol));
      if (matchingHeader && row[matchingHeader]) {
        return row[matchingHeader];
      }
    }
    
    const firstTextColumn = headers.find(h => 
      isNaN(parseFloat(row[h])) || !isFinite(row[h])
    );
    
    return firstTextColumn ? row[firstTextColumn] : `Row ${Math.random().toString(36).substr(2, 5)}`;
  }
  private prepareDataContext(data: ExcelData): string {
    let context = '';
    
    Object.entries(data.sheets).forEach(([sheetName, rows]) => {
      context += `\nSheet: ${sheetName}\n`;
      context += `Columns: ${Object.keys(rows[0] || {}).join(', ')}\n`;
      context += `Sample Data (first 5 rows):\n`;
      
      rows.slice(0, 5).forEach((row, index) => {
        context += `Row ${index + 1}: ${JSON.stringify(row)}\n`;
      });
      
      context += `Total rows: ${rows.length}\n`;
    });
    
    return context;
  }

  private parseResponse(response: string): { text: string; chart?: ChartData } {
    const chartSpecIdentifier = 'CHART_SPEC:';
    const chartSpecIndex = response.indexOf(chartSpecIdentifier);

    if (chartSpecIndex !== -1) {
      const textResponse = response.substring(0, chartSpecIndex).trim();
      const chartSpecString = response.substring(chartSpecIndex + chartSpecIdentifier.length).trim();
      
      try {
        const chartSpec = JSON.parse(chartSpecString);
        
        const chartData: ChartData = {
          type: chartSpec.type,
          data: chartSpec.data,
          config: {
            xKey: chartSpec.xKey,
            yKey: chartSpec.yKey,
            dataKey: chartSpec.dataKey,
            nameKey: chartSpec.nameKey,
            title: chartSpec.title,
            xLabel: chartSpec.xLabel,
            yLabel: chartSpec.yLabel
          }
        };
        
        return { text: textResponse, chart: chartData };
      } catch (error) {
        console.error('Failed to parse chart specification:', error);
        return { text: response };
      }
    }
    
    return { text: response };
  }
}