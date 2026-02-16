/**
 * GuidedTour Component - Interactive product tour with tooltips
 */
import React, { useState, useEffect, createContext, useContext } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ChevronLeft, ChevronRight, CheckCircle } from 'lucide-react';
import { Button } from './ui/button';

// Tour context for managing tour state
const TourContext = createContext(null);

export const useTour = () => {
  const context = useContext(TourContext);
  if (!context) {
    throw new Error('useTour must be used within a TourProvider');
  }
  return context;
};

// Tour steps configuration
const DEFAULT_TOUR_STEPS = [
  {
    id: 'welcome',
    target: '[data-tour="dashboard"]',
    title: 'Welcome to DataPulse!',
    content: 'This is your command center. View real-time stats, recent activity, and data quality metrics.',
    position: 'bottom',
  },
  {
    id: 'projects',
    target: '[data-tour="projects"]',
    title: 'Projects & Forms',
    content: 'Create and manage your data collection projects. Each project can have multiple forms.',
    position: 'right',
  },
  {
    id: 'submissions',
    target: '[data-tour="submissions"]',
    title: 'View Submissions',
    content: 'See all collected data in real-time. Filter, review, approve, and export your submissions.',
    position: 'right',
  },
  {
    id: 'team',
    target: '[data-tour="team"]',
    title: 'Team Management',
    content: 'Add team members, assign roles, and track individual performance.',
    position: 'right',
  },
  {
    id: 'map',
    target: '[data-tour="map"]',
    title: 'GPS Tracking',
    content: 'Visualize data collection points on an interactive map with clustering.',
    position: 'right',
  },
  {
    id: 'quality',
    target: '[data-tour="quality"]',
    title: 'Quality Score',
    content: 'AI-powered quality checks automatically flag anomalies and ensure data integrity.',
    position: 'left',
  },
];

// Tour Provider component
export function TourProvider({ children, steps = DEFAULT_TOUR_STEPS }) {
  const [isActive, setIsActive] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [hasSeenTour, setHasSeenTour] = useState(false);

  const startTour = () => {
    setCurrentStep(0);
    setIsActive(true);
  };

  const endTour = () => {
    setIsActive(false);
    setHasSeenTour(true);
  };

  const nextStep = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(prev => prev + 1);
    } else {
      endTour();
    }
  };

  const prevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const goToStep = (index) => {
    if (index >= 0 && index < steps.length) {
      setCurrentStep(index);
    }
  };

  const value = {
    isActive,
    currentStep,
    steps,
    hasSeenTour,
    startTour,
    endTour,
    nextStep,
    prevStep,
    goToStep,
    currentStepData: steps[currentStep],
  };

  return (
    <TourContext.Provider value={value}>
      {children}
    </TourContext.Provider>
  );
}

