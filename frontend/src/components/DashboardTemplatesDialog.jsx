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
  BarChart3,
  Briefcase,
  FolderKanban,
  Headphones,
  Trash2,
  Pencil,
  Check,
  X,
  Filter
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
  LayoutDashboard,
  BarChart3,
  Briefcase,
  FolderKanban,
  Headphones
};

const CATEGORIES = [
  { id: 'all', name: 'All Templates' },
  { id: 'sales', name: 'Sales' },
  { id: 'marketing', name: 'Marketing' },
  { id: 'customers', name: 'Customers' },
  { id: 'operations', name: 'Operations' },
  { id: 'finance', name: 'Finance' },
  { id: 'analytics', name: 'Analytics' },
  { id: 'executive', name: 'Executive' },
  { id: 'project', name: 'Projects' },
  { id: 'support', name: 'Support' },
];

const DashboardTemplatesDialog = ({ isOpen, onClose, onSelectTemplate, token }) => {
  const [tab, setTab] = useState('preset');
  const [category, setCategory] = useState('all');
  const [preset, setPreset] = useState([]);
  const [custom, setCustom] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');

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

  const handleStartEdit = (e, template) => {
    e.stopPropagation();
    setEditingId(template.id);
    setEditName(template.name);
    setEditDescription(template.description || '');
  };

  const handleCancelEdit = (e) => {
    e.stopPropagation();
    setEditingId(null);
    setEditName('');
    setEditDescription('');
  };

  const handleSaveEdit = async (e) => {
    e.stopPropagation();
    if (!editName.trim()) {
      toast.error('Template name is required');
      return;
    }
    try {
      await axios.put(`${API_URL}/api/dashboard-templates/${editingId}`, 
        { name: editName.trim(), description: editDescription.trim() },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success('Template updated');
      setEditingId(null);
      fetchTemplates();
    } catch {
      toast.error('Failed to update template');
    }
  };

  if (!isOpen) return null;
  
  // Filter templates by category
  let templates = tab === 'preset' ? preset : custom;
  if (tab === 'preset' && category !== 'all') {
    templates = templates.filter(t => t.category === category);
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }} 
        animate={{ opacity: 1, scale: 1 }} 
        className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-hidden"
      >
        {/* Header */}
        <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-violet-100 dark:bg-violet-900/30 rounded-lg">
              <Sparkles className="w-5 h-5 text-violet-500" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">Dashboard Templates</h2>
              <span className="text-sm text-gray-400">10 presets • 12 widget types</span>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors"
            data-testid="close-templates-dialog"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>
        
        {/* Tabs and Filter */}
        <div className="px-6 pt-4 flex gap-4 border-b border-gray-200 dark:border-gray-700 items-center">
          <div className="flex gap-2">
            <button 
              onClick={() => setTab('preset')} 
              className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
                tab === 'preset' 
                  ? 'text-violet-700 dark:text-violet-400 border-b-2 border-violet-500 bg-violet-50 dark:bg-violet-900/20' 
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
              data-testid="preset-tab"
            >
              Preset ({preset.length})
            </button>
            <button 
              onClick={() => setTab('custom')} 
              className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
                tab === 'custom' 
                  ? 'text-violet-700 dark:text-violet-400 border-b-2 border-violet-500 bg-violet-50 dark:bg-violet-900/20' 
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
              data-testid="custom-tab"
            >
              My Templates ({custom.length})
            </button>
          </div>
          
          {/* Category Filter - only for preset */}
          {tab === 'preset' && (
            <div className="ml-auto flex items-center gap-2">
              <Filter className="w-4 h-4 text-gray-400" />
              <select 
                value={category} 
                onChange={e => setCategory(e.target.value)} 
                className="text-sm border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-1.5 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 focus:ring-2 focus:ring-violet-500 focus:border-transparent outline-none"
                data-testid="category-filter"
              >
                {CATEGORIES.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          )}
        </div>
        
        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[60vh]">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-violet-600"></div>
            </div>
          ) : templates.length > 0 ? (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {templates.map(t => {
                const Icon = ICONS[t.icon] || LayoutDashboard;
                const isEditing = editingId === t.id;
                
                return (
                  <motion.div 
                    key={t.id} 
                    whileHover={isEditing ? {} : { scale: 1.02, y: -2 }} 
                    className={`relative border rounded-xl overflow-hidden transition-all bg-white dark:bg-gray-800 ${
                      isEditing 
                        ? 'border-violet-500 ring-2 ring-violet-200 dark:ring-violet-800' 
                        : 'border-gray-200 dark:border-gray-700 hover:shadow-lg hover:border-violet-300 dark:hover:border-violet-600 cursor-pointer group'
                    }`}
                    onClick={() => !isEditing && onSelectTemplate(t)}
                    data-testid={`template-card-${t.id}`}
                  >
                    <div className={`h-20 bg-gradient-to-br ${t.color} flex items-center justify-center relative`}>
                      <Icon className="w-8 h-8 text-white" />
                      {t.category && t.category !== 'custom' && (
                        <span className="absolute top-2 left-2 text-xs px-2 py-0.5 bg-white/20 backdrop-blur-sm rounded-full text-white font-medium">
                          {t.category}
                        </span>
                      )}
                    </div>
                    <div className="p-3">
                      {isEditing ? (
                        <div className="space-y-2" onClick={e => e.stopPropagation()}>
                          <input
                            type="text"
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-violet-500 focus:border-transparent outline-none"
                            placeholder="Template name"
                            data-testid={`edit-name-input-${t.id}`}
                            autoFocus
                          />
                          <textarea
                            value={editDescription}
                            onChange={(e) => setEditDescription(e.target.value)}
                            className="w-full px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-violet-500 focus:border-transparent outline-none resize-none"
                            placeholder="Description (optional)"
                            rows={2}
                            data-testid={`edit-description-input-${t.id}`}
                          />
                          <div className="flex gap-2 justify-end">
                            <button
                              onClick={handleCancelEdit}
                              className="px-2 py-1 text-xs text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                              data-testid={`cancel-edit-${t.id}`}
                            >
                              Cancel
                            </button>
                            <button
                              onClick={handleSaveEdit}
                              className="px-2 py-1 text-xs bg-violet-600 text-white rounded hover:bg-violet-700 transition-colors flex items-center gap-1"
                              data-testid={`save-edit-${t.id}`}
                            >
                              <Check className="w-3 h-3" /> Save
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <h3 className="font-semibold text-sm text-gray-900 dark:text-white">{t.name}</h3>
                          <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-1 mt-0.5">{t.description}</p>
                          <div className="flex items-center justify-between mt-2">
                            <span className="text-xs text-gray-400 dark:text-gray-500">
                              {t.widgets?.length || 0} widgets
                            </span>
                          </div>
                        </>
                      )}
                    </div>
                    {tab === 'custom' && !isEditing && (
                      <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button 
                          onClick={(e) => handleStartEdit(e, t)} 
                          className="p-1.5 bg-white/90 dark:bg-gray-800/90 rounded-lg shadow hover:bg-violet-50 dark:hover:bg-violet-900/20"
                          data-testid={`edit-template-${t.id}`}
                        >
                          <Pencil className="w-4 h-4 text-violet-500" />
                        </button>
                        <button 
                          onClick={(e) => { e.stopPropagation(); handleDelete(t.id); }} 
                          className="p-1.5 bg-white/90 dark:bg-gray-800/90 rounded-lg shadow hover:bg-red-50 dark:hover:bg-red-900/20"
                          data-testid={`delete-template-${t.id}`}
                        >
                          <Trash2 className="w-4 h-4 text-red-500" />
                        </button>
                      </div>
                    )}
                  </motion.div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-12">
              <LayoutDashboard className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
              <p className="text-gray-500 dark:text-gray-400">
                {tab === 'custom' 
                  ? 'No custom templates yet. Save a dashboard as a template to see it here.' 
                  : 'No templates found in this category'}
              </p>
            </div>
          )}
        </div>
        
        {/* Footer */}
        <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 flex justify-between items-center">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Widget types: Stat, Chart, Table, Gauge, Progress, Map, Funnel, Heatmap, Scorecard, List, Timeline, Sparkline
          </p>
          <button 
            onClick={onClose} 
            className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            Close
          </button>
        </div>
      </motion.div>
    </div>
  );
};

export default DashboardTemplatesDialog;
