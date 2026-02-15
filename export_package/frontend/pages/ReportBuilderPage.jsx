import React, { useState, useRef } from 'react';
import { 
  FileText, Download, Settings, Eye, Plus, PieChart, RefreshCw
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import DashboardLayout from '../layouts/DashboardLayout';
import { toast } from 'sonner';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

// Import refactored components
import { 
  ThemeSelector, 
  THEMES, 
  ReportSection, 
  SECTION_TYPES,
  AddSectionPanel 
} from '../components/report';

// ========================================
// MAIN COMPONENT
// ========================================

const ReportBuilderPage = () => {
  // Report configuration state
  const [reportConfig, setReportConfig] = useState({
    title: 'Survey Results Infographics',
    subtitle: 'Comprehensive Analysis Report',
    companyName: '',
    theme: 'blue_coral',
    reportDate: new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
  });
  
  // Sections state
  const [sections, setSections] = useState([
    { 
      id: 'sec_1', 
      type: 'stat_cards', 
      title: 'Key Metrics',
      width: 100,
      stats: [
        { value: '44%', label: 'Mercury is the closest planet to the Sun', iconType: 'percent' },
        { value: '32%', label: 'Despite being red, Mars is a cold place', iconType: 'trending' },
        { value: '21%', label: 'Neptune is the farthest planet from the Sun', iconType: 'users' },
        { value: '72%', label: 'Jupiter is the biggest planet of them all', iconType: 'cart' },
      ]
    },
    { id: 'sec_2', type: 'bar_chart', title: 'Revenue by Quarter', width: 50 },
    { id: 'sec_3', type: 'data_table', title: 'Regional Breakdown', width: 50 },
    { id: 'sec_4', type: 'intro', title: 'Introduction', content: '', width: 100 },
    { id: 'sec_5', type: 'pie_chart', title: 'Market Share', width: 50 },
    { id: 'sec_6', type: 'line_chart', title: 'Growth Trend', width: 50 },
    { id: 'sec_7', type: 'conclusion', title: 'Conclusions', content: '', width: 100 },
  ]);
  
  // UI state
  const [isPreview, setIsPreview] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [showSettings, setShowSettings] = useState(true);
  const [customColors, setCustomColors] = useState({ primary: '#3B82F6', accent: '#EF4444' });
  
  // Helper to generate lighter shade
  const getLighterHex = (hex, opacity) => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    const lighter = (c) => Math.round(c + (255 - c) * (1 - opacity));
    return `#${lighter(r).toString(16).padStart(2, '0')}${lighter(g).toString(16).padStart(2, '0')}${lighter(b).toString(16).padStart(2, '0')}`;
  };
  
  // Get current theme (supports custom colors)
  const theme = reportConfig.theme === 'custom' 
    ? { 
        id: 'custom', 
        name: 'Custom', 
        primary: customColors.primary, 
        accent: customColors.accent,
        secondary: getLighterHex(customColors.primary, 0.7),
        light: getLighterHex(customColors.primary, 0.15)
      }
    : (THEMES.find(t => t.id === reportConfig.theme) || THEMES[0]);
  
  // Section management functions
  const handleUpdateSection = (index, updatedSection) => {
    const newSections = [...sections];
    newSections[index] = updatedSection;
    setSections(newSections);
  };
  
  const handleDeleteSection = (index) => {
    setSections(sections.filter((_, i) => i !== index));
  };
  
  const handleMoveUp = (index) => {
    if (index === 0) return;
    const newSections = [...sections];
    [newSections[index - 1], newSections[index]] = [newSections[index], newSections[index - 1]];
    setSections(newSections);
  };
  
  const handleMoveDown = (index) => {
    if (index === sections.length - 1) return;
    const newSections = [...sections];
    [newSections[index], newSections[index + 1]] = [newSections[index + 1], newSections[index]];
    setSections(newSections);
  };
  
  // Resize section width handler
  const handleResizeWidth = (index, newWidth) => {
    const newSections = [...sections];
    newSections[index] = {
      ...newSections[index],
      width: newWidth
    };
    setSections(newSections);
  };
  
  const handleAddSection = (type) => {
    const sectionInfo = SECTION_TYPES.find(t => t.id === type);
    const newSection = {
      id: `sec_${Date.now()}`,
      type,
      title: sectionInfo?.name || 'New Section',
      width: ['bar_chart', 'pie_chart', 'line_chart', 'data_table'].includes(type) ? 50 : 100,
      content: '',
      stats: type === 'stat_cards' ? [
        { value: '25%', label: 'Enter description', iconType: 'percent' },
        { value: '50%', label: 'Enter description', iconType: 'trending' },
        { value: '75%', label: 'Enter description', iconType: 'users' },
        { value: '100%', label: 'Enter description', iconType: 'cart' },
      ] : undefined,
    };
    setSections([...sections, newSection]);
  };
  
  // Reference for the report canvas
  const reportCanvasRef = useRef(null);
  
  // Export PDF using client-side generation with proper multi-page support
  const handleExportPDF = async () => {
    setIsExporting(true);
    try {
      const reportElement = reportCanvasRef.current;
      if (!reportElement) {
        toast.error('Report canvas not found');
        setIsExporting(false);
        return;
      }
      
      // Switch to preview mode for clean export
      const wasInEditMode = !isPreview;
      if (wasInEditMode) {
        setIsPreview(true);
        await new Promise(resolve => setTimeout(resolve, 300));
      }
      
      // Create PDF with A4 dimensions
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });
      
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const margin = 10;
      const usableWidth = pdfWidth - (margin * 2);
      const usableHeight = pdfHeight - (margin * 2);
      const footerHeight = 15;
      const contentHeight = usableHeight - footerHeight;
      
      // Capture the full report as canvas
      const canvas = await html2canvas(reportElement, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        windowWidth: 1200,
      });
      
      const imgData = canvas.toDataURL('image/png');
      
      // Calculate how the image maps to PDF pages
      const imgWidth = usableWidth;
      const imgHeight = (canvas.height * usableWidth) / canvas.width;
      
      // Check if we need multiple pages
      if (imgHeight <= contentHeight) {
        // Single page - simple case
        pdf.addImage(imgData, 'PNG', margin, margin, imgWidth, imgHeight);
        addFooter(pdf, pdfWidth, pdfHeight, margin, 1, 1);
      } else {
        // Multi-page handling
        const totalPages = Math.ceil(imgHeight / contentHeight);
        const pixelsPerPage = (contentHeight / imgHeight) * canvas.height;
        
        for (let page = 0; page < totalPages; page++) {
          if (page > 0) {
            pdf.addPage();
          }
          
          const sourceY = page * pixelsPerPage;
          const sourceHeight = Math.min(pixelsPerPage, canvas.height - sourceY);
          const destHeight = (sourceHeight / canvas.height) * imgHeight;
          
          const pageCanvas = document.createElement('canvas');
          pageCanvas.width = canvas.width;
          pageCanvas.height = sourceHeight;
          const ctx = pageCanvas.getContext('2d');
          
          ctx.drawImage(
            canvas,
            0, sourceY, canvas.width, sourceHeight,
            0, 0, canvas.width, sourceHeight
          );
          
          const pageImgData = pageCanvas.toDataURL('image/png');
          
          let yOffset = margin;
          if (page > 0) {
            pdf.setFontSize(9);
            pdf.setTextColor(128, 128, 128);
            pdf.text(`${reportConfig.title} (continued)`, margin, margin + 3);
            pdf.setDrawColor(200, 200, 200);
            pdf.line(margin, margin + 5, pdfWidth - margin, margin + 5);
            yOffset = margin + 8;
          }
          
          pdf.addImage(pageImgData, 'PNG', margin, yOffset, imgWidth, destHeight);
          addFooter(pdf, pdfWidth, pdfHeight, margin, page + 1, totalPages);
        }
      }
      
      function addFooter(pdfDoc, width, height, m, currentPage, totalPages) {
        const footerY = height - m - 5;
        
        pdfDoc.setDrawColor(59, 130, 246);
        pdfDoc.setLineWidth(0.5);
        pdfDoc.line(m, footerY - 3, width - m, footerY - 3);
        
        pdfDoc.setFontSize(10);
        pdfDoc.setTextColor(59, 130, 246);
        const footerText = 'DataViz Studio';
        const textWidth = pdfDoc.getTextWidth(footerText);
        pdfDoc.text(footerText, (width - textWidth) / 2, footerY);
        
        pdfDoc.setFontSize(8);
        pdfDoc.setTextColor(128, 128, 128);
        const pageText = `Page ${currentPage} of ${totalPages}`;
        pdfDoc.text(pageText, width - m - pdfDoc.getTextWidth(pageText), footerY);
      }
      
      const fileName = `${reportConfig.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_${new Date().toISOString().split('T')[0]}.pdf`;
      pdf.save(fileName);
      
      if (wasInEditMode) {
        setIsPreview(false);
      }
      
      toast.success(`Report exported successfully! (${Math.ceil(imgHeight / contentHeight)} page${Math.ceil(imgHeight / contentHeight) > 1 ? 's' : ''})`);
    } catch (error) {
      console.error('Export failed:', error);
      toast.error('Failed to export PDF. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };
  
  return (
    <DashboardLayout>
      <div className="min-h-screen bg-gray-50" data-testid="report-builder-page">
        {/* Header */}
        <div className="bg-white border-b px-6 py-4 sticky top-0 z-10">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Report Builder</h1>
              <p className="text-gray-500 text-sm">Design professional infographic-style reports</p>
            </div>
            <div className="flex items-center gap-3">
              <ThemeSelector
                selectedTheme={reportConfig.theme}
                onSelect={(t) => setReportConfig({ ...reportConfig, theme: t })}
                customColors={customColors}
                onCustomColorsChange={setCustomColors}
              />
              <button
                onClick={() => setShowSettings(!showSettings)}
                className={`p-2 rounded-lg transition-colors ${showSettings ? 'bg-blue-100 text-blue-600' : 'bg-white border hover:bg-gray-50'}`}
                data-testid="settings-btn"
              >
                <Settings size={20} />
              </button>
              <button
                onClick={() => setIsPreview(!isPreview)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                  isPreview ? 'bg-blue-600 text-white' : 'bg-white border hover:bg-gray-50'
                }`}
                data-testid="preview-btn"
              >
                <Eye size={18} />
                <span className="font-medium">{isPreview ? 'Edit Mode' : 'Preview'}</span>
              </button>
              <button
                onClick={handleExportPDF}
                disabled={isExporting}
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg hover:from-blue-700 hover:to-blue-800 transition-all disabled:opacity-50 shadow-md"
                data-testid="export-btn"
              >
                {isExporting ? <RefreshCw size={18} className="animate-spin" /> : <Download size={18} />}
                <span className="font-medium">{isExporting ? 'Exporting...' : 'Export PDF'}</span>
              </button>
            </div>
          </div>
        </div>
        
        <div className="p-6">
          {/* Settings Panel */}
          <AnimatePresence>
            {showSettings && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="bg-white rounded-xl border shadow-sm mb-6 overflow-hidden"
                data-testid="settings-panel"
              >
                <div className="p-4">
                  <h3 className="font-semibold text-gray-800 mb-4">Report Header Settings</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Report Title</label>
                      <input
                        type="text"
                        value={reportConfig.title}
                        onChange={(e) => setReportConfig({ ...reportConfig, title: e.target.value })}
                        className="w-full p-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="Enter report title"
                        data-testid="report-title-input"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Subtitle</label>
                      <input
                        type="text"
                        value={reportConfig.subtitle}
                        onChange={(e) => setReportConfig({ ...reportConfig, subtitle: e.target.value })}
                        className="w-full p-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="Enter subtitle"
                        data-testid="report-subtitle-input"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Company Name (Optional)</label>
                      <input
                        type="text"
                        value={reportConfig.companyName}
                        onChange={(e) => setReportConfig({ ...reportConfig, companyName: e.target.value })}
                        className="w-full p-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="Your company name"
                        data-testid="company-name-input"
                      />
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          
          {/* Report Preview Canvas */}
          <div 
            ref={reportCanvasRef}
            className="bg-white rounded-2xl border-2 shadow-lg overflow-hidden"
            style={{ borderColor: theme.primary + '30' }}
            data-testid="report-canvas"
          >
            {/* Report Header */}
            <div 
              className="p-6 text-white relative overflow-hidden"
              style={{ backgroundColor: theme.primary }}
            >
              <div 
                className="absolute top-0 right-0 w-64 h-64 rounded-full opacity-10"
                style={{ backgroundColor: 'white', transform: 'translate(30%, -50%)' }}
              />
              <div 
                className="absolute bottom-0 left-0 w-48 h-48 rounded-full opacity-10"
                style={{ backgroundColor: 'white', transform: 'translate(-30%, 50%)' }}
              />
              
              <div className="relative z-10 text-center">
                <h2 className="text-3xl font-bold mb-2">{reportConfig.title || 'Report Title'}</h2>
                <p className="text-lg opacity-90">{reportConfig.subtitle || 'Report Subtitle'}</p>
                {reportConfig.companyName && (
                  <p className="text-sm opacity-75 mt-2">{reportConfig.companyName}</p>
                )}
              </div>
            </div>
            
            {/* Report Body */}
            <div className="p-6">
              <div className="flex flex-wrap gap-4">
                <AnimatePresence>
                  {sections.map((section, index) => (
                    <ReportSection
                      key={section.id}
                      section={section}
                      index={index}
                      theme={theme}
                      isPreview={isPreview}
                      onUpdate={handleUpdateSection}
                      onDelete={handleDeleteSection}
                      onMoveUp={handleMoveUp}
                      onMoveDown={handleMoveDown}
                      onResizeWidth={handleResizeWidth}
                      totalSections={sections.length}
                    />
                  ))}
                </AnimatePresence>
              </div>
              
              {/* Add Section Panel (only in edit mode) */}
              {!isPreview && (
                <div className="mt-6">
                  <AddSectionPanel onAdd={handleAddSection} theme={theme} />
                </div>
              )}
              
              {sections.length === 0 && (
                <div className="flex flex-col items-center justify-center py-16 text-gray-400">
                  <Plus size={48} className="mb-3" />
                  <p className="text-lg">Add sections to build your report</p>
                  <p className="text-sm">Click on a section type above to get started</p>
                </div>
              )}
            </div>
            
            {/* Report Footer */}
            <div 
              className="px-6 py-4 flex items-center justify-center gap-3 text-white"
              style={{ backgroundColor: theme.primary }}
            >
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center">
                  <PieChart size={18} className="text-white" />
                </div>
                <span className="font-bold text-lg">DataViz Studio</span>
              </div>
            </div>
          </div>
          
          {/* Help Text */}
          <div className="mt-4 text-center text-sm text-gray-500">
            <p>
              <strong>Tips:</strong> Use the width dropdown (25%, 50%, 75%, 100%) to resize sections • 
              Use arrow buttons to reorder • 
              Click Preview to see final result
            </p>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default ReportBuilderPage;
