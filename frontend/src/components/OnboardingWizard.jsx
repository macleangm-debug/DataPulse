/**
 * DataPulse Onboarding Wizard
 * Interactive product tour with tooltips highlighting key features
 */

import React, { useState, useEffect, useCallback, createContext, useContext } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Sparkles,
  WifiOff,
  BarChart3,
  Brain,
  Shield,
  Users,
  Folder,
  FileText,
  Bell,
  ChevronRight,
  ChevronLeft,
  X,
  Check,
  Zap,
  Globe,
  Database,
  MapPin,
  Play,
  ArrowRight,
  Rocket,
  Target,
  Star
} from 'lucide-react';
import { Button } from './ui/button';
import { Progress } from './ui/progress';
import { cn } from '../lib/utils';
import { useAuthStore, useOrgStore } from '../store';

// Onboarding Context
const OnboardingContext = createContext(null);

export const useOnboarding = () => {
  const context = useContext(OnboardingContext);
  if (!context) {
    throw new Error('useOnboarding must be used within OnboardingProvider');
  }
  return context;
};

// Onboarding steps configuration
const ONBOARDING_STEPS = [
  {
    id: 'welcome',
    type: 'modal',
    title: 'Welcome to DataPulse',
    subtitle: 'Your enterprise-grade research data platform',
    description: 'Let\'s take a quick tour to help you discover the powerful features that make DataPulse the choice of leading research organizations worldwide.',
    icon: Rocket,
    features: [
      { icon: WifiOff, label: 'Offline-First Collection', desc: 'Work anywhere, even without internet' },
      { icon: BarChart3, label: 'Advanced Analytics', desc: 'Publication-quality analysis & visualizations' },
      { icon: Brain, label: 'AI-Powered Quality', desc: 'Automatic anomaly detection & monitoring' },
      { icon: Shield, label: 'Enterprise Security', desc: 'AES-256 encryption & compliance ready' }
    ]
  },
  {
    id: 'navigation',
    type: 'tooltip',
    target: '[data-tour="nav-rail"]',
    fallbackTarget: 'aside',
    position: 'right',
    title: 'Smart Navigation',
    description: 'Access all modules from this rail. Click any icon to expand its menu. Your most-used features are always one click away.',
    highlight: true
  },
  {
    id: 'org-selector',
    type: 'tooltip',
    target: '[data-tour="org-selector"]',
    fallbackTarget: 'button:has-text("Organization")',
    position: 'bottom',
    title: 'Multi-Organization Support',
    description: 'Switch between organizations instantly. Perfect for consultants and agencies managing multiple research projects.',
    highlight: true
  },
  {
    id: 'offline-feature',
    type: 'feature-spotlight',
    title: 'Offline-First Data Collection',
    icon: WifiOff,
    color: 'from-emerald-500 to-teal-600',
    description: 'DataPulse works seamlessly without internet connection. Your enumerators can collect data in the most remote locations.',
    benefits: [
      'Encrypted local storage with AES-256',
      'Automatic background sync when online',
      'Conflict resolution for simultaneous edits',
      'Full form functionality offline'
    ],
    cta: { label: 'See Offline Settings', path: '/settings?tab=app' }
  },
  {
    id: 'analysis-feature',
    type: 'feature-spotlight',
    title: 'Professional Data Analysis',
    icon: BarChart3,
    color: 'from-violet-500 to-purple-600',
    description: 'From basic frequencies to advanced statistical models - analyze your data without leaving the platform.',
    benefits: [
      'Descriptive statistics & crosstabs',
      'T-tests, ANOVA, regression analysis',
      'Complex survey statistics with design effects',
      'AI Copilot for natural language queries'
    ],
    cta: { label: 'Explore Analysis', path: '/analysis' }
  },
  {
    id: 'quality-ai-feature',
    type: 'feature-spotlight',
    title: 'AI Quality Monitoring',
    icon: Brain,
    color: 'from-amber-500 to-orange-600',
    description: 'Let AI watch your data quality in real-time. Catch issues before they become problems.',
    benefits: [
      'Speeding detection (too-fast responses)',
      'Straight-lining pattern detection',
      'GPS anomaly monitoring',
      'Duplicate submission detection'
    ],
    cta: { label: 'View Quality AI', path: '/quality-ai' }
  },
  {
    id: 'create-project',
    type: 'tooltip',
    target: '[data-tour="create-btn"]',
    fallbackTarget: 'button:has-text("Create")',
    position: 'bottom',
    title: 'Quick Create',
    description: 'Start your first project from here. Create forms, import data, or set up a new survey in seconds.',
    highlight: true,
    action: 'Click to explore creation options'
  },
  {
    id: 'search',
    type: 'tooltip',
    target: '[data-tour="search-bar"]',
    fallbackTarget: 'input[placeholder*="Search"]',
    position: 'bottom',
    title: 'Universal Search',
    description: 'Find anything instantly - forms, submissions, projects, or team members. Press ⌘K for quick access.',
    highlight: true
  },
  {
    id: 'notifications',
    type: 'tooltip',
    target: '[data-tour="notifications"]',
    fallbackTarget: 'button:has([class*="bell"])',
    position: 'bottom-end',
    title: 'Smart Notifications',
    description: 'Stay informed with real-time alerts for submissions, quality issues, and team activity. Enable push notifications for mobile alerts.',
    highlight: true
  },
  {
    id: 'complete',
    type: 'modal',
    title: 'You\'re All Set!',
    subtitle: 'Ready to transform your research',
    description: 'You\'ve completed the tour! Here are your next steps to get started with DataPulse.',
    icon: Star,
    nextSteps: [
      { icon: Folder, label: 'Create a Project', desc: 'Organize your research into projects', path: '/projects' },
      { icon: FileText, label: 'Build a Form', desc: 'Design your first data collection instrument', path: '/forms/new' },
      { icon: Users, label: 'Invite Team', desc: 'Collaborate with your research team', path: '/team' },
      { icon: Database, label: 'Import Data', desc: 'Bring in existing datasets', path: '/cases/import' }
    ]
  }
];

