import React, { useMemo, useRef, useState } from 'react';
import {
  Upload,
  FileText,
  CheckCircle2,
  Loader2,
  X,
  File,
  Image,
  ArrowRight,
  FolderOpen,
  Cloud,
  Link,
  Search,
  FileSearch,
  Eye,
  RefreshCw,
  Clock3,
  AlertTriangle,
  Paperclip,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../ui/Card';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { Progress } from '../ui/Progress';
import { Input } from '../ui/Input';
import { Modal, Avatar, Alert } from '../ui';

const SOURCE_OPTIONS = [
  { id: 'upload', icon: <Upload className="h-5 w-5" />, label: 'File Upload', description: 'Drag & drop or browse' },
  { id: 'email', icon: <Cloud className="h-5 w-5" />, label: 'Email Import', description: 'Import from email' },
  { id: 'api', icon: <Link className="h-5 w-5" />, label: 'API Integration', description: 'Connect external sources' },
  { id: 'folder', icon: <FolderOpen className="h-5 w-5" />, label: 'Folder Sync', description: 'Watch folder for files' },
];

const INITIAL_DOCS = [
  { id: 'd1', name: 'Invoice_INV2024_089.pdf', category: 'Commercial Invoice', source: 'Email Import', status: 'processed', label: 'Processed', updated: '2 min ago', size: '842 KB', type: 'application/pdf', owner: 'Asha Patel', confidence: 98, notes: 'HS code validated automatically.' },
  { id: 'd2', name: 'Packing_List_0432.pdf', category: 'Packing List', source: 'File Upload', status: 'processing', label: 'Processing', updated: '12 min ago', size: '1.3 MB', type: 'application/pdf', owner: 'Rohan Mehta', confidence: 92, notes: 'Pending review for quantity mismatch.' },
  { id: 'd3', name: 'Bill_of_Lading_9912.pdf', category: 'Bill of Lading', source: 'Folder Sync', status: 'pending', label: 'Pending', updated: '18 min ago', size: '1.1 MB', type: 'application/pdf', owner: 'Priya Shah', confidence: 95, notes: 'Ready for classification.' },
  { id: 'd4', name: 'Certificate_of_Origin.pdf', category: 'Certificate', source: 'API Integration', status: 'flagged', label: 'Flagged', updated: '41 min ago', size: '512 KB', type: 'application/pdf', owner: 'Nikhil Rao', confidence: 78, notes: 'Origin evidence requires attention.' },
];

function fileIcon(type) {
  if (type?.includes('pdf')) return <FileText className="h-5 w-5 text-error" />;
  if (type?.includes('image')) return <Image className="h-5 w-5 text-brand-accent" />;
  return <File className="h-5 w-5 text-text-muted" />;
}

function DocRow({ doc, onPreview, onDelete }) {
  const variant = doc.status === 'processed' ? 'success' : doc.status === 'flagged' ? 'error' : doc.status === 'processing' ? 'warning' : 'info';
  return (
    <tr className="group border-b border-[#1E2638]/50 hover:bg-[#1C2438]/40 transition-all duration-150">
      <td className="px-6 py-4">
        <div className="flex items-center gap-4">
          <div 
            className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#0D1020] border border-[#273047] text-[#C9A520] group-hover:border-[#C9A520]/40 group-hover:shadow-[0_0_12px_rgba(201,165,32,0.12)] transition-all"
          >
            {fileIcon(doc.type)}
          </div>
          <div className="min-w-0">
            <p className="truncate text-[14px] font-semibold text-[#E2E8F5] leading-tight">{doc.name}</p>
            <p className="mt-0.5 text-[12px] font-medium text-[#4A5A72]">{doc.category}</p>
          </div>
        </div>
      </td>
      <td className="px-6 py-4">
        <div className="flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full bg-[#4A5A72]" />
          <span className="text-[13px] font-medium text-[#8B97AE]">{doc.source}</span>
        </div>
      </td>
      <td className="px-6 py-4">
        <Badge variant={variant} dot>{doc.label}</Badge>
      </td>
      <td className="px-6 py-4 text-[13px] font-medium text-[#8B97AE]">
        {doc.updated}
      </td>
      <td className="px-6 py-4 text-right text-[13px] font-bold text-[#E2E8F5] font-mono whitespace-nowrap">
        {doc.size}
      </td>
      <td className="px-6 py-4">
        <div className="flex justify-end gap-3">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => onPreview(doc)}
            className="h-8 w-8 p-0 text-[#8B97AE] hover:text-[#C9A520] hover:bg-[#C9A520]/10"
            title="Preview Document"
          >
            <Eye className="h-4 w-4" />
          </Button>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => onDelete(doc.id)}
            className="h-8 w-8 p-0 text-[#8B97AE] hover:text-[#E05656] hover:bg-[#E05656]/10"
            title="Delete Document"
          >
            <X className="h-4.5 w-4.5" />
          </Button>
        </div>
      </td>
    </tr>
  );
}

