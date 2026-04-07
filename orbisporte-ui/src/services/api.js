/**
 * API Service
 * 
 * Centralizes all API calls to the backend.
 */

import axios from 'axios';

// Prefer the documented local env vars, then fall back to localhost.
const API_URL =
  process.env.REACT_APP_API_BASE_URL ||
  process.env.REACT_APP_API_URL ||
  'http://localhost:8000';
export { API_URL, apiClient };
console.log('API URL:', API_URL);

// Create axios instance with base URL
const apiClient = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 120000, // 2 minutes timeout for long-running operations
});

// Token management
let authToken = localStorage.getItem('authToken');
let refreshToken = localStorage.getItem('refreshToken');
let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach(prom => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

// Set auth token in axios headers
const setAuthToken = (token) => {
  authToken = token;
  if (token) {
    apiClient.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    localStorage.setItem('authToken', token);
  } else {
    delete apiClient.defaults.headers.common['Authorization'];
    localStorage.removeItem('authToken');
  }
};

// Set refresh token in localStorage
const setRefreshToken = (token) => {
  refreshToken = token;
  if (token) {
    localStorage.setItem('refreshToken', token);
  } else {
    localStorage.removeItem('refreshToken');
  }
};

// Initialize token if available
if (authToken) {
  setAuthToken(authToken);
}

// Request interceptor to add auth token
apiClient.interceptors.request.use(
  (config) => {
    if (authToken) {
      config.headers.Authorization = `Bearer ${authToken}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle auth errors and automatic token refresh
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Check if error is 401 and we haven't already tried to refresh
    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        // If already refreshing, queue this request
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then(token => {
            originalRequest.headers['Authorization'] = 'Bearer ' + token;
            return apiClient(originalRequest);
          })
          .catch(err => {
            return Promise.reject(err);
          });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      // Try to refresh the token
      if (refreshToken) {
        try {
          console.log('Attempting to refresh access token...');
          const response = await axios.post(`${API_URL}/react/refresh-token`, {
            refresh_token: refreshToken
          });

          const { access_token, refresh_token: newRefreshToken } = response.data;

          // Update tokens
          setAuthToken(access_token);
          // Only update the refresh token if the backend returned a new one.
          // The /react/refresh-token endpoint returns only access_token, so
          // calling setRefreshToken(undefined) would delete the existing one.
          if (newRefreshToken) {
            setRefreshToken(newRefreshToken);
          }

          // Update the original request with new token
          originalRequest.headers['Authorization'] = 'Bearer ' + access_token;

          // Process all queued requests
          processQueue(null, access_token);

          console.log('Token refreshed successfully');
          isRefreshing = false;

          // Retry the original request
          return apiClient(originalRequest);
        } catch (refreshError) {
          console.error('Token refresh failed:', refreshError);
          processQueue(refreshError, null);
          isRefreshing = false;

          // Clear tokens and notify user
          setAuthToken(null);
          setRefreshToken(null);

          window.dispatchEvent(new CustomEvent('tokenExpired', {
            detail: {
              message: 'Your session has expired. Please log in again.',
              status: 401
            }
          }));

          return Promise.reject(refreshError);
        }
      } else {
        // No refresh token available
        isRefreshing = false;
        setAuthToken(null);

        window.dispatchEvent(new CustomEvent('tokenExpired', {
          detail: {
            message: 'Your session has expired. Please log in again.',
            status: 401
          }
        }));

        return Promise.reject(error);
      }
    }

    // Handle 402 status or other errors
    if (error.response?.status === 402) {
      setAuthToken(null);
      setRefreshToken(null);

      window.dispatchEvent(new CustomEvent('tokenExpired', {
        detail: {
          message: 'Your session has expired. Please log in again.',
          status: error.response?.status
        }
      }));
    }

    return Promise.reject(error);
  }
);

// ---- Fallback host handling for ERR_NETWORK (dev convenience) ----
const fallbackHosts = (() => {
  const hosts = [];
  
  // 1. If API_URL is absolute, add its origin
  if (API_URL.startsWith('http')) {
    try { hosts.push(new URL(API_URL).origin); } catch (_) {}
  }
  
  // 2. 127.0.0.1 variant — only for local dev
  if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
     hosts.push('http://localhost:8000');
     hosts.push('http://127.0.0.1:8000');
  }

  // 3. Always include current origin as a fallback for relative paths
  if (typeof window !== 'undefined') {
    hosts.push(window.location.origin);
  }

  // Deduplicate
  return Array.from(new Set(hosts.filter(Boolean)));
})();

async function postWithFallback(path, data, config) {
  // If no fallback hosts, just use the apiClient directly
  if (fallbackHosts.length === 0) {
    return apiClient.post(path, data, config);
  }

  let lastErr = new Error('Connection failed');
  for (const origin of fallbackHosts) {
    try {
      const isBaseOrigin = origin === apiClient.defaults.baseURL || 
                           (API_URL.startsWith('/') && origin === window.location.origin);
      
      const client = isBaseOrigin
        ? apiClient
        : axios.create({ baseURL: origin, headers: { 'Content-Type': 'application/json' } });
        
      if (authToken) client.defaults.headers.common['Authorization'] = `Bearer ${authToken}`;
      const res = await client.post(path, data, config);
      
      // If different origin succeeded, update default for future calls
      if (!isBaseOrigin && origin.startsWith('http')) {
        apiClient.defaults.baseURL = origin;
      }
      return res;
    } catch (err) {
      lastErr = err;
      // Retry only on network errors (no response)
      if (err.code !== 'ERR_NETWORK' && !(!err.response && err.request)) {
        throw err;
      }
    }
  }
  throw lastErr;
}

// Document Services
const documentService = {
  checkDuplicate: async (contentHash) => {
    const response = await apiClient.post('/react/check-duplicate', {
      content_hash: contentHash
    });
    return response.data;
  },

  uploadDocument: async (file, contentHash = null) => {
    const formData = new FormData();
    formData.append('file', file);
    if (contentHash) {
      formData.append('content_hash', contentHash);
      console.log('[UPLOAD] Sending content_hash:', contentHash.substring(0, 16) + '...');
    }
    const response = await apiClient.post('/react/upload-document', formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    });
    return response.data;
  },

  extractDocument: async (filePath, classification, filename, contentHash = null, extractBarcodes = false) => {
    // Use longer timeout specifically for extraction (5 minutes)
    console.log('[API] Using extraction timeout: 300000ms (5 minutes) - VERSION 2.0');
    const response = await apiClient.post('/react/extract', {
      file_path: filePath,
      classification,
      filename: filename || 'unknown',
      content_hash: contentHash,
      extract_barcodes: extractBarcodes
    }, {
      timeout: 300000 // 5 minutes for extraction operations
    });
    return response.data;
  },

  /**
   * ULTRA-FAST extraction (3-7x faster!)
   * Use this when document type is known - skips classification entirely.
   *
   * @param {string} filePath - Path to uploaded PDF
   * @param {string} documentType - Known document type (invoice, bill_of_lading, packing_list, etc.)
   * @param {string} filename - Original filename
   * @param {boolean} extractBarcodes - Whether to extract barcodes (default: false)
   * @returns {Promise} Extraction result
   *
   * Performance:
   * - Text-based PDFs: 5-12 seconds for 7 pages
   * - Image-based PDFs: 10-15 seconds for 7 pages
   */
  extractDocumentFast: async (filePath, documentType, filename = 'unknown', extractBarcodes = false, contentHash = null) => {
    console.log(`[FAST] Using fast extraction for ${filename} as ${documentType}`);
    const response = await apiClient.post('/react/extract-fast', {
      file_path: filePath,
      document_type: documentType,
      filename: filename,
      extract_barcodes: extractBarcodes,
      content_hash: contentHash
    }, {
      timeout: 300000 // 5 minutes for extraction operations
    });
    console.log(`[FAST] Extraction completed in ${response.data.processing_time}s`);
    return response.data;
  },

  /**
   * Smart extraction - automatically chooses fast or standard mode
   *
   * @param {string} filePath - Path to uploaded PDF
   * @param {string} documentType - Document type ('invoice', 'unknown', etc.)
   * @param {object} classification - Pre-computed classification (optional)
   * @param {string} filename - Original filename
   * @param {string} contentHash - SHA-256 hash for duplicate detection (optional)
   * @param {boolean} extractBarcodes - Whether to extract barcodes/QR codes (default: false)
   * @returns {Promise} Extraction result
   */
  extractDocumentSmart: async (filePath, documentType = 'unknown', classification = null, filename = 'unknown', contentHash = null, extractBarcodes = false) => {
    // Use standard extraction for all cases
    console.log(`[SMART] Using STANDARD extraction mode`);
    return documentService.extractDocument(filePath, classification, filename, contentHash, extractBarcodes);
  },

  /**
   * Get all extracted documents for the current user
   */
  getAllDocuments: async () => {
    const response = await apiClient.get('/react/documents');
    return response.data;
  },

  /**
   * Get a specific document by ID with full extracted data
   */
  getDocumentById: async (documentId) => {
    const response = await apiClient.get(`/react/documents/${documentId}`);
    return response.data;
  },

  /**
   * Rescan and re-extract data from a previously uploaded document
   * Updates the existing database record with new extraction data
   *
   * @param {string} contentHash - SHA-256 hash of the document
   * @param {string} filePath - Path to the uploaded file
   * @param {string} filename - Original filename
   * @param {boolean} extractBarcodes - Whether to extract barcodes/QR codes (default: false)
   * @returns {Promise} Rescan result with updated extraction data
   */
  rescanDocument: async (contentHash, filePath, filename = 'unknown', extractBarcodes = false) => {
    console.log(`[RESCAN] Rescanning document: ${filename}`);
    console.log(`[RESCAN] Hash: ${contentHash.substring(0, 16)}...`);
    console.log(`[RESCAN] Path: ${filePath}`);
    console.log(`[RESCAN] Extract barcodes: ${extractBarcodes}`);

    const response = await apiClient.post('/react/rescan', {
      content_hash: contentHash,
      file_path: filePath,
      filename: filename,
      extract_barcodes: extractBarcodes
    });

    console.log(`[RESCAN] Success:`, response.data.message);
    return response.data;
  },

  /**
   * Delete a document by ID
   */
  deleteDocument: async (documentId) => {
    const response = await apiClient.delete(`/react/documents/${documentId}`);
    return response.data;
  },

  /**
   * Update document notes/tags (partial update)
   */
  updateDocumentNotes: async (documentId, notes) => {
    const response = await apiClient.patch(`/react/documents/${documentId}`, { notes });
    return response.data;
  },

  /**
   * Persist a confirmed/manually-entered HSN code for a document.
   * Saves to ProcessedDocument.hs_code and propagates into the latest
   * M02ExtractionResult.normalised_fields so the code is used consistently.
   */
  saveDocumentHSN: async (documentId, hsnCode, hsnDescription = null) => {
    const body = { hs_code: hsnCode };
    if (hsnDescription) body.hs_code_description = hsnDescription;
    const response = await apiClient.patch(`/react/documents/${documentId}`, body);
    return response.data;
  },
};

// Q&A Service for general customs questions
const qaService = {
  async askGeneralQuestion(question) {
    try {
      const response = await fetch(`${API_URL}/react/qa`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ question }),
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error asking general question:', error);
      throw error;
    }
  }
};

// Chat Service for document-specific questions (RAG pipeline)
const chatService = {
  async sendMessage(message, useAllDocuments = false) {
    try {
      const response = await fetch(`${API_URL}/react/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          question: message,
          use_all_documents: useAllDocuments
        }),
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error sending chat message:', error);
      throw error;
    }
  },

  async getDocumentSummary() {
    try {
      const response = await fetch(`${API_URL}/react/documents/summary`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error getting document summary:', error);
      throw error;
    }
  },

  async validateDocumentContext(question) {
    try {
      const response = await fetch(`${API_URL}/react/documents/validate-context`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ question }),
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error validating document context:', error);
      throw error;
    }
  }
};