// Tooltip positioning utilities
const getTooltipPosition = (target, position) => {
  if (!target) return { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' };
  
  const rect = target.getBoundingClientRect();
  const scrollY = window.scrollY;
  const scrollX = window.scrollX;
  
  const positions = {
    'top': {
      top: rect.top + scrollY - 16,
      left: rect.left + scrollX + rect.width / 2,
      transform: 'translate(-50%, -100%)'
    },
    'bottom': {
      top: rect.bottom + scrollY + 16,
      left: rect.left + scrollX + rect.width / 2,
      transform: 'translate(-50%, 0)'
    },
    'left': {
      top: rect.top + scrollY + rect.height / 2,
      left: rect.left + scrollX - 16,
      transform: 'translate(-100%, -50%)'
    },
    'right': {
      top: rect.top + scrollY + rect.height / 2,
      left: rect.right + scrollX + 16,
      transform: 'translate(0, -50%)'
    },
    'bottom-end': {
      top: rect.bottom + scrollY + 16,
      left: rect.right + scrollX,
      transform: 'translate(-100%, 0)'
    }
  };
  
  return positions[position] || positions['bottom'];
};

// Spotlight overlay component
const SpotlightOverlay = ({ target, onClick }) => {
  const [spotlightStyle, setSpotlightStyle] = useState({});
  
  useEffect(() => {
    if (target) {
      const rect = target.getBoundingClientRect();
      setSpotlightStyle({
        top: rect.top - 8,
        left: rect.left - 8,
        width: rect.width + 16,
        height: rect.height + 16,
      });
    }
  }, [target]);
  
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[9998]"
      onClick={onClick}
    >
      {/* Dark overlay with cutout */}
      <div className="absolute inset-0 bg-black/70" />
      {target && (
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="absolute rounded-xl ring-4 ring-primary ring-offset-2 ring-offset-background"
          style={{
            ...spotlightStyle,
            boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.7)',
            background: 'transparent'
          }}
        />
      )}
    </motion.div>
  );
};

