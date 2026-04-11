/**
 * DocumentContext
 *
 * Session-level state management for uploaded documents.
 * Persists files across panel switches within the current session.
 * Files are cleared when user logs out or refreshes the page.
 *
 * Duplicate Detection: Uses content-based SHA-256 hashing
 * - For PDFs: Extracts and hashes text content (ignores metadata)
 * - For other files: Hashes binary content
 */

import React, { createContext, useContext, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';

// Configure PDF.js worker - use unpkg CDN
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

const DocumentContext = createContext();
const MAX_PDF_PAGES_FOR_HASH = 5;
const MAX_PDF_TEXT_CHARS_FOR_HASH = 100000;
const MAX_PDF_SIZE_FOR_TEXT_HASH = 12 * 1024 * 1024; // 12 MB
const PDF_HASH_TIMEOUT_MS = 7000;

const normalizeFileType = (value = '', filename = '') => {
  const v = String(value || '').trim().toLowerCase();
  if (v === 'pdf' || v === '.pdf') return 'application/pdf';
  if (v === 'jpg' || v === 'jpeg' || v === '.jpg' || v === '.jpeg') return 'image/jpeg';
  if (v === 'png' || v === '.png') return 'image/png';
  if (v) return v;

  const name = String(filename || '').toLowerCase();
  if (name.endsWith('.pdf')) return 'application/pdf';
  if (name.endsWith('.jpg') || name.endsWith('.jpeg')) return 'image/jpeg';
  if (name.endsWith('.png')) return 'image/png';
  return 'application/pdf';
};

export const useDocumentContext = () => {
  const context = useContext(DocumentContext);
  if (!context) {
    throw new Error('useDocumentContext must be used within DocumentProvider');
  }
  return context;
};

/**
 * Extract text content from a PDF file
 * @param {File} file - The PDF file
 * @returns {Promise<string>} - Extracted text content
 */
const extractPDFText = async (
  file,
  maxPages = MAX_PDF_PAGES_FOR_HASH,
  maxChars = MAX_PDF_TEXT_CHARS_FOR_HASH
) => {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
    const pdf = await loadingTask.promise;

    let fullText = '';
    const pagesToProcess = Math.min(pdf.numPages, maxPages);
    for (let pageNum = 1; pageNum <= pagesToProcess; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const textContent = await page.getTextContent();
      const pageText = textContent.items.map(item => item.str).join(' ');
      fullText += pageText + '\n';
      if (fullText.length >= maxChars) break;
    }

    const normalizedText = fullText
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase()
      .slice(0, maxChars);
    return normalizedText;
  } catch (error) {
    console.error('[PDF] Error extracting text:', error);
    throw error;
  }
};

/**
 * Calculate SHA-256 hash of a file's content
 * For PDFs: Hashes extracted text content (content-based)
 * For other files: Hashes binary content (byte-based)
 * @param {File} file - The file to hash
 * @returns {Promise<string>} - Hex string of the file hash
 */
const calculateFileHash = async (file) => {
  try {
    console.log('[HASH] Calculating hash for:', file.name, 'Type:', file.type, 'Size:', file.size, 'bytes');

    let dataToHash;

    // Check if file is a PDF
    const isPDF = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');

    if (isPDF) {
      console.log('[HASH] PDF detected - using content-based hashing (bounded)');
      try {
        let pdfText = '';
        if (file.size <= MAX_PDF_SIZE_FOR_TEXT_HASH) {
          const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error('PDF text extraction timeout')), PDF_HASH_TIMEOUT_MS);
          });
          pdfText = await Promise.race([extractPDFText(file), timeoutPromise]);
        } else {
          console.warn('[HASH] Large PDF; using binary hash fallback:', file.size);
        }

        if (pdfText) {
          const encoder = new TextEncoder();
          dataToHash = encoder.encode(pdfText);
          console.log('[HASH] Hashing PDF text content');
        } else {
          dataToHash = await file.arrayBuffer();
          console.log('[HASH] Hashing PDF binary fallback');
        }
      } catch (pdfError) {
        console.warn('[HASH] PDF text extraction failed, falling back to binary hash:', pdfError);
        dataToHash = await file.arrayBuffer();
      }
    } else {
      console.log('[HASH] Non-PDF file - using binary hashing');
      dataToHash = await file.arrayBuffer();
    }

    const hashBuffer = await crypto.subtle.digest('SHA-256', dataToHash);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    console.log('[HASH] Result:', hashHex.substring(0, 16) + '...', '(first 16 chars)');
    return hashHex;
  } catch (error) {
    console.error('[HASH] Error calculating file hash:', error);
    // Fallback to a unique identifier if hashing fails
    const fallback = `fallback-${file.name}-${file.size}-${file.lastModified}-${Date.now()}`;
    console.log('[HASH] Using fallback:', fallback);
    return fallback;
  }
};

