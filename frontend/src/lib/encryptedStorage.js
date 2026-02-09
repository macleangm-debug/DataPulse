/**
 * DataPulse - Encrypted Offline Storage
 * Uses Web Crypto API to encrypt all data before storing in IndexedDB
 * 
 * Features:
 * - AES-GCM 256-bit encryption
 * - Automatic key management with PBKDF2
 * - Secure key derivation from user credentials
 * - IV (Initialization Vector) per record for security
 */

const DB_NAME = 'DataPulseEncrypted';
const DB_VERSION = 2;
const KEY_STORAGE = 'datapulse_encryption_key';

// Store names
const STORES = {
  FORMS: 'encryptedForms',
  SUBMISSIONS: 'encryptedSubmissions',
  MEDIA: 'encryptedMedia',
  SYNC_QUEUE: 'encryptedSyncQueue',
  CASES: 'encryptedCases',
  DATASETS: 'encryptedDatasets',
  DEVICE_INFO: 'deviceInfo'
};

/**
 * Encryption utilities using Web Crypto API
 */
class CryptoService {
  constructor() {
    this.encryptionKey = null;
    this.isInitialized = false;
  }

  /**
   * Generate a cryptographic key from user credentials using PBKDF2
   */
  async deriveKeyFromCredentials(userId, deviceId) {
    const encoder = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      encoder.encode(`${userId}:${deviceId}`),
      'PBKDF2',
      false,
      ['deriveKey']
    );

    // Use a fixed salt (in production, this should be stored securely)
    const salt = encoder.encode('DataPulse_Encrypted_Storage_Salt_v1');

    return crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: salt,
        iterations: 100000,
        hash: 'SHA-256'
      },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      true, // extractable for backup
      ['encrypt', 'decrypt']
    );
  }

  /**
   * Initialize encryption with user credentials
   */
  async initialize(userId, deviceId) {
    try {
      // Check if we have a stored key
      const storedKeyData = localStorage.getItem(KEY_STORAGE);
      
      if (storedKeyData) {
        // Import existing key
        const keyData = JSON.parse(storedKeyData);
        this.encryptionKey = await crypto.subtle.importKey(
          'jwk',
          keyData,
          { name: 'AES-GCM', length: 256 },
          true,
          ['encrypt', 'decrypt']
        );
      } else {
        // Generate new key from credentials
        this.encryptionKey = await this.deriveKeyFromCredentials(userId, deviceId);
        
        // Store key for future use (export as JWK)
        const exportedKey = await crypto.subtle.exportKey('jwk', this.encryptionKey);
        localStorage.setItem(KEY_STORAGE, JSON.stringify(exportedKey));
      }

      this.isInitialized = true;
      console.log('Encryption initialized successfully');
      return true;
    } catch (error) {
      console.error('Failed to initialize encryption:', error);
      throw error;
    }
  }

  /**
   * Generate a random IV for each encryption operation
   */
  generateIV() {
    return crypto.getRandomValues(new Uint8Array(12));
  }

  /**
   * Encrypt data using AES-GCM
   */
  async encrypt(data) {
    if (!this.isInitialized) {
      throw new Error('Encryption not initialized');
    }

    const encoder = new TextEncoder();
    const iv = this.generateIV();
    const encodedData = encoder.encode(JSON.stringify(data));

    const encryptedBuffer = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: iv },
      this.encryptionKey,
      encodedData
    );

    // Combine IV and encrypted data for storage
    return {
      iv: Array.from(iv),
      data: Array.from(new Uint8Array(encryptedBuffer)),
      encrypted: true,
      timestamp: Date.now()
    };
  }

  /**
   * Decrypt data using AES-GCM
   */
  async decrypt(encryptedPayload) {
    if (!this.isInitialized) {
      throw new Error('Encryption not initialized');
    }

    if (!encryptedPayload.encrypted) {
      // Data is not encrypted, return as-is
      return encryptedPayload;
    }

    const iv = new Uint8Array(encryptedPayload.iv);
    const encryptedData = new Uint8Array(encryptedPayload.data);

    const decryptedBuffer = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: iv },
      this.encryptionKey,
      encryptedData
    );

    const decoder = new TextDecoder();
    return JSON.parse(decoder.decode(decryptedBuffer));
  }

  /**
   * Clear encryption key (for logout/remote wipe)
   */
  clearKey() {
    this.encryptionKey = null;
    this.isInitialized = false;
    localStorage.removeItem(KEY_STORAGE);
  }

  /**
   * Check if encryption is available
   */
  isAvailable() {
    return typeof crypto !== 'undefined' && 
           typeof crypto.subtle !== 'undefined' &&
           typeof crypto.subtle.encrypt === 'function';
  }
}

