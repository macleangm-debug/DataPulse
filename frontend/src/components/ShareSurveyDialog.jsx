import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Share2,
  Link2,
  QrCode,
  Code,
  Copy,
  Check,
  ExternalLink,
  Download
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { cn } from '../lib/utils';

/**
 * ShareSurveyDialog - A reusable dialog for sharing surveys/forms
 * 
 * @param {boolean} isOpen - Whether the dialog is open
 * @param {function} onClose - Callback when dialog closes
 * @param {string} surveyName - Name of the survey
 * @param {string} publicUrl - The public URL for sharing
 * @param {string} embedCode - Optional embed code for iframe
 */
export function ShareSurveyDialog({
  isOpen,
  onClose,
  surveyName = 'My Survey',
  publicUrl = '',
  embedCode = ''
}) {
  const [activeTab, setActiveTab] = useState('link');
  const [copied, setCopied] = useState(false);
  const [copiedEmbed, setCopiedEmbed] = useState(false);
  const qrRef = useRef(null);

  const handleCopyLink = () => {
    navigator.clipboard.writeText(publicUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCopyEmbed = () => {
    const code = embedCode || `<iframe src="${publicUrl}" width="100%" height="600" frameborder="0"></iframe>`;
    navigator.clipboard.writeText(code);
    setCopiedEmbed(true);
    setTimeout(() => setCopiedEmbed(false), 2000);
  };

  const handleOpenInNewTab = () => {
    window.open(publicUrl, '_blank');
  };

  const handleDownloadQR = () => {
    if (qrRef.current) {
      const svg = qrRef.current.querySelector('svg');
      if (svg) {
        const svgData = new XMLSerializer().serializeToString(svg);
        const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
        const svgUrl = URL.createObjectURL(svgBlob);
        const link = document.createElement('a');
        link.href = svgUrl;
        link.download = `${surveyName.replace(/\s+/g, '_')}_qr.svg`;
        link.click();
        URL.revokeObjectURL(svgUrl);
      }
    }
  };

  const tabs = [
    { id: 'link', label: 'Link', icon: Link2 },
    { id: 'qrcode', label: 'QR Code', icon: QrCode },
    { id: 'embed', label: 'Embed', icon: Code },
  ];

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 z-50"
            onClick={onClose}
          />
          
          {/* Dialog */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-lg bg-slate-900 border border-slate-700 rounded-xl z-50 overflow-hidden shadow-2xl"
            data-testid="share-survey-dialog"
          >
            {/* Header */}
            <div className="p-6 pb-4">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-teal-500/10 flex items-center justify-center">
                    <Share2 className="w-5 h-5 text-teal-500" />
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold text-white">Share Survey</h2>
                    <p className="text-sm text-slate-400">{surveyName}</p>
                  </div>
                </div>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={onClose}
                  className="text-slate-400 hover:text-white -mt-2 -mr-2"
                  data-testid="close-share-dialog"
                >
                  <X className="w-5 h-5" />
                </Button>
              </div>
            </div>

            {/* Tabs */}
            <div className="px-6">
              <div className="flex bg-slate-800 rounded-lg p-1">
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={cn(
                      "flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-md text-sm font-medium transition-all",
                      activeTab === tab.id
                        ? "bg-teal-500 text-white"
                        : "text-slate-400 hover:text-white"
                    )}
                    data-testid={`share-tab-${tab.id}`}
                  >
                    <tab.icon className="w-4 h-4" />
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Content */}
            <div className="p-6">
              {/* Link Tab */}
              {activeTab === 'link' && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-white">
                      Public Survey Link
                    </label>
                    <div className="flex gap-2">
                      <Input
                        value={publicUrl}
                        readOnly
                        className="bg-slate-800 border-slate-600 text-white text-sm flex-1"
                        data-testid="share-link-input"
                      />
                      <Button
                        onClick={handleCopyLink}
                        className={cn(
                          "px-4 transition-all",
                          copied 
                            ? "bg-green-500 hover:bg-green-600" 
                            : "bg-teal-500 hover:bg-teal-600"
                        )}
                        data-testid="copy-link-btn"
                      >
                        {copied ? (
                          <Check className="w-4 h-4" />
                        ) : (
                          <Copy className="w-4 h-4" />
                        )}
                      </Button>
                    </div>
                    <p className="text-xs text-slate-400">
                      Share this link with anyone to collect responses. No login required for respondents.
                    </p>
                  </div>

                  <Button
                    variant="outline"
                    onClick={handleOpenInNewTab}
                    className="w-full border-slate-600 text-white hover:bg-slate-800"
                    data-testid="open-survey-btn"
                  >
                    <ExternalLink className="w-4 h-4 mr-2" />
                    Open Survey in New Tab
                  </Button>
                </div>
              )}

              {/* QR Code Tab */}
              {activeTab === 'qrcode' && (
                <div className="space-y-4">
                  <div className="flex flex-col items-center justify-center py-8">
                    <div className="w-48 h-48 bg-white rounded-lg p-4 flex items-center justify-center">
                      {publicUrl ? (
                        <img 
                          src={generateQRCodeSVG(publicUrl)} 
                          alt="QR Code" 
                          className="w-full h-full"
                        />
                      ) : (
                        <div className="w-full h-full bg-slate-200 rounded flex items-center justify-center">
                          <QrCode className="w-24 h-24 text-slate-400" />
                        </div>
                      )}
                    </div>
                    <p className="text-xs text-slate-400 mt-4 text-center">
                      Scan this QR code to open the survey
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    onClick={handleDownloadQR}
                    className="w-full border-slate-600 text-white hover:bg-slate-800"
                    data-testid="download-qr-btn"
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Download QR Code
                  </Button>
                </div>
              )}

              {/* Embed Tab */}
              {activeTab === 'embed' && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-white">
                      Embed Code
                    </label>
                    <div className="relative">
                      <pre className="bg-slate-800 border border-slate-600 rounded-lg p-4 text-xs text-slate-300 overflow-x-auto">
                        {`<iframe
  src="${publicUrl}"
  width="100%"
  height="600"
  frameborder="0"
></iframe>`}
                      </pre>
                      <Button
                        size="sm"
                        onClick={handleCopyEmbed}
                        className={cn(
                          "absolute top-2 right-2 transition-all",
                          copiedEmbed 
                            ? "bg-green-500 hover:bg-green-600" 
                            : "bg-teal-500 hover:bg-teal-600"
                        )}
                        data-testid="copy-embed-btn"
                      >
                        {copiedEmbed ? (
                          <>
                            <Check className="w-3 h-3 mr-1" />
                            Copied
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3 mr-1" />
                            Copy
                          </>
                        )}
                      </Button>
                    </div>
                    <p className="text-xs text-slate-400">
                      Paste this code into your website's HTML to embed the survey.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

export default ShareSurveyDialog;
