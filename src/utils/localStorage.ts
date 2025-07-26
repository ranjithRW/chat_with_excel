import { ExcelData, ChatMessage } from '../types';

const EXCEL_DATA_KEY = 'excel-chatbot-data';
const CHAT_HISTORY_KEY = 'excel-chatbot-history';

export const saveExcelData = (data: ExcelData): void => {
  try {
    localStorage.setItem(EXCEL_DATA_KEY, JSON.stringify(data));
  } catch (e: any) {
    if (
      e instanceof DOMException &&
      (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED')
    ) {
      alert('Failed to save data: Storage limit exceeded. Please reduce the file size or clear some data.');
    } else {
      throw e;
    }
  }
};

export const getExcelData = (): ExcelData | null => {
  const data = localStorage.getItem(EXCEL_DATA_KEY);
  return data ? JSON.parse(data) : null;
};

export const clearExcelData = (): void => {
  localStorage.removeItem(EXCEL_DATA_KEY);
};

export const saveChatHistory = (messages: ChatMessage[]): void => {
  localStorage.setItem(CHAT_HISTORY_KEY, JSON.stringify(messages));
};

export const getChatHistory = (): ChatMessage[] => {
  const history = localStorage.getItem(CHAT_HISTORY_KEY);
  return history ? JSON.parse(history) : [];
};

export const clearChatHistory = (): void => {
  localStorage.removeItem(CHAT_HISTORY_KEY);
};