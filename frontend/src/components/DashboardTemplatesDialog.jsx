import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Sparkles, 
  DollarSign, 
  Target, 
  Users, 
  Activity, 
  TrendingUp, 
  Layers, 
  LayoutDashboard, 
  Trash2, 
  X 
} from 'lucide-react';
import { toast } from 'sonner';
import axios from 'axios';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const ICONS = { 
  DollarSign, 
  Target, 
  Users, 
  Activity, 
  TrendingUp, 
  Layers, 
  LayoutDashboard 
};

const DashboardTemplatesDialog = ({ isOpen, onClose, onSelectTemplate, token }) => {
  const [tab, setTab] = useState('preset');
  const [preset, setPreset] = useState([]);
  const [custom, setCustom] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { 
    if (isOpen) fetchTemplates(); 
  }, [isOpen]);

  const fetchTemplates = async () => {
    try {
      setLoading(true);
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const res = await axios.get(`${API_URL}/api/dashboard-templates`, { headers });
      setPreset(res.data.preset || []);
      setCustom(res.data.custom || []);
    } catch (e) { 
      console.error('Failed to load templates:', e);
      toast.error('Failed to load templates'); 
    }
    finally { setLoading(false); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this template?')) return;
    try {
      await axios.delete(`${API_URL}/api/dashboard-templates/${id}`, { 
        headers: { Authorization: `Bearer ${token}` } 
      });
      toast.success('Template deleted');
      fetchTemplates();
    } catch { 
      toast.error('Failed to delete template'); 
    }
  };

  if (!isOpen) return null;
  
  const templates = tab === 'preset' ? preset : custom;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }} 
        animate={{ opacity: 1, scale: 1 }} 
        className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl max-w-4xl w-full max-h-[85vh] overflow-hidden"
      >
        {/* Header */}
        <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-violet-500" />
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">Dashboard Templates</h2>
          </div>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors"
            data-testid="close-templates-dialog"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>
        
        {/* Tabs */}
        <div className="px-6 pt-4 flex gap-2 border-b border-gray-200 dark:border-gray-700">
          <button 
            onClick={() => setTab('preset')} 
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              tab === 'preset' 
                ? 'text-violet-700 dark:text-violet-400 border-b-2 border-violet-500' 
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
            data-testid="preset-tab"
          >
            Preset ({preset.length})
          </button>
          <button 
            onClick={() => setTab('custom')} 
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              tab === 'custom' 
                ? 'text-violet-700 dark:text-violet-400 border-b-2 border-violet-500' 
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
            data-testid="custom-tab"
          >
            My Templates ({custom.length})
          </button>
        </div>
        
        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[55vh]">
          {loading ? (
            <div className="text-center py-8 text-gray-500">Loading...</div>
          ) : templates.length > 0 ? (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {templates.map(t => {
                const Icon = ICONS[t.icon] || LayoutDashboard;
                return (
                  <motion.div 
                    key={t.id} 
                    whileHover={{ scale: 1.02 }} 
                    className="relative border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden hover:shadow-lg hover:border-violet-300 dark:hover:border-violet-600 cursor-pointer group transition-all"
                    onClick={() => onSelectTemplate(t)}
                    data-testid={`template-card-${t.id}`}
                  >
                    <div className={`h-20 bg-gradient-to-br ${t.color} flex items-center justify-center`}>
                      <Icon className="w-8 h-8 text-white" />
                    </div>
                    <div className="p-3 bg-white dark:bg-gray-900">
                      <h3 className="font-semibold text-gray-900 dark:text-white">{t.name}</h3>
                      <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-1">{t.description}</p>
                      <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                        {t.widgets?.length || 0} widgets
                      </p>
                    </div>
                    {tab === 'custom' && (
                      <button 
                        onClick={(e) => { e.stopPropagation(); handleDelete(t.id); }} 
                        className="absolute top-2 right-2 p-1 bg-white dark:bg-gray-800 rounded shadow opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-50 dark:hover:bg-red-900/20"
                        data-testid={`delete-template-${t.id}`}
                      >
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </button>
                    )}
                  </motion.div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-12 text-gray-400 dark:text-gray-500">
              {tab === 'custom' ? 'No custom templates yet. Save a dashboard as a template to see it here.' : 'No templates available'}
            </div>
          )}
        </div>
        
        {/* Footer */}
        <div className="p-4 border-t border-gray-200 dark:border-gray-700 flex justify-end">
          <button 
            onClick={onClose} 
            className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
          >
            Cancel
          </button>
        </div>
      </motion.div>
    </div>
  );
};

export default DashboardTemplatesDialog;
