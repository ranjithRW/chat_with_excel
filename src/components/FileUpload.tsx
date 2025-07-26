import React, { useCallback, useState } from 'react';
import { Upload, FileText, X } from 'lucide-react';
import { parseExcelFile, parseCSVFile } from '../utils/excelParser';
import { saveExcelData } from '../utils/localStorage';
import { ExcelData } from '../types';

interface FileUploadProps {
  onDataUploaded: (data: ExcelData) => void;
  currentData: ExcelData | null;
  onClearData: () => void;
}

export const FileUpload: React.FC<FileUploadProps> = ({ 
  onDataUploaded, 
  currentData, 
  onClearData 
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileUpload = useCallback(async (file: File) => {
    setIsUploading(true);
    setError(null);

    try {
      let data: ExcelData;
      
      if (file.name.endsWith('.csv')) {
        data = await parseCSVFile(file);
      } else if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
        data = await parseExcelFile(file);
      } else {
        throw new Error('Unsupported file format. Please upload .xlsx, .xls, or .csv files.');
      }

      saveExcelData(data);
      onDataUploaded(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload file');
    } finally {
      setIsUploading(false);
    }
  }, [onDataUploaded]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleFileUpload(files[0]);
    }
  }, [handleFileUpload]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFileUpload(files[0]);
    }
  }, [handleFileUpload]);

  if (currentData) {
    return (
      <div className="bg-white p-6 rounded-lg shadow-sm border">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Uploaded File</h3>
          <button
            onClick={onClearData}
            className="p-2 text-gray-400 hover:text-red-500 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="flex items-center space-x-3 mb-4">
          <FileText className="w-8 h-8 text-green-500" />
          <div>
            <p className="font-medium text-gray-900">{currentData.fileName}</p>
            <p className="text-sm text-gray-500">
              {Object.keys(currentData.sheets).length} sheet(s) • 
              Uploaded {new Date(currentData.uploadedAt).toLocaleDateString()}
            </p>
          </div>
        </div>

        <div className="space-y-2">
          <h4 className="font-medium text-gray-700">Sheets:</h4>
          {Object.entries(currentData.sheets).map(([sheetName, data]) => (
            <div key={sheetName} className="text-sm text-gray-600 bg-gray-50 p-2 rounded">
              <span className="font-medium">{sheetName}</span> - {data.length} rows
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white p-6 rounded-lg shadow-sm border">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Upload Excel File</h3>
      
      <div
        className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
          isDragging 
            ? 'border-blue-400 bg-blue-50' 
            : 'border-gray-300 hover:border-gray-400'
        }`}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
      >
        <Upload className={`w-12 h-12 mx-auto mb-4 ${
          isDragging ? 'text-blue-500' : 'text-gray-400'
        }`} />
        
        <p className="text-lg font-medium text-gray-900 mb-2">
          {isUploading ? 'Processing...' : 'Drop your Excel file here'}
        </p>
        
        <p className="text-gray-500 mb-4">
          Supports .xlsx, .xls, and .csv files
        </p>
        
        <label className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 cursor-pointer transition-colors">
          <Upload className="w-4 h-4 mr-2" />
          Choose File
          <input
            type="file"
            className="hidden"
            accept=".xlsx,.xls,.csv"
            onChange={handleFileSelect}
            disabled={isUploading}
          />
        </label>
      </div>

      {error && (
        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-700 text-sm">{error}</p>
        </div>
      )}
    </div>
  );
};