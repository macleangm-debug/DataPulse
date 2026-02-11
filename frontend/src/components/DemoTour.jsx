/**
 * DataPulse Interactive Demo Tour
 * Guided walkthrough for the landing page demo experience
 */

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  X,
  ChevronRight,
  ChevronLeft,
  Play,
  BarChart3,
  FileText,
  MapPin,
  Users,
  WifiOff,
  Camera,
  Brain,
  Sparkles,
  CheckCircle2,
  ArrowRight,
  Hand
} from 'lucide-react';
import { Button } from './ui/button';
import { Progress } from './ui/progress';
import { cn } from '../lib/utils';

// Demo Tour Steps Configuration
const DEMO_TOUR_STEPS = [
  {
    id: 'welcome',
    type: 'modal',
    title: 'Welcome to DataPulse!',
    emoji: '👋',
    description: 'Let us show you around the dashboard. This quick tour will help you discover all the powerful features available.',
    duration: '~2 min'
  },
  {
    id: 'dashboard',
    type: 'highlight',
    target: 'dashboard-stats',
    position: 'bottom',
    title: 'Real-time Dashboard',
    description: 'Monitor all your data collection activities at a glance. See submissions, completion rates, and team activity in real-time.',
    icon: BarChart3
  },
  {
    id: 'forms',
    type: 'highlight',
    target: 'active-forms',
    position: 'right',
    title: 'Your Active Forms',
    description: 'View and manage all your survey forms here. Track progress, edit questions, and deploy to your field team instantly.',
    icon: FileText
  },
  {
    id: 'team',
    type: 'highlight',
    target: 'team-activity',
    position: 'left',
    title: 'Team Activity Feed',
    description: 'Stay updated on what your team is doing. See who submitted data, when, and track any quality issues flagged.',
    icon: Users
  },
  {
    id: 'offline',
    type: 'feature',
    title: 'Offline-First Design',
    icon: WifiOff,
    description: 'DataPulse works seamlessly without internet. Collect data anywhere, and it syncs automatically when you\'re back online.',
    color: 'emerald'
  },
  {
    id: 'ai',
    type: 'feature',
    title: 'AI-Powered Quality',
    icon: Brain,
    description: 'Our AI monitors your data quality in real-time. It catches speeding, straight-lining, GPS anomalies, and duplicate entries automatically.',
    color: 'purple'
  },
  {
    id: 'complete',
    type: 'complete',
    title: 'You\'re Ready!',
    emoji: '🎉',
    description: 'You\'ve seen the highlights! Sign up for free to start collecting data with DataPulse.',
    cta: { label: 'Start Free Trial', path: '/register' }
  }
];

