# Excel Chatbot Assistant

A powerful AI-powered Excel data analysis and visualization tool built with React, TypeScript, and OpenAI GPT-4.

## Features

- 📊 Upload and parse Excel files (.xlsx, .xls, .csv)
- 💬 Natural language chat interface for data analysis
- 📈 Dynamic chart generation (bar, line, pie, area charts)
- 🤖 AI-powered insights using OpenAI GPT-4
- 💾 Session-based data storage with localStorage
- 🎨 Modern, responsive UI with Tailwind CSS

## Setup

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd excel-chatbot-assistant
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment Configuration**
   ```bash
   cp .env.example .env
   ```
   
   Edit the `.env` file and add your OpenAI API key:
   ```
   VITE_OPENAI_API_KEY=sk-your-openai-api-key-here
   ```
   
   Get your API key from: https://platform.openai.com/api-keys

4. **Start the development server**
   ```bash
   npm run dev
   ```

## Usage

1. **Upload Data**: Drag and drop or select an Excel file (.xlsx, .xls, .csv)
2. **Ask Questions**: Use natural language to query your data
   - "Show me a summary of the data"
   - "Create a bar chart of sales by region"
   - "What are the top 5 products by revenue?"
   - "Show trends over time"
3. **View Results**: Get AI-powered insights with optional visualizations

## Tech Stack

- **Frontend**: React 18, TypeScript, Tailwind CSS
- **Charts**: Recharts
- **Excel Parsing**: SheetJS (xlsx)
- **AI**: OpenAI GPT-4 API
- **Storage**: localStorage
- **Build Tool**: Vite

## Security

- API keys are stored as environment variables
- Data processing happens client-side
- No data is sent to external servers except OpenAI for analysis
- Session data is stored locally and cleared when needed

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

MIT License - see LICENSE file for details