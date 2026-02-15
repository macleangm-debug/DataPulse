/**
 * DataPulse - Enhanced Offline Sync Hook
 * Provides React hooks for offline-first data collection
 * 
 * Features:
 * - Automatic form caching
 * - Offline submission queue
 * - Background sync with conflict resolution
 * - Real-time sync status
 * - Storage management
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { offlineStorage, syncManager } from './offlineStorage';
import { useAuthStore } from '../store';

const API_URL = process.env.REACT_APP_BACKEND_URL;

// Sync status states
export const SYNC_STATUS = {
  IDLE: 'idle',
  SYNCING: 'syncing',
  SUCCESS: 'success',
  ERROR: 'error',
  OFFLINE: 'offline',
  CONFLICT: 'conflict'
};

/**
 * Main offline sync hook
 */
export function useOfflineSync() {
  const { token } = useAuthStore();
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [syncStatus, setSyncStatus] = useState(SYNC_STATUS.IDLE);
  const [pendingCount, setPendingCount] = useState(0);
  const [lastSyncTime, setLastSyncTime] = useState(null);
  const [conflicts, setConflicts] = useState([]);
  const [syncProgress, setSyncProgress] = useState({ current: 0, total: 0 });
  const [storageInfo, setStorageInfo] = useState(null);

  // Update pending count
  const updatePendingCount = useCallback(async () => {
    try {
      const count = await offlineStorage.getPendingCount();
      setPendingCount(count);
    } catch (error) {
      console.error('Failed to get pending count:', error);
    }
  }, []);

  // Update storage info
  const updateStorageInfo = useCallback(async () => {
    try {
      const info = await offlineStorage.getStorageEstimate();
      setStorageInfo(info);
    } catch (error) {
      console.error('Failed to get storage estimate:', error);
    }
  }, []);

  // Handle online/offline events
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setSyncStatus(SYNC_STATUS.IDLE);
    };

    const handleOffline = () => {
      setIsOnline(false);
      setSyncStatus(SYNC_STATUS.OFFLINE);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Initial check
    setIsOnline(navigator.onLine);
    if (!navigator.onLine) {
      setSyncStatus(SYNC_STATUS.OFFLINE);
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Listen to sync manager events
  useEffect(() => {
    const unsubscribe = syncManager.addListener((event) => {
      switch (event.type) {
        case 'sync_start':
          setSyncStatus(SYNC_STATUS.SYNCING);
          break;
        case 'sync_complete':
          setSyncStatus(SYNC_STATUS.SUCCESS);
          setLastSyncTime(new Date());
          setSyncProgress({ current: event.results.synced, total: event.results.total });
          updatePendingCount();
          setTimeout(() => setSyncStatus(SYNC_STATUS.IDLE), 3000);
          break;
        case 'sync_error':
          setSyncStatus(SYNC_STATUS.ERROR);
          setTimeout(() => setSyncStatus(SYNC_STATUS.IDLE), 5000);
          break;
        case 'conflict_detected':
          setSyncStatus(SYNC_STATUS.CONFLICT);
          setConflicts(syncManager.getConflictQueue());
          break;
        case 'conflict_resolved':
          setConflicts(syncManager.getConflictQueue());
          break;
        case 'online':
          setIsOnline(true);
          break;
        case 'offline':
          setIsOnline(false);
          break;
        default:
          break;
      }
    });

    return unsubscribe;
  }, [updatePendingCount]);

  // Initial load
  useEffect(() => {
    updatePendingCount();
    updateStorageInfo();
  }, [updatePendingCount, updateStorageInfo]);

  // Trigger manual sync
  const triggerSync = useCallback(async (conflictStrategy = 'server_wins') => {
    if (!isOnline) {
      console.log('Cannot sync while offline');
      return { success: false, reason: 'offline' };
    }

    try {
      const results = await syncManager.syncPendingSubmissions(conflictStrategy);
      return { success: true, results };
    } catch (error) {
      console.error('Sync failed:', error);
      return { success: false, error };
    }
  }, [isOnline]);

  // Resolve conflict
  const resolveConflict = useCallback(async (localId, resolvedData) => {
    await syncManager.resolveConflictManually(localId, resolvedData);
    setConflicts(syncManager.getConflictQueue());
  }, []);

  return {
    isOnline,
    syncStatus,
    pendingCount,
    lastSyncTime,
    conflicts,
    syncProgress,
    storageInfo,
    triggerSync,
    resolveConflict,
    updatePendingCount,
    updateStorageInfo
  };
}

/**
 * Hook for caching and retrieving forms offline
 */
export function useOfflineForms(projectId = null) {
  const { token } = useAuthStore();
  const [forms, setForms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [cacheStatus, setCacheStatus] = useState('idle'); // idle, caching, cached, error

  // Load forms from cache or server
  const loadForms = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      if (navigator.onLine && token) {
        // Try to fetch from server
        const url = projectId 
          ? `${API_URL}/api/forms?project_id=${projectId}`
          : `${API_URL}/api/forms`;
        
        const response = await fetch(url, {
          headers: { Authorization: `Bearer ${token}` }
        });

        if (response.ok) {
          const data = await response.json();
          const formsData = Array.isArray(data) ? data : data.forms || [];
          setForms(formsData);
          
          // Cache forms for offline use
          setCacheStatus('caching');
          for (const form of formsData) {
            await offlineStorage.saveForm(form);
          }
          setCacheStatus('cached');
          return;
        }
      }

      // Fall back to cached forms
      const cachedForms = projectId 
        ? await offlineStorage.getFormsByProject(projectId)
        : await offlineStorage.getAllForms();
      
      setForms(cachedForms);
      if (cachedForms.length > 0) {
        setCacheStatus('cached');
      }
    } catch (err) {
      console.error('Failed to load forms:', err);
      setError(err.message);
      
      // Try cache as last resort
      try {
        const cachedForms = await offlineStorage.getAllForms();
        setForms(cachedForms);
      } catch (cacheErr) {
        console.error('Cache fallback failed:', cacheErr);
      }
    } finally {
      setLoading(false);
    }
  }, [projectId, token]);

  // Cache a specific form
  const cacheForm = useCallback(async (formId) => {
    if (!navigator.onLine || !token) return null;

    try {
      const response = await fetch(`${API_URL}/api/forms/${formId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.ok) {
        const form = await response.json();
        await offlineStorage.saveForm(form);
        return form;
      }
    } catch (error) {
      console.error('Failed to cache form:', error);
    }
    return null;
  }, [token]);

  // Get form from cache
  const getCachedForm = useCallback(async (formId) => {
    return await offlineStorage.getForm(formId);
  }, []);

  useEffect(() => {
    loadForms();
  }, [loadForms]);

  return {
    forms,
    loading,
    error,
    cacheStatus,
    loadForms,
    cacheForm,
    getCachedForm
  };
}

/**
 * Hook for handling offline submissions
 */
export function useOfflineSubmission(formId) {
  const { token, user } = useAuthStore();
  const [submitting, setSubmitting] = useState(false);
  const [submissions, setSubmissions] = useState([]);

  // Load submissions for this form
  const loadSubmissions = useCallback(async () => {
    try {
      const pending = await offlineStorage.getPendingSubmissions();
      const formSubmissions = pending.filter(s => s.form_id === formId);
      setSubmissions(formSubmissions);
    } catch (error) {
      console.error('Failed to load submissions:', error);
    }
  }, [formId]);

  // Save submission (offline or online)
  const saveSubmission = useCallback(async (data, options = {}) => {
    const { 
      caseId, 
      gpsLocation, 
      media = [],
      forceOffline = false 
    } = options;

    setSubmitting(true);

    const submissionData = {
      form_id: formId,
      data,
      case_id: caseId,
      gps_location: gpsLocation,
      submitted_by: user?.id,
      device_info: {
        userAgent: navigator.userAgent,
        platform: navigator.platform,
        language: navigator.language,
        online: navigator.onLine
      },
      created_at: new Date().toISOString()
    };

    try {
      // Save media first
      for (const mediaItem of media) {
        await offlineStorage.saveMedia(
          mediaItem.id,
          submissionData.local_id,
          mediaItem.type,
          mediaItem.blob,
          mediaItem.metadata
        );
      }

      if (navigator.onLine && !forceOffline && token) {
        // Try direct submission
        const response = await fetch(`${API_URL}/api/submissions/`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify(submissionData)
        });

        if (response.ok) {
          const result = await response.json();
          await loadSubmissions();
          return { success: true, online: true, id: result.id };
        }
      }

      // Save offline
      const localId = await offlineStorage.saveSubmission(submissionData);
      await loadSubmissions();
      
      // Request background sync
      syncManager.requestBackgroundSync();

      return { success: true, online: false, localId };
    } catch (error) {
      console.error('Submission failed:', error);
      
      // Always try to save offline as fallback
      try {
        const localId = await offlineStorage.saveSubmission(submissionData);
        await loadSubmissions();
        return { success: true, online: false, localId, hadError: true };
      } catch (offlineError) {
        return { success: false, error: offlineError.message };
      }
    } finally {
      setSubmitting(false);
    }
  }, [formId, token, user, loadSubmissions]);

  // Delete a pending submission
  const deleteSubmission = useCallback(async (localId) => {
    try {
      await offlineStorage.deleteSubmission(localId);
      await loadSubmissions();
      return true;
    } catch (error) {
      console.error('Failed to delete submission:', error);
      return false;
    }
  }, [loadSubmissions]);

  // Edit a pending submission
  const editSubmission = useCallback(async (localId, newData) => {
    try {
      const submission = await offlineStorage.getSubmission(localId);
      if (submission && submission.status === 'pending') {
        submission.data = { ...submission.data, ...newData };
        submission.updated_at = new Date().toISOString();
        // Re-save with updated data
        const tx = await offlineStorage.ensureReady();
        return new Promise((resolve, reject) => {
          const transaction = tx.transaction(['pendingSubmissions'], 'readwrite');
          const store = transaction.objectStore('pendingSubmissions');
          const request = store.put(submission);
          request.onsuccess = () => {
            loadSubmissions();
            resolve(true);
          };
          request.onerror = () => reject(request.error);
        });
      }
      return false;
    } catch (error) {
      console.error('Failed to edit submission:', error);
      return false;
    }
  }, [loadSubmissions]);

  useEffect(() => {
    loadSubmissions();
  }, [loadSubmissions]);

  return {
    submitting,
    submissions,
    saveSubmission,
    deleteSubmission,
    editSubmission,
    loadSubmissions
  };
}

/**
 * Hook for caching datasets offline
 */
export function useOfflineDatasets(orgId) {
  const { token } = useAuthStore();
  const [datasets, setDatasets] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadDatasets = useCallback(async () => {
    setLoading(true);
    
    try {
      if (navigator.onLine && token) {
        const response = await fetch(`${API_URL}/api/datasets/${orgId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });

        if (response.ok) {
          const data = await response.json();
          const datasetsData = data.datasets || [];
          setDatasets(datasetsData);

          // Cache datasets
          for (const dataset of datasetsData) {
            await cacheDataset(dataset);
          }
          return;
        }
      }

      // Load from cache
      const cached = await getCachedDatasets();
      setDatasets(cached);
    } catch (error) {
      console.error('Failed to load datasets:', error);
      const cached = await getCachedDatasets();
      setDatasets(cached);
    } finally {
      setLoading(false);
    }
  }, [orgId, token]);

  const cacheDataset = async (dataset) => {
    try {
      await offlineStorage.ensureReady();
      // Store in a datasets object store if available
      // For now, store in localStorage as a fallback
      const key = `dataset_${dataset.id}`;
      localStorage.setItem(key, JSON.stringify({
        ...dataset,
        cached_at: new Date().toISOString()
      }));
    } catch (error) {
      console.error('Failed to cache dataset:', error);
    }
  };

  const getCachedDatasets = async () => {
    const cached = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith('dataset_')) {
        try {
          const data = JSON.parse(localStorage.getItem(key));
          if (data.org_id === orgId) {
            cached.push(data);
          }
        } catch (e) {
          // Skip invalid entries
        }
      }
    }
    return cached;
  };

  const searchDataset = useCallback(async (datasetId, query, field) => {
    // First try cache
    const key = `dataset_${datasetId}`;
    const cached = localStorage.getItem(key);
    
    if (cached) {
      const dataset = JSON.parse(cached);
      const records = dataset.records || [];
      return records.filter(r => {
        const value = r[field] || r.data?.[field];
        return value && String(value).toLowerCase().includes(query.toLowerCase());
      });
    }

    // Fall back to API if online
    if (navigator.onLine && token) {
      const response = await fetch(
        `${API_URL}/api/datasets/${datasetId}/search?q=${encodeURIComponent(query)}&field=${field}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (response.ok) {
        const data = await response.json();
        return data.results || [];
      }
    }

    return [];
  }, [token]);

  useEffect(() => {
    if (orgId) {
      loadDatasets();
    }
  }, [orgId, loadDatasets]);

  return {
    datasets,
    loading,
    loadDatasets,
    searchDataset
  };
}

export default useOfflineSync;
