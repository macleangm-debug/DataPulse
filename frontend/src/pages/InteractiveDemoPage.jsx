/**
 * DataPulse Interactive Demo Page
 * A sandboxed demo environment with guided tour like Survey360
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Progress } from '../components/ui/progress';
import { 
  BarChart3, 
  FileText, 
  Users, 
  Clock,
  TrendingUp,
  CheckCircle2,
  AlertCircle,
  MapPin,
  ChevronRight,
  ChevronLeft,
  X,
  Play,
  Settings,
  Bell,
  Search,
  Plus,
  MoreVertical,
  FolderOpen,
  Database,
  WifiOff,
  Brain,
  Sparkles,
  ArrowLeft,
  Hand,
  Eye,
  Download,
  Filter,
  RefreshCw,
  Calendar,
  Activity
} from 'lucide-react';
import { cn } from '../lib/utils';

// ============= DEMO DATA =============
const DEMO_STATS = {
  totalSubmissions: 2847,
  activeSurveys: 3,
  completionRate: 94,
  pendingReviews: 127
};

const DEMO_SURVEYS = [
  {
    id: '1',
    name: 'Customer Satisfaction Survey 2026',
    status: 'active',
    submissions: 1847,
    target: 2000,
    lastSubmission: '2 min ago',
    team: 12
  },
  {
    id: '2', 
    name: 'Product Feedback Q1',
    status: 'active',
    submissions: 753,
    target: 1000,
    lastSubmission: '15 min ago',
    team: 8
  },
  {
    id: '3',
    name: 'Annual Conference Registration',
    status: 'draft',
    submissions: 247,
    target: 500,
    lastSubmission: '1 hour ago',
    team: 4
  }
];

const DEMO_ACTIVITY = [
  { user: 'Sarah Chen', action: 'submitted response to', target: 'Customer Satisfaction', time: '2 min ago', avatar: 'SC' },
  { user: 'Mike Johnson', action: 'completed', target: 'Product Feedback', time: '5 min ago', avatar: 'MJ' },
  { user: 'Emily Davis', action: 'flagged submission in', target: 'Customer Satisfaction', time: '12 min ago', avatar: 'ED' },
  { user: 'Alex Thompson', action: 'submitted response to', target: 'Annual Conference', time: '18 min ago', avatar: 'AT' },
  { user: 'Lisa Wang', action: 'approved correction for', target: 'Product Feedback', time: '25 min ago', avatar: 'LW' },
];

// ============= TOUR CONFIGURATION =============
const TOUR_STEPS = [
  {
    id: 'welcome',
    type: 'modal',
    title: 'Welcome to DataPulse!',
    emoji: '👋',
    description: 'Let us show you around the dashboard. This quick tour will help you discover all the powerful features available.',
    duration: '~2 min'
  },
  {
    id: 'stats',
    type: 'tooltip',
    target: 'demo-stats',
    position: 'bottom',
    title: 'Real-time Statistics',
    description: 'Monitor your key metrics at a glance - submissions, completion rates, and pending reviews update in real-time.',
    icon: BarChart3
  },
  {
    id: 'surveys',
    type: 'tooltip',
    target: 'demo-surveys',
    position: 'right',
    title: 'Active Surveys',
    description: 'View and manage all your surveys. Track progress bars, see team assignments, and access quick actions.',
    icon: FileText
  },
  {
    id: 'activity',
    type: 'tooltip',
    target: 'demo-activity',
    position: 'left',
    title: 'Recent Activity',
    description: 'Stay updated on team activity. See who submitted data, flagged issues, or completed reviews.',
    icon: Activity
  },
  {
    id: 'sidebar',
    type: 'tooltip',
    target: 'demo-sidebar',
    position: 'right',
    title: 'Navigation Sidebar',
    description: 'Access all modules from here - Forms, Submissions, Quality AI, Analytics, and Team Management.',
    icon: FolderOpen
  },
  {
    id: 'offline',
    type: 'feature',
    title: 'Offline-First Design',
    icon: WifiOff,
    description: 'DataPulse works seamlessly without internet. Your field team can collect data anywhere, and it syncs automatically when online.',
    color: 'emerald'
  },
  {
    id: 'ai',
    type: 'feature',
    title: 'AI-Powered Quality',
    icon: Brain,
    description: 'Our AI monitors data quality in real-time - detecting speeding, straight-lining, GPS anomalies, and duplicate entries automatically.',
    color: 'purple'
  },
  {
    id: 'complete',
    type: 'complete',
    title: 'You\'re Ready!',
    emoji: '🎉',
    description: 'You\'ve seen the highlights! Sign up for free to start collecting data with DataPulse.',
    features: [
      'Real-time dashboards & analytics',
      'Offline-first data collection', 
      'AI-powered quality monitoring',
      '45+ question types'
    ]
  }
];

// ============= TOUR COMPONENTS =============

const TourOverlay = ({ children, onClose }) => (
  <motion.div
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0 }}
    className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm"
    onClick={onClose}
  >
    {children}
  </motion.div>
);

const TourModal = ({ step, onNext, onSkip, progress }) => (
  <TourOverlay onClose={onSkip}>
    <div className="flex items-center justify-center min-h-screen p-4" onClick={(e) => e.stopPropagation()}>
      <motion.div
        initial={{ scale: 0.9, y: 20, opacity: 0 }}
        animate={{ scale: 1, y: 0, opacity: 1 }}
        exit={{ scale: 0.9, y: 20, opacity: 0 }}
        className="bg-slate-800 border border-slate-700 rounded-2xl shadow-2xl max-w-md w-full overflow-hidden"
      >
        {/* Progress bar */}
        <div className="h-1 bg-slate-700">
          <motion.div 
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            className="h-full bg-gradient-to-r from-cyan-500 to-blue-500" 
          />
        </div>

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
          <p className="text-slate-400 mb-4">{step.description}</p>

          {step.duration && (
            <p className="text-xs text-slate-500 mb-4">Tour duration: {step.duration}</p>
          )}
        </div>

        <div className="px-6 pb-6 flex items-center justify-between">
          <Button variant="ghost" onClick={onSkip} className="text-slate-400 hover:text-white">
            Skip Tour
          </Button>
          <Button onClick={onNext} className="bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-white gap-2">
            Next
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </motion.div>
    </div>
  </TourOverlay>
);