// Welcome/Complete Modal
const WelcomeModal = ({ step, onNext, onComplete, isLast }) => {
  const navigate = useNavigate();
  const Icon = step.icon;
  
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.9, opacity: 0, y: 20 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className="bg-card border border-border rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden"
      >
        {/* Header with gradient */}
        <div className="relative bg-gradient-to-br from-primary/20 via-primary/10 to-transparent p-8 text-center">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(59,130,246,0.1),transparent_50%)]" />
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: 'spring' }}
            className="relative w-20 h-20 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center shadow-lg shadow-primary/30"
          >
            <Icon className="w-10 h-10 text-primary-foreground" />
          </motion.div>
          <h2 className="text-2xl font-bold text-foreground mb-1">{step.title}</h2>
          <p className="text-muted-foreground">{step.subtitle}</p>
        </div>
        
        {/* Content */}
        <div className="p-6 space-y-6">
          <p className="text-muted-foreground text-center">{step.description}</p>
          
          {/* Features grid for welcome */}
          {step.features && (
            <div className="grid grid-cols-2 gap-3">
              {step.features.map((feature, idx) => {
                const FeatureIcon = feature.icon;
                return (
                  <motion.div
                    key={idx}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 + idx * 0.1 }}
                    className="p-3 rounded-xl bg-muted/50 border border-border/50"
                  >
                    <FeatureIcon className="w-5 h-5 text-primary mb-2" />
                    <p className="text-sm font-medium text-foreground">{feature.label}</p>
                    <p className="text-xs text-muted-foreground">{feature.desc}</p>
                  </motion.div>
                );
              })}
            </div>
          )}
          
          {/* Next steps for complete */}
          {step.nextSteps && (
            <div className="space-y-2">
              {step.nextSteps.map((item, idx) => {
                const ItemIcon = item.icon;
                return (
                  <motion.button
                    key={idx}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.3 + idx * 0.1 }}
                    onClick={() => {
                      onComplete();
                      navigate(item.path);
                    }}
                    className="w-full p-3 rounded-xl bg-muted/50 border border-border/50 hover:bg-muted hover:border-primary/30 transition-all flex items-center gap-3 group"
                  >
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                      <ItemIcon className="w-5 h-5 text-primary" />
                    </div>
                    <div className="text-left flex-1">
                      <p className="text-sm font-medium text-foreground">{item.label}</p>
                      <p className="text-xs text-muted-foreground">{item.desc}</p>
                    </div>
                    <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
                  </motion.button>
                );
              })}
            </div>
          )}
        </div>
        
        {/* Footer */}
        <div className="p-4 border-t border-border bg-muted/30 flex justify-between items-center">
          {isLast ? (
            <Button onClick={onComplete} className="w-full gap-2">
              <Check className="w-4 h-4" />
              Complete Setup
            </Button>
          ) : (
            <>
              <p className="text-xs text-muted-foreground">
                Takes about 2 minutes
              </p>
              <Button onClick={onNext} className="gap-2">
                Start Tour
                <ChevronRight className="w-4 h-4" />
              </Button>
            </>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
};

// Feature Spotlight Modal
const FeatureSpotlight = ({ step, onNext, onPrev, currentStep, totalSteps }) => {
  const navigate = useNavigate();
  const Icon = step.icon;
  
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.9, opacity: 0, y: 20 }}
        className="bg-card border border-border rounded-2xl shadow-2xl max-w-md w-full overflow-hidden"
      >
        {/* Icon header with gradient */}
        <div className={cn("relative p-6 text-center bg-gradient-to-br", step.color)}>
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
        <div className="p-6 space-y-4">
          <div className="text-center">
            <h3 className="text-xl font-bold text-foreground mb-2">{step.title}</h3>
            <p className="text-muted-foreground text-sm">{step.description}</p>
          </div>
          
          {/* Benefits list */}
          {step.benefits && (
            <div className="space-y-2">
              {step.benefits.map((benefit, idx) => (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.2 + idx * 0.1 }}
                  className="flex items-center gap-2 text-sm"
                >
                  <Check className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                  <span className="text-foreground">{benefit}</span>
                </motion.div>
              ))}
            </div>
          )}
          
          {/* CTA button */}
          {step.cta && (
            <Button
              variant="outline"
              className="w-full"
              onClick={() => navigate(step.cta.path)}
            >
              {step.cta.label}
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          )}
        </div>
        
        {/* Footer with navigation */}
        <div className="p-4 border-t border-border bg-muted/30">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs text-muted-foreground">
              Step {currentStep} of {totalSteps}
            </span>
            <Progress value={(currentStep / totalSteps) * 100} className="w-24 h-1.5" />
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={onPrev} className="flex-1">
              <ChevronLeft className="w-4 h-4 mr-1" />
              Back
            </Button>
            <Button size="sm" onClick={onNext} className="flex-1">
              Next
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};

