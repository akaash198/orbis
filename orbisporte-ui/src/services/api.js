/**
 * API Service
 * 
 * Centralizes all API calls to the backend.
 */

import axios from 'axios';

// Prefer explicit env, otherwise default to localhost; we'll add runtime fallbacks below
const API_URL = process.env.REACT_APP_API_URL || 'https://orbisporte-backend.spectrai.sg';
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
  // Current configured base
  try { hosts.push(new URL(API_URL).origin); } catch (_) {}
  // 127.0.0.1 variant — only add when the configured API URL is already localhost/127.0.0.1
  // to avoid wasting time on an invalid host in production.
  try {
    const u = new URL(API_URL);
    const hostname = u.hostname.toLowerCase();
    const isLocal = hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1';
    if (isLocal) {
      hosts.push(`${u.protocol}//127.0.0.1:${u.port || (u.protocol === 'https:' ? '443' : '8000')}`);
    }
  } catch (_) {}
  // Same-origin (useful if backend is reverse-proxied with frontend)
  try {
    const frontendOrigin = window.location.origin;
    const primaryOrigin = new URL(API_URL).origin;
    // Only add frontend origin as fallback if it's different from primary AND it's localhost (dev only)
    if (frontendOrigin !== primaryOrigin && window.location.hostname === 'localhost') {
      hosts.push(frontendOrigin);
    }
  } catch (_) {}
  // Deduplicate
  return Array.from(new Set(hosts.filter(Boolean)));
})();

async function postWithFallback(path, data, config) {
  let lastErr;
  for (const origin of fallbackHosts) {
    try {
      const client = origin === apiClient.defaults.baseURL
        ? apiClient
        : axios.create({ baseURL: origin, headers: { 'Content-Type': 'application/json' } });
      if (authToken) client.defaults.headers.common['Authorization'] = `Bearer ${authToken}`;
      const res = await client.post(path, data, config);
      // If different origin succeeded, update default for future calls
      if (origin !== apiClient.defaults.baseURL) {
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