// M02 Pipeline Service
const m02Service = {
  /**
   * Trigger M02 pipeline for a document.
   * Uses postWithFallback so transient network errors are retried
   * across all known backend hosts before giving up.
   * Returns { result_id, status }.
   */
  process: async (documentId, documentType = null) => {
    const body = documentType ? { document_type: documentType } : {};
    const response = await postWithFallback(`/m02/process/${documentId}`, body);
    return response.data;
  },

  /** Poll for M02 result by document ID. Returns full result object. */
  getResult: async (documentId) => {
    const response = await apiClient.get(`/m02/result/${documentId}`);
    return response.data;
  },

  /** Submit human review corrections for a result. */
  submitReview: async (resultId, reviewedFields, approved = true) => {
    const response = await apiClient.patch(`/m02/review/${resultId}`, {
      reviewed_fields: reviewedFields,
      approved,
    });
    return response.data;
  },
};

// HS Code Services
const hsCodeService = {
  lookupHSCode: async (productDescription) => {
    const response = await apiClient.post('/react/hscode', { 
      product_description: productDescription,
      use_agentic: true
    });
    return response.data;
  },

  enhanceWithHSCodes: async (extractedData) => {
    const response = await apiClient.post('/react/enhance-hscode', {
      extracted_data: extractedData
    });
    return response.data;
  }
};

