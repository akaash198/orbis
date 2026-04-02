import React, { useState, useCallback } from 'react';
import { 
  Upload, 
  FileText, 
  CheckCircle, 
  Loader2,
  X,
  File,
  Image,
  FileSpreadsheet,
  AlertCircle,
  ArrowRight,
  ArrowLeft,
  Cloud,
  Link,
  FolderOpen,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/Card';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { Progress } from '../ui/Progress';
import { Input } from '../ui/Input';

interface FileData {
  id: string;
  file: File;
  name: string;
  size: number;
  type: string;
  status: 'pending' | 'uploading' | 'processing' | 'completed' | 'error';
  progress: number;
  error?: string;
}

type UploadStep = 'source' | 'upload' | 'processing' | 'review';

interface DocumentUploadProps {
  onNavigate?: (page: string) => void;
}

export function DocumentUpload({ onNavigate }: DocumentUploadProps) {
  const [step, setStep] = useState<UploadStep>('source');
  const [files, setFiles] = useState<FileData[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadSource, setUploadSource] = useState<'upload' | 'email' | 'api' | 'folder'>('upload');

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFiles = Array.from(e.dataTransfer.files);
    addFiles(droppedFiles);
  }, []);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selectedFiles = Array.from(e.target.files);
      addFiles(selectedFiles);
    }
  }, []);

  const addFiles = (newFiles: File[]) => {
    const validTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/tiff'];
    const validFiles = newFiles.filter(file => {
      const isValidType = validTypes.some(type => file.type.includes(type.split('/')[1]));
      return isValidType || file.name.match(/\.(pdf|jpg|jpeg|png|tiff)$/i);
    });

    const newFileData: FileData[] = validFiles.map(file => ({
      id: Math.random().toString(36).substring(7),
      file,
      name: file.name,
      size: file.size,
      type: file.type || 'application/pdf',
      status: 'pending',
      progress: 0,
    }));

    setFiles(prev => [...prev, ...newFileData]);
    if (step === 'source') {
      setStep('upload');
    }
  };

  const removeFile = (id: string) => {
    setFiles(prev => prev.filter(f => f.id !== id));
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getFileIcon = (type: string) => {
    if (type.includes('pdf')) return <FileText className="w-5 h-5 text-error" />;
    if (type.includes('image')) return <Image className="w-5 h-5 text-primary-400" />;
    return <File className="w-5 h-5 text-text-muted" />;
  };

  const simulateUpload = () => {
    setStep('processing');
    
    // Simulate processing
    files.forEach((file, index) => {
      setTimeout(() => {
        setFiles(prev => prev.map(f => 
          f.id === file.id 
            ? { ...f, status: 'completed', progress: 100 } 
            : f
        ));
      }, 1000 + (index * 500));
    });

    setTimeout(() => {
      setStep('review');
    }, files.length * 600 + 1000);
  };

  const sourceOptions = [
    { id: 'upload', icon: <Upload className="w-5 h-5" />, label: 'File Upload', description: 'Drag & drop or browse' },
    { id: 'email', icon: <Cloud className="w-5 h-5" />, label: 'Email Import', description: 'Import from email' },
    { id: 'api', icon: <Link className="w-5 h-5" />, label: 'API Integration', description: 'Connect external sources' },
    { id: 'folder', icon: <FolderOpen className="w-5 h-5" />, label: 'Folder Sync', description: 'Watch folder for files' },
  ];

  const stepIndicator = [
    { key: 'source', label: 'Source', icon: FileText },
    { key: 'upload', label: 'Upload', icon: Upload },
    { key: 'processing', label: 'Processing', icon: Loader2 },
    { key: 'review', label: 'Review', icon: CheckCircle },
  ];

  const currentStepIndex = stepIndicator.findIndex(s => s.key === step);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Document Upload</h1>
          <p className="text-text-secondary mt-1">Upload and process your customs documents</p>
        </div>
        
        {/* Step Indicator */}
        <div className="flex items-center gap-2">
          {stepIndicator.map((s, index) => {
            const Icon = s.icon;
            const isActive = index === currentStepIndex;
            const isCompleted = index < currentStepIndex;
            
            return (
              <React.Fragment key={s.key}>
                <div 
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-colors ${
                    isActive ? 'bg-primary-500/20 text-primary-400' 
                    : isCompleted ? 'bg-success/20 text-success'
                    : 'bg-surface-glass text-text-muted'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? 'animate-spin' : ''}`} />
                  <span className="text-sm font-medium hidden sm:inline">{s.label}</span>
                </div>
                {index < stepIndicator.length - 1 && (
                  <div className={`w-6 h-0.5 ${isCompleted ? 'bg-success' : 'bg-border'}`} />
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {/* Step Content */}
      {step === 'source' && (
        <Card className="animate-fade-in">
          <CardHeader>
            <CardTitle>Select Upload Source</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {sourceOptions.map((option) => (
                <button
                  key={option.id}
                  onClick={() => setUploadSource(option.id as any)}
                  className={`p-4 rounded-xl border transition-all text-left group ${
                    uploadSource === option.id
                      ? 'border-primary-500 bg-primary-500/10'
                      : 'border-border hover:border-border-glow hover:bg-surface-hover'
                  }`}
                >
                  <div className={`w-12 h-12 rounded-lg flex items-center justify-center mb-3 transition-colors ${
                    uploadSource === option.id
                      ? 'bg-primary-500/20 text-primary-400'
                      : 'bg-surface-glass text-text-muted group-hover:text-text-secondary'
                  }`}>
                    {option.icon}
                  </div>
                  <h4 className="font-medium text-text-primary mb-1">{option.label}</h4>
                  <p className="text-xs text-text-secondary">{option.description}</p>
                </button>
              ))}
            </div>
            <div className="flex justify-end mt-6">
              <Button 
                onClick={() => setStep('upload')}
                icon={<ArrowRight className="w-4 h-4" />}
                iconPosition="right"
              >
                Continue
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 'upload' && (
        <div className="space-y-4 animate-fade-in">
          {/* Drop Zone */}
          <Card>
            <CardContent className="p-8">
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`border-2 border-dashed rounded-xl p-8 text-center transition-all ${
                  isDragging 
                    ? 'border-primary-500 bg-primary-500/10' 
                    : 'border-border hover:border-border-glow'
                }`}
              >
                <div className="w-16 h-16 rounded-full bg-primary-500/15 flex items-center justify-center mx-auto mb-4">
                  <Upload className="w-8 h-8 text-primary-400" />
                </div>
                <h3 className="text-lg font-medium text-text-primary mb-2">
                  {isDragging ? 'Drop files here' : 'Drag & drop files here'}
                </h3>
                <p className="text-sm text-text-secondary mb-4">
                  or click to browse from your computer
                </p>
                <input
                  type="file"
                  multiple
                  accept=".pdf,.jpg,.jpeg,.png,.tiff"
                  onChange={handleFileSelect}
                  className="hidden"
                  id="file-upload"
                />
                <label htmlFor="file-upload">
                  <Button variant="secondary" as="span" className="cursor-pointer">
                    Browse Files
                  </Button>
                </label>
                <p className="text-xs text-text-muted mt-4">
                  Supported formats: PDF, JPG, PNG, TIFF
                </p>
              </div>
            </CardContent>
          </Card>

          {/* File List */}
          {files.length > 0 && (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Uploaded Files ({files.length})</CardTitle>
                <Button variant="ghost" size="sm" onClick={() => setFiles([])}>
                  Clear All
                </Button>
              </CardHeader>
              <CardContent className="space-y-2">
                {files.map((file) => (
                  <div 
                    key={file.id}
                    className="flex items-center gap-3 p-3 rounded-lg bg-surface-glass border border-border"
                  >
                    {getFileIcon(file.type)}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-text-primary truncate">
                        {file.name}
                      </p>
                      <p className="text-xs text-text-muted">{formatFileSize(file.size)}</p>
                    </div>
                    {file.status === 'pending' && (
                      <button
                        onClick={() => removeFile(file.id)}
                        className="p-1 rounded hover:bg-surface-hover"
                      >
                        <X className="w-4 h-4 text-text-muted" />
                      </button>
                    )}
                    {file.status === 'completed' && (
                      <CheckCircle className="w-5 h-5 text-success" />
                    )}
                  </div>
                ))}
              </CardContent>
              <div className="flex justify-end gap-3 mt-4 pt-4 border-t border-border">
                <Button 
                  variant="secondary" 
                  onClick={() => setStep('source')}
                  icon={<ArrowLeft className="w-4 h-4" />}
                >
                  Back
                </Button>
                <Button 
                  onClick={simulateUpload}
                  disabled={files.length === 0}
                  icon={<Loader2 className="w-4 h-4" />}
                >
                  Process {files.length} File{files.length !== 1 ? 's' : ''}
                </Button>
              </div>
            </Card>
          )}
        </div>
      )}

      {step === 'processing' && (
        <Card className="animate-fade-in">
          <CardContent className="py-12">
            <div className="text-center">
              <div className="w-20 h-20 rounded-full bg-primary-500/15 flex items-center justify-center mx-auto mb-6">
                <Loader2 className="w-10 h-10 text-primary-400 animate-spin" />
              </div>
              <h3 className="text-xl font-semibold text-text-primary mb-2">
                Processing Documents
              </h3>
              <p className="text-text-secondary mb-6">
                Extracting data and classifying HS codes...
              </p>
              
              {/* Progress per file */}
              <div className="max-w-md mx-auto space-y-3">
                {files.map((file) => (
                  <div key={file.id} className="p-3 rounded-lg bg-surface-glass border border-border">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-text-primary truncate">{file.name}</span>
                      <Badge variant={file.status === 'completed' ? 'success' : 'info'}>
                        {file.status === 'completed' ? 'Done' : 'Processing'}
                      </Badge>
                    </div>
                    <Progress value={file.status === 'completed' ? 100 : 65} />
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 'review' && (
        <div className="space-y-4 animate-fade-in">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-success" />
                Processing Complete
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div className="text-center p-4 rounded-lg bg-success/10 border border-success/20">
                  <p className="text-2xl font-bold text-success">{files.length}</p>
                  <p className="text-sm text-text-secondary">Files Processed</p>
                </div>
                <div className="text-center p-4 rounded-lg bg-primary-500/10 border border-primary-500/20">
                  <p className="text-2xl font-bold text-primary-400">{files.length}</p>
                  <p className="text-sm text-text-secondary">Classified</p>
                </div>
                <div className="text-center p-4 rounded-lg bg-warning/10 border border-warning/20">
                  <p className="text-2xl font-bold text-warning">1</p>
                  <p className="text-sm text-text-secondary">Needs Review</p>
                </div>
                <div className="text-center p-4 rounded-lg bg-accent-500/10 border border-accent-500/20">
                  <p className="text-2xl font-bold text-accent-400">0</p>
                  <p className="text-sm text-text-secondary">Errors</p>
                </div>
              </div>

              {/* Processed Files */}
              <div className="space-y-2">
                {files.map((file) => (
                  <div 
                    key={file.id}
                    className="flex items-center gap-3 p-3 rounded-lg bg-surface-glass border border-border"
                  >
                    {getFileIcon(file.type)}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-text-primary truncate">
                        {file.name}
                      </p>
                      <p className="text-xs text-text-muted">
                        HS Code: 8471.30 • Confidence: 95%
                      </p>
                    </div>
                    <Badge variant="success">Completed</Badge>
                  </div>
                ))}
              </div>

              <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-border">
                <Button 
                  variant="secondary" 
                  onClick={() => {
                    setFiles([]);
                    setStep('source');
                  }}
                >
                  Upload More
                </Button>
                <Button 
                  onClick={() => onNavigate?.('hs-codes')}
                  icon={<ArrowRight className="w-4 h-4" />}
                  iconPosition="right"
                >
                  View Results
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}