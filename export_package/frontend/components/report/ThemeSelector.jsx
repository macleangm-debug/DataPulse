import React, { useState } from 'react';
import { Palette, ChevronDown, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// Color themes matching the infographic style
export const THEMES = [
  { id: 'blue_coral', name: 'Blue & Coral', primary: '#3B82F6', accent: '#EF4444', secondary: '#60A5FA', light: '#DBEAFE' },
  { id: 'purple_teal', name: 'Purple & Teal', primary: '#8B5CF6', accent: '#14B8A6', secondary: '#A78BFA', light: '#EDE9FE' },
  { id: 'green_orange', name: 'Green & Orange', primary: '#10B981', accent: '#F59E0B', secondary: '#34D399', light: '#D1FAE5' },
  { id: 'slate_amber', name: 'Slate & Amber', primary: '#475569', accent: '#F59E0B', secondary: '#64748B', light: '#F1F5F9' },
  { id: 'indigo_rose', name: 'Indigo & Rose', primary: '#6366F1', accent: '#F43F5E', secondary: '#818CF8', light: '#E0E7FF' },
  { id: 'cyan_pink', name: 'Cyan & Pink', primary: '#06B6D4', accent: '#EC4899', secondary: '#22D3EE', light: '#CFFAFE' },
];

const ThemeSelector = ({ selectedTheme, onSelect, customColors, onCustomColorsChange }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [showCustomPicker, setShowCustomPicker] = useState(false);
  const [tempColors, setTempColors] = useState(customColors || { primary: '#3B82F6', accent: '#EF4444' });
  
  const isCustom = selectedTheme === 'custom';
  const theme = isCustom 
    ? { id: 'custom', name: 'Custom', ...customColors, secondary: customColors?.primary + '99', light: customColors?.primary + '20' }
    : (THEMES.find(t => t.id === selectedTheme) || THEMES[0]);
  
  const handleApplyCustom = () => {
    onCustomColorsChange(tempColors);
    onSelect('custom');
    setShowCustomPicker(false);
    setIsOpen(false);
  };
  
  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 bg-white border rounded-lg hover:bg-gray-50 transition-colors shadow-sm"
        data-testid="theme-selector"
      >
        <Palette size={16} className="text-gray-500" />
        <div className="flex gap-1">
          <div className="w-4 h-4 rounded" style={{ backgroundColor: theme.primary }} />
          <div className="w-4 h-4 rounded" style={{ backgroundColor: theme.accent }} />
        </div>
        <span className="text-sm font-medium">{theme.name}</span>
        <ChevronDown size={16} className={`text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute top-full left-0 mt-1 w-72 bg-white border rounded-lg shadow-xl z-20 overflow-hidden"
          >
            {/* Preset Themes */}
            <div className="p-2 border-b">
              <p className="text-xs font-medium text-gray-500 px-2 mb-1">Preset Themes</p>
              {THEMES.map((t) => (
                <button
                  key={t.id}
                  onClick={() => {
                    onSelect(t.id);
                    setIsOpen(false);
                  }}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-50 transition-colors ${
                    selectedTheme === t.id ? 'bg-blue-50' : ''
                  }`}
                  data-testid={`theme-option-${t.id}`}
                >
                  <div className="flex gap-1">
                    <div className="w-5 h-5 rounded" style={{ backgroundColor: t.primary }} />
                    <div className="w-5 h-5 rounded" style={{ backgroundColor: t.accent }} />
                  </div>
                  <span className="text-sm flex-1 text-left">{t.name}</span>
                  {selectedTheme === t.id && <Check size={16} className="text-blue-500" />}
                </button>
              ))}
            </div>
            
            {/* Custom Theme Section */}
            <div className="p-3">
              <button
                onClick={() => setShowCustomPicker(!showCustomPicker)}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-50 transition-colors ${
                  isCustom ? 'bg-blue-50' : ''
                }`}
                data-testid="custom-theme-btn"
              >
                <div className="flex gap-1">
                  <div className="w-5 h-5 rounded border-2 border-dashed border-gray-300" style={{ backgroundColor: customColors?.primary || '#3B82F6' }} />
                  <div className="w-5 h-5 rounded border-2 border-dashed border-gray-300" style={{ backgroundColor: customColors?.accent || '#EF4444' }} />
                </div>
                <span className="text-sm flex-1 text-left">Custom Colors</span>
                {isCustom && <Check size={16} className="text-blue-500" />}
              </button>
              
              {/* Color Picker Panel */}
              <AnimatePresence>
                {showCustomPicker && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="mt-3 p-3 bg-gray-50 rounded-lg"
                  >
                    <div className="space-y-3">
                      {/* Primary Color */}
                      <div>
                        <label className="text-xs font-medium text-gray-600 block mb-1">Primary Color</label>
                        <div className="flex items-center gap-2">
                          <input
                            type="color"
                            value={tempColors.primary}
                            onChange={(e) => setTempColors({ ...tempColors, primary: e.target.value })}
                            className="w-10 h-10 rounded cursor-pointer border-0"
                            data-testid="primary-color-picker"
                          />
                          <input
                            type="text"
                            value={tempColors.primary}
                            onChange={(e) => setTempColors({ ...tempColors, primary: e.target.value })}
                            className="flex-1 px-2 py-1.5 text-sm border rounded font-mono"
                            placeholder="#3B82F6"
                            data-testid="primary-color-input"
                          />
                        </div>
                      </div>
                      
                      {/* Accent Color */}
                      <div>
                        <label className="text-xs font-medium text-gray-600 block mb-1">Accent Color</label>
                        <div className="flex items-center gap-2">
                          <input
                            type="color"
                            value={tempColors.accent}
                            onChange={(e) => setTempColors({ ...tempColors, accent: e.target.value })}
                            className="w-10 h-10 rounded cursor-pointer border-0"
                            data-testid="accent-color-picker"
                          />
                          <input
                            type="text"
                            value={tempColors.accent}
                            onChange={(e) => setTempColors({ ...tempColors, accent: e.target.value })}
                            className="flex-1 px-2 py-1.5 text-sm border rounded font-mono"
                            placeholder="#EF4444"
                            data-testid="accent-color-input"
                          />
                        </div>
                      </div>
                      
                      {/* Preview */}
                      <div>
                        <label className="text-xs font-medium text-gray-600 block mb-1">Preview</label>
                        <div className="flex gap-2">
                          <div 
                            className="flex-1 h-8 rounded flex items-center justify-center text-white text-xs font-medium"
                            style={{ backgroundColor: tempColors.primary }}
                          >
                            Primary
                          </div>
                          <div 
                            className="flex-1 h-8 rounded flex items-center justify-center text-white text-xs font-medium"
                            style={{ backgroundColor: tempColors.accent }}
                          >
                            Accent
                          </div>
                        </div>
                      </div>
                      
                      {/* Apply Button */}
                      <button
                        onClick={handleApplyCustom}
                        className="w-full py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
                        data-testid="apply-custom-theme-btn"
                      >
                        Apply Custom Theme
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ThemeSelector;