// Singleton crypto service
export const cryptoService = new CryptoService();

/**
 * Encrypted IndexedDB Storage
 */
class EncryptedStorage {
  constructor() {
    this.db = null;
    this.isReady = false;
    this.readyPromise = null;
  }

  /**
   * Initialize the encrypted storage
   */
  async init(userId, deviceId) {
    // Initialize encryption first
    if (!cryptoService.isAvailable()) {
      console.warn('Web Crypto API not available, falling back to unencrypted storage');
      return this.initUnencrypted();
    }

    await cryptoService.initialize(userId, deviceId);
    
    return new Promise((resolve, reject) => {
      if (!('indexedDB' in window)) {
        reject(new Error('IndexedDB not supported'));
        return;
      }

      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        console.error('Failed to open encrypted IndexedDB:', request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        this.isReady = true;
        console.log('Encrypted IndexedDB initialized');
        resolve(this.db);
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;

        // Encrypted Forms store
        if (!db.objectStoreNames.contains(STORES.FORMS)) {
          const store = db.createObjectStore(STORES.FORMS, { keyPath: 'id' });
          store.createIndex('project_id', 'project_id', { unique: false });
        }

        // Encrypted Submissions store
        if (!db.objectStoreNames.contains(STORES.SUBMISSIONS)) {
          const store = db.createObjectStore(STORES.SUBMISSIONS, { 
            keyPath: 'local_id', 
            autoIncrement: true 
          });
          store.createIndex('form_id', 'form_id', { unique: false });
          store.createIndex('status', 'status', { unique: false });
        }

        // Encrypted Media store
        if (!db.objectStoreNames.contains(STORES.MEDIA)) {
          const store = db.createObjectStore(STORES.MEDIA, { keyPath: 'id' });
          store.createIndex('submission_id', 'submission_id', { unique: false });
        }

        // Encrypted Sync Queue
        if (!db.objectStoreNames.contains(STORES.SYNC_QUEUE)) {
          const store = db.createObjectStore(STORES.SYNC_QUEUE, { 
            keyPath: 'id', 
            autoIncrement: true 
          });
          store.createIndex('priority', 'priority', { unique: false });
        }

        // Encrypted Cases store
        if (!db.objectStoreNames.contains(STORES.CASES)) {
          const store = db.createObjectStore(STORES.CASES, { keyPath: 'id' });
          store.createIndex('status', 'status', { unique: false });
          store.createIndex('assigned_to', 'assigned_to', { unique: false });
        }

        // Encrypted Datasets store
        if (!db.objectStoreNames.contains(STORES.DATASETS)) {
          const store = db.createObjectStore(STORES.DATASETS, { keyPath: 'id' });
          store.createIndex('type', 'type', { unique: false });
        }

        // Device Info store (for remote wipe tracking)
        if (!db.objectStoreNames.contains(STORES.DEVICE_INFO)) {
          db.createObjectStore(STORES.DEVICE_INFO, { keyPath: 'key' });
        }
      };
    });
  }

  async initUnencrypted() {
    // Fallback to basic IndexedDB without encryption
    console.warn('Using unencrypted storage');
    this.isReady = true;
    return this.db;
  }

