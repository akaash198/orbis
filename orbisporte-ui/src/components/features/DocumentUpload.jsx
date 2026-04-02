import React, { useState, useCallback } from 'react';
import { 
  Upload, 
  FileText, 
  CheckCircle, 
  Loader2,
  X,
  File,
  Image,
  ArrowRight,
  ArrowLeft,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/Card';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { Progress } from '../ui/Progress';

function FileData({ file, id, name, size, type, status, progress, onRemove }) {
  const formatFileSize = (bytes) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getFileIcon = (type) => {
    if (type?.includes('pdf')) return <FileText className="w-5 h-5 text-error" />;
    if (type?.includes('image')) return <Image className="w-5 h-5 text-primary-400" />;
    return <File className="w-5 h-5 text-text-muted" />;
  };

  return (
    <div className="flex items-center gap-3 p-3 rounded-lg bg-surface-glass border border-border">
      {getFileIcon(type)}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-text-primary truncate">{name}</p>
        <p className="text-xs text-text-muted">{formatFileSize(size)}</p>
      </div>
      {status === 'completed' ? (
        <CheckCircle className="w-5 h-5 text-success" />
      ) : status === 'processing' ? (
        <Loader2 className="w-5 h-5 text-primary-400 animate-spin" />
      ) : (
        <button onClick={() => onRemove(id)} className="p-1 rounded hover:bg-surface-hover">
          <X className="w-4 h-4 text-text-muted" />
        </button>
      )}
    </div>
  );
}

export function DocumentUpload({ onNavigate }) {
  const [step, setStep] = useState('upload');
  const [files, setFiles] = useState([]);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadSource, setUploadSource] = useState('upload');

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFiles = Array.from(e.dataTransfer.files);
    addFiles(droppedFiles);
  }, []);

  const handleFileSelect = useCallback((e) => {
    if (e.target.files) {
      const selectedFiles = Array.from(e.target.files);
      addFiles(selectedFiles);
    }
  }, []);

  const addFiles = (newFiles) => {
    const validTypes = ['application/pdf', 'image/jpeg', 'image/png'];
    const validFiles = newFiles.filter(file => 
      validTypes.some(type => file.type?.includes(type.split('/')[1])) ||
      file.name?.match(/\.(pdf|jpg|jpeg|png)$/i)
    );

    const newFileData = validFiles.map(file => ({
      id: Math.random().toString(36).substring(7),
      file,
      name: file.name,
      size: file.size,
      type: file.type || 'application/pdf',
      status: 'pending',
      progress: 0,
    }));

    setFiles(prev => [...prev, ...newFileData]);
  };

  const removeFile = (id) => {
    setFiles(prev => prev.filter(f => f.id !== id));
  };

  const simulateUpload = () => {
    setStep('processing');
    files.forEach((file, index) => {
      setTimeout(() => {
        setFiles(prev => prev.map(f => 
          f.id === file.id ? { ...f, status: 'completed', progress: 100 } : f
        ));
      }, 1000 + (index * 500));
    });
    setTimeout(() => setStep('review'), files.length * 600 + 1000);
  };

  const sourceOptions = [
    { id: 'upload', icon: <Upload className="w-5 h-5" />, label: 'File Upload', description: 'Drag & drop or browse' },
    { id: 'email', icon: <FileText className="w-5 h-5" />, label: 'Email Import', description: 'Import from email' },
    { id: 'api', icon: <FileText className="w-5 h-5" />, label: 'API Integration', description: 'Connect external sources' },
    { id: 'folder', icon: <FileText className="w-5 h-5" />, label: 'Folder Sync', description: 'Watch folder for files' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Document Upload</h1>
          <p className="text-text-secondary mt-1">Upload and process your customs documents</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={step === 'upload' ? 'info' : step === 'processing' ? 'warning' : 'success'}>
            {step === 'upload' ? 'Ready to Upload' : step === 'processing' ? 'Processing' : 'Complete'}
          </Badge>
        </div>
      </div>

      {step === 'upload' && (
        <div className="space-y-4 animate-fade-in">
          <Card>
            <CardHeader>
              <CardTitle>Select Upload Source</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {sourceOptions.map((option) => (
                  <button
                    key={option.id}
                    onClick={() => setUploadSource(option.id)}
                    className={`p-4 rounded-xl border transition-all text-left group ${
                      uploadSource === option.id
                        ? 'border-primary-500 bg-primary-500/10'
                        : 'border-border hover:border-border-glow hover:bg-surface-hover'
                    }`}
                  >
                    <div className={`w-12 h-12 rounded-lg flex items-center justify-center mb-3 ${
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
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-8">
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`border-2 border-dashed rounded-xl p-8 text-center transition-all ${
                  isDragging ? 'border-primary-500 bg-primary-500/10' : 'border-border hover:border-border-glow'
                }`}
              >
                <div className="w-16 h-16 rounded-full bg-primary-500/15 flex items-center justify-center mx-auto mb-4">
                  <Upload className="w-8 h-8 text-primary-400" />
                </div>
                <h3 className="text-lg font-medium text-text-primary mb-2">
                  {isDragging ? 'Drop files here' : 'Drag & drop files here'}
                </h3>
                <p className="text-sm text-text-secondary mb-4">or click to browse from your computer</p>
                <input type="file" multiple accept=".pdf,.jpg,.jpeg,.png" onChange={handleFileSelect} className="hidden" id="file-upload" />
                <label htmlFor="file-upload">
                  <Button variant="secondary" as="span" className="cursor-pointer">Browse Files</Button>
                </label>
                <p className="text-xs text-text-muted mt-4">Supported: PDF, JPG, PNG</p>
              </div>
            </CardContent>
          </Card>

          {files.length > 0 && (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Files ({files.length})</CardTitle>
                <Button variant="ghost" size="sm" onClick={() => setFiles([])}>Clear All</Button>
              </CardHeader>
              <CardContent className="space-y-2">
                {files.map((file) => (
                  <FileData key={file.id} {...file} onRemove={removeFile} />
                ))}
              </CardContent>
              <div className="flex justify-end gap-3 mt-4 pt-4 border-t border-border">
                <Button onClick={simulateUpload} disabled={files.length === 0} icon={<Loader2 className="w-4 h-4" />}>
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
              <h3 className="text-xl font-semibold text-text-primary mb-2">Processing Documents</h3>
              <p className="text-text-secondary mb-6">Extracting data and classifying HS codes...</p>
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
              <div className="space-y-2">
                {files.map((file) => (
                  <FileData key={file.id} {...file} onRemove={() => {}} />
                ))}
              </div>
              <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-border">
                <Button variant="secondary" onClick={() => { setFiles([]); setStep('upload'); }}>
                  Upload More
                </Button>
                <Button onClick={() => onNavigate?.('hs-codes')} icon={<ArrowRight className="w-4 h-4" />} iconPosition="right">
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