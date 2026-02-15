import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Save, X } from 'lucide-react';
import { toast } from 'sonner';
import axios from 'axios';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const SaveAsTemplateButton = ({ dashboardId, dashboardName, token }) => {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!name.trim()) { 
      toast.error('Please enter a template name'); 
      return; 
    }
    
    setSaving(true);
    try {
      await axios.post(
        `${API_URL}/api/dashboard-templates/from-dashboard/${dashboardId}?name=${encodeURIComponent(name)}`, 
        null, 
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success('Dashboard saved as template!');
      setOpen(false);
      setName('');
    } catch (error) { 
      console.error('Failed to save template:', error);
      toast.error('Failed to save as template'); 
    }
    finally { setSaving(false); }
  };

  return (
    <>
      <button 
        onClick={() => { 
          setName(`${dashboardName} Template`); 
          setOpen(true); 
        }} 
        className="flex items-center gap-2 px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-gray-700 dark:text-gray-300"
        data-testid="save-as-template-btn"
      >
        <Save className="w-4 h-4" />
        Save as Template
      </button>
      
      {open && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }} 
            animate={{ opacity: 1, scale: 1 }} 
            className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl max-w-md w-full p-6 m-4"
          >
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">Save as Template</h3>
              <button 
                onClick={() => setOpen(false)}
                className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              Save this dashboard's layout and widgets as a reusable template.
            </p>
            
            <input 
              type="text" 
              value={name} 
              onChange={e => setName(e.target.value)} 
              placeholder="Template name" 
              className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg mb-4 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-violet-500 focus:border-transparent outline-none"
              data-testid="template-name-input"
              autoFocus
            />
            
            <div className="flex gap-2 justify-end">
              <button 
                onClick={() => setOpen(false)} 
                className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={handleSave} 
                disabled={saving} 
                className="px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-lg disabled:opacity-50 transition-colors"
                data-testid="save-template-submit"
              >
                {saving ? 'Saving...' : 'Save Template'}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </>
  );
};

export default SaveAsTemplateButton;