// Tooltip component
const TooltipStep = ({ step, onNext, onPrev, onSkip, currentStep, totalSteps }) => {
  const [targetEl, setTargetEl] = useState(null);
  const [position, setPosition] = useState({});
  
  useEffect(() => {
    // Find target element
    const findTarget = () => {
      let el = document.querySelector(step.target);
      if (!el && step.fallbackTarget) {
        el = document.querySelector(step.fallbackTarget);
      }
      return el;
    };
    
    const el = findTarget();
    setTargetEl(el);
    
    if (el) {
      const pos = getTooltipPosition(el, step.position);
      setPosition(pos);
      
      // Scroll element into view if needed
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    
    // Update position on resize
    const handleResize = () => {
      const el = findTarget();
      if (el) {
        setPosition(getTooltipPosition(el, step.position));
      }
    };
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [step]);
  
  return (
    <>
      <SpotlightOverlay target={targetEl} onClick={() => {}} />
      
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        className="fixed z-[9999] w-80"
        style={{
          top: position.top,
          left: position.left,
          transform: position.transform
        }}
      >
        <div className="bg-card border border-border rounded-xl shadow-2xl overflow-hidden">
          {/* Arrow indicator */}
          <div className={cn(
            "absolute w-3 h-3 bg-card border-l border-t border-border rotate-45",
            step.position === 'bottom' && "-top-1.5 left-1/2 -translate-x-1/2",
            step.position === 'top' && "-bottom-1.5 left-1/2 -translate-x-1/2 rotate-[225deg]",
            step.position === 'left' && "-right-1.5 top-1/2 -translate-y-1/2 rotate-[135deg]",
            step.position === 'right' && "-left-1.5 top-1/2 -translate-y-1/2 -rotate-45",
            step.position === 'bottom-end' && "-top-1.5 right-6"
          )} />
          
          {/* Content */}
          <div className="p-4">
            <div className="flex items-start justify-between mb-2">
              <h4 className="font-semibold text-foreground">{step.title}</h4>
              <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                {currentStep}/{totalSteps}
              </span>
            </div>
            <p className="text-sm text-muted-foreground mb-3">{step.description}</p>
            
            {step.action && (
              <p className="text-xs text-primary font-medium mb-3 flex items-center gap-1">
                <Zap className="w-3 h-3" />
                {step.action}
              </p>
            )}
            
            {/* Progress bar */}
            <Progress value={(currentStep / totalSteps) * 100} className="h-1 mb-3" />
            
            {/* Navigation */}
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={onPrev} className="h-8 px-2">
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <Button size="sm" onClick={onNext} className="flex-1 h-8">
                Next
              </Button>
            </div>
          </div>
        </div>
      </motion.div>
    </>
  );
};

// Main Onboarding Provider
export function OnboardingProvider({ children }) {
  const { user, isAuthenticated } = useAuthStore();
  const { currentOrg } = useOrgStore();
  const location = useLocation();
  
  const [isActive, setIsActive] = useState(false);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState(() => {
    return localStorage.getItem('datapulse_onboarding_completed') === 'true';
  });
  
  // Check if should show onboarding for new users
  useEffect(() => {
    if (isAuthenticated && !hasCompletedOnboarding && location.pathname === '/dashboard') {
      // Small delay to let the dashboard render first
      const timer = setTimeout(() => {
        setIsActive(true);
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [isAuthenticated, hasCompletedOnboarding, location.pathname]);
  
  const currentStep = ONBOARDING_STEPS[currentStepIndex];
  const totalSteps = ONBOARDING_STEPS.length;
  
  const goToNext = useCallback(() => {
    if (currentStepIndex < ONBOARDING_STEPS.length - 1) {
      setCurrentStepIndex(prev => prev + 1);
    }
  }, [currentStepIndex]);
  
  const goToPrev = useCallback(() => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex(prev => prev - 1);
    }
  }, [currentStepIndex]);
  
  const completeOnboarding = useCallback(() => {
    setIsActive(false);
    setHasCompletedOnboarding(true);
    localStorage.setItem('datapulse_onboarding_completed', 'true');
    setCurrentStepIndex(0);
  }, []);
  
  const startOnboarding = useCallback(() => {
    setCurrentStepIndex(0);
    setIsActive(true);
  }, []);
  
  const skipOnboarding = useCallback(() => {
    completeOnboarding();
  }, [completeOnboarding]);
  
  const resetOnboarding = useCallback(() => {
    localStorage.removeItem('datapulse_onboarding_completed');
    setHasCompletedOnboarding(false);
    setCurrentStepIndex(0);
  }, []);
  
  const value = {
    isActive,
    currentStep: currentStepIndex,
    hasCompletedOnboarding,
    startOnboarding,
    completeOnboarding,
    resetOnboarding
  };
  
  return (
    <OnboardingContext.Provider value={value}>
      {children}
      
      <AnimatePresence mode="wait">
        {isActive && currentStep && (
          <>
            {currentStep.type === 'modal' && (
              <WelcomeModal
                key={currentStep.id}
                step={currentStep}
                onNext={goToNext}
                onComplete={completeOnboarding}
                isLast={currentStepIndex === ONBOARDING_STEPS.length - 1}
              />
            )}
            
            {currentStep.type === 'tooltip' && (
              <TooltipStep
                key={currentStep.id}
                step={currentStep}
                onNext={goToNext}
                onPrev={goToPrev}
                onSkip={skipOnboarding}
                currentStep={currentStepIndex + 1}
                totalSteps={totalSteps}
              />
            )}
            
            {currentStep.type === 'feature-spotlight' && (
              <FeatureSpotlight
                key={currentStep.id}
                step={currentStep}
                onNext={goToNext}
                onPrev={goToPrev}
                currentStep={currentStepIndex + 1}
                totalSteps={totalSteps}
              />
            )}
          </>
        )}
      </AnimatePresence>
    </OnboardingContext.Provider>
  );
}

// Replay button for settings
export function OnboardingReplayButton() {
  const { startOnboarding, resetOnboarding } = useOnboarding();
  
  const handleReplay = () => {
    resetOnboarding();
    // Navigate to dashboard first, then start
    window.location.href = '/dashboard';
  };
  
  return (
    <Button variant="outline" onClick={handleReplay} className="gap-2">
      <Play className="w-4 h-4" />
      Replay Onboarding Tour
    </Button>
  );
}

export default OnboardingProvider;