// Customs Services
const customsService = {
  generateDeclaration: async (invoices, billOfLading, shipmentType, shipmentChannel) => {
    const response = await apiClient.post('/customs/generate-declaration', {
      invoices,
      bill_of_lading: billOfLading,
      shipment_type: shipmentType,
      shipment_channel: shipmentChannel
    });
    return response.data;
  },

  /**
   * Generate customs declaration from selected document IDs (from database)
   * @param {Array<number>} documentIds - Array of document IDs to include
   * @param {string} shipmentType - "Import" or "Export"
   * @param {string} shipmentChannel - "Sea", "Air", or "Land"
   */
  generateDeclarationFromDocuments: async (documentIds, shipmentType, shipmentChannel) => {
    const response = await apiClient.post('/customs/generate-from-documents', {
      document_ids: documentIds,
      shipment_type: shipmentType,
      shipment_channel: shipmentChannel
    });
    return response.data;
  },

  /**
   * Generate customs declaration from session documents (in-memory)
   * @param {Array<Object>} documents - Array of document objects with extracted data
   * @param {string} shipmentType - "Import" or "Export"
   * @param {string} shipmentChannel - "Sea", "Air", or "Land"
   */
  generateDeclarationFromSessionDocs: async (documents, shipmentType, shipmentChannel) => {
    const response = await apiClient.post('/customs/generate-from-session', {
      documents: documents,
      shipment_type: shipmentType,
      shipment_channel: shipmentChannel
    });
    return response.data;
  },

  validateDeclaration: async (declaration) => {
    const response = await apiClient.post('/customs/validate', { declaration });
    return response.data;
  },

  exportDeclaration: async (declaration, format = 'json') => {
    const response = await apiClient.post('/customs/export', { 
      declaration, 
      format 
    });
    return response.data;
  }
};

// Dashboard Services
const dashboardService = {
  /**
   * Get user-specific dashboard statistics
   * Requires authentication
   */
  getDashboardStats: async () => {
    const response = await apiClient.get('/react/dashboard/stats');
    return response.data;
  }
};

// Authentication Services
const authService = {
  async validateToken() {
    try {
      if (!authToken) {
        return { valid: false, error: 'No token found' };
      }

      const response = await apiClient.get('/react/validate-token');
      return { valid: true, data: response.data };
    } catch (error) {
      console.error('Token validation error:', error);
      if (error.response?.status === 401 || error.response?.status === 402) {
        // Token is invalid or expired
        setAuthToken(null);
        return { valid: false, error: 'Token expired or invalid' };
      }
      return { valid: false, error: error.message };
    }
  },

  async login(user_name, password) {
    console.log('[authService] Login attempt for user:', user_name);
    console.log('[authService] API URL:', API_URL);
    console.log('[authService] Fallback hosts:', fallbackHosts);

    try {
      console.log('[authService] Calling postWithFallback to /react/login');
      const response = await postWithFallback('/react/login', { user_name, password }, { timeout: 10000 });
      console.log('[authService] Login response:', response);

      // Store JWT tokens
      if (response.data.access_token) {
        console.log('[authService] Setting access token');
        setAuthToken(response.data.access_token);
      }
      if (response.data.refresh_token) {
        console.log('[authService] Setting refresh token');
        setRefreshToken(response.data.refresh_token);
      }

      console.log('[authService] Login successful!');
      return { success: true, user: response.data.user, ...response.data };
    } catch (error) {
      console.error('[authService] Login error:', error);
      console.error('[authService] Error details:', {
        code: error.code,
        response: error.response,
        message: error.message
      });
      throw error;
    }
  },

  async signup(userData) {
    try {
      const response = await postWithFallback('/react/signup', userData);
      return response.data;
    } catch (error) {
      console.error('Signup error:', error);
      throw error;
    }
  },

  async logout() {
    try {
      // Send refresh token to backend for revocation
      const response = await apiClient.post('/react/logout', {
        refresh_token: refreshToken
      });

      // Clear tokens on logout
      setAuthToken(null);
      setRefreshToken(null);

      // Clear session data
      sessionStorage.removeItem('customs_declarations_count');

      return response.data;
    } catch (error) {
      console.error('Logout error:', error);
      // Clear tokens even if logout fails
      setAuthToken(null);
      setRefreshToken(null);

      // Clear session data even if logout fails
      sessionStorage.removeItem('customs_declarations_count');

      throw error;
    }
  },

  async updateProfile(userId, profileData) {
    try {
      const response = await apiClient.put(`/auth/users/${userId}`, profileData);
      return response.data;
    } catch (error) {
      console.error('Profile update error:', error);
      throw error;
    }
  },

  async createUser(userData) {
    try {
      const response = await apiClient.post('/auth/users', userData);
      return response.data;
    } catch (error) {
      console.error('Create user error:', error);
      throw error;
    }
  },

  async getUsers() {
    try {
      const response = await apiClient.get('/auth/users');
      return response.data;
    } catch (error) {
      console.error('Get users error:', error);
      throw error;
    }
  },

  async deleteUser(userId) {
    try {
      const response = await apiClient.delete(`/auth/users/${userId}`);
      return response.data;
    } catch (error) {
      console.error('Delete user error:', error);
      throw error;
    }
  },

  // Refresh token manually
  async refreshAccessToken() {
    try {
      if (!refreshToken) {
        throw new Error('No refresh token available');
      }

      const response = await axios.post(`${API_URL}/react/refresh-token`, {
        refresh_token: refreshToken
      });

      const { access_token, refresh_token: newRefreshToken } = response.data;

      // Update tokens
      setAuthToken(access_token);
      setRefreshToken(newRefreshToken);

      return response.data;
    } catch (error) {
      console.error('Manual token refresh error:', error);
      // Clear tokens if refresh fails
      setAuthToken(null);
      setRefreshToken(null);
      throw error;
    }
  },

  // Token management
  getToken: () => authToken,
  getRefreshToken: () => refreshToken,
  setToken: setAuthToken,
  setRefreshToken: setRefreshToken,
  clearToken: () => {
    setAuthToken(null);
    setRefreshToken(null);
  },
  isAuthenticated: () => !!authToken
};