export function DocumentUpload({ onNavigate }) {
  const [documents, setDocuments] = useState(INITIAL_DOCS);
  const [files, setFiles] = useState([]);
  const [uploadSource, setUploadSource] = useState('upload');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedDocument, setSelectedDocument] = useState(null);
  const [mode, setMode] = useState('repository');
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);

  const filtered = useMemo(() => documents.filter((doc) => {
    const q = searchTerm.trim().toLowerCase();
    const matches = !q || [doc.name, doc.category, doc.source].some((v) => v.toLowerCase().includes(q));
    const statusMatch = statusFilter === 'all' || doc.status === statusFilter;
    return matches && statusMatch;
  }), [documents, searchTerm, statusFilter]);

  const kpis = [
    { label: 'Total Documents', value: documents.length, icon: <FileText className="h-5 w-5 text-brand-accent" /> },
    { label: 'Processed', value: documents.filter((d) => d.status === 'processed').length, icon: <CheckCircle2 className="h-5 w-5 text-success" /> },
    { label: 'Pending Review', value: documents.filter((d) => d.status === 'processing' || d.status === 'pending').length, icon: <Clock3 className="h-5 w-5 text-warning" /> },
    { label: 'Flagged', value: documents.filter((d) => d.status === 'flagged').length, icon: <AlertTriangle className="h-5 w-5 text-error" /> },
  ];

  const formatSize = (bytes) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const addFiles = (incoming) => {
    const mapped = incoming.map((file) => ({
      id: Math.random().toString(36).slice(2, 9),
      name: file.name,
      size: formatSize(file.size),
      type: file.type || 'application/pdf',
      progress: 0,
      status: 'pending',
    }));
    setFiles((prev) => [...prev, ...mapped]);
    setMode('upload');
  };

  const uploadInput = (
    <input
      ref={fileInputRef}
      type="file"
      multiple
      accept=".pdf,.jpg,.jpeg,.png,.tiff"
      className="hidden"
      id="document-upload-input"
      onChange={(e) => {
        if (e.target.files) {
          addFiles(Array.from(e.target.files));
          e.target.value = '';
        }
      }}
    />
  );

  return (
    <div className="space-y-8">
      <section className="rounded-3xl border border-border bg-gradient-to-br from-background-secondary via-surface to-background-secondary p-6 shadow-card sm:p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-brand-accent/30 bg-brand-accent/10 px-3 py-1 text-tiny font-semibold text-brand-accent">
              <Paperclip className="h-3.5 w-3.5" /> Document Management
            </div>
            <h1 className="text-3xl font-semibold tracking-[-0.02em] text-text-primary sm:text-4xl">Repository, upload, and review in one place</h1>
            <p className="mt-3 max-w-2xl text-body text-text-secondary">Manage customs documents across every source, monitor status, and preview extracted data without leaving the workflow.</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button variant="secondary" icon={<RefreshCw className="h-4 w-4" />} onClick={() => setDocuments(INITIAL_DOCS)}>Reset Demo Data</Button>
            <Button variant="primary" icon={<Upload className="h-4 w-4" />} onClick={() => setMode('upload')}>Upload Documents</Button>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map((kpi) => (
          <Card key={kpi.label} hover className="p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-label font-medium text-text-secondary">{kpi.label}</p>
                <p className="mt-1 text-2xl font-semibold text-text-primary">{kpi.value}</p>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-border/60 bg-surface">{kpi.icon}</div>
            </div>
          </Card>
        ))}
      </section>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-2">
          <Button variant={mode === 'repository' ? 'primary' : 'secondary'} size="sm" onClick={() => setMode('repository')}>Repository</Button>
          <Button variant={mode === 'upload' ? 'primary' : 'secondary'} size="sm" onClick={() => setMode('upload')}>Upload Queue</Button>
          <Button variant={mode === 'workflow' ? 'primary' : 'secondary'} size="sm" onClick={() => setMode('workflow')}>Workflow</Button>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="info">204 files this month</Badge>
          <Badge variant="success" dot>Sync healthy</Badge>
        </div>
      </div>

      {mode === 'repository' && (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
          <div className="space-y-8 xl:col-span-8">
            <Card hover>
              <CardHeader className="border-b border-border/60">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div><CardTitle>Document Repository</CardTitle><CardDescription className="mt-1">Search, filter, and preview the current document set.</CardDescription></div>
                  <div className="flex flex-col gap-3 sm:flex-row">
                    <Input value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Search documents..." icon={<Search className="h-4 w-4" />} />
                    <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="min-h-[44px] rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text-primary">
                      <option value="all">All Status</option>
                      <option value="processed">Processed</option>
                      <option value="processing">Processing</option>
                      <option value="pending">Pending</option>
                      <option value="flagged">Flagged</option>
                    </select>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="grid gap-3 px-4 py-4 md:hidden">
                  {filtered.map((doc) => (
                    <article key={doc.id} className="rounded-2xl border border-border bg-background-secondary/60 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-accent/10">{fileIcon(doc.type)}</div>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-text-primary">{doc.name}</p>
                            <p className="text-xs text-text-tertiary">{doc.category}</p>
                          </div>
                        </div>
                        <Badge variant={(doc.status === 'processed' ? 'success' : doc.status === 'flagged' ? 'error' : doc.status === 'processing' ? 'warning' : 'info')}>{doc.label}</Badge>
                      </div>
                      <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
                        <div>
                          <p className="text-text-tertiary">Source</p>
                          <p className="mt-1 text-text-secondary">{doc.source}</p>
                        </div>
                        <div>
                          <p className="text-text-tertiary">Updated</p>
                          <p className="mt-1 text-text-secondary">{doc.updated}</p>
                        </div>
                        <div>
                          <p className="text-text-tertiary">Size</p>
                          <p className="mt-1 text-text-secondary">{doc.size}</p>
                        </div>
                        <div>
                          <p className="text-text-tertiary">Owner</p>
                          <p className="mt-1 text-text-secondary">{doc.owner}</p>
                        </div>
                      </div>
                      <div className="mt-4 flex justify-end gap-2">
                        <Button variant="ghost" size="sm" icon={<Eye className="h-4 w-4" />} onClick={() => setSelectedDocument(doc)}>Preview</Button>
                        <button type="button" onClick={() => setDocuments((prev) => prev.filter((item) => item.id !== doc.id))} className="inline-flex h-11 w-11 items-center justify-center rounded-lg border border-border bg-surface text-text-secondary hover:bg-surface-subtle hover:text-text-primary" aria-label={`Delete ${doc.name}`}>
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    </article>
                  ))}
                  {!filtered.length && <div className="rounded-2xl border border-border bg-surface-subtle px-4 py-10 text-center text-sm text-text-secondary">No documents match the current filters.</div>}
                </div>
                <div className="hidden overflow-x-auto md:block">
                  <table className="w-full table-fixed border-collapse">
                    <thead className="bg-[#0D1020]">
                      <tr className="border-b border-[#273047]">
                        <th className="w-[28%] px-6 py-4 text-left text-[11px] font-bold uppercase tracking-[0.15em] text-[#4A5A72]">Document</th>
                        <th className="w-[18%] px-6 py-4 text-left text-[11px] font-bold uppercase tracking-[0.15em] text-[#4A5A72]">Source</th>
                        <th className="w-[15%] px-6 py-4 text-left text-[11px] font-bold uppercase tracking-[0.15em] text-[#4A5A72]">Status</th>
                        <th className="w-[15%] px-6 py-4 text-left text-[11px] font-bold uppercase tracking-[0.15em] text-[#4A5A72]">Updated</th>
                        <th className="w-[12%] px-6 py-4 text-right text-[11px] font-bold uppercase tracking-[0.15em] text-[#4A5A72]">Size</th>
                        <th className="w-[12%] px-6 py-4 text-right text-[11px] font-bold uppercase tracking-[0.15em] text-[#4A5A72]">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((doc) => <DocRow key={doc.id} doc={doc} onPreview={setSelectedDocument} onDelete={(id) => setDocuments((prev) => prev.filter((d) => d.id !== id))} />)}
                      {!filtered.length && (
                        <tr><td colSpan={6} className="px-4 py-12 text-center text-sm text-text-secondary">No documents match the current filters.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            <Card hover>
              <CardHeader>
                <CardTitle>Upload Sources</CardTitle>
                <CardDescription>Choose how new documents enter the system.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  {SOURCE_OPTIONS.map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => setUploadSource(option.id)}
                      className={`rounded-xl border p-6 text-left transition-all duration-200 ${uploadSource === option.id ? 'border-brand-accent/30 bg-brand-accent/10 text-text-primary' : 'border-border bg-surface text-text-secondary hover:border-border-accent hover:bg-surface-subtle'}`}
                    >
                      <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-lg bg-brand/15 text-brand-accent">{option.icon}</div>
                      <h4 className="text-sm font-semibold">{option.label}</h4>
                      <p className="mt-1 text-body-sm text-text-secondary">{option.description}</p>
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6 xl:col-span-4">
            <Card hover>
              <CardHeader>
                <CardTitle>Repository Health</CardTitle>
                <CardDescription>Current upload and processing posture.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div><div className="mb-2 flex items-center justify-between text-sm"><span className="text-text-secondary">Processing Rate</span><span className="font-semibold text-text-primary">94%</span></div><Progress value={94} variant="success" /></div>
                <div><div className="mb-2 flex items-center justify-between text-sm"><span className="text-text-secondary">Manual Review</span><span className="font-semibold text-text-primary">12%</span></div><Progress value={12} variant="warning" /></div>
                <div><div className="mb-2 flex items-center justify-between text-sm"><span className="text-text-secondary">Flagged Docs</span><span className="font-semibold text-text-primary">5%</span></div><Progress value={5} variant="error" /></div>
              </CardContent>
            </Card>
            <Alert variant="info" title="Upload Tip">Use the upload queue to batch documents before routing them into classification or review.</Alert>
            <Card hover>
              <CardHeader><CardTitle>Preview Actions</CardTitle><CardDescription>Quick actions on the selected document.</CardDescription></CardHeader>
              <CardContent className="space-y-3">
                <Button variant="secondary" className="w-full" icon={<FileSearch className="h-4 w-4" />}>Classify Document</Button>
                <Button variant="secondary" className="w-full" icon={<ArrowRight className="h-4 w-4" />}>Go to HS Code Lookup</Button>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {mode === 'upload' && (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
          <div className="space-y-6 xl:col-span-8">
            <Card hover>
              <CardHeader><CardTitle>Upload Queue</CardTitle><CardDescription>Drag and drop files, then run bulk processing.</CardDescription></CardHeader>
              <CardContent>
                <div className="rounded-2xl border-2 border-dashed border-border bg-background-secondary/50 p-8 text-center hover:border-border-accent hover:bg-surface-subtle" onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); addFiles(Array.from(e.dataTransfer.files)); }}>
                  <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-brand/15 text-brand-accent"><Upload className="h-8 w-8" /></div>
                  <h3 className="text-lg font-semibold text-text-primary">Drop documents here</h3>
                  <p className="mt-2 text-body-sm text-text-secondary">PDF, JPG, PNG, and TIFF are supported.</p>
                  <div className="mt-5">
                    {uploadInput}
                    <Button variant="secondary" className="cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                      Browse Files
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card hover>
              <CardHeader className="flex-row items-center justify-between"><div><CardTitle>Current Batch</CardTitle><CardDescription>Files waiting to be processed.</CardDescription></div><Button variant="ghost" size="sm" onClick={() => setFiles([])}>Clear Batch</Button></CardHeader>
              <CardContent className="space-y-3">
                {!files.length ? <div className="rounded-xl border border-border bg-surface-subtle px-4 py-10 text-center text-sm text-text-secondary">No files in the upload queue yet.</div> : files.map((file) => (
                  <div key={file.id} className="flex items-center gap-3 rounded-xl border border-border bg-surface px-4 py-3">
                    {fileIcon(file.type)}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-text-primary">{file.name}</p>
                      <p className="text-xs text-text-tertiary">{file.size}</p>
                      <div className="mt-2"><Progress value={file.progress} variant={file.status === 'completed' ? 'success' : 'default'} /></div>
                    </div>
                    <Badge variant={file.status === 'completed' ? 'success' : 'info'}>{file.status === 'completed' ? 'Done' : 'Queued'}</Badge>
                    <button type="button" onClick={() => setFiles((prev) => prev.filter((f) => f.id !== file.id))} className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-surface text-text-secondary hover:bg-surface-subtle hover:text-text-primary" aria-label={`Remove ${file.name}`}><X className="h-4 w-4" /></button>
                  </div>
                ))}
              </CardContent>
              <div className="flex justify-end gap-3 border-t border-border px-6 py-4">
                <Button variant="secondary" onClick={() => setMode('repository')}>Back to Repository</Button>
                <Button onClick={() => { if (!files.length) return; setUploading(true); setFiles((prev) => prev.map((f) => ({ ...f, progress: 35, status: 'processing' }))); setTimeout(() => { setFiles((prev) => prev.map((f) => ({ ...f, progress: 100, status: 'completed' }))); setDocuments((prev) => [...prev, ...files.map((f, index) => ({ id: f.id, name: f.name, category: 'Imported Document', source: SOURCE_OPTIONS.find((s) => s.id === uploadSource)?.label || 'File Upload', status: 'processed', label: 'Processed', updated: `${index + 1} min ago`, size: f.size, type: f.type, owner: 'Current User', confidence: 96, notes: 'Imported through document management page.' }))]); setUploading(false); setMode('repository'); }, 1200); }} disabled={!files.length || uploading} icon={<Loader2 className={`h-4 w-4 ${uploading ? 'animate-spin' : ''}`} />}>{uploading ? 'Processing' : `Process ${files.length} File${files.length !== 1 ? 's' : ''}`}</Button>
              </div>
            </Card>
          </div>
          <div className="space-y-6 xl:col-span-4">
            <Card hover><CardHeader><CardTitle>Batch Metadata</CardTitle><CardDescription>Source and workflow context.</CardDescription></CardHeader><CardContent className="space-y-3"><div className="rounded-xl border border-border bg-surface px-4 py-3"><p className="text-xs uppercase tracking-[0.12em] text-text-tertiary">Upload Source</p><p className="mt-1 text-sm font-medium text-text-primary">{SOURCE_OPTIONS.find((o) => o.id === uploadSource)?.label}</p></div><div className="rounded-xl border border-border bg-surface px-4 py-3"><p className="text-xs uppercase tracking-[0.12em] text-text-tertiary">Batch Size</p><p className="mt-1 text-sm font-medium text-text-primary">{files.length} file(s)</p></div><div className="rounded-xl border border-border bg-surface px-4 py-3"><p className="text-xs uppercase tracking-[0.12em] text-text-tertiary">Status</p><p className="mt-1 text-sm font-medium text-text-primary">{uploading ? 'Processing' : 'Ready'}</p></div></CardContent></Card>
            <Alert variant="warning" title="Tip">Use batch upload for invoices and packing lists before extracting HS codes.</Alert>
          </div>
        </div>
      )}

      {mode === 'workflow' && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Card hover><CardHeader><CardTitle>Workflow Stages</CardTitle><CardDescription>Document lifecycle from intake to review.</CardDescription></CardHeader><CardContent className="space-y-4">{[{ label: 'Ingest', value: 100 }, { label: 'Classify', value: 94 }, { label: 'Extract', value: 88 }, { label: 'Review', value: 42 }].map((stage) => <div key={stage.label}><div className="mb-1 flex items-center justify-between text-sm"><span className="text-text-secondary">{stage.label}</span><span className="font-medium text-text-primary">{stage.value}%</span></div><Progress value={stage.value} /></div>)}</CardContent></Card>
          <Card hover><CardHeader><CardTitle>Operational Notes</CardTitle><CardDescription>What the team should watch next.</CardDescription></CardHeader><CardContent className="space-y-3"><Alert variant="info" title="Auto Routing">Documents from email and folder sync are routed into the repository automatically.</Alert><Alert variant="success" title="Preview Ready">Open any processed document to inspect the extracted metadata side by side.</Alert></CardContent></Card>
        </div>
      )}

      <Modal
        open={Boolean(selectedDocument)}
        onClose={() => setSelectedDocument(null)}
        title={selectedDocument?.name}
        description={selectedDocument ? `${selectedDocument.category} · ${selectedDocument.owner}` : undefined}
        footer={<div className="flex w-full items-center justify-between gap-3"><div className="flex items-center gap-3"><Avatar name={selectedDocument?.owner} /><div><p className="text-sm font-medium text-text-primary">{selectedDocument?.owner}</p><p className="text-xs text-text-tertiary">Confidence {selectedDocument?.confidence}%</p></div></div><div className="flex gap-3"><Button variant="secondary" onClick={() => setSelectedDocument(null)}>Close</Button><Button onClick={() => onNavigate?.('hs-codes')} icon={<ArrowRight className="h-4 w-4" />} iconPosition="right">Review HS Code</Button></div></div>}
      >
        {selectedDocument && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-border bg-surface px-4 py-3"><p className="text-xs uppercase tracking-[0.12em] text-text-tertiary">Status</p><p className="mt-1 text-sm font-medium text-text-primary">{selectedDocument.label}</p></div>
              <div className="rounded-xl border border-border bg-surface px-4 py-3"><p className="text-xs uppercase tracking-[0.12em] text-text-tertiary">Updated</p><p className="mt-1 text-sm font-medium text-text-primary">{selectedDocument.updated}</p></div>
              <div className="rounded-xl border border-border bg-surface px-4 py-3"><p className="text-xs uppercase tracking-[0.12em] text-text-tertiary">Confidence</p><p className="mt-1 text-sm font-medium text-text-primary">{selectedDocument.confidence}%</p></div>
              <div className="rounded-xl border border-border bg-surface px-4 py-3"><p className="text-xs uppercase tracking-[0.12em] text-text-tertiary">Size</p><p className="mt-1 text-sm font-medium text-text-primary">{selectedDocument.size}</p></div>
            </div>
            <div className="rounded-2xl border border-border bg-background-secondary p-4">
              <p className="text-sm font-medium text-text-primary">Notes</p>
              <p className="mt-2 text-body-sm text-text-secondary">{selectedDocument.notes}</p>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
