import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Loader, BarChart3, EyeOff } from 'lucide-react';
import { ChatMessage, ExcelData } from '../types';
import { OpenAIService } from '../utils/openai';
import { saveChatHistory } from '../utils/localStorage';
import { ChartRenderer } from './ChartRenderer'; // Import ChartRenderer

interface ChatInterfaceProps {
  data: ExcelData;
  messages: ChatMessage[];
  onMessagesChange: (messages: ChatMessage[]) => void;
}

export const ChatInterface: React.FC<ChatInterfaceProps> = ({
  data,
  messages,
  onMessagesChange
}) => {
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const openAIService = useRef<OpenAIService | null>(null);

  useEffect(() => {
    try {
      openAIService.current = new OpenAIService();
      setApiError(null);
    } catch (error) {
      setApiError(error instanceof Error ? error.message : 'Failed to initialize OpenAI service');
    }
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || isLoading || !openAIService.current || apiError) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      type: 'user',
      content: inputMessage,
      timestamp: new Date().toISOString()
    };

    const updatedMessages = [...messages, userMessage];
    onMessagesChange(updatedMessages);
    setInputMessage('');
    setIsLoading(true);

    try {
      const response = await openAIService.current.analyzeData(inputMessage, data);
      
      const assistantMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        type: 'assistant',
        content: response.text,
        timestamp: new Date().toISOString(),
        chart: response.chart,
        showChart: !!response.chart, // Show chart by default if available
        currentChartType: response.chart?.type, // Set initial chart type
      };

      const finalMessages = [...updatedMessages, assistantMessage];
      onMessagesChange(finalMessages);
      saveChatHistory(finalMessages);
    } catch (error) {
      const errorMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        type: 'assistant',
        content: `Sorry, I encountered an error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: new Date().toISOString()
      };
      const finalMessages = [...updatedMessages, errorMessage];
      onMessagesChange(finalMessages);
    } finally {
      setIsLoading(false);
    }
  };

  // --- NEW: Handlers for chart interaction ---
  const handleToggleChart = (messageId: string) => {
    const updatedMessages = messages.map((msg) =>
      msg.id === messageId ? { ...msg, showChart: !msg.showChart } : msg
    );
    onMessagesChange(updatedMessages);
  };

  const handleChartTypeChange = (
    messageId: string,
    newType: 'bar' | 'line' | 'pie' | 'area'
  ) => {
    const updatedMessages = messages.map((msg) =>
      msg.id === messageId ? { ...msg, currentChartType: newType } : msg
    );
    onMessagesChange(updatedMessages);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          // Welcome message (no changes)
          <div className="text-center py-12">
            <Bot className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Welcome to Excel Chatbot Assistant</h3>
            <p className="text-gray-500 max-w-md mx-auto">Ask me questions about your Excel data! I can help you analyze data, create summaries, and generate charts.</p>
            <div className="mt-6 text-sm text-gray-400">
              <p className="mb-2">Try asking:</p>
              <ul className="space-y-1">
                <li>"Show me a summary of the data"</li>
                <li>"Top 5 Pokemon by Attack"</li>
                <li>"Show me the strongest Pokemon"</li>
                <li>"Create a chart of Pokemon types"</li>
                <li>"Show trends over time"</li>
              </ul>
            </div>
          </div>
        ) : (
          // --- MODIFIED: Message rendering loop ---
          messages.map((message) => (
            <div
              key={message.id}
              className={`flex flex-col ${message.type === 'user' ? 'items-end' : 'items-start'}`}
            >
              <div className={`flex max-w-3xl ${message.type === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                  message.type === 'user' 
                    ? 'bg-blue-600 text-white ml-3' 
                    : 'bg-gray-200 text-gray-600 mr-3'
                }`}>
                  {message.type === 'user' ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                </div>
                
                <div className={`rounded-lg p-4 ${
                  message.type === 'user'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-900'
                }`}>
                  <p className="whitespace-pre-wrap">{message.content}</p>
                  
                  {/* --- NEW: Chart Toggle Button --- */}
                  {message.type === 'assistant' && message.chart && (
                    <div className="mt-4 border-t border-gray-200 pt-3">
                      <button
                        onClick={() => handleToggleChart(message.id)}
                        className="flex items-center space-x-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all bg-white text-gray-700 border border-gray-200 hover:bg-gray-50"
                      >
                        {message.showChart ? (
                          <>
                            <EyeOff className="w-4 h-4" />
                            <span>Hide Chart</span>
                          </>
                        ) : (
                          <>
                            <BarChart3 className="w-4 h-4" />
                            <span>Show Chart</span>
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* --- NEW: Chart Renderer --- */}
              {message.showChart && message.chart && (
                <div className="mt-2 w-full max-w-3xl">
                  <ChartRenderer
                    chartData={message.chart}
                    currentChartType={message.currentChartType}
                    onChartTypeChange={(newType) => handleChartTypeChange(message.id, newType)}
                  />
                </div>
              )}
            </div>
          ))
        )}
        
        {isLoading && (
           // Loader (no changes)
           <div className="flex justify-start">
            <div className="flex max-w-3xl">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gray-200 text-gray-600 mr-3 flex items-center justify-center">
                <Bot className="w-4 h-4" />
              </div>
              <div className="bg-gray-100 rounded-lg p-4">
                <div className="flex items-center space-x-2">
                  <Loader className="w-4 h-4 animate-spin" />
                  <span className="text-gray-600">Analyzing your data...</span>
                </div>
              </div>
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      <div className="border-t bg-white p-4">
        {/* Input form (no changes) */}
        <div className="flex space-x-3">
          <input
            type="text"
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
            placeholder="Ask a question about your data..."
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            disabled={isLoading || !!apiError}
          />
          <button
            onClick={handleSendMessage}
            disabled={!inputMessage.trim() || isLoading || !!apiError}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
        {apiError && (
          <p className="text-sm text-red-600 mt-2">{apiError}</p>
        )}
      </div>
    </div>
  );
};