// ============================================================================
// DUTY CALCULATOR SERVICE (Module 5 - OrbisPorté)
// ============================================================================
const dutyService = {
  /**
   * Calculate customs duties for an import
   */
  async calculateDuty(payload) {
    try {
      const response = await apiClient.post('/react/duty/calculate', payload);
      return response.data;
    } catch (error) {
      console.error('Duty calculation error:', error);
      throw error;
    }
  },

  /**
   * Get duty rates for a specific HSN code
   */
  async getDutyRates(hsnCode, portCode = null, countryOfOrigin = null) {
    try {
      const params = new URLSearchParams();
      if (portCode) params.append('port_code', portCode);
      if (countryOfOrigin) params.append('country_of_origin', countryOfOrigin);

      const url = `/react/duty/rates/${hsnCode}${params.toString() ? '?' + params.toString() : ''}`;
      const response = await apiClient.get(url);
      return response.data;
    } catch (error) {
      console.error('Get duty rates error:', error);
      throw error;
    }
  },

  /**
   * Get user's calculation history
   */
  async getCalculationHistory(limit = 10) {
    try {
      const response = await apiClient.get(`/react/duty/history?limit=${limit}`);
      return response.data;
    } catch (error) {
      console.error('Get calculation history error:', error);
      throw error;
    }
  }
};

/**
 * Invoice-to-Duty Integration Service
 * Week 1 - Module 1: Complete invoice processing workflow
 */
const invoiceDutyService = {
  /**
   * Process complete invoice: Extract → Classify HSN → Calculate Duties
   */
  async processInvoiceComplete(payload) {
    try {
      console.log('[invoiceDutyService] Processing invoice:', payload);
      const response = await apiClient.post('/react/invoice/process-complete', payload);
      console.log('[invoiceDutyService] Success:', response.data);
      return response.data;
    } catch (error) {
      console.error('[invoiceDutyService] Process invoice error:', error);
      throw error;
    }
  },

  /**
   * Export invoice duty results to CSV
   */
  async exportResults(documentId, format = 'csv') {
    try {
      console.log('[invoiceDutyService] Exporting results for document:', documentId);
      const response = await apiClient.get(`/react/invoice/export/${documentId}?format=${format}`, {
        responseType: 'blob' // Important for file download
      });

      // Create download link
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `invoice_duty_${documentId}.${format}`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      console.log('[invoiceDutyService] Export successful');
      return { success: true };
    } catch (error) {
      console.error('[invoiceDutyService] Export error:', error);
      throw error;
    }
  },

  /**
   * Get duty summary for previously processed document
   */
  async getDutySummary(documentId) {
    try {
      const response = await apiClient.get(`/react/invoice/duty-summary/${documentId}`);
      return response.data;
    } catch (error) {
      console.error('[invoiceDutyService] Get duty summary error:', error);
      throw error;
    }
  }
};