const TourTooltip = ({ step, onNext, onPrev, onSkip, currentStep, totalSteps, targetRef }) => {
  const [position, setPosition] = useState({ top: '50%', left: '50%' });
  const Icon = step.icon;

  useEffect(() => {
    if (targetRef?.current) {
      const rect = targetRef.current.getBoundingClientRect();
      const positions = {
        'bottom': { top: rect.bottom + 16, left: rect.left + rect.width / 2, transform: 'translateX(-50%)' },
        'right': { top: rect.top + rect.height / 2, left: rect.right + 16, transform: 'translateY(-50%)' },
        'left': { top: rect.top + rect.height / 2, left: rect.left - 16, transform: 'translate(-100%, -50%)' },
        'top': { top: rect.top - 16, left: rect.left + rect.width / 2, transform: 'translate(-50%, -100%)' }
      };
      setPosition(positions[step.position] || positions['bottom']);
    }
  }, [targetRef, step.position]);

  return (
    <>
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] bg-black/50"
        onClick={onSkip}
      />
      
      {/* Highlight box around target */}
      {targetRef?.current && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="fixed z-[101] ring-2 ring-cyan-500 ring-offset-2 ring-offset-slate-900 rounded-xl pointer-events-none"
          style={{
            top: targetRef.current.getBoundingClientRect().top - 8,
            left: targetRef.current.getBoundingClientRect().left - 8,
            width: targetRef.current.getBoundingClientRect().width + 16,
            height: targetRef.current.getBoundingClientRect().height + 16,
          }}
        />
      )}

      {/* Tooltip */}
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        className="fixed z-[102] w-80"
        style={{ top: position.top, left: position.left, transform: position.transform }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-slate-800 border border-slate-700 rounded-xl shadow-2xl overflow-hidden">
          <div className="p-4">
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

            {/* Progress dots */}
            <div className="flex justify-center gap-1 mb-4">
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

            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={onPrev} className="text-slate-400 hover:text-white h-8 px-2">
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <Button size="sm" onClick={onNext} className="flex-1 h-8 bg-cyan-500 hover:bg-cyan-600 text-white">
                Next
              </Button>
              <Button variant="ghost" size="sm" onClick={onSkip} className="text-slate-400 hover:text-white h-8 px-2">
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </motion.div>
    </>
  );
};