export const DocumentProvider = ({ children }) => {
  const [files, setFiles] = useState([]);

  // M02 pipeline state lives here so it survives DocumentPanel re-renders
  const [m02States, setM02States] = useState({});      // { [fileIdx]: { status, resultId, result, error } }
  const [activeM02Idx, setActiveM02Idx] = useState(null);

  const updateM02State = (idx, updates) => {
    setM02States(prev => ({ ...prev, [idx]: { ...(prev[idx] || {}), ...updates } }));
  };

  // Check if a file is a duplicate based on content hash
  const findDuplicates = (newFileHash, newFileName, newFileSize) => {
    console.log('[DUPLICATE CHECK] New file:', newFileName, 'Size:', newFileSize, 'Hash:', newFileHash);
    console.log('[DUPLICATE CHECK] Existing files count:', files.length);
    console.log('[DUPLICATE CHECK] Existing files:', files.map(f => ({
      name: f.file.name,
      size: f.file.size,
      hash: f.hash
    })));

    return files
      .map((fileState, index) => {
        // Compare content hashes (SHA-256)
        console.log(`[COMPARE] "${newFileName}" hash: ${newFileHash.substring(0,16)}...`);
        console.log(`[COMPARE] "${fileState.file.name}" hash: ${fileState.hash.substring(0,16)}...`);
        console.log(`[COMPARE] Match? ${fileState.hash === newFileHash}`);

        if (fileState.hash === newFileHash) {
          console.log('[DUPLICATE FOUND] ✅ Match at index:', index, 'File:', fileState.file.name);
          return { index, fileState };
        }
        return null;
      })
      .filter(Boolean);
  };

  // Add new files to the state with content-based duplicate detection
  const addFiles = async (newFiles) => {
    console.log('[ADD FILES] Processing', newFiles.length, 'file(s)');
    const results = {
      added: [],
      duplicates: []
    };

    // Import API service dynamically to avoid circular dependency
    const { documentService } = await import('../services/api');

    // Process files sequentially to calculate hashes
    for (const newFile of newFiles) {
      console.log('[ADD FILES] Processing file:', newFile.name, 'Size:', newFile.size);

      // Calculate hash for the new file
      const newFileHash = await calculateFileHash(newFile);
      console.log('[ADD FILES] Calculated hash:', newFileHash);

      // Check for local duplicates (current session) — restore state, no warning
      const localDuplicates = findDuplicates(newFileHash, newFile.name, newFile.size);

      if (localDuplicates.length > 0) {
        const existingFileState = localDuplicates[0].fileState;
        const restoredFileState = {
          file: newFile,
          hash: newFileHash,
          serverPath: existingFileState.serverPath || null,
          classification: existingFileState.classification || null,
          extraction: existingFileState.extraction || null,
          documentId: existingFileState.documentId || null,
          loading: false,
          timestamp: Date.now(),
          highlighted: false,
          isDuplicate: false,
          isUploaded: !!existingFileState.serverPath,
          uploaded: !!existingFileState.serverPath,
          isExtracted: !!existingFileState.extraction,
        };
        results.added.push(restoredFileState);
        continue;
      }

      // Check for database duplicates (previous sessions)
      try {
        console.log('[ADD FILES] Checking database for duplicates...');
        const dbCheck = await documentService.checkDuplicate(newFileHash);

        if (dbCheck.exists) {
          // File exists in database from previous session
          console.log('[ADD FILES] DATABASE DUPLICATE detected:', newFile.name);
          console.log('[ADD FILES] Database response:', JSON.stringify(dbCheck, null, 2));
          console.log('[ADD FILES] Extracted data:', dbCheck.existing_file.extracted_data);
          console.log('[ADD FILES] File path:', dbCheck.existing_file.file_path);

          // Check if filename is EXACTLY the same
          const existingDbFilename = dbCheck.existing_file.filename;
          const isSameFilename = existingDbFilename === newFile.name;

          console.log('[ADD FILES] Filename comparison (DB):', {
            newFilename: newFile.name,
            existingFilename: existingDbFilename,
            isSameFilename: isSameFilename
          });

          // File exists in DB — restore its state so the user can continue working with it
          // Do NOT mark as isDuplicate; that blocks upload/extract buttons and confuses the workflow
          console.log('[ADD FILES] DATABASE DUPLICATE → Restoring existing file state');

          const duplicateFileState = {
            file: newFile,
            hash: newFileHash,
            serverPath: dbCheck.existing_file.file_path || null,
            classification: dbCheck.existing_file.classification || null,
            extraction: dbCheck.existing_file.extracted_data || null,
            documentId: dbCheck.existing_file.id || dbCheck.existing_file.document_id || null,
            loading: false,
            timestamp: Date.now(),
            highlighted: false,
            isDuplicate: false, // Not flagged — let the user work with it normally
            isUploaded: true,
            uploaded: true,
            isExtracted: !!dbCheck.existing_file.extracted_data,
            isSameFilename: isSameFilename,
            duplicateInfo: {
              uploadedAt: dbCheck.existing_file.uploaded_at,
              documentType: dbCheck.existing_file.document_type,
              originalFilename: existingDbFilename
            }
          };

          console.log('[ADD FILES] Created duplicate file state:', {
            isDuplicate: duplicateFileState.isDuplicate,
            isUploaded: duplicateFileState.isUploaded,
            isExtracted: duplicateFileState.isExtracted,
            hasExtraction: !!duplicateFileState.extraction,
            serverPath: duplicateFileState.serverPath,
            originalFilename: existingDbFilename,
            isSameFilename: isSameFilename
          });

          results.added.push(duplicateFileState);
          // Don't push to duplicates — no warning modal needed when restoring from DB
          continue;
        }
      } catch (dbError) {
        console.warn('[ADD FILES] Database check failed, proceeding with local check only:', dbError);
        // If database check fails, still allow the file (don't block user)
      }

      // File is unique, add it with its hash
      console.log('[ADD FILES] UNIQUE file, adding:', newFile.name);
      const fileWithState = {
        file: newFile,
        hash: newFileHash,
        serverPath: null,
        classification: null,
        extraction: null,
        loading: false,
        timestamp: Date.now(),
        highlighted: false,
        isDuplicate: false,
        isUploaded: false,
        isExtracted: false
      };
      results.added.push(fileWithState);
    }

    // Add all files (both unique and duplicates)
    if (results.added.length > 0) {
      console.log('[ADD FILES] Adding', results.added.length, 'file(s) to state');
      console.log('[ADD FILES] Files being added:', results.added.map(f => ({
        name: f.file.name,
        isDuplicate: f.isDuplicate,
        hasExtraction: !!f.extraction,
        serverPath: f.serverPath
      })));

      setFiles(prev => {
        const newFiles = [...prev, ...results.added];
        console.log('[ADD FILES] New files state length:', newFiles.length);
        return newFiles;
      });
    }

    console.log('[ADD FILES] Final results:', {
      added: results.added.length,
      duplicates: results.duplicates.length,
      addedFiles: results.added.map(f => f.file.name),
      duplicateFiles: results.duplicates.map(d => d.file.name)
    });
    return results;
  };

  // Update a specific file's state
  const updateFile = (idx, updates) => {
    setFiles(prev => prev.map((f, i) => i === idx ? { ...f, ...updates } : f));
  };

  // Highlight a specific file (for duplicate detection)
  const highlightFile = (idx) => {
    // First, clear all highlights
    setFiles(prev => prev.map(f => ({ ...f, highlighted: false })));

    // Then highlight the target file
    setTimeout(() => {
      setFiles(prev => prev.map((f, i) => i === idx ? { ...f, highlighted: true } : f));

      // Remove highlight after 5 seconds (increased for better visibility)
      setTimeout(() => {
        setFiles(prev => prev.map((f, i) => i === idx ? { ...f, highlighted: false } : f));
      }, 5000);
    }, 100);
  };

  // Programmatically add a file (e.g., virtual voice file)
  // Note: Caller should ensure fileState includes a 'hash' property
  const addFile = async (fileState) => {
    // If hash is not provided and file exists, calculate it
    if (!fileState.hash && fileState.file) {
      fileState.hash = await calculateFileHash(fileState.file);
    }
    setFiles(prev => {
      // Skip if a file with the same documentId, serverPath, or hash already exists
      const alreadyExists = prev.some(f =>
        (fileState.documentId && f.documentId === fileState.documentId) ||
        (fileState.serverPath && f.serverPath === fileState.serverPath) ||
        (fileState.hash && f.hash === fileState.hash && !fileState.hash.startsWith('intake-'))
      );
      if (alreadyExists) return prev;
      return [...prev, fileState];
    });
  };

  // Remove a file
  const removeFile = (idx) => {
    setFiles(prev => prev.filter((_, i) => i !== idx));
  };

  // Clear all files
  const clearFiles = () => {
    setFiles([]);
  };

  // Load files from database (after login or page refresh)
  const loadDatabaseFiles = async () => {
    try {
      console.log('[LOAD DB FILES] Fetching documents from database...');
      const { documentService } = await import('../services/api');
      const response = await documentService.getAllDocuments();
      const docs = Array.isArray(response)
        ? response
        : (response?.documents || response?.items || []);

      if (docs.length > 0) {
        console.log('[LOAD DB FILES] Found', docs.length, 'documents');

        // Convert database documents to file state format
        const dbFiles = docs.map((doc, idx) => {
          // Create a metadata-only placeholder file. Actual bytes are fetched
          // from backend preview endpoints when needed.
          const virtualFile = new File(
            [],
            doc.filename || `document_${idx + 1}.pdf`,
            { type: normalizeFileType(doc.file_type, doc.filename) }
          );

          return {
            file: virtualFile,
            hash: doc.content_hash || `db-${doc.id}`,
            serverPath: doc.file_path,
            classification: doc.doc_type || null,
            extraction: doc.extracted_data,
            loading: false,
            timestamp: doc.created_at ? new Date(doc.created_at).getTime() : Date.now(),
            highlighted: false,
            isDuplicate: false, // Not a duplicate since it's from database
            isUploaded: true, // Already in database
            isExtracted: !!doc.extracted_data, // Has extraction data
            fromDatabase: true, // Flag to indicate it's from database
            documentId: doc.id, // Store database ID
            duplicateInfo: {
              uploadedAt: doc.created_at,
              documentType: doc.doc_type,
              originalFilename: doc.filename
            }
          };
        });

        setFiles(dbFiles);
        console.log('[LOAD DB FILES] Loaded', dbFiles.length, 'files from database');
        return { success: true, count: dbFiles.length };
      }

      return { success: true, count: 0 };
    } catch (error) {
      console.error('[LOAD DB FILES] Error loading database files:', error);
      return { success: false, error: error.message };
    }
  };

  const value = {
    files,
    setFiles,
    addFiles,
    updateFile,
    addFile,
    removeFile,
    clearFiles,
    loadDatabaseFiles,
    highlightFile,
    findDuplicates,
    calculateFileHash,
    m02States,
    setM02States,
    updateM02State,
    activeM02Idx,
    setActiveM02Idx,
  };

  return (
    <DocumentContext.Provider value={value}>
      {children}
    </DocumentContext.Provider>
  );
};

// Export calculateFileHash for external use
export { calculateFileHash };

export default DocumentContext;
