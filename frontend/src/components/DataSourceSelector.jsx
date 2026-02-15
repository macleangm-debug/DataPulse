import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Database, 
  FileSpreadsheet, 
  FormInput, 
  Camera,
  Search,
  Check,
  ChevronRight,
  Loader2,
  AlertCircle,
  RefreshCw
} from 'lucide-react';
import { toast } from 'sonner';
import axios from 'axios';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const SOURCE_TYPE_ICONS = {
  form: FormInput,
  dataset: FileSpreadsheet,
  snapshot: Camera
};

const SOURCE_TYPE_COLORS = {
  form: 'from-blue-500 to-blue-600',
  dataset: 'from-emerald-500 to-emerald-600',
  snapshot: 'from-violet-500 to-violet-600'
};

const DataSourceSelector = ({ 
  isOpen, 
  onClose, 
  onSelect, 
  token,
  orgId,
  selectedSource = null,
  allowMultiple = false
}) => {
  const [sources, setSources] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [selected, setSelected] = useState(selectedSource ? [selectedSource] : []);

  useEffect(() => {
    if (isOpen) {
      fetchDataSources();
    }
  }, [isOpen, orgId]);

  const fetchDataSources = async () => {
    try {
      setLoading(true);
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const params = orgId ? `?org_id=${orgId}` : '';
      const res = await axios.get(`${API_URL}/api/data-sources${params}`, { headers });
      setSources(res.data.sources || []);
    } catch (e) {
      console.error('Failed to load data sources:', e);
      toast.error('Failed to load data sources');
    } finally {
      setLoading(false);
    }
  };

  const handleSelect = (source) => {
    if (allowMultiple) {
      const isSelected = selected.some(s => s.id === source.id);
      if (isSelected) {
        setSelected(selected.filter(s => s.id !== source.id));
      } else {
        setSelected([...selected, source]);
      }
    } else {
      setSelected([source]);
    }
  };

  const handleConfirm = () => {
    if (selected.length === 0) {
      toast.error('Please select a data source');
      return;
    }
    onSelect(allowMultiple ? selected : selected[0]);
    onClose();
  };

  if (!isOpen) return null;

  // Filter sources
  let filteredSources = sources;
  if (filterType !== 'all') {
    filteredSources = filteredSources.filter(s => s.type === filterType);
  }
  if (searchQuery) {
    filteredSources = filteredSources.filter(s => 
      s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (s.description && s.description.toLowerCase().includes(searchQuery.toLowerCase()))
    );
  }

  // Group by type
  const groupedSources = {
    form: filteredSources.filter(s => s.type === 'form'),
    dataset: filteredSources.filter(s => s.type === 'dataset'),
    snapshot: filteredSources.filter(s => s.type === 'snapshot')
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }} 
        animate={{ opacity: 1, scale: 1 }} 
        className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl max-w-3xl w-full max-h-[85vh] overflow-hidden"
      >
        {/* Header */}
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                <Database className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">Select Data Source</h2>
                <p className="text-sm text-gray-500">Connect your visualization to live data</p>
              </div>
            </div>
            <button 
              onClick={fetchDataSources}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
              title="Refresh"
            >
              <RefreshCw className={`w-5 h-5 text-gray-500 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {/* Search and Filter */}
          <div className="flex gap-3">
            <div className="flex-1 relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search data sources..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="px-4 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 focus:ring-2 focus:ring-blue-500 outline-none"
            >
              <option value="all">All Types</option>
              <option value="form">Forms</option>
              <option value="dataset">Datasets</option>
              <option value="snapshot">Snapshots</option>
            </select>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[50vh]">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
            </div>
          ) : filteredSources.length === 0 ? (
            <div className="text-center py-12">
              <AlertCircle className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
              <p className="text-gray-500 dark:text-gray-400">
                {sources.length === 0 
                  ? 'No data sources available. Create forms or upload datasets first.' 
                  : 'No data sources match your search'}
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Forms Section */}
              {groupedSources.form.length > 0 && (filterType === 'all' || filterType === 'form') && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 mb-3 flex items-center gap-2">
                    <FormInput className="w-4 h-4" />
                    Forms ({groupedSources.form.length})
                  </h3>
                  <div className="grid gap-3">
                    {groupedSources.form.map(source => (
                      <SourceCard 
                        key={source.id} 
                        source={source} 
                        isSelected={selected.some(s => s.id === source.id)}
                        onSelect={() => handleSelect(source)}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Datasets Section */}
              {groupedSources.dataset.length > 0 && (filterType === 'all' || filterType === 'dataset') && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 mb-3 flex items-center gap-2">
                    <FileSpreadsheet className="w-4 h-4" />
                    Datasets ({groupedSources.dataset.length})
                  </h3>
                  <div className="grid gap-3">
                    {groupedSources.dataset.map(source => (
                      <SourceCard 
                        key={source.id} 
                        source={source} 
                        isSelected={selected.some(s => s.id === source.id)}
                        onSelect={() => handleSelect(source)}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Snapshots Section */}
              {groupedSources.snapshot.length > 0 && (filterType === 'all' || filterType === 'snapshot') && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 mb-3 flex items-center gap-2">
                    <Camera className="w-4 h-4" />
                    Snapshots ({groupedSources.snapshot.length})
                  </h3>
                  <div className="grid gap-3">
                    {groupedSources.snapshot.map(source => (
                      <SourceCard 
                        key={source.id} 
                        source={source} 
                        isSelected={selected.some(s => s.id === source.id)}
                        onSelect={() => handleSelect(source)}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 flex justify-between items-center">
          <p className="text-sm text-gray-500">
            {selected.length > 0 
              ? `${selected.length} source${selected.length > 1 ? 's' : ''} selected` 
              : 'Select a data source to continue'}
          </p>
          <div className="flex gap-2">
            <button 
              onClick={onClose}
              className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button 
              onClick={handleConfirm}
              disabled={selected.length === 0}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
            >
              Connect Data
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

// Source Card Component
const SourceCard = ({ source, isSelected, onSelect }) => {
  const Icon = SOURCE_TYPE_ICONS[source.type] || Database;
  const colorClass = SOURCE_TYPE_COLORS[source.type] || 'from-gray-500 to-gray-600';

  return (
    <motion.div
      whileHover={{ scale: 1.01 }}
      onClick={onSelect}
      className={`
        relative flex items-center gap-4 p-4 border rounded-lg cursor-pointer transition-all
        ${isSelected 
          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 ring-2 ring-blue-500' 
          : 'border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-600 bg-white dark:bg-gray-800'
        }
      `}
      data-testid={`source-card-${source.id}`}
    >
      {/* Icon */}
      <div className={`w-12 h-12 rounded-lg bg-gradient-to-br ${colorClass} flex items-center justify-center flex-shrink-0`}>
        <Icon className="w-6 h-6 text-white" />
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <h4 className="font-semibold text-gray-900 dark:text-white truncate">{source.name}</h4>
        <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
          {source.description || `${source.type.charAt(0).toUpperCase() + source.type.slice(1)}`}
        </p>
        <div className="flex items-center gap-3 mt-1">
          <span className="text-xs text-gray-400">
            {source.record_count.toLocaleString()} records
          </span>
          <span className="text-xs text-gray-400">
            {source.fields?.length || 0} fields
          </span>
          {source.last_updated && (
            <span className="text-xs text-gray-400">
              Updated {new Date(source.last_updated).toLocaleDateString()}
            </span>
          )}
        </div>
      </div>

      {/* Selection indicator */}
      {isSelected && (
        <div className="w-6 h-6 rounded-full bg-blue-600 flex items-center justify-center flex-shrink-0">
          <Check className="w-4 h-4 text-white" />
        </div>
      )}
    </motion.div>
  );
};

export default DataSourceSelector;
