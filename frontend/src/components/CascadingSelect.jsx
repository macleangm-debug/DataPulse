import React, { useState, useEffect, useCallback } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Badge } from './ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { ChevronRight, Search, Loader2, X } from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL;

/**
 * Cascading Select Component
 * Renders a series of dependent dropdowns where each selection filters the next level
 */
export function CascadingSelect({
  field,
  value = {},
  onChange,
  disabled = false
}) {
  const [levels, setLevels] = useState([]);
  const [selections, setSelections] = useState({});
  const [loading, setLoading] = useState({});
  const [options, setOptions] = useState({});
  const [searchQueries, setSearchQueries] = useState({});

  const cascadeLevels = field.cascade_levels || [];
  const cascadeSettings = field.cascade_settings || {};
  const cascadeConfigId = field.cascade_config_id;

  // Initialize selections from value
  useEffect(() => {
    if (value && typeof value === 'object') {
      setSelections(value);
    }
  }, []);

  // Initialize levels
  useEffect(() => {
    const levelNames = cascadeLevels.map((l, idx) => l.field_name || `level_${idx}`);
    setLevels(levelNames);
    
    // Load initial options for root level
    if (cascadeLevels.length > 0) {
      loadOptions(0, null);
    }
  }, [cascadeLevels]);

  const getAuthHeaders = useCallback(() => {
    let token = localStorage.getItem('access_token');
    if (!token) {
      const authStorage = localStorage.getItem('auth-storage');
      if (authStorage) {
        try {
          const parsed = JSON.parse(authStorage);
          token = parsed?.state?.token || null;
        } catch (e) {}
      }
    }
    if (!token) token = localStorage.getItem('token');
    return token ? { 'Authorization': `Bearer ${token}` } : {};
  }, []);

  const loadOptions = async (levelIndex, parentValue) => {
    if (levelIndex >= cascadeLevels.length) return;
    
    const level = cascadeLevels[levelIndex];
    const levelKey = level.field_name || `level_${levelIndex}`;
    
    setLoading(prev => ({ ...prev, [levelKey]: true }));

    try {
      // If using inline options
      if (level.source === 'inline' && level.options) {
        let filteredOptions = level.options;
        
        // Filter by parent value if not root level
        if (levelIndex > 0 && parentValue) {
          filteredOptions = level.options.filter(opt => opt.parent_value === parentValue);
        }
        
        setOptions(prev => ({ ...prev, [levelKey]: filteredOptions }));
      }
      // If using API/dataset
      else if (cascadeConfigId) {
        const params = new URLSearchParams({
          level_index: levelIndex.toString(),
          limit: '100'
        });
        
        if (parentValue) {
          params.append('parent_value', parentValue);
        }
        
        if (searchQueries[levelKey]) {
          params.append('search', searchQueries[levelKey]);
        }
        
        const response = await fetch(
          `${API_URL}/api/advanced-fields/cascades/${cascadeConfigId}/options?${params}`,
          { headers: getAuthHeaders() }
        );
        
        if (response.ok) {
          const data = await response.json();
          setOptions(prev => ({ ...prev, [levelKey]: data.options || [] }));
        }
      }
    } catch (error) {
      console.error('Failed to load cascade options:', error);
    } finally {
      setLoading(prev => ({ ...prev, [levelKey]: false }));
    }
  };

  const handleSelection = (levelIndex, selectedValue) => {
    const level = cascadeLevels[levelIndex];
    const levelKey = level.field_name || `level_${levelIndex}`;
    
    // Update selections
    const newSelections = { ...selections };
    newSelections[levelKey] = selectedValue;
    
    // Clear all child selections
    for (let i = levelIndex + 1; i < cascadeLevels.length; i++) {
      const childKey = cascadeLevels[i].field_name || `level_${i}`;
      delete newSelections[childKey];
      setOptions(prev => ({ ...prev, [childKey]: [] }));
    }
    
    setSelections(newSelections);
    onChange(newSelections);
    
    // Load next level options
    if (levelIndex + 1 < cascadeLevels.length) {
      loadOptions(levelIndex + 1, selectedValue);
    }
  };

  const clearSelection = (levelIndex) => {
    const level = cascadeLevels[levelIndex];
    const levelKey = level.field_name || `level_${levelIndex}`;
    
    const newSelections = { ...selections };
    
    // Clear this level and all children
    for (let i = levelIndex; i < cascadeLevels.length; i++) {
      const key = cascadeLevels[i].field_name || `level_${i}`;
      delete newSelections[key];
      if (i > levelIndex) {
        setOptions(prev => ({ ...prev, [key]: [] }));
      }
    }
    
    setSelections(newSelections);
    onChange(newSelections);
  };

  const handleSearch = (levelIndex, query) => {
    const level = cascadeLevels[levelIndex];
    const levelKey = level.field_name || `level_${levelIndex}`;
    
    setSearchQueries(prev => ({ ...prev, [levelKey]: query }));
    
    // Reload options with search
    const parentValue = levelIndex > 0 
      ? selections[cascadeLevels[levelIndex - 1].field_name || `level_${levelIndex - 1}`]
      : null;
    
    // Debounce search
    setTimeout(() => {
      loadOptions(levelIndex, parentValue);
    }, 300);
  };

  return (
    <div className="space-y-3" data-testid={`cascade-select-${field.id}`}>
      <Label>
        {field.label || field.name}
        {field.validation?.required && <span className="text-destructive ml-1">*</span>}
      </Label>
      
      {field.hint && (
        <p className="text-xs text-muted-foreground">{field.hint}</p>
      )}
      
      <div className="space-y-2">
        {cascadeLevels.map((level, idx) => {
          const levelKey = level.field_name || `level_${idx}`;
          const isDisabled = disabled || (idx > 0 && !selections[cascadeLevels[idx - 1].field_name || `level_${idx - 1}`]);
          const levelOptions = options[levelKey] || [];
          const selectedValue = selections[levelKey];
          
          return (
            <div key={levelKey} className="flex items-center gap-2">
              {idx > 0 && (
                <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              )}
              
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <Select
                    value={selectedValue || ''}
                    onValueChange={(v) => handleSelection(idx, v)}
                    disabled={isDisabled}
                  >
                    <SelectTrigger className={isDisabled ? 'opacity-50' : ''}>
                      <SelectValue placeholder={level.label || `Select ${levelKey}`} />
                    </SelectTrigger>
                    <SelectContent>
                      {cascadeSettings.search_enabled && (
                        <div className="p-2 border-b">
                          <div className="relative">
                            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                              value={searchQueries[levelKey] || ''}
                              onChange={(e) => handleSearch(idx, e.target.value)}
                              placeholder="Search..."
                              className="pl-8 h-8"
                              onClick={(e) => e.stopPropagation()}
                            />
                          </div>
                        </div>
                      )}
                      
                      {loading[levelKey] ? (
                        <div className="flex items-center justify-center py-4">
                          <Loader2 className="h-4 w-4 animate-spin" />
                        </div>
                      ) : levelOptions.length === 0 ? (
                        <div className="text-center py-4 text-sm text-muted-foreground">
                          No options available
                        </div>
                      ) : (
                        levelOptions.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))
                      )}
                      
                      {cascadeSettings.allow_other && (
                        <>
                          <div className="border-t my-1" />
                          <SelectItem value="__other__">
                            Other (specify)
                          </SelectItem>
                        </>
                      )}
                    </SelectContent>
                  </Select>
                  
                  {selectedValue && !isDisabled && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => clearSelection(idx)}
                      className="h-8 w-8 p-0"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
      
      {/* Display selected path */}
      {Object.keys(selections).length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {cascadeLevels.map((level, idx) => {
            const levelKey = level.field_name || `level_${idx}`;
            const selectedValue = selections[levelKey];
            if (!selectedValue) return null;
            
            const option = (options[levelKey] || []).find(o => o.value === selectedValue);
            const label = option?.label || selectedValue;
            
            return (
              <React.Fragment key={levelKey}>
                {idx > 0 && <span className="text-muted-foreground">→</span>}
                <Badge variant="secondary" className="text-xs">
                  {label}
                </Badge>
              </React.Fragment>
            );
          })}
        </div>
      )}
    </div>
  );
}

/**
 * Nested Repeat Group Component
 * Renders a repeatable group that can contain other repeatable groups
 */
export function NestedRepeatGroup({
  field,
  value = [],
  onChange,
  renderField,
  disabled = false,
  parentIndex = null
}) {
  const [items, setItems] = useState(value || []);
  
  const nestedSettings = field.nested_settings || {};
  const minCount = nestedSettings.min_count || 0;
  const maxCount = nestedSettings.max_count || Infinity;
  const addLabel = nestedSettings.add_label || 'Add item';
  const childFields = field.children || [];

  useEffect(() => {
    // Ensure minimum items
    if (items.length < minCount) {
      const newItems = [...items];
      while (newItems.length < minCount) {
        newItems.push({});
      }
      setItems(newItems);
      onChange(newItems);
    }
  }, [minCount]);

  const addItem = () => {
    if (items.length >= maxCount) return;
    const newItems = [...items, {}];
    setItems(newItems);
    onChange(newItems);
  };

  const removeItem = (index) => {
    if (items.length <= minCount) return;
    const newItems = items.filter((_, i) => i !== index);
    setItems(newItems);
    onChange(newItems);
  };

  const updateItem = (index, fieldId, fieldValue) => {
    const newItems = [...items];
    newItems[index] = {
      ...newItems[index],
      [fieldId]: fieldValue
    };
    setItems(newItems);
    onChange(newItems);
  };

  return (
    <div className="space-y-3 border border-border rounded-lg p-4" data-testid={`nested-repeat-${field.id}`}>
      <div className="flex items-center justify-between">
        <Label className="text-lg font-medium">
          {field.label || field.name}
          {field.validation?.required && <span className="text-destructive ml-1">*</span>}
        </Label>
        <Badge variant="outline">{items.length} items</Badge>
      </div>
      
      {field.hint && (
        <p className="text-sm text-muted-foreground">{field.hint}</p>
      )}
      
      <div className="space-y-4">
        {items.map((item, itemIndex) => (
          <div 
            key={itemIndex} 
            className="border border-border/50 rounded-lg p-4 bg-muted/20"
          >
            <div className="flex items-center justify-between mb-3">
              <Badge variant="outline">
                {parentIndex !== null ? `${parentIndex + 1}.${itemIndex + 1}` : itemIndex + 1}
              </Badge>
              {items.length > minCount && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeItem(itemIndex)}
                  disabled={disabled}
                  className="text-destructive hover:text-destructive"
                >
                  Remove
                </Button>
              )}
            </div>
            
            <div className="space-y-3">
              {childFields.map((childField) => (
                <div key={childField.id}>
                  {renderField(childField, item[childField.id], (fieldId, fieldValue) => {
                    updateItem(itemIndex, fieldId, fieldValue);
                  })}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      
      {items.length < maxCount && (
        <Button
          variant="outline"
          onClick={addItem}
          disabled={disabled}
          className="w-full"
        >
          {addLabel}
        </Button>
      )}
      
      {maxCount !== Infinity && (
        <p className="text-xs text-muted-foreground text-center">
          {items.length} / {maxCount} items
        </p>
      )}
    </div>
  );
}

export default CascadingSelect;
