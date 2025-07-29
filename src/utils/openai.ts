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
You are an expert data analyst. A user asked a question about a dataset.
I may have already pre-processed the data based on their query (e.g., by filtering or sorting it). If so, the processed data will be in the "Processed Data for Query" section.

Data Context:
File: ${data.fileName}
Sheets and Data (first 5 rows for context):
${dataContext}

${processedData ? `Processed Data for Query:
This is the relevant data subset to answer the user's question.
${processedData}
` : ''}
User Question: ${question}

Instructions:
1.  Your main task is to use the provided data (especially the "Processed Data for Query" if available) to formulate a clear, human-readable text summary that directly answers the user's question.
2.  **DO NOT** instruct the user on how to perform the analysis themselves (e.g., "In Excel, you can..."). You have been given the data; your job is to present the answer from it.
3.  If a specific list of items is requested (e.g., "list all pokemon..."), provide that list in a clear format (like a bulleted or numbered list).
4.  If the user asks for a visualization, or if the data analysis would strongly benefit from a chart, you MUST include a chart specification.
5.  For Pokemon datasets, recognize common attributes: Attack, Defense, HP, Speed, etc., and create engaging chart titles.
6.  CRITICAL: Your response format MUST be as follows:
   - First, the complete text summary.
   - After the text, on a new line, the chart specification block.

Example of a good response for "show pokemon above 300 attack points":
Here are the Pokémon with an Attack stat above 300:
- Deoxys (Attack Forme): 514
- Mega Mewtwo X: 416
- Mega Heracross: 387
... and so on for all matching Pokémon.