// Tooltip component that appears during tour
export function TourTooltip() {
  const { isActive, currentStep, steps, currentStepData, nextStep, prevStep, endTour } = useTour();
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const [targetRect, setTargetRect] = useState(null);

  useEffect(() => {
    if (!isActive || !currentStepData) return;

    const targetElement = document.querySelector(currentStepData.target);
    if (targetElement) {
      const rect = targetElement.getBoundingClientRect();
      setTargetRect(rect);

      // Calculate tooltip position
      let top, left;
      const tooltipWidth = 320;
      const tooltipHeight = 180;
      const offset = 16;

      switch (currentStepData.position) {
        case 'top':
          top = rect.top - tooltipHeight - offset;
          left = rect.left + rect.width / 2 - tooltipWidth / 2;
          break;
        case 'bottom':
          top = rect.bottom + offset;
          left = rect.left + rect.width / 2 - tooltipWidth / 2;
          break;
        case 'left':
          top = rect.top + rect.height / 2 - tooltipHeight / 2;
          left = rect.left - tooltipWidth - offset;
          break;
        case 'right':
        default:
          top = rect.top + rect.height / 2 - tooltipHeight / 2;
          left = rect.right + offset;
          break;
      }

      // Keep tooltip in viewport
      top = Math.max(16, Math.min(top, window.innerHeight - tooltipHeight - 16));
      left = Math.max(16, Math.min(left, window.innerWidth - tooltipWidth - 16));

      setPosition({ top, left });
    }
  }, [isActive, currentStep, currentStepData]);

  if (!isActive) return null;

  return (
    <>
      {/* Overlay */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/50 z-[100]"
        onClick={endTour}
      />

      {/* Spotlight on target */}
      {targetRect && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="fixed z-[101] rounded-lg ring-4 ring-teal-500 ring-offset-4 ring-offset-transparent"
          style={{
            top: targetRect.top - 4,
            left: targetRect.left - 4,
            width: targetRect.width + 8,
            height: targetRect.height + 8,
            boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.5)',
          }}
        />
      )}

      {/* Tooltip */}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentStep}
          initial={{ opacity: 0, scale: 0.9, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: -10 }}
          transition={{ duration: 0.2 }}
          className="fixed z-[102] w-80 bg-slate-800 rounded-xl shadow-2xl border border-slate-700 overflow-hidden"
          style={{ top: position.top, left: position.left }}
        >
          {/* Progress bar */}
          <div className="h-1 bg-slate-700">
            <motion.div
              className="h-full bg-gradient-to-r from-teal-500 to-cyan-500"
              initial={{ width: 0 }}
              animate={{ width: `${((currentStep + 1) / steps.length) * 100}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>

          <div className="p-4">
            {/* Step indicator */}
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs text-slate-400">
                Step {currentStep + 1} of {steps.length}
              </span>
              <button
                onClick={endTour}
                className="p-1 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Content */}
            <h3 className="text-lg font-semibold text-white mb-2">
              {currentStepData?.title}
            </h3>
            <p className="text-sm text-slate-300 mb-4">
              {currentStepData?.content}
            </p>

            {/* Navigation */}
            <div className="flex items-center justify-between">
              <Button
                variant="ghost"
                size="sm"
                onClick={prevStep}
                disabled={currentStep === 0}
                className="text-slate-400 hover:text-white"
              >
                <ChevronLeft className="w-4 h-4 mr-1" />
                Back
              </Button>

              {currentStep === steps.length - 1 ? (
                <Button
                  size="sm"
                  onClick={endTour}
                  className="bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-600 hover:to-cyan-600"
                >
                  <CheckCircle className="w-4 h-4 mr-1" />
                  Finish Tour
                </Button>
              ) : (
                <Button
                  size="sm"
                  onClick={nextStep}
                  className="bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-600 hover:to-cyan-600"
                >
                  Next
                  <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              )}
            </div>
          </div>

          {/* Step dots */}
          <div className="flex items-center justify-center gap-1.5 pb-3">
            {steps.map((_, index) => (
              <button
                key={index}
                onClick={() => useTour().goToStep(index)}
                className={`w-2 h-2 rounded-full transition-colors ${
                  index === currentStep
                    ? 'bg-teal-500'
                    : index < currentStep
                    ? 'bg-teal-500/50'
                    : 'bg-slate-600'
                }`}
              />
            ))}
          </div>
        </motion.div>
      </AnimatePresence>
    </>
  );
}

// Button to start the tour
export function TourButton({ className = '' }) {
  const { startTour, hasSeenTour } = useTour();

  return (
    <Button
      onClick={startTour}
      variant="outline"
      size="sm"
      className={`gap-2 ${className}`}
    >
      <span className="relative flex h-2 w-2">
        {!hasSeenTour && (
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-teal-400 opacity-75" />
        )}
        <span className="relative inline-flex rounded-full h-2 w-2 bg-teal-500" />
      </span>
      Take a Tour
    </Button>
  );
}

// Main GuidedTour component that combines provider and tooltip
export function GuidedTour({ children, steps = DEFAULT_TOUR_STEPS, autoStart = false }) {
  return (
    <TourProvider steps={steps}>
      {children}
      <TourTooltip />
      {autoStart && <AutoStartTour />}
    </TourProvider>
  );
}

// Auto-start tour after a delay
function AutoStartTour() {
  const { startTour, hasSeenTour } = useTour();

  useEffect(() => {
    if (!hasSeenTour) {
      const timer = setTimeout(() => {
        startTour();
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [hasSeenTour, startTour]);

  return null;
}

export default GuidedTour;