// Welcome Modal Component
const WelcomeModal = ({ step, onNext, onSkip }) => {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      onClick={onSkip}
    >
      <motion.div
        initial={{ scale: 0.9, y: 20, opacity: 0 }}
        animate={{ scale: 1, y: 0, opacity: 1 }}
        exit={{ scale: 0.9, y: 20, opacity: 0 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className="bg-slate-800 border border-slate-700 rounded-2xl shadow-2xl max-w-md w-full overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={onSkip}
          className="absolute top-4 right-4 p-1.5 rounded-full hover:bg-slate-700 transition-colors z-10"
          aria-label="Skip tour"
        >
          <X className="w-4 h-4 text-slate-400" />
        </button>

        {/* Progress bar */}
        <div className="h-1 bg-slate-700">
          <div className="h-full w-[14%] bg-gradient-to-r from-cyan-500 to-blue-500 rounded-r" />
        </div>

        {/* Content */}
        <div className="p-6 text-center">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: 'spring', damping: 15 }}
            className="text-5xl mb-4"
          >
            {step.emoji}
          </motion.div>
          
          <h2 className="text-2xl font-bold text-white mb-2">{step.title}</h2>
          <p className="text-slate-400 mb-6">{step.description}</p>

          {step.duration && (
            <p className="text-xs text-slate-500 mb-4">
              Tour duration: {step.duration}
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 pb-6 flex items-center justify-between">
          <Button
            variant="ghost"
            onClick={onSkip}
            className="text-slate-400 hover:text-white"
            data-testid="tour-skip-btn"
          >
            Skip Tour
          </Button>
          <Button
            onClick={onNext}
            className="bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-white gap-2"
            data-testid="tour-next-btn"
          >
            Next
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </motion.div>
    </motion.div>
  );
};

// Feature Spotlight Component
const FeatureSpotlight = ({ step, onNext, onPrev, onSkip, currentStep, totalSteps }) => {
  const Icon = step.icon;
  
  const colorClasses = {
    emerald: 'from-emerald-500 to-teal-500',
    purple: 'from-purple-500 to-pink-500',
    blue: 'from-blue-500 to-cyan-500',
    orange: 'from-orange-500 to-amber-500'
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      onClick={onSkip}
    >
      <motion.div
        initial={{ scale: 0.9, y: 20, opacity: 0 }}
        animate={{ scale: 1, y: 0, opacity: 1 }}
        exit={{ scale: 0.9, y: 20, opacity: 0 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className="bg-slate-800 border border-slate-700 rounded-2xl shadow-2xl max-w-md w-full overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Progress bar */}
        <div className="h-1 bg-slate-700">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${(currentStep / totalSteps) * 100}%` }}
            className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 rounded-r"
          />
        </div>

        {/* Icon header */}
        <div className={cn("p-6 bg-gradient-to-br", colorClasses[step.color] || colorClasses.blue)}>
          <motion.div
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: 'spring', damping: 15 }}
            className="w-16 h-16 mx-auto rounded-2xl bg-white/20 backdrop-blur flex items-center justify-center"
          >
            <Icon className="w-8 h-8 text-white" />
          </motion.div>
        </div>

        {/* Content */}
        <div className="p-6 text-center">
          <h3 className="text-xl font-bold text-white mb-2">{step.title}</h3>
          <p className="text-slate-400">{step.description}</p>
        </div>

        {/* Footer */}
        <div className="px-6 pb-6">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs text-slate-500">
              Step {currentStep} of {totalSteps}
            </span>
            <div className="flex gap-1">
              {Array.from({ length: totalSteps }).map((_, i) => (
                <div
                  key={i}
                  className={cn(
                    "w-2 h-2 rounded-full transition-colors",
                    i + 1 <= currentStep ? "bg-cyan-500" : "bg-slate-600"
                  )}
                />
              ))}
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              onClick={onPrev}
              className="text-slate-400 hover:text-white"
              data-testid="tour-prev-btn"
            >
              <ChevronLeft className="w-4 h-4 mr-1" />
              Back
            </Button>
            <Button
              variant="ghost"
              onClick={onSkip}
              className="text-slate-400 hover:text-white flex-1"
            >
              Skip Tour
            </Button>
            <Button
              onClick={onNext}
              className="bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-white gap-1"
              data-testid="tour-next-btn"
            >
              Next
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};

// Highlight Tooltip Component
const HighlightTooltip = ({ step, onNext, onPrev, onSkip, currentStep, totalSteps }) => {
  const Icon = step.icon;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[9999]"
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60" onClick={onSkip} />

      {/* Tooltip */}
      <motion.div
        initial={{ scale: 0.9, y: 20, opacity: 0 }}
        animate={{ scale: 1, y: 0, opacity: 1 }}
        exit={{ scale: 0.9, y: 20, opacity: 0 }}
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-80"
      >
        <div className="bg-slate-800 border border-slate-700 rounded-xl shadow-2xl overflow-hidden">
          {/* Progress indicator */}
          <div className="h-1 bg-slate-700">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${(currentStep / totalSteps) * 100}%` }}
              className="h-full bg-gradient-to-r from-cyan-500 to-blue-500"
            />
          </div>

          <div className="p-4">
            {/* Header */}
            <div className="flex items-start gap-3 mb-3">
              <div className="w-10 h-10 rounded-lg bg-cyan-500/20 flex items-center justify-center flex-shrink-0">
                <Icon className="w-5 h-5 text-cyan-400" />
              </div>
              <div>
                <h4 className="font-semibold text-white">{step.title}</h4>
                <span className="text-xs text-slate-500">Step {currentStep}/{totalSteps}</span>
              </div>
            </div>

            <p className="text-sm text-slate-400 mb-4">{step.description}</p>

            {/* Navigation */}
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={onPrev}
                className="text-slate-400 hover:text-white h-8 px-2"
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <Button
                size="sm"
                onClick={onNext}
                className="flex-1 h-8 bg-cyan-500 hover:bg-cyan-600 text-white"
                data-testid="tour-next-btn"
              >
                Next
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={onSkip}
                className="text-slate-400 hover:text-white h-8 px-2"
                title="Skip tour"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};

// Complete Modal Component
const CompleteModal = ({ step, onComplete, onPrev, currentStep, totalSteps }) => {
  const navigate = useNavigate();

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
    >
      <motion.div
        initial={{ scale: 0.9, y: 20, opacity: 0 }}
        animate={{ scale: 1, y: 0, opacity: 1 }}
        exit={{ scale: 0.9, y: 20, opacity: 0 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className="bg-slate-800 border border-slate-700 rounded-2xl shadow-2xl max-w-md w-full overflow-hidden"
      >
        {/* Progress bar - complete */}
        <div className="h-1 bg-gradient-to-r from-cyan-500 to-blue-500" />

        {/* Content */}
        <div className="p-6 text-center">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: 'spring', damping: 15 }}
            className="text-5xl mb-4"
          >
            {step.emoji}
          </motion.div>

          <h2 className="text-2xl font-bold text-white mb-2">{step.title}</h2>
          <p className="text-slate-400 mb-6">{step.description}</p>

          {/* Feature checkmarks */}
          <div className="space-y-2 mb-6 text-left">
            {[
              'Real-time dashboards & analytics',
              'Offline-first data collection',
              'AI-powered quality monitoring',
              '45+ question types'
            ].map((feature, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3 + idx * 0.1 }}
                className="flex items-center gap-2 text-sm"
              >
                <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                <span className="text-slate-300">{feature}</span>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 pb-6 flex flex-col gap-3">
          <Button
            onClick={() => navigate(step.cta.path)}
            className="w-full bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-white gap-2"
            data-testid="tour-cta-btn"
          >
            {step.cta.label}
            <ArrowRight className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            onClick={onComplete}
            className="w-full text-slate-400 hover:text-white"
          >
            Explore Demo Again
          </Button>
        </div>
      </motion.div>
    </motion.div>
  );
};

// Main Demo Tour Component
export function DemoTour({ isOpen, onClose }) {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const currentStep = DEMO_TOUR_STEPS[currentStepIndex];
  const totalSteps = DEMO_TOUR_STEPS.length;

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  // Reset step when tour opens
  useEffect(() => {
    if (isOpen) {
      setCurrentStepIndex(0);
    }
  }, [isOpen]);

  const goToNext = useCallback(() => {
    if (currentStepIndex < DEMO_TOUR_STEPS.length - 1) {
      setCurrentStepIndex(prev => prev + 1);
    }
  }, [currentStepIndex]);

  const goToPrev = useCallback(() => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex(prev => prev - 1);
    }
  }, [currentStepIndex]);

  const handleComplete = useCallback(() => {
    setCurrentStepIndex(0);
    onClose();
  }, [onClose]);

  if (!isOpen || !currentStep) return null;

  return (
    <AnimatePresence mode="wait">
      {currentStep.type === 'modal' && (
        <WelcomeModal
          key={currentStep.id}
          step={currentStep}
          onNext={goToNext}
          onSkip={onClose}
        />
      )}

      {currentStep.type === 'highlight' && (
        <HighlightTooltip
          key={currentStep.id}
          step={currentStep}
          onNext={goToNext}
          onPrev={goToPrev}
          onSkip={onClose}
          currentStep={currentStepIndex + 1}
          totalSteps={totalSteps}
        />
      )}

      {currentStep.type === 'feature' && (
        <FeatureSpotlight
          key={currentStep.id}
          step={currentStep}
          onNext={goToNext}
          onPrev={goToPrev}
          onSkip={onClose}
          currentStep={currentStepIndex + 1}
          totalSteps={totalSteps}
        />
      )}

      {currentStep.type === 'complete' && (
        <CompleteModal
          key={currentStep.id}
          step={currentStep}
          onComplete={handleComplete}
          onPrev={goToPrev}
          currentStep={currentStepIndex + 1}
          totalSteps={totalSteps}
        />
      )}
    </AnimatePresence>
  );
}