CHART_SPEC: {
  "type": "bar",
  "title": "Pokémon with Attack Points Above 300",
  "data": [{"Name":"Deoxys (Attack Forme)","Attack":514},{"Name":"Mega Mewtwo X","Attack":416}, {"Name":"Mega Heracross","Attack":387}],
  "xKey": "Name",
  "yKey": "Attack"
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
  
  // --- Start of Altered/New Methods ---

  private preprocessQuery(question: string, data: ExcelData): string | null {
    const lowerQuestion = question.toLowerCase();
    const allHeaders = [...new Set(Object.values(data.sheets).flatMap(rows => rows.length > 0 ? Object.keys(rows[0]) : []))];

    // Check for numeric filtering first as it's very specific
    if (this.extractNumericFilterCondition(question, allHeaders)) {
        return this.processFilterQuery(question, data);
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

    // Handle general filtering keywords
    if (lowerQuestion.includes('filter') || lowerQuestion.includes('where') || lowerQuestion.includes('only') || lowerQuestion.includes('show all')) {
      return this.processFilterQuery(question, data);
    }
    
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

    // Handle sorting queries
    if (lowerQuestion.includes('sort') || lowerQuestion.includes('order') || lowerQuestion.includes('rank')) {
      return this.processSortQuery(question, data);
    }

    return null;
  }

  /**
   * NEW HELPER: Extracts a numeric filtering condition (e.g., "Attack > 300") from the question.
   */
  private extractNumericFilterCondition(question: string, headers: string[]): { column: string; operator: string; value: number } | null {
    const lowerQ = question.toLowerCase();
    const operators = {
        '>': ['>', 'above', 'over', 'greater than', 'more than'],
        '<': ['<', 'below', 'under', 'less than'],
        '>=': ['>=', 'at least', 'not less than'],
        '<=': ['<=', 'at most', 'not more than'],
        '==': ['==', '=', 'is', 'equal to', 'equals'],
    };

    for (const header of headers) {
        // Skip if header is too short or generic
        if (header.length < 2) continue;
        
        for (const [symbol, words] of Object.entries(operators)) {
            for (const word of words) {
                // Pattern: "attack above 300"
                const pattern1 = new RegExp(`\\b${header.toLowerCase()}\\s+${word}\\s+(\\d+\\.?\\d*)\\b`);
                const match1 = lowerQ.match(pattern1);
                if (match1) {
                    return { column: header, operator: symbol, value: parseFloat(match1[1]) };
                }
                
                // Pattern: "above 300 attack points"
                const pattern2 = new RegExp(`\\b${word}\\s+(\\d+\\.?\\d*)\\s+${header.toLowerCase()}`);
                const match2 = lowerQ.match(pattern2);
                if (match2) {
                    return { column: header, operator: symbol, value: parseFloat(match2[1]) };
                }
            }
        }
    }
    return null;
  }

  /**
   * REWRITTEN: This now handles both numeric and text-based filtering.
   */
  private processFilterQuery(question: string, data: ExcelData): string {
    let result = 'Filtered Data Analysis:\n\n';

    Object.entries(data.sheets).forEach(([sheetName, rows]) => {
        if (rows.length === 0) return;

        const headers = Object.keys(rows[0]);
        const numericCondition = this.extractNumericFilterCondition(question, headers);

        let filteredRows = [...rows];
        let filterDescription = "No specific filter applied, showing all data.";

        if (numericCondition) {
            const { column, operator, value } = numericCondition;
            filteredRows = rows.filter(row => {
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
            filterDescription = `Filter Applied: Find rows where '${column}' ${operator} ${value}`;
        } else {
            // Fallback to simple text-based filtering if no numeric condition is found
            const filterTerms = this.extractFilterTerms(question);
            if (filterTerms.length > 0) {
                filteredRows = rows.filter(row => {
                    return filterTerms.some(term =>
                        Object.values(row).some(val =>
                            String(val).toLowerCase().includes(term.toLowerCase())
                        )
                    );
                });
                filterDescription = `Filter Applied: Find rows containing text: ${filterTerms.join(', ')}`;
            }
        }
        
        result += `Sheet: ${sheetName}\n${filterDescription}\n`;
        result += `Total rows: ${rows.length}, Filtered rows: ${filteredRows.length}\n`;

        if (filteredRows.length > 0) {
            result += `Resulting Data (up to 100 rows):\n`;
            // Pass the actual filtered data to the AI
            result += JSON.stringify(filteredRows.slice(0, 100));
        }
        result += '\n';
    });

    return result;
  }

  // --- End of Altered/New Methods ---
  // The rest of your original methods remain below...

  private extractFilterTerms(question: string): string[] {
    const terms: string[] = [];
    const lowerQuestion = question.toLowerCase();

    const quotedMatches = lowerQuestion.match(/"([^"]+)"/g);
    if (quotedMatches) {
      terms.push(...quotedMatches.map(match => match.replace(/"/g, '')));
    }

    // More generic check for terms after keywords
    const keywords = ['filter for', 'containing', 'only', 'where', 'show all'];
    for(const keyword of keywords) {
      if(lowerQuestion.includes(keyword)) {
        const term = lowerQuestion.split(keyword)[1]?.trim().split(' ')[0];
        if (term && term.length > 2) terms.push(term);
      }
    }
    
    // Avoid common words
    const stopWords = new Set(['a', 'an', 'the', 'for', 'in', 'of', 'on', 'with', 'by']);
    return terms.filter(term => !stopWords.has(term));
  }
  
  private processAggregationQuery(question: string, data: ExcelData): string {
    let result = 'Aggregation Analysis:\n\n';
    Object.entries(data.sheets).forEach(([sheetName, rows]) => {
      if (rows.length === 0) return;
      const headers = Object.keys(rows[0]);
      const numericColumns = headers.filter(header => rows.some(row => !isNaN(parseFloat(row[header])) && isFinite(row[header])));
      if (numericColumns.length > 0) {
        result += `Sheet: ${sheetName}\n`;
        numericColumns.forEach(column => {
          const values = rows.map(row => parseFloat(row[column])).filter(val => !isNaN(val) && isFinite(val));
          if (values.length > 0) {
            const sum = values.reduce((a, b) => a + b, 0);
            const avg = sum / values.length;
            result += `${column}: Total=${sum.toLocaleString()}, Average=${avg.toFixed(2)}\n`;
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
      const categoryColumns = headers.filter(header => typeof rows[0][header] === 'string' && new Set(rows.map(row => row[header])).size < rows.length * 0.5);
      const numericColumns = headers.filter(header => rows.some(row => !isNaN(parseFloat(row[header])) && isFinite(row[header])));
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
      const dateColumns = headers.filter(header => rows.some(row => !isNaN(Date.parse(row[header]))));
      const numericColumns = headers.filter(header => rows.some(row => !isNaN(parseFloat(row[header])) && isFinite(row[header])));
      if (dateColumns.length > 0 && numericColumns.length > 0) {
        const dateCol = dateColumns[0];
        const numericCol = this.findRelevantColumn(question, numericColumns) || numericColumns[0];
        const sortedData = rows.filter(row => !isNaN(Date.parse(row[dateCol])) && !isNaN(parseFloat(row[numericCol]))).sort((a, b) => new Date(a[dateCol]).getTime() - new Date(b[dateCol]).getTime()).map(row => ({ date: new Date(row[dateCol]).toLocaleDateString(), value: parseFloat(row[numericCol]) }));
        result += `Sheet: ${sheetName}\nTrend over time (${dateCol} vs ${numericCol}):\n`;
        sortedData.slice(0, 10).forEach(item => { result += `${item.date}: ${item.value.toLocaleString()}\n`; });
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
      const numericColumns = headers.filter(header => rows.some(row => !isNaN(parseFloat(row[header])) && isFinite(row[header])));
      if (numericColumns.length > 0) {
        const relevantColumn = this.findRelevantColumn(question, numericColumns);
        if (relevantColumn) {
          const sorted = [...rows].filter(row => row[relevantColumn] != null && row[relevantColumn] !== '' && !isNaN(parseFloat(row[relevantColumn]))).sort((a, b) => parseFloat(b[relevantColumn]) - parseFloat(a[relevantColumn])).slice(0, topN);
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
      const numericColumns = headers.filter(header => rows.some(row => !isNaN(parseFloat(row[header])) && isFinite(row[header])));
      if (numericColumns.length > 0) {
        const relevantColumn = this.findRelevantColumn(question, numericColumns);
        if (relevantColumn) {
          const sorted = [...rows].filter(row => row[relevantColumn] != null && row[relevantColumn] !== '').sort((a, b) => parseFloat(a[relevantColumn]) - parseFloat(b[relevantColumn])).slice(0, bottomN);
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

  private processSortQuery(question: string, data: ExcelData): string {
    let result = 'Sorted Data Analysis:\n\n';
    Object.entries(data.sheets).forEach(([sheetName, rows]) => {
      if (rows.length === 0) return;
      const headers = Object.keys(rows[0]);
      const relevantColumn = this.findRelevantColumn(question, headers);
      if (relevantColumn) {
        const isNumeric = !isNaN(parseFloat(rows[0][relevantColumn]));
        const isAscending = question.toLowerCase().includes('ascending') || question.toLowerCase().includes('lowest') || question.toLowerCase().includes('smallest');
        const sorted = [...rows].filter(row => row[relevantColumn] != null && row[relevantColumn] !== '').sort((a, b) => {
          const aVal = isNumeric ? parseFloat(a[relevantColumn]) : a[relevantColumn];
          const bVal = isNumeric ? parseFloat(b[relevantColumn]) : b[relevantColumn];
          if (aVal < bVal) return isAscending ? -1 : 1;
          if (aVal > bVal) return isAscending ? 1 : -1;
          return 0;
        });
        result += `Sheet: ${sheetName}\nSorted by ${relevantColumn} (${isAscending ? 'ascending' : 'descending'}):\n`;
        sorted.slice(0, 20).forEach((row, index) => {
          const identifier = this.getRowIdentifier(row, headers);
          result += `${index + 1}. ${identifier}: ${row[relevantColumn]}\n`;
        });
        result += '\n';
      }
    });
    return result;
  }

  private findRelevantColumn(question: string, columns: string[]): string | null {
    const lowerQuestion = question.toLowerCase();
    for (const col of columns) {
        if (lowerQuestion.includes(col.toLowerCase())) {
            return col;
        }
    }
    const keywords = {'attack': 'Attack', 'defense': 'Defense', 'hp': 'HP', 'speed': 'Speed', 'sales': 'Sales', 'price': 'Price', 'revenue': 'Revenue'};
    for(const keyword in keywords) {
        if(lowerQuestion.includes(keyword)) {
            const colName = columns.find(c => c.toLowerCase().includes(keywords[keyword].toLowerCase()));
            if(colName) return colName;
        }
    }
    return columns.find(c => !isNaN(parseFloat(c))) || columns[0] || null;
  }

  private getRowIdentifier(row: any, headers: string[]): string {
    const identifierColumns = ['name', 'pokemon', 'title', 'product', 'item', 'id'];
    for (const idCol of identifierColumns) {
      const matchingHeader = headers.find(h => h.toLowerCase().includes(idCol));
      if (matchingHeader && row[matchingHeader]) {
        return row[matchingHeader];
      }
    }
    const firstTextColumn = headers.find(h => isNaN(parseFloat(row[h])));
    return firstTextColumn ? row[firstTextColumn] : `Row with ${headers[1]}: ${row[headers[1]]}`;
  }

  private prepareDataContext(data: ExcelData): string {
    let context = '';
    Object.entries(data.sheets).forEach(([sheetName, rows]) => {
      context += `\nSheet: ${sheetName}\n`;
      if (rows.length > 0) {
        context += `Columns: ${Object.keys(rows[0]).join(', ')}\n`;
        context += `Sample Data (first 3 rows):\n`;
        rows.slice(0, 3).forEach((row, index) => {
          context += `Row ${index + 1}: ${JSON.stringify(row)}\n`;
        });
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
        console.error('Failed to parse chart specification:', error, chartSpecString);
        return { text: response };
      }
    }
    return { text: response };
  }
}