  async ensureReady() {
    if (!this.isReady && this.readyPromise) {
      await this.readyPromise;
    }
    return this.db;
  }

  // ============ Generic Encrypted CRUD Operations ============

  async saveEncrypted(storeName, data, keyPath = 'id') {
    await this.ensureReady();
    
    // Encrypt the sensitive data
    const encryptedData = await cryptoService.encrypt(data);
    const record = {
      [keyPath]: data[keyPath],
      encrypted_payload: encryptedData,
      created_at: new Date().toISOString()
    };

    // Store indexes as plain text for querying
    if (data.project_id) record.project_id = data.project_id;
    if (data.form_id) record.form_id = data.form_id;
    if (data.status) record.status = data.status;
    if (data.assigned_to) record.assigned_to = data.assigned_to;
    if (data.type) record.type = data.type;

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.put(record);
      request.onsuccess = () => resolve(data[keyPath]);
      request.onerror = () => reject(request.error);
    });
  }

  async getDecrypted(storeName, key) {
    await this.ensureReady();

    return new Promise(async (resolve, reject) => {
      const transaction = this.db.transaction([storeName], 'readonly');
      const store = transaction.objectStore(storeName);
      const request = store.get(key);
      
      request.onsuccess = async () => {
        if (!request.result) {
          resolve(null);
          return;
        }
        
        try {
          const decrypted = await cryptoService.decrypt(request.result.encrypted_payload);
          resolve(decrypted);
        } catch (error) {
          console.error('Decryption failed:', error);
          reject(error);
        }
      };
      
      request.onerror = () => reject(request.error);
    });
  }

  async getAllDecrypted(storeName) {
    await this.ensureReady();

    return new Promise(async (resolve, reject) => {
      const transaction = this.db.transaction([storeName], 'readonly');
      const store = transaction.objectStore(storeName);
      const request = store.getAll();
      
      request.onsuccess = async () => {
        try {
          const decrypted = await Promise.all(
            request.result.map(item => cryptoService.decrypt(item.encrypted_payload))
          );
          resolve(decrypted);
        } catch (error) {
          console.error('Decryption failed:', error);
          reject(error);
        }
      };
      
      request.onerror = () => reject(request.error);
    });
  }

  async deleteRecord(storeName, key) {
    await this.ensureReady();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.delete(key);
      request.onsuccess = () => resolve(true);
      request.onerror = () => reject(request.error);
    });
  }

  // ============ Form Operations ============

  async saveForm(form) {
    return this.saveEncrypted(STORES.FORMS, form, 'id');
  }

  async getForm(formId) {
    return this.getDecrypted(STORES.FORMS, formId);
  }

  async getAllForms() {
    return this.getAllDecrypted(STORES.FORMS);
  }

  // ============ Submission Operations ============

  async saveSubmission(submission) {
    const data = {
      ...submission,
      local_id: submission.local_id || `local_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      status: 'pending',
      created_at: new Date().toISOString()
    };
    return this.saveEncrypted(STORES.SUBMISSIONS, data, 'local_id');
  }

  async getSubmission(localId) {
    return this.getDecrypted(STORES.SUBMISSIONS, localId);
  }

  async getPendingSubmissions() {
    const all = await this.getAllDecrypted(STORES.SUBMISSIONS);
    return all.filter(s => s.status === 'pending');
  }

  async updateSubmissionStatus(localId, status) {
    const submission = await this.getSubmission(localId);
    if (submission) {
      submission.status = status;
      submission.updated_at = new Date().toISOString();
      return this.saveEncrypted(STORES.SUBMISSIONS, submission, 'local_id');
    }
    return null;
  }

  // ============ Case Operations ============

  async saveCase(caseData) {
    return this.saveEncrypted(STORES.CASES, caseData, 'id');
  }

  async getCase(caseId) {
    return this.getDecrypted(STORES.CASES, caseId);
  }

  async getAllCases() {
    return this.getAllDecrypted(STORES.CASES);
  }

  async getCasesByAssignment(userId) {
    const all = await this.getAllDecrypted(STORES.CASES);
    return all.filter(c => c.assigned_to === userId);
  }

  // ============ Dataset Operations ============

  async saveDataset(dataset) {
    return this.saveEncrypted(STORES.DATASETS, dataset, 'id');
  }

  async getDataset(datasetId) {
    return this.getDecrypted(STORES.DATASETS, datasetId);
  }

  async getAllDatasets() {
    return this.getAllDecrypted(STORES.DATASETS);
  }

  // ============ Remote Wipe Support ============

  async checkRemoteWipe() {
    // Check device info for wipe flag
    await this.ensureReady();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([STORES.DEVICE_INFO], 'readonly');
      const store = transaction.objectStore(STORES.DEVICE_INFO);
      const request = store.get('wipe_status');
      
      request.onsuccess = () => {
        resolve(request.result?.should_wipe || false);
      };
      request.onerror = () => reject(request.error);
    });
  }

  async setWipeFlag(shouldWipe) {
    await this.ensureReady();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([STORES.DEVICE_INFO], 'readwrite');
      const store = transaction.objectStore(STORES.DEVICE_INFO);
      const request = store.put({ key: 'wipe_status', should_wipe: shouldWipe, timestamp: Date.now() });
      request.onsuccess = () => resolve(true);
      request.onerror = () => reject(request.error);
    });
  }

  async performSecureWipe() {
    console.warn('Performing secure wipe of all local data');
    
    // Clear encryption key
    cryptoService.clearKey();
    
    // Clear all stores
    const stores = Object.values(STORES);
    
    for (const storeName of stores) {
      try {
        await new Promise((resolve, reject) => {
          const transaction = this.db.transaction([storeName], 'readwrite');
          const store = transaction.objectStore(storeName);
          const request = store.clear();
          request.onsuccess = () => resolve(true);
          request.onerror = () => reject(request.error);
        });
      } catch (error) {
        console.error(`Failed to clear store ${storeName}:`, error);
      }
    }

    // Clear localStorage
    localStorage.clear();
    
    // Clear sessionStorage
    sessionStorage.clear();

    console.log('Secure wipe completed');
    return true;
  }

  // ============ Storage Statistics ============

  async getStorageStats() {
    const stats = {
      forms: 0,
      submissions: 0,
      cases: 0,
      datasets: 0,
      media: 0,
      encrypted: cryptoService.isInitialized
    };

    if (this.db) {
      for (const [key, storeName] of Object.entries(STORES)) {
        try {
          const count = await new Promise((resolve) => {
            const transaction = this.db.transaction([storeName], 'readonly');
            const store = transaction.objectStore(storeName);
            const request = store.count();
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => resolve(0);
          });
          stats[key.toLowerCase()] = count;
        } catch (e) {
          // Ignore
        }
      }
    }

    // Get storage estimate
    if ('storage' in navigator && 'estimate' in navigator.storage) {
      const estimate = await navigator.storage.estimate();
      stats.usage = estimate.usage;
      stats.quota = estimate.quota;
      stats.usagePercent = ((estimate.usage / estimate.quota) * 100).toFixed(2);
    }

    return stats;
  }
}

// Export singleton
export const encryptedStorage = new EncryptedStorage();

/**
 * Hook to initialize encrypted storage with user context
 */
export async function initializeEncryptedStorage(userId, deviceId) {
  const finalDeviceId = deviceId || getOrCreateDeviceId();
  await encryptedStorage.init(userId, finalDeviceId);
  return encryptedStorage;
}

/**
 * Get or create a unique device ID
 */
function getOrCreateDeviceId() {
  let deviceId = localStorage.getItem('datapulse_device_id');
  if (!deviceId) {
    deviceId = `device_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    localStorage.setItem('datapulse_device_id', deviceId);
  }
  return deviceId;
}

export { STORES };
