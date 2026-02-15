import { useState, useCallback } from 'react';
import { toast } from 'sonner';

const API_URL = process.env.REACT_APP_BACKEND_URL;

export function useAnalysisData(getToken) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchResponses = useCallback(async (formId, snapshotId, page = 1, pageSize = 20) => {
    if (!formId) return { responses: [], total: 0 };
    
    setLoading(true);
    setError(null);
    
    try {
      const endpoint = snapshotId
        ? `${API_URL}/api/snapshots/${snapshotId}/data?page=${page}&page_size=${pageSize}`
        : `${API_URL}/api/forms/${formId}/submissions?page=${page}&page_size=${pageSize}`;
      
      const response = await fetch(endpoint, {
        headers: { 'Authorization': `Bearer ${getToken()}` }
      });
      
      if (!response.ok) throw new Error('Failed to fetch responses');
      
      const data = await response.json();
      return {
        responses: data.data || data.submissions || [],
        total: data.total || data.length || 0
      };
    } catch (err) {
      setError(err.message);
      toast.error('Failed to load responses');
      return { responses: [], total: 0 };
    } finally {
      setLoading(false);
    }
  }, [getToken]);

  const fetchSnapshots = useCallback(async (formId) => {
    if (!formId) return [];
    
    try {
      const response = await fetch(`${API_URL}/api/forms/${formId}/snapshots`, {
        headers: { 'Authorization': `Bearer ${getToken()}` }
      });
      
      if (!response.ok) return [];
      return await response.json();
    } catch {
      return [];
    }
  }, [getToken]);

  const createSnapshot = useCallback(async (formId, name, description) => {
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/forms/${formId}/snapshots`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getToken()}`
        },
        body: JSON.stringify({ name, description })
      });
      
      if (!response.ok) throw new Error('Failed to create snapshot');
      
      const data = await response.json();
      toast.success('Snapshot created successfully');
      return data;
    } catch (err) {
      toast.error(err.message);
      return null;
    } finally {
      setLoading(false);
    }
  }, [getToken]);

  const fetchFormFields = useCallback(async (formId) => {
    if (!formId) return [];
    
    try {
      const response = await fetch(`${API_URL}/api/forms/${formId}`, {
        headers: { 'Authorization': `Bearer ${getToken()}` }
      });
      
      if (!response.ok) return [];
      
      const form = await response.json();
      return form.fields || [];
    } catch {
      return [];
    }
  }, [getToken]);

  return {
    loading,
    error,
    fetchResponses,
    fetchSnapshots,
    createSnapshot,
    fetchFormFields
  };
}

export default useAnalysisData;
