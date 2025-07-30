import React, { useState, useEffect } from 'react';
import { MessageSquare, Database, Trash2 } from 'lucide-react';
import { FileUpload } from './components/FileUpload';
import { ChatInterface } from './components/ChatInterface';
import { ExcelData, ChatMessage } from './types';
import { getExcelData, getChatHistory, clearExcelData, clearChatHistory } from './utils/localStorage';

function App() {
  const [excelData, setExcelData] = useState<ExcelData | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);

  useEffect(() => {
    // Load saved data on startup
    const savedData = getExcelData();
    const savedHistory = getChatHistory();
    
    if (savedData) setExcelData(savedData);
    if (savedHistory) setChatMessages(savedHistory);
  }, []);

  const handleDataUploaded = (data: ExcelData) => {
    setExcelData(data);
    // Clear chat history when new data is uploaded
    setChatMessages([]);
    clearChatHistory();
  };

  const handleClearData = () => {
    setExcelData(null);
    setChatMessages([]);
    clearExcelData();
    clearChatHistory();
  };

  const handleClearChat = () => {
    setChatMessages([]);
    clearChatHistory();
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-full px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              {/* <div className="flex items-center justify-center w-10 h-10 bg-blue-600 rounded-lg">
                <MessageSquare className="w-6 h-6 text-white" />
              </div> */}
              <div>
                <h1 className="text-2xl font-bold text-violet-500">0bito <span className='text-pink-600'>Chatbot😎</span></h1>
                <p className="text-sm text-gray-500">AI-powered Excel data analysis and visualization</p>
              </div>
            </div>
            
            {chatMessages.length > 0 && (
              <button
                onClick={handleClearChat}
                className="flex items-center space-x-2 px-4 py-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                <span>Clear Chat</span>
              </button>
            )}
          </div>
        </div>
      </header>

      <div className="flex h-[calc(100vh-88px)]">
        {/* Sidebar */}
        <div className="w-96 bg-white border-r flex flex-col">
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            <FileUpload 
              onDataUploaded={handleDataUploaded}
              currentData={excelData}
              onClearData={handleClearData}
            />
            
          
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 flex flex-col">
          {excelData ? (
            <ChatInterface
              data={excelData}
              messages={chatMessages}
              onMessagesChange={setChatMessages}
            />
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <Database className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <h2 className="text-xl font-semibold text-gray-900 mb-2">
                  No Data Uploaded
                </h2>
                <p className="text-gray-500 max-w-md">
                  Upload an Excel file to start analyzing your data with AI. 
                  Support for .xlsx, .xls, and .csv files.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;