const TourFeature = ({ step, onNext, onPrev, onSkip, currentStep, totalSteps }) => {
  const Icon = step.icon;
  const colorClasses = {
    emerald: 'from-emerald-500 to-teal-500',
    purple: 'from-purple-500 to-pink-500',
    blue: 'from-blue-500 to-cyan-500'
  };

  return (
    <TourOverlay onClose={onSkip}>
      <div className="flex items-center justify-center min-h-screen p-4" onClick={(e) => e.stopPropagation()}>
        <motion.div
          initial={{ scale: 0.9, y: 20, opacity: 0 }}
          animate={{ scale: 1, y: 0, opacity: 1 }}
          exit={{ scale: 0.9, y: 20, opacity: 0 }}
          className="bg-slate-800 border border-slate-700 rounded-2xl shadow-2xl max-w-md w-full overflow-hidden"
        >
          <div className={cn("p-6 bg-gradient-to-br", colorClasses[step.color])}>
            <motion.div
              initial={{ scale: 0, rotate: -180 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: 'spring', damping: 15 }}
              className="w-16 h-16 mx-auto rounded-2xl bg-white/20 backdrop-blur flex items-center justify-center"
            >
              <Icon className="w-8 h-8 text-white" />
            </motion.div>
          </div>

          <div className="p-6 text-center">
            <h3 className="text-xl font-bold text-white mb-2">{step.title}</h3>
            <p className="text-slate-400 mb-4">{step.description}</p>
            
            <div className="flex justify-center gap-1 mb-4">
              {Array.from({ length: totalSteps }).map((_, i) => (
                <div key={i} className={cn("w-2 h-2 rounded-full", i + 1 <= currentStep ? "bg-cyan-500" : "bg-slate-600")} />
              ))}
            </div>
          </div>

          <div className="px-6 pb-6 flex items-center gap-2">
            <Button variant="ghost" onClick={onPrev} className="text-slate-400 hover:text-white">
              <ChevronLeft className="w-4 h-4 mr-1" /> Back
            </Button>
            <Button variant="ghost" onClick={onSkip} className="flex-1 text-slate-400 hover:text-white">
              Skip Tour
            </Button>
            <Button onClick={onNext} className="bg-gradient-to-r from-cyan-500 to-blue-500 text-white gap-1">
              Next <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </motion.div>
      </div>
    </TourOverlay>
  );
};