// Module 7: Notification Tracking Service
const notificationService = {
  /**
   * List all notifications
   */
  async listNotifications(filters = {}) {
    try {
      const params = new URLSearchParams();
      if (filters.notification_type) params.append('notification_type', filters.notification_type);
      if (filters.parsed_status) params.append('parsed_status', filters.parsed_status);
      if (filters.limit) params.append('limit', filters.limit);

      const response = await apiClient.get(`/react/notifications/list?${params.toString()}`);
      return response.data;
    } catch (error) {
      console.error('[notificationService] List notifications error:', error);
      throw error;
    }
  },

  /**
   * Get notification details by ID
   */
  async getNotificationDetails(notificationId) {
    try {
      const response = await apiClient.get(`/react/notifications/${notificationId}`);
      return response.data;
    } catch (error) {
      console.error('[notificationService] Get notification details error:', error);
      throw error;
    }
  },

  /**
   * Ingest a new notification
   */
  async ingestNotification(payload) {
    try {
      console.log('[notificationService] Ingesting notification:', payload);
      const response = await apiClient.post('/react/notifications/ingest', payload);
      console.log('[notificationService] Ingest success:', response.data);
      return response.data;
    } catch (error) {
      console.error('[notificationService] Ingest error:', error);
      throw error;
    }
  },

  /**
   * Parse a notification to extract HSN codes and rate changes
   */
  async parseNotification(notificationId, autoApply = false) {
    try {
      console.log('[notificationService] Parsing notification:', notificationId);
      const response = await apiClient.post(`/react/notifications/${notificationId}/parse?auto_apply=${autoApply}`);
      console.log('[notificationService] Parse success:', response.data);
      return response.data;
    } catch (error) {
      console.error('[notificationService] Parse error:', error);
      throw error;
    }
  },

  /**
   * Get notification conflicts
   */
  async getConflicts(resolved = null) {
    try {
      const params = resolved !== null ? `?resolved=${resolved}` : '';
      const response = await apiClient.get(`/react/notifications/conflicts${params}`);
      return response.data;
    } catch (error) {
      console.error('[notificationService] Get conflicts error:', error);
      throw error;
    }
  },

  /**
   * Get recent rate changes
   */
  async getRateChanges(days = 90, hsnCode = null) {
    try {
      const params = { days };
      if (hsnCode) {
        params.hsn_code = hsnCode;
      }
      const response = await apiClient.get('/react/notifications/rate-changes', { params });
      return response.data;
    } catch (error) {
      console.error('[notificationService] Get rate changes error:', error);
      throw error;
    }
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// M04 DUTY COMPUTATION ENGINE SERVICE
// SOP DUTY-001 to DUTY-008: CIF → AV → BCD → SWS → IGST → ADD → CVD → FTA
// ─────────────────────────────────────────────────────────────────────────────
const m04Service = {
  /**
   * Full SOP-compliant duty computation.
   * @param {Object} payload - { fob_cost, freight, insurance, input_currency,
   *   hsn_code, country_of_origin, exchange_rate_override?, port_code?,
   *   quantity?, unit?, product_description?, document_id? }
   */
  async compute(payload) {
    try {
      const response = await apiClient.post('/m04/compute', payload);
      return response.data;
    } catch (error) {
      console.error('[m04Service] compute error:', error);
      throw error;
    }
  },

  /**
   * Get live INR exchange rate for a currency.
   * @param {string} currency - ISO 4217 code, e.g. "USD"
   */
  async getExchangeRate(currency) {
    try {
      const response = await apiClient.get(`/m04/exchange-rate/${currency}`);
      return response.data;
    } catch (error) {
      console.error('[m04Service] exchange rate error:', error);
      throw error;
    }
  },

  /**
   * Check FTA / Rules of Origin eligibility.
   * @param {string} hsnCode
   * @param {string} countryOfOrigin
   * @param {string} [productDescription]
   */
  async ftaCheck(hsnCode, countryOfOrigin, productDescription = null) {
    try {
      const response = await apiClient.post('/m04/fta-check', {
        hsn_code: hsnCode,
        country_of_origin: countryOfOrigin,
        product_description: productDescription,
      });
      return response.data;
    } catch (error) {
      console.error('[m04Service] FTA check error:', error);
      throw error;
    }
  },

  /**
   * Get active ADD/CVD/SGD trade remedy notifications.
   * @param {string} hsnCode
   * @param {string} [countryOfOrigin]
   */
  async getTradeRemedies(hsnCode, countryOfOrigin = null) {
    try {
      const params = { hsn_code: hsnCode };
      if (countryOfOrigin) params.country_of_origin = countryOfOrigin;
      const response = await apiClient.get('/m04/trade-remedies', { params });
      return response.data;
    } catch (error) {
      console.error('[m04Service] trade remedies error:', error);
      throw error;
    }
  },

  /** Fetch user's M04 computation history. */
  async getHistory(limit = 20) {
    try {
      const response = await apiClient.get(`/m04/history?limit=${limit}`);
      return response.data;
    } catch (error) {
      console.error('[m04Service] history error:', error);
      throw error;
    }
  },

  /** Retrieve a stored computation by UUID. */
  async getResult(uuid) {
    try {
      const response = await apiClient.get(`/m04/result/${uuid}`);
      return response.data;
    } catch (error) {
      console.error('[m04Service] get result error:', error);
      throw error;
    }
  },

  /** Get supported currencies with fallback rates. */
  async getCurrencies() {
    try {
      const response = await apiClient.get('/m04/currencies');
      return response.data;
    } catch (error) {
      console.error('[m04Service] currencies error:', error);
      throw error;
    }
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// M06 — Trade Fraud Detection Engine
// ─────────────────────────────────────────────────────────────────────────────
export const m06Service = {
  /**
   * Fully automatic fraud analysis — pulls all data from M05 BoE + M04 duty records.
   * The user only needs to provide a filing_id (preferred) or document_id.
   *
   * @param {number} filingId   - M05 BoE filing ID (preferred)
   * @param {number} [documentId] - M02 document ID (fallback if no filing)
   * @param {string} [m04Uuid]  - M04 computation UUID (optional override)
   */
  async analyseAuto(filingId, documentId = null, m04Uuid = null) {
    try {
      const payload = {};
      if (filingId)   payload.filing_id = filingId;
      if (documentId) payload.document_id = documentId;
      if (m04Uuid)    payload.m04_computation_uuid = m04Uuid;
      const response = await apiClient.post('/m06/analyse-auto', payload);
      return response.data;
    } catch (error) {
      console.error('[m06Service] analyseAuto error:', error);
      throw error;
    }
  },

  /**
   * Get recent M05 BoE filings for the fraud analysis filing picker.
   * @param {number} [limit]
   */
  async getRecentFilings(limit = 20) {
    try {
      const response = await apiClient.get(`/m06/recent-filings?limit=${limit}`);
      return response.data;
    } catch (error) {
      console.error('[m06Service] getRecentFilings error:', error);
      throw error;
    }
  },

  /**
   * Run the full M06 fraud detection pipeline on a manually-supplied transaction.
   * @param {Object} transaction - Normalised transaction record
   */
  async analyseTransaction(transaction) {
    try {
      const response = await apiClient.post('/m06/analyse', { transaction });
      return response.data;
    } catch (error) {
      console.error('[m06Service] analyse error:', error);
      throw error;
    }
  },

  /**
   * List SIIB/DRI investigation cases.
   * @param {string} [status] - Filter: OPEN | UNDER_REVIEW | ESCALATED | CLOSED
   * @param {number} [limit]
   */
  async getCases(status = null, limit = 20) {
    try {
      const params = { limit };
      if (status) params.status = status;
      const response = await apiClient.get('/m06/cases', { params });
      return response.data;
    } catch (error) {
      console.error('[m06Service] getCases error:', error);
      throw error;
    }
  },

  /**
   * Update an investigation case with analyst findings and action.
   * @param {number} caseId
   * @param {Object} update - { status, analyst_findings, action }
   */
  async updateCase(caseId, update) {
    try {
      const response = await apiClient.patch(`/m06/cases/${caseId}`, update);
      return response.data;
    } catch (error) {
      console.error('[m06Service] updateCase error:', error);
      throw error;
    }
  },

  /** Fetch user's M06 fraud analysis history. */
  async getHistory(limit = 20) {
    try {
      const response = await apiClient.get(`/m06/history?limit=${limit}`);
      return response.data;
    } catch (error) {
      console.error('[m06Service] history error:', error);
      throw error;
    }
  },

  /** Retrieve a stored fraud analysis result by UUID. */
  async getResult(analysisUuid) {
    try {
      const response = await apiClient.get(`/m06/result/${analysisUuid}`);
      return response.data;
    } catch (error) {
      console.error('[m06Service] getResult error:', error);
      throw error;
    }
  },
};

export const m07Service = {
  /** Auto-score a shipment using filing_id (or document_id) — no manual input. */
  async scoreAuto(filingId, documentId = null, m06Result = null) {
    try {
      const payload = {};
      if (filingId)   payload.filing_id   = filingId;
      if (documentId) payload.document_id = documentId;
      if (m06Result)  payload.m06_result  = m06Result;
      const response = await apiClient.post('/m07/score', payload);
      return response.data;
    } catch (error) {
      console.error('[m07Service] scoreAuto error:', error);
      throw error;
    }
  },

  /** Recent M05 BoE filings for the risk scoring picker. */
  async getRecentFilings(limit = 20) {
    try {
      const response = await apiClient.get(`/m07/recent-filings?limit=${limit}`);
      return response.data;
    } catch (error) {
      console.error('[m07Service] getRecentFilings error:', error);
      throw error;
    }
  },

  /** AMBER + RED review queue items. */
  async getQueue(tier = null, status = null, limit = 20) {
    try {
      const params = { limit };
      if (tier)   params.tier   = tier;
      if (status) params.status = status;
      const response = await apiClient.get('/m07/queue', { params });
      return response.data;
    } catch (error) {
      console.error('[m07Service] getQueue error:', error);
      throw error;
    }
  },

  /** Officer resolves a review queue item. */
  async updateQueueItem(itemId, update) {
    try {
      const response = await apiClient.patch(`/m07/queue/${itemId}`, update);
      return response.data;
    } catch (error) {
      console.error('[m07Service] updateQueueItem error:', error);
      throw error;
    }
  },

  /** Scoring history. */
  async getHistory(limit = 20) {
    try {
      const response = await apiClient.get(`/m07/history?limit=${limit}`);
      return response.data;
    } catch (error) {
      console.error('[m07Service] getHistory error:', error);
      throw error;
    }
  },

  /** Full result by UUID (includes feature vector + contributions). */
  async getResult(analysisUuid) {
    try {
      const response = await apiClient.get(`/m07/result/${analysisUuid}`);
      return response.data;
    } catch (error) {
      console.error('[m07Service] getResult error:', error);
      throw error;
    }
  },
};

// ============================================================================
// M03 HSN CLASSIFICATION ENGINE SERVICE
// normalize → embed → retrieve → classify → post-process → route
// ============================================================================
export const m03Service = {
  /**
   * Classify a product description under 8-digit HSN
   * @param {string} productDescription - Product description
   * @param {string} [countryOfOrigin] - ISO country code
   * @param {number} [documentId] - Optional document ID
   */
  async classify(productDescription, countryOfOrigin = null, documentId = null) {
    try {
      const payload = { product_description: productDescription };
      if (countryOfOrigin) payload.country_of_origin = countryOfOrigin;
      if (documentId) payload.document_id = documentId;
      
      const response = await apiClient.post('/m03/classify', payload);
      return response.data;
    } catch (error) {
      console.error('[m03Service] classify error:', error);
      throw error;
    }
  },

  /**
   * Classify multiple line-items in one request
   * @param {Array} items - [{description, country_of_origin?, document_id?}]
   */
  async classifyBatch(items) {
    try {
      const response = await apiClient.post('/m03/classify-batch', { items });
      return response.data;
    } catch (error) {
      console.error('[m03Service] classifyBatch error:', error);
      throw error;
    }
  },

  /**
   * Get a stored M03 classification result
   * @param {number} resultId
   */
  async getResult(resultId) {
    try {
      const response = await apiClient.get(`/m03/result/${resultId}`);
      return response.data;
    } catch (error) {
      console.error('[m03Service] getResult error:', error);
      throw error;
    }
  },

  /**
   * Submit human review (approve/reject/override)
   * @param {number} resultId
   * @param {Object} review - {approved, reviewer_hsn_override?, notes?}
   */
  async reviewResult(resultId, review) {
    try {
      const payload = {};
      if (review.approved !== undefined) payload.approved = review.approved;
      if (review.reviewer_hsn_override) payload.reviewer_hsn_override = review.reviewer_hsn_override;
      if (review.notes) payload.notes = review.notes;
      
      const response = await apiClient.patch(`/m03/review/${resultId}`, payload);
      return response.data;
    } catch (error) {
      console.error('[m03Service] reviewResult error:', error);
      throw error;
    }
  },

  /**
   * List M03 results pending human review
   * @param {number} [limit]
   */
  async getQueue(limit = 50) {
    try {
      const response = await apiClient.get(`/m03/queue?limit=${limit}`);
      return response.data;
    } catch (error) {
      console.error('[m03Service] getQueue error:', error);
      throw error;
    }
  },

  /**
   * Get seed status - how many HSN codes are embedded in pgvector
   */
  async getSeedStatus() {
    try {
      const response = await apiClient.get('/m03/seed-status');
      return response.data;
    } catch (error) {
      console.error('[m03Service] getSeedStatus error:', error);
      throw error;
    }
  },
};

// ============================================================================
// M05 BILL OF ENTRY SERVICE
// Prepare → Validate → Submit → Track → Resolve Queries
// ============================================================================
export const m05Service = {
  /**
   * Aggregate M01–M04 data into pre-filled BoE payload
   * @param {number} documentId
   * @param {string} [portOfImport] - ICEGATE port code
   * @param {string} [m04ComputationUuid]
   */
  async prepareBoE(documentId, portOfImport = 'INMAA1', m04ComputationUuid = null) {
    try {
      const payload = { document_id: documentId, port_of_import: portOfImport };
      if (m04ComputationUuid) payload.m04_computation_uuid = m04ComputationUuid;
      
      const response = await apiClient.post('/m05/prepare', payload);
      return response.data;
    } catch (error) {
      console.error('[m05Service] prepareBoE error:', error);
      throw error;
    }
  },

  /**
   * Validate all BoE fields before submission
   * @param {Object} boeFields
   * @param {Array} lineItems
   */
  async validateBoE(boeFields, lineItems) {
    try {
      const response = await apiClient.post('/m05/validate', {
        boe_fields: boeFields,
        line_items: lineItems,
      });
      return response.data;
    } catch (error) {
      console.error('[m05Service] validateBoE error:', error);
      throw error;
    }
  },

  /**
   * Submit BoE to ICEGATE
   * @param {number} filingId
   * @param {Object} boeFields
   * @param {Array} lineItems
   */
  async submitBoE(filingId, boeFields, lineItems) {
    try {
      const response = await apiClient.post('/m05/submit', {
        filing_id: filingId,
        boe_fields: boeFields,
        line_items: lineItems,
      });
      return response.data;
    } catch (error) {
      console.error('[m05Service] submitBoE error:', error);
      throw error;
    }
  },

  /**
   * Get BoE filing status
   * @param {number} filingId
   */
  async getFilingStatus(filingId) {
    try {
      const response = await apiClient.get(`/m05/status/${filingId}`);
      return response.data;
    } catch (error) {
      console.error('[m05Service] getFilingStatus error:', error);
      throw error;
    }
  },

  /**
   * Draft LLM response to ICEGATE customs query
   * @param {number} filingId
   * @param {string} queryText
   * @param {string} [additionalContext]
   */
  async resolveQuery(filingId, queryText, additionalContext = null) {
    try {
      const payload = { filing_id: filingId, query_text: queryText };
      if (additionalContext) payload.additional_context = additionalContext;
      
      const response = await apiClient.post('/m05/resolve-query', payload);
      return response.data;
    } catch (error) {
      console.error('[m05Service] resolveQuery error:', error);
      throw error;
    }
  },

  /**
   * Download BoE as PDF
   * @param {number} filingId
   */
  async downloadPDF(filingId) {
    try {
      const response = await apiClient.get(`/m05/pdf/${filingId}`, {
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `BoE_${filingId}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      return { success: true };
    } catch (error) {
      console.error('[m05Service] downloadPDF error:', error);
      throw error;
    }
  },

  /**
   * Delete a BoE filing
   * @param {number} filingId
   */
  async deleteFiling(filingId) {
    try {
      const response = await apiClient.delete(`/m05/filing/${filingId}`);
      return response.data;
    } catch (error) {
      console.error('[m05Service] deleteFiling error:', error);
      throw error;
    }
  },

  /**
   * Get user's BoE filing history
   * @param {number} [limit]
   */
  async getHistory(limit = 20) {
    try {
      const response = await apiClient.get(`/m05/history?limit=${limit}`);
      return response.data;
    } catch (error) {
      console.error('[m05Service] getHistory error:', error);
      throw error;
    }
  },
};

// ============================================================================
// DATA INTAKE SERVICE
// Upload → Barcode → Voice → SFTP → Email → Registry
// ============================================================================
export const intakeService = {
  /**
   * Upload a document (REST API / Web Portal)
   * @param {File} file
   * @param {string} [sourceChannel] - 'api' | 'portal'
   * @param {string} [sourceSystem]
   */
  async uploadDocument(file, sourceChannel = 'api', sourceSystem = null) {
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('source_channel', sourceChannel);
      if (sourceSystem) formData.append('source_system', sourceSystem);

      const response = await apiClient.post('/intake/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return response.data;
    } catch (error) {
      console.error('[intakeService] uploadDocument error:', error);
      throw error;
    }
  },

  /**
   * Scan barcode / QR code from an image
   * @param {File} imageFile
   */
  async scanBarcodeFromImage(imageFile) {
    try {
      const formData = new FormData();
      formData.append('file', imageFile);

      const response = await apiClient.post('/intake/barcode/image', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return response.data;
    } catch (error) {
      console.error('[intakeService] scanBarcodeFromImage error:', error);
      throw error;
    }
  },

  /**
   * Submit raw barcode payload from hardware scanner
   * @param {string} payload - Raw barcode string
   */
  async submitRawBarcode(payload) {
    try {
      const response = await apiClient.post('/intake/barcode/raw', payload, {
        headers: { 'Content-Type': 'text/plain' },
      });
      return response.data;
    } catch (error) {
      console.error('[intakeService] submitRawBarcode error:', error);
      throw error;
    }
  },

  /**
   * Upload audio for ASR transcription
   * @param {File} audioFile
   */
  async uploadVoice(audioFile) {
    try {
      const formData = new FormData();
      formData.append('file', audioFile);

      const response = await apiClient.post('/intake/voice', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return response.data;
    } catch (error) {
      console.error('[intakeService] uploadVoice error:', error);
      throw error;
    }
  },

  /**
   * Trigger SFTP batch poll (admin only)
   */
  async triggerSFTP() {
    try {
      const response = await apiClient.post('/intake/sftp/trigger');
      return response.data;
    } catch (error) {
      console.error('[intakeService] triggerSFTP error:', error);
      throw error;
    }
  },

  /**
   * Trigger email inbox poll (admin only)
   */
  async triggerEmail() {
    try {
      const response = await apiClient.post('/intake/email/trigger');
      return response.data;
    } catch (error) {
      console.error('[intakeService] triggerEmail error:', error);
      throw error;
    }
  },

  /**
   * Get ingestion status for a document
   * @param {string} documentId
   */
  async getStatus(documentId) {
    try {
      const response = await apiClient.get(`/intake/status/${documentId}`);
      return response.data;
    } catch (error) {
      console.error('[intakeService] getStatus error:', error);
      throw error;
    }
  },

  /**
   * List documents in the registry (paginated)
   * @param {Object} filters
   */
  async getRegistry(filters = {}) {
    try {
      const params = new URLSearchParams();
      if (filters.page) params.append('page', filters.page);
      if (filters.page_size) params.append('page_size', filters.page_size);
      if (filters.source_channel) params.append('source_channel', filters.source_channel);
      if (filters.ingestion_status) params.append('ingestion_status', filters.ingestion_status);

      const response = await apiClient.get(`/intake/registry?${params.toString()}`);
      return response.data;
    } catch (error) {
      console.error('[intakeService] getRegistry error:', error);
      throw error;
    }
  },

  /**
   * Delete a document from the registry and data lake
   * @param {string} documentId
   */
  async deleteDocument(documentId) {
    try {
      const response = await apiClient.delete(`/intake/document/${documentId}`);
      return response.data;
    } catch (error) {
      console.error('[intakeService] deleteDocument error:', error);
      throw error;
    }
  },

  /**
   * Data Lake and Kafka health check
   */
  async getHealth() {
    try {
      const response = await apiClient.get('/intake/health');
      return response.data;
    } catch (error) {
      console.error('[intakeService] getHealth error:', error);
      throw error;
    }
  },
};

// ============================================================================
// ADDITIONAL DOCUMENT & ROUTE SERVICES
// ============================================================================

// Classify document type
export const classifyService = {
  async classifyDocument(filePath) {
    try {
      const response = await apiClient.post('/react/classify', { file_path: filePath });
      return response.data;
    } catch (error) {
      console.error('[classifyService] classifyDocument error:', error);
      throw error;
    }
  },
};

// Validation service
export const validationService = {
  async validateGST(gstNumber) {
    try {
      const response = await apiClient.post('/react/validate-gst', { gst_number: gstNumber });
      return response.data;
    } catch (error) {
      console.error('[validationService] validateGST error:', error);
      throw error;
    }
  },

  async validateIEC(iecNumber) {
    try {
      const response = await apiClient.post('/react/validate-iec', { iec_number: iecNumber });
      return response.data;
    } catch (error) {
      console.error('[validationService] validateIEC error:', error);
      throw error;
    }
  },
};

// Bill of Entry Service (React routes)
export const boeService = {
  async createFromInvoice(documentId, portCode = 'INMAA1', autoValidate = true) {
    try {
      const response = await apiClient.post('/react/boe/create-from-invoice', {
        document_id: documentId,
        port_code: portCode,
        auto_validate: autoValidate,
      });
      return response.data;
    } catch (error) {
      console.error('[boeService] createFromInvoice error:', error);
      throw error;
    }
  },

  async getList(status = null, limit = 20) {
    try {
      const params = new URLSearchParams();
      if (status) params.append('status', status);
      params.append('limit', limit);

      const response = await apiClient.get(`/react/boe/list?${params.toString()}`);
      return response.data;
    } catch (error) {
      console.error('[boeService] getList error:', error);
      throw error;
    }
  },

  async getById(boeId) {
    try {
      const response = await apiClient.get(`/react/boe/${boeId}`);
      return response.data;
    } catch (error) {
      console.error('[boeService] getById error:', error);
      throw error;
    }
  },

  async validate(boeId) {
    try {
      const response = await apiClient.post(`/react/boe/${boeId}/validate`);
      return response.data;
    } catch (error) {
      console.error('[boeService] validate error:', error);
      throw error;
    }
  },

  async export(boeId, format = 'json') {
    try {
      const response = await apiClient.get(`/react/boe/${boeId}/export?format=${format}`);
      return response.data;
    } catch (error) {
      console.error('[boeService] export error:', error);
      throw error;
    }
  },
};

// Notification service extensions
export const notificationServiceExtensions = {
  async adoptIntakeDocument(intakeDocumentId) {
    try {
      const response = await apiClient.post(`/react/adopt-intake/${intakeDocumentId}`);
      return response.data;
    } catch (error) {
      console.error('[notificationServiceExtensions] adoptIntakeDocument error:', error);
      throw error;
    }
  },
};

// Document service extensions
export const documentServiceExtensions = {
  async getProcessedInvoices() {
    try {
      const response = await apiClient.get('/react/documents/processed-invoices');
      return response.data;
    } catch (error) {
      console.error('[documentServiceExtensions] getProcessedInvoices error:', error);
      throw error;
    }
  },

  async updateDocument(documentId, updateData) {
    try {
      const response = await apiClient.patch(`/react/documents/${documentId}`, updateData);
      return response.data;
    } catch (error) {
      console.error('[documentServiceExtensions] updateDocument error:', error);
      throw error;
    }
  },

  async generateCustomsDeclaration(documentId) {
    try {
      const response = await apiClient.post('/react/generate-customs-declaration', {
        document_id: documentId,
      });
      return response.data;
    } catch (error) {
      console.error('[documentServiceExtensions] generateCustomsDeclaration error:', error);
      throw error;
    }
  },
};

// Export all services
export {
  documentService,
  qaService,
  chatService,
  hsCodeService,
  customsService,
  authService,
  dashboardService,
  dutyService,
  invoiceDutyService,
  notificationService,
  m02Service,
  m04Service,
};
