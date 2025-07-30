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
      // This now intelligently decides WHEN to pre-process.
      const processedData = this.preprocessQuery(question, data);

      const prompt = `
You are an expert data analyst. A user asked a question about a dataset.
I may have already pre-processed the data based on their query. If so, the pre-analyzed result or a specific data payload for a chart will be in the "Processed Data for Query" section. If that section is empty, you must analyze the user's question from scratch using the raw Data Context.

Data Context:
File: ${data.fileName}
Sheets and Data (first 5 rows for context):
${dataContext}

${processedData ? `Processed Data for Query:
This is the relevant data subset or pre-built chart payload to answer the user's question. Use this as your primary source.
${processedData}
` : ''}
User Question: ${question}

Instructions:
1.  Your main task is to use the provided data (either pre-processed or from the Data Context) to formulate a clear, human-readable text summary that directly answers the user's question.
2.  **CRITICAL FORMATTING:** If the result is a list of items (e.g., a top 5 list), you **MUST** format the text response as a bulleted or numbered list. DO NOT write it as a single long sentence.
3.  **CRITICAL FOR CHARTS:**
    - If a 'Data for Chart' section is provided in the pre-processing, you **MUST** use it to generate the CHART_SPEC. Copy all fields ('type', 'title', 'data', keys) directly.
    - If no 'Data for Chart' is provided, but the user asks for a visualization (e.g., "pie chart," "bar chart"), you MUST create the chart spec yourself by analyzing the Data Context. For a pie chart, you will likely need to aggregate the data first (e.g., sum scores by player).
4.  Your response format MUST be:
   - First, the complete text summary.
   - After the text, on a new line, the chart specification block.

Example for "pie chart of scores by player" (when no pre-processing is done):
Here is the distribution of total scores by player.

CHART_SPEC: {
  "type": "pie",
  "title": "Total Scores by Player",
  "data": [{"Player": "Player A", "Score": 1830}, {"Player": "Player B", "Score": 1795}],
  "nameKey": "Player",
  "dataKey": "Score"
}

Answer the question now:`;

      const completion = await this.openai.chat.completions.create({
        model: "gpt-4",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.1,
        max_tokens: 1500
      });

      const response = completion.choices[0]?.message?.content || '';
      return this.parseResponse(response);
    } catch (error) {
      console.error('OpenAI API error:', error);
      throw new Error('Failed to analyze data. Please check your API key and try again.');
    }
  }

  /**
   * RE-ARCHITECTED: This function now acts as an intelligent router. It runs custom pre-processing
   * for complex analytical queries but intentionally does nothing for simple visualization requests,
   * allowing the powerful base AI model to handle them.
   */
  private preprocessQuery(question: string, data: ExcelData): string | null {
    const lowerQuestion = question.toLowerCase();
    
    // --- INTELLIGENT ROUTING ---
    const isSimpleChartRequest = /(pie|bar|line)\s*chart/.test(lowerQuestion);
    const isComplexQuery = /(top|bottom|highest|lowest|most|least|filter|sort|order|rank)/.test(lowerQuestion);

    // If it's just a visualization request without complex analysis, let the AI handle it.
    if (isSimpleChartRequest && !isComplexQuery) {
        return null;
    }
    // --- END OF ROUTING ---

    // Otherwise, proceed with our custom pre-processing pipeline for analytical queries.
    const maxMinResult = this.processMaxMinQuery(question, data);
    if (maxMinResult) return maxMinResult;
    
    const topMatch = lowerQuestion.match(/top\s+(\d+)/);
    if (topMatch) return this.processTopNQuery(question, data, parseInt(topMatch[1]));
    
    const bottomMatch = lowerQuestion.match(/bottom\s+(\d+)|worst\s+(\d+)|lowest\s+(\d+)/);
    if (bottomMatch) return this.processBottomNQuery(question, data, parseInt(bottomMatch[1] || bottomMatch[2] || bottomMatch[3]));
    
    const allHeaders = [...new Set(Object.values(data.sheets).flatMap(rows => rows.length > 0 ? Object.keys(rows[0]) : []))];
    if (this.extractNumericFilterCondition(question, allHeaders)) return this.processFilterQuery(question, data, allHeaders);

    // Other handlers can be added here if needed.
    
    return null;
  }
  
  // This is a simplified version now, only handling numeric filters as other cases are routed.
  private processFilterQuery(question: string, data: ExcelData, headers: string[]): string | null {
    const numericCondition = this.extractNumericFilterCondition(question, headers);
    if (!numericCondition) return null;

    let result = 'Filtered Data Analysis:\n\n';
    let analysisFound = false;

    Object.entries(data.sheets).forEach(([sheetName, rows]) => {
        if (rows.length === 0) return;
        const { column, operator, value } = numericCondition;
        const filteredRows = rows.filter(row => {
            const rowValue = parseFloat(row[column]);
            if (isNaN(rowValue)) return false;
            switch (operator) {
                case '>': return rowValue > value;
                case '<': return rowValue < value;
                case '>=': return rowValue >= value;
                case '<=': return rowValue <= value;
                case '==': return rowValue === value;
                default: return false;
            }
        });

        if (filteredRows.length > 0) {
            analysisFound = true;
            const identifierColumn = this.getIdentifierColumnName(filteredRows, headers) || headers[0];
            const chartPayload = { type: 'bar', title: `Data where ${column} ${operator} ${value}`, data: filteredRows, xKey: identifierColumn, yKey: column };
            result += `Sheet: ${sheetName}\nAnalysis: Filtered for rows where '${column}' ${operator} ${value}.\n`;
            result += `Result:\n${JSON.stringify(filteredRows.slice(0, 20))}\n\n`; // Show a sample
            result += `Data for Chart:\n${JSON.stringify(chartPayload)}\n`;
        }
    });
    return analysisFound ? result : null;
  }

  // The rest of the specialized processors are still here and work as intended.
  
  private processMaxMinQuery(question: string, data: ExcelData): string | null {
    // This implementation remains correct for its specific task.
    const lowerQuestion = question.toLowerCase();
    const maxKeywords = ['most', 'highest', 'maximum', 'biggest', 'largest', 'top'];
    const minKeywords = ['least', 'lowest', 'minimum', 'smallest', 'bottom'];
    const hasKeyword = [...maxKeywords, ...minKeywords].some(kw => lowerQuestion.includes(kw));
    const isTopBottomN = / (top|bottom)\s+\d+/.test(lowerQuestion);
    if (!hasKeyword || isTopBottomN) return null;
    let analysisFound = false;
    let result = 'Maximum/Minimum Value Analysis:\n\n';
    for (const [sheetName, rows] of Object.entries(data.sheets)) {
        if (rows.length === 0) continue;
        const headers = Object.keys(rows[0]);
        const numericColumns = headers.filter(h => rows.some(row => row[h] != null && !isNaN(parseFloat(row[h]))));
        const metricColumn = this.findRelevantColumn(lowerQuestion, numericColumns, rows);
        if (!metricColumn) continue;
        const isMaxOperation = maxKeywords.some(kw => lowerQuestion.includes(kw));
        const filter = this.extractFilterEntity(lowerQuestion, headers, rows);
        let workingRows = rows;
        if (filter) {
            workingRows = rows.filter(row => String(row[filter.column] ?? '').toLowerCase().includes(filter.value.toLowerCase()));
        }
        if (workingRows.length === 0) continue;
        let targetRow: any = null;
        let targetValue: number = isMaxOperation ? -Infinity : Infinity;
        for (const row of workingRows) {
            const value = parseFloat(row[metricColumn]);
            if (isNaN(value)) continue;
            if ((isMaxOperation && value > targetValue) || (!isMaxOperation && value < targetValue)) {
                targetRow = row;
                targetValue = value;
            }
        }
        if (targetRow) {
            analysisFound = true;
            const identifier = this.getRowIdentifier(targetRow, headers);
            const xAxisLabel = filter ? filter.column : "Identifier";
            const chartPayload = { type: 'bar', title: `${isMaxOperation ? 'Highest' : 'Lowest'} ${metricColumn} for ${identifier}`, data: [{ [xAxisLabel]: identifier, [metricColumn]: targetValue }], xKey: xAxisLabel, yKey: metricColumn };
            result += `Sheet: ${sheetName}\nAnalysis: Finding the ${isMaxOperation ? 'maximum' : 'minimum'} of '${metricColumn}'${filter ? ` for '${filter.value}'` : ''}.\n`;
            result += `Result: The value is ${targetValue}.\n\n`;
            result += `Data for Chart:\n${JSON.stringify(chartPayload)}\n`;
        }
    }
    return analysisFound ? result : null;
  }

  private processTopNQuery(question: string, data: ExcelData, topN: number): string {
    // This implementation remains correct for its specific task.
    let result = `Top ${topN} Analysis:\n\n`;
    let analysisFound = false;
    for (const [sheetName, rows] of Object.entries(data.sheets)) {
      if (rows.length === 0) continue;
      const headers = Object.keys(rows[0]);
      const numericColumns = headers.filter(header => rows.some(row => !isNaN(parseFloat(row[header]))));
      if (numericColumns.length > 0) {
        const relevantColumn = this.findRelevantColumn(question, numericColumns, rows);
        if (relevantColumn) {
          analysisFound = true;
          const sorted = [...rows].filter(row => row[relevantColumn] != null && !isNaN(parseFloat(row[relevantColumn]))).sort((a, b) => parseFloat(b[relevantColumn]) - parseFloat(a[relevantColumn])).slice(0, topN);
          const identifierColumn = this.getIdentifierColumnName(sorted, headers) || headers[0];
          const chartPayload = { type: 'bar', title: `Top ${topN} by ${relevantColumn}`, data: sorted, xKey: identifierColumn, yKey: relevantColumn, };
          result += `Sheet: ${sheetName}\nAnalysis: Finding top ${topN} rows by '${relevantColumn}'.\n`;
          result += `Result:\n${JSON.stringify(sorted)}\n\n`;
          result += `Data for Chart:\n${JSON.stringify(chartPayload)}\n`;
        }
      }
    }
    return analysisFound ? result : '';
  }

  private processBottomNQuery(question: string, data: ExcelData, bottomN: number): string {
    // Implementation similar to processTopNQuery, but sorts ascending for bottom N
    let result = `Bottom ${bottomN} Analysis:\n\n`;
    let analysisFound = false;
    for (const [sheetName, rows] of Object.entries(data.sheets)) {
      if (rows.length === 0) continue;
      const headers = Object.keys(rows[0]);
      const numericColumns = headers.filter(header => rows.some(row => !isNaN(parseFloat(row[header]))));
      if (numericColumns.length > 0) {
        const relevantColumn = this.findRelevantColumn(question, numericColumns, rows);
        if (relevantColumn) {
          analysisFound = true;
          const sorted = [...rows].filter(row => row[relevantColumn] != null && !isNaN(parseFloat(row[relevantColumn]))).sort((a, b) => parseFloat(a[relevantColumn]) - parseFloat(b[relevantColumn])).slice(0, bottomN);
          const identifierColumn = this.getIdentifierColumnName(sorted, headers) || headers[0];
          const chartPayload = { type: 'bar', title: `Bottom ${bottomN} by ${relevantColumn}`, data: sorted, xKey: identifierColumn, yKey: relevantColumn, };
          result += `Sheet: ${sheetName}\nAnalysis: Finding bottom ${bottomN} rows by '${relevantColumn}'.\n`;
          result += `Result:\n${JSON.stringify(sorted)}\n\n`;
          result += `Data for Chart:\n${JSON.stringify(chartPayload)}\n`;
        }
      }
    }
    return analysisFound ? result : '';
  }
  
  // --- HELPER FUNCTIONS ---

  private getIdentifierColumnName(rows: any[], headers: string[]): string | null {
      if (rows.length === 0) return null;
      const firstRow = rows[0];
      const identifierColumns = ['name', 'player', 'pokemon', 'title', 'product', 'item', 'id'];
      for (const idCol of identifierColumns) {
        const matchingHeader = headers.find(h => h.toLowerCase().includes(idCol));
        if (matchingHeader && firstRow[matchingHeader]) return matchingHeader;
      }
      const firstTextColumn = headers.find(h => typeof firstRow[h] === 'string' && isNaN(parseFloat(firstRow[h])));
      return firstTextColumn || null;
  }

  private extractFilterEntity(question: string, headers: string[], rows: any[]): { column: string; value: string } | null {
    const textColumns = headers.filter(h => typeof rows[0]?.[h] === 'string');
    const match = question.match(/(?:of|for|in|by)\s+([\w\s\.'"-]+)/);
    if (!match || !match[1]) return null;
    const queryEntity = match[1].trim();
    if (!queryEntity) return null;
    for (const col of textColumns) {
        if (rows.some(row => String(row[col] ?? '').toLowerCase().includes(queryEntity.toLowerCase()))) {
            return { column: col, value: queryEntity };
        }
    }
    return null;
  }
  
  private findRelevantColumn(question: string, columns: string[], rows: any[]): string | null {
    for (const col of columns) if (question.includes(col.toLowerCase())) return col;
    const keywords = {score: 'score', runs: 'runs', century: 'century', centuries: 'century', attack: 'Attack', defense: 'Defense', hp: 'HP', speed: 'Speed', sales: 'Sales', price: 'Price', revenue: 'Revenue'} as const;
    for(const keyword in keywords) {
        if(Object.prototype.hasOwnProperty.call(keywords, keyword)) {
            if(question.includes(keyword)) {
                const colName = columns.find(c => c.toLowerCase().includes((keywords as Record<string, string>)[keyword].toLowerCase()));
                if(colName) return colName;
            }
        }
    }
    if (rows.length > 0) {
      const firstRow = rows[0];
      const numericCols = columns.filter(c => firstRow[c] != null && !isNaN(parseFloat(firstRow[c])));
      return numericCols.length > 0 ? numericCols[0] : null;
    }
    return null;
  }
  
  private getRowIdentifier(row: any, headers: string[]): string {
    const identifierColumns = ['name', 'player', 'pokemon', 'title', 'product', 'item', 'id'];
    for (const idCol of identifierColumns) {
      const matchingHeader = headers.find(h => h.toLowerCase().includes(idCol));
      if (matchingHeader && row[matchingHeader]) return row[matchingHeader];
    }
    const firstTextColumn = headers.find(h => typeof row[h] === 'string' && isNaN(parseFloat(row[h])));
    return firstTextColumn ? row[firstTextColumn] : `Row with ${headers[1]}: ${row[headers[1]]}`;
  }

  private extractNumericFilterCondition(question: string, headers: string[]): { column: string; operator: string; value: number } | null {
    const lowerQ = question.toLowerCase();
    const operators = { '>': ['>', 'above', 'over', 'greater than', 'more than'], '<': ['<', 'below', 'under', 'less than'], '>=': ['>=', 'at least', 'not less than'], '<=': ['<=', 'at most', 'not more than'], '==': ['==', '=', 'is', 'equal to', 'equals'], };
    for (const header of headers) {
        if (header.length < 1) continue;
        for (const [symbol, words] of Object.entries(operators)) {
            for (const word of words) {
                const p1 = new RegExp(`\\b${header.toLowerCase()}\\s+${word}\\s+(\\d+\\.?\\d*)\\b`);
                const m1 = lowerQ.match(p1);
                if (m1) return { column: header, operator: symbol, value: parseFloat(m1[1]) };
                const p2 = new RegExp(`\\b${word}\\s+(\\d+\\.?\\d*)\\s+${header.toLowerCase()}`);
                const m2 = lowerQ.match(p2);
                if (m2) return { column: header, operator: symbol, value: parseFloat(m2[1]) };
            }
        }
    }
    return null;
  }

  private prepareDataContext(data: ExcelData): string {
    let context = '';
    Object.entries(data.sheets).forEach(([sheetName, rows]) => {
      context += `\nSheet: ${sheetName}\n`;
      if (rows.length > 0) {
        context += `Columns: ${Object.keys(rows[0]).join(', ')}\nSample Data (first 3 rows):\n${JSON.stringify(rows.slice(0, 3))}\n`;
      }
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
        return {
          text: textResponse,
          chart: {
            type: chartSpec.type,
            data: chartSpec.data,
            config: {
              xKey: chartSpec.xKey,
              yKey: chartSpec.yKey,
              dataKey: chartSpec.dataKey,
              nameKey: chartSpec.nameKey,
              title: chartSpec.title,
            }
          }
        };
      } catch (error) {
        console.error('Failed to parse chart specification:', error, chartSpecString);
        return { text: response };
      }
    }
    return { text: response };
  }
}