const TourComplete = ({ step, onComplete, onPrev }) => {
  const navigate = useNavigate();
  
  return (
    <TourOverlay onClose={onComplete}>
      <div className="flex items-center justify-center min-h-screen p-4" onClick={(e) => e.stopPropagation()}>
        <motion.div
          initial={{ scale: 0.9, y: 20, opacity: 0 }}
          animate={{ scale: 1, y: 0, opacity: 1 }}
          className="bg-slate-800 border border-slate-700 rounded-2xl shadow-2xl max-w-md w-full overflow-hidden"
        >
          <div className="h-1 bg-gradient-to-r from-cyan-500 to-blue-500" />

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

            <div className="space-y-2 mb-6 text-left">
              {step.features.map((feature, idx) => (
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

          <div className="px-6 pb-6 flex flex-col gap-3">
            <Button
              onClick={() => navigate('/register')}
              className="w-full bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-white gap-2"
            >
              Start Free Trial
              <ChevronRight className="w-4 h-4" />
            </Button>
            <Button variant="ghost" onClick={onComplete} className="w-full text-slate-400 hover:text-white">
              Continue Exploring
            </Button>
          </div>
        </motion.div>
      </div>
    </TourOverlay>
  );
};

// ============= MAIN DEMO PAGE =============

export default function InteractiveDemoPage() {
  const navigate = useNavigate();
  const [showTour, setShowTour] = useState(false);
  const [tourStep, setTourStep] = useState(0);
  const [activeView, setActiveView] = useState('dashboard'); // dashboard, surveys, submissions, form-preview
  const [selectedSurvey, setSelectedSurvey] = useState(null);
  
  // Refs for tour targets
  const statsRef = React.useRef(null);
  const surveysRef = React.useRef(null);
  const activityRef = React.useRef(null);
  const sidebarRef = React.useRef(null);

  const currentStep = TOUR_STEPS[tourStep];
  const totalSteps = TOUR_STEPS.length;
  const progress = ((tourStep + 1) / totalSteps) * 100;

  // Auto-start tour on first visit
  useEffect(() => {
    const hasSeenTour = sessionStorage.getItem('demo_tour_seen');
    if (!hasSeenTour) {
      const timer = setTimeout(() => setShowTour(true), 1000);
      return () => clearTimeout(timer);
    }
  }, []);

  const startTour = () => {
    setTourStep(0);
    setShowTour(true);
  };

  const nextStep = useCallback(() => {
    if (tourStep < TOUR_STEPS.length - 1) {
      setTourStep(prev => prev + 1);
    }
  }, [tourStep]);

  const prevStep = useCallback(() => {
    if (tourStep > 0) {
      setTourStep(prev => prev - 1);
    }
  }, [tourStep]);

  const endTour = useCallback(() => {
    setShowTour(false);
    sessionStorage.setItem('demo_tour_seen', 'true');
  }, []);
  
  // Handle survey click
  const handleSurveyClick = (survey) => {
    setSelectedSurvey(survey);
    setActiveView('form-preview');
  };
  
  // Handle sidebar navigation
  const handleNavClick = (view) => {
    setActiveView(view);
    setSelectedSurvey(null);
  };

  const getTargetRef = (targetId) => {
    const refs = {
      'demo-stats': statsRef,
      'demo-surveys': surveysRef,
      'demo-activity': activityRef,
      'demo-sidebar': sidebarRef
    };
    return refs[targetId];
  };

  return (
    <div className="min-h-screen bg-slate-900">
      {/* Demo Mode Banner */}
      <motion.div
        initial={{ y: -50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="bg-gradient-to-r from-cyan-600 via-blue-600 to-purple-600 text-white py-2.5 px-4"
      >
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Sparkles className="w-4 h-4" />
            <span className="text-sm font-medium">
              Sample data from Customer Feedback Survey – Actions like save & export are disabled
            </span>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={startTour}
              className="text-white hover:bg-white/20 gap-1.5"
              data-testid="start-tour-btn"
            >
              <Hand className="w-4 h-4" />
              Take Tour
            </Button>
            <Button
              size="sm"
              onClick={() => navigate('/')}
              className="bg-white text-blue-600 hover:bg-blue-50"
            >
              Exit Demo
            </Button>
          </div>
        </div>
      </motion.div>

      <div className="flex">
        {/* Sidebar */}
        <aside 
          ref={sidebarRef}
          className="w-64 bg-slate-800 border-r border-slate-700 min-h-[calc(100vh-44px)] p-4"
          data-tour="demo-sidebar"
        >
          {/* Logo */}
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-500 flex items-center justify-center">
              <Database className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold text-white">
              Data<span className="text-cyan-400">Pulse</span>
            </span>
          </div>

          {/* Demo User */}
          <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-700/50 mb-6">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-500 to-blue-500 flex items-center justify-center text-white font-semibold">
              DU
            </div>
            <div>
              <p className="text-sm font-medium text-white">Demo User</p>
              <p className="text-xs text-slate-400">demo@datapulse.io</p>
            </div>
          </div>

          {/* Navigation */}
          <nav className="space-y-1">
            {[
              { icon: BarChart3, label: 'Dashboard', view: 'dashboard' },
              { icon: FileText, label: 'Surveys', view: 'surveys', badge: '3' },
              { icon: FolderOpen, label: 'Submissions', view: 'submissions', badge: '127' },
              { icon: Brain, label: 'Quality AI', view: 'quality' },
              { icon: Users, label: 'Team', view: 'team' },
              { icon: MapPin, label: 'GPS Map', view: 'gps' },
              { icon: Settings, label: 'Settings', view: 'settings' },
            ].map((item, idx) => (
              <button
                key={idx}
                onClick={() => handleNavClick(item.view)}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors cursor-pointer",
                  activeView === item.view || (activeView === 'form-preview' && item.view === 'surveys')
                    ? "bg-cyan-500/20 text-cyan-400" 
                    : "text-slate-400 hover:bg-slate-700/50 hover:text-white"
                )}
              >
                <item.icon className="w-5 h-5" />
                {item.label}
                {item.badge && (
                  <span className="ml-auto px-2 py-0.5 rounded-full bg-slate-600 text-xs">
                    {item.badge}
                  </span>
                )}
              </button>
            ))}
          </nav>

          {/* Demo Mode Card */}
          <div className="mt-8 p-4 rounded-xl bg-gradient-to-br from-cyan-500/10 to-blue-500/10 border border-cyan-500/20">
            <div className="flex items-center gap-2 mb-2">
              <Eye className="w-4 h-4 text-cyan-400" />
              <span className="text-sm font-medium text-white">Demo Mode</span>
            </div>
            <p className="text-xs text-slate-400 mb-3">
              Explore features with sample data
            </p>
            <Button 
              size="sm" 
              onClick={() => navigate('/register')}
              className="w-full bg-cyan-500 hover:bg-cyan-600 text-white"
            >
              Start Free Trial
            </Button>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 p-6 overflow-auto">
          {/* Form Preview View */}
          {activeView === 'form-preview' && selectedSurvey && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              <div className="flex items-center gap-4 mb-6">
                <Button 
                  variant="ghost" 
                  onClick={() => setActiveView('dashboard')}
                  className="text-slate-400 hover:text-white gap-2"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Back to Dashboard
                </Button>
              </div>
              
              <Card className="bg-slate-800 border-slate-700">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-white text-xl">{selectedSurvey.name}</CardTitle>
                      <p className="text-sm text-slate-400 mt-1">Form Preview - Click fields to see how they work</p>
                    </div>
                    <Badge className="bg-emerald-500/20 text-emerald-400">{selectedSurvey.status}</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Sample Form Fields */}
                  <div className="space-y-4">
                    <div className="p-4 rounded-lg bg-slate-700/50 border border-slate-600">
                      <label className="block text-sm font-medium text-white mb-2">1. Full Name *</label>
                      <input 
                        type="text" 
                        placeholder="Enter your full name"
                        className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white placeholder:text-slate-500 focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                      />
                    </div>
                    
                    <div className="p-4 rounded-lg bg-slate-700/50 border border-slate-600">
                      <label className="block text-sm font-medium text-white mb-2">2. How satisfied are you with our service? *</label>
                      <div className="flex gap-4 mt-2">
                        {['Very Unsatisfied', 'Unsatisfied', 'Neutral', 'Satisfied', 'Very Satisfied'].map((opt, i) => (
                          <label key={i} className="flex items-center gap-2 cursor-pointer">
                            <input type="radio" name="satisfaction" className="w-4 h-4 accent-cyan-500" />
                            <span className="text-sm text-slate-300">{opt}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                    
                    <div className="p-4 rounded-lg bg-slate-700/50 border border-slate-600">
                      <label className="block text-sm font-medium text-white mb-2">3. Additional Comments</label>
                      <textarea 
                        placeholder="Share your thoughts..."
                        rows={3}
                        className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white placeholder:text-slate-500 focus:ring-2 focus:ring-cyan-500 focus:border-transparent resize-none"
                      />
                    </div>
                    
                    <div className="p-4 rounded-lg bg-slate-700/50 border border-slate-600">
                      <label className="block text-sm font-medium text-white mb-2">4. Upload Photo (Optional)</label>
                      <div className="border-2 border-dashed border-slate-600 rounded-lg p-8 text-center hover:border-cyan-500 transition-colors cursor-pointer">
                        <Database className="w-8 h-8 text-slate-500 mx-auto mb-2" />
                        <p className="text-sm text-slate-400">Click to upload or drag and drop</p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex justify-end gap-3 pt-4 border-t border-slate-700">
                    <Button variant="outline" className="border-slate-600 text-slate-300">Save Draft</Button>
                    <Button className="bg-cyan-500 hover:bg-cyan-600">Submit Response</Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}
          
          {/* Other Views Placeholder */}
          {['surveys', 'submissions', 'quality', 'team', 'gps', 'settings'].includes(activeView) && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col items-center justify-center min-h-[60vh]"
            >
              <div className="w-20 h-20 rounded-2xl bg-cyan-500/20 flex items-center justify-center mb-4">
                {activeView === 'surveys' && <FileText className="w-10 h-10 text-cyan-400" />}
                {activeView === 'submissions' && <FolderOpen className="w-10 h-10 text-cyan-400" />}
                {activeView === 'quality' && <Brain className="w-10 h-10 text-cyan-400" />}
                {activeView === 'team' && <Users className="w-10 h-10 text-cyan-400" />}
                {activeView === 'gps' && <MapPin className="w-10 h-10 text-cyan-400" />}
                {activeView === 'settings' && <Settings className="w-10 h-10 text-cyan-400" />}
              </div>
              <h2 className="text-2xl font-bold text-white mb-2 capitalize">{activeView}</h2>
              <p className="text-slate-400 mb-6 text-center max-w-md">
                This section is available in the full version. Sign up for free to explore all features!
              </p>
              <div className="flex gap-3">
                <Button variant="outline" onClick={() => setActiveView('dashboard')} className="border-slate-600">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back to Dashboard
                </Button>
                <Button onClick={() => navigate('/register')} className="bg-cyan-500 hover:bg-cyan-600">
                  Start Free Trial
                </Button>
              </div>
            </motion.div>
          )}
          
          {/* Dashboard View */}
          {activeView === 'dashboard' && (
            <>
              {/* Header */}
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h1 className="text-2xl font-bold text-white mb-1">Dashboard</h1>
                  <p className="text-slate-400">Welcome back! Here's your survey overview.</p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input 
                      type="text" 
                      placeholder="Search..." 
                      className="pl-9 pr-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white placeholder:text-slate-500 w-64 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                    />
                  </div>
                  <Button variant="ghost" size="icon" className="text-slate-400 hover:text-white">
                    <Bell className="w-5 h-5" />
                  </Button>
                  <Button className="bg-cyan-500 hover:bg-cyan-600 text-white gap-2">
                    <Plus className="w-4 h-4" />
                    New Survey
                  </Button>
                </div>
              </div>

              {/* Stats Cards */}
              <div 
                ref={statsRef}
                className="grid grid-cols-4 gap-4 mb-8"
            data-tour="demo-stats"
          >
            {[
              { label: 'Total Submissions', value: DEMO_STATS.totalSubmissions.toLocaleString(), icon: BarChart3, change: '+12%', color: 'cyan' },
              { label: 'Active Surveys', value: DEMO_STATS.activeSurveys, icon: FileText, change: '+1', color: 'blue' },
              { label: 'Completion Rate', value: `${DEMO_STATS.completionRate}%`, icon: CheckCircle2, change: '+3%', color: 'emerald' },
              { label: 'Pending Reviews', value: DEMO_STATS.pendingReviews, icon: Clock, change: '-8', color: 'amber' },
            ].map((stat, idx) => (
              <Card key={idx} className="bg-slate-800 border-slate-700">
                <CardContent className="p-5">
                  <div className="flex items-center justify-between mb-3">
                    <div className={cn(
                      "w-10 h-10 rounded-lg flex items-center justify-center",
                      stat.color === 'cyan' && "bg-cyan-500/20 text-cyan-400",
                      stat.color === 'blue' && "bg-blue-500/20 text-blue-400",
                      stat.color === 'emerald' && "bg-emerald-500/20 text-emerald-400",
                      stat.color === 'amber' && "bg-amber-500/20 text-amber-400"
                    )}>
                      <stat.icon className="w-5 h-5" />
                    </div>
                    <Badge variant="secondary" className={cn(
                      "text-xs",
                      stat.change.startsWith('+') ? "bg-emerald-500/20 text-emerald-400" : "bg-amber-500/20 text-amber-400"
                    )}>
                      {stat.change}
                    </Badge>
                  </div>
                  <p className="text-2xl font-bold text-white mb-1">{stat.value}</p>
                  <p className="text-sm text-slate-400">{stat.label}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="grid grid-cols-3 gap-6">
            {/* Active Surveys */}
            <div 
              ref={surveysRef}
              className="col-span-2"
              data-tour="demo-surveys"
            >
              <Card className="bg-slate-800 border-slate-700">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-white text-lg">Active Surveys</CardTitle>
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="sm" className="text-slate-400 hover:text-white gap-1">
                      <Filter className="w-4 h-4" />
                      Filter
                    </Button>
                    <Button variant="ghost" size="icon" className="text-slate-400 hover:text-white">
                      <RefreshCw className="w-4 h-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {DEMO_SURVEYS.map((survey) => (
                    <div 
                      key={survey.id} 
                      onClick={() => handleSurveyClick(survey)}
                      className="p-4 rounded-xl bg-slate-700/50 hover:bg-slate-700 transition-colors cursor-pointer group"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <h3 className="font-medium text-white mb-1 group-hover:text-cyan-400 transition-colors">{survey.name}</h3>
                          <div className="flex items-center gap-3 text-xs text-slate-400">
                            <span className="flex items-center gap-1">
                              <Users className="w-3 h-3" /> {survey.team} team members
                            </span>
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" /> {survey.lastSubmission}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant={survey.status === 'active' ? 'default' : 'secondary'} className={cn(
                            survey.status === 'active' ? "bg-emerald-500/20 text-emerald-400" : "bg-slate-600 text-slate-300"
                          )}>
                            {survey.status}
                          </Badge>
                          <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-cyan-400 transition-colors" />
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <Progress value={(survey.submissions / survey.target) * 100} className="flex-1 h-2" />
                        <span className="text-sm text-slate-400 w-24 text-right">
                          {survey.submissions}/{survey.target}
                        </span>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>

            {/* Recent Activity */}
            <div 
              ref={activityRef}
              data-tour="demo-activity"
            >
              <Card className="bg-slate-800 border-slate-700 h-full">
                <CardHeader className="pb-2">
                  <CardTitle className="text-white text-lg">Recent Activity</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {DEMO_ACTIVITY.map((activity, idx) => (
                    <div key={idx} className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-cyan-500 to-blue-500 flex items-center justify-center text-white text-xs font-semibold flex-shrink-0">
                        {activity.avatar}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-slate-300">
                          <span className="font-medium text-white">{activity.user}</span>{' '}
                          {activity.action}{' '}
                          <span className="text-cyan-400">{activity.target}</span>
                        </p>
                        <p className="text-xs text-slate-500">{activity.time}</p>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          </div>
            </>
          )}
        </main>
      </div>

      {/* Tour Overlay */}
      <AnimatePresence mode="wait">
        {showTour && currentStep && (
          <>
            {currentStep.type === 'modal' && (
              <TourModal
                key={currentStep.id}
                step={currentStep}
                onNext={nextStep}
                onSkip={endTour}
                progress={progress}
              />
            )}
            {currentStep.type === 'tooltip' && (
              <TourTooltip
                key={currentStep.id}
                step={currentStep}
                onNext={nextStep}
                onPrev={prevStep}
                onSkip={endTour}
                currentStep={tourStep + 1}
                totalSteps={totalSteps}
                targetRef={getTargetRef(currentStep.target)}
              />
            )}
            {currentStep.type === 'feature' && (
              <TourFeature
                key={currentStep.id}
                step={currentStep}
                onNext={nextStep}
                onPrev={prevStep}
                onSkip={endTour}
                currentStep={tourStep + 1}
                totalSteps={totalSteps}
              />
            )}
            {currentStep.type === 'complete' && (
              <TourComplete
                key={currentStep.id}
                step={currentStep}
                onComplete={endTour}
                onPrev={prevStep}
              />
            )}
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