// Tour Trigger Button Component
export function DemoTourButton({ className, variant = 'default' }) {
  const [isTourOpen, setIsTourOpen] = useState(false);

  return (
    <>
      <Button
        onClick={() => setIsTourOpen(true)}
        className={cn(
          variant === 'default' 
            ? "bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-white gap-2"
            : "bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white gap-2",
          className
        )}
        data-testid="start-tour-btn"
      >
        <Play className="w-4 h-4" />
        Take a Tour
      </Button>
      
      <DemoTour isOpen={isTourOpen} onClose={() => setIsTourOpen(false)} />
    </>
  );
}

// Interactive Demo Mode Banner
export function DemoModeBanner({ onStartTour }) {
  return (
    <motion.div
      initial={{ y: -100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className="bg-gradient-to-r from-cyan-600 via-blue-600 to-purple-600 text-white py-2 px-4"
    >
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4" />
          <span className="text-sm font-medium">
            Sample data from Customer Feedback Survey - Actions like save & export are disabled
          </span>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={onStartTour}
            className="text-white hover:bg-white/20 gap-1"
          >
            <Hand className="w-4 h-4" />
            Take Tour
          </Button>
          <Button
            size="sm"
            className="bg-white text-blue-600 hover:bg-blue-50"
          >
            Exit Demo
          </Button>
        </div>
      </div>
    </motion.div>
  );
}

export default DemoTour;
