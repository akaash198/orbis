/**
 * useDocumentProcessing Hook
 *
 * Custom hook for document processing workflows including upload, classification, and extraction.
 * Now uses DocumentContext for session-level state persistence across panel switches.
 */

import { documentService } from '../services/api';
import { useDocumentContext } from '../contexts/DocumentContext';

const useDocumentProcessing = (onExtractSuccess) => {
  const { files, addFiles, updateFile, addFile, highlightFile, removeFile,
          m02States, setM02States, updateM02State, activeM02Idx, setActiveM02Idx } = useDocumentContext();

  // Add new files to the state with content-based duplicate detection
  // Now async because it calculates SHA-256 hashes
  const handleFileInput = async (e) => {
    const newFiles = Array.from(e.target.files);
    console.log('[useDocumentProcessing] Processing', newFiles.length, 'file(s)');
    const results = await addFiles(newFiles);
    console.log('[useDocumentProcessing] Results:', results);
    console.log('[useDocumentProcessing] Current files count:', files.length);

    // Return results to caller so they can handle duplicates
    return results;
  };

  // Upload a document to the server with duplicate detection
  const uploadDocument = async (idx) => {
    const fileState = files[idx];
    if (!fileState.file) return;

    updateFile(idx, { loading: true });

    try {
      // Pass the content hash to backend for server-side duplicate detection
      const response = await documentService.uploadDocument(fileState.file, fileState.hash);
      updateFile(idx, {
        serverPath: response.file_path,
        documentId: response.document_id || response.id,
        loading: false,
        isUploaded: true,
        uploaded: true  // For DocumentPreviewModal compatibility
      });
      console.log('[UPLOAD] Success:', response.filename);
    } catch (err) {
      console.error('Upload error:', err);

      // Handle duplicate file error (409 Conflict)
      if (err?.response?.status === 409) {
        const errorDetail = err.response.data.detail;
        const existingFile = errorDetail.existing_file;
        const uploadedDate = existingFile?.uploaded_at
          ? new Date(existingFile.uploaded_at).toLocaleString()
          : 'Unknown';

        alert(
          `⚠️ Duplicate File Detected!\n\n` +
          `${errorDetail.message}\n\n` +
          `Original file uploaded: ${uploadedDate}\n` +
          `Document type: ${existingFile?.document_type || 'Unknown'}`
        );
      } else {
        alert(`Upload failed: ${err?.response?.status} ${err?.response?.data?.detail || err.message}`);
      }

      updateFile(idx, { loading: false });
    }
  };

  // Extract data from a document
  const extractDocument = async (idx, documentType = 'invoice', extractBarcodes = false) => {
    const fileState = files[idx];
    if (!fileState.serverPath) return;

    updateFile(idx, { loading: true });

    try {
      // NEW: Use extractDocumentSmart for automatic fast/standard mode selection
      // If documentType is 'invoice' (default), it uses ULTRA-FAST mode (3-7x faster!)
      // If documentType is 'unknown', it uses standard classification
      console.log(`[EXTRACTION] Starting with type: ${documentType}, extractBarcodes: ${extractBarcodes}`);

      const response = await documentService.extractDocumentSmart(
        fileState.serverPath,
        documentType,  // Defaults to 'invoice' for speed
        fileState.classification || null,
        fileState.file?.name || 'unknown',
        fileState.hash,  // Pass the hash to store in database
        extractBarcodes  // Pass barcode extraction flag
      );

      console.log(`[EXTRACTION] Response received:`, response);
      console.log(`[EXTRACTION] Barcodes in response:`, response.data?.barcodes);

      if (extractBarcodes) {
        if (response.data?.barcodes && response.data.barcodes.length > 0) {
          console.log(`[BARCODE] ✓ Found ${response.data.barcodes.length} barcode(s):`, response.data.barcodes);
        } else {
          console.warn(`[BARCODE] ✗ No barcodes found (extract_barcodes was enabled)`);
        }
      }

      updateFile(idx, {
        extraction: response.data,
        loading: false,
        isExtracted: true  // Mark as extracted to disable Extract button
      });

      // Call the success callback if provided, passing extraction data
      if (onExtractSuccess) {
        onExtractSuccess(response.data, fileState);
      }
    } catch (err) {
      console.error('Extraction error:', err);
      alert(`Extraction failed: ${err?.response?.status} ${err?.response?.data?.detail || err.message}`);
      updateFile(idx, { loading: false });
    }
  };

  return {
    files,
    addFile,
    handleFileInput,
    uploadDocument,
    extractDocument,
    highlightFile,
    updateFile,
    removeFile,
    m02States,
    setM02States,
    updateM02State,
    activeM02Idx,
    setActiveM02Idx,
  };
};

export default useDocumentProcessing;
