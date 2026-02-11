import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { 
  BarChart3, 
  FileText, 
  MapPin, 
  Users, 
  WifiOff, 
  Camera, 
  Brain, 
  Shield, 
  Zap, 
  Globe, 
  Mic, 
  QrCode,
  PenTool,
  FolderTree,
  CheckCircle2,
  ArrowRight,
  Play,
  Sparkles,
  Database,
  LineChart,
  Lock,
  Clock,
  ChevronRight,
  Star,
  Menu,
  X,
  Smartphone,
  Cloud,
  Wifi
} from 'lucide-react';

// Floating icon component for hero section
const FloatingIcon = ({ icon: Icon, className, delay = 0, duration = 3, color }) => {
  const colorClasses = {
    blue: 'bg-blue-500/10 text-blue-500 border-blue-500/30 shadow-blue-500/20',
    cyan: 'bg-cyan-500/10 text-cyan-500 border-cyan-500/30 shadow-cyan-500/20',
    purple: 'bg-purple-500/10 text-purple-500 border-purple-500/30 shadow-purple-500/20',
    emerald: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/30 shadow-emerald-500/20',
    orange: 'bg-orange-500/10 text-orange-500 border-orange-500/30 shadow-orange-500/20',
    pink: 'bg-pink-500/10 text-pink-500 border-pink-500/30 shadow-pink-500/20',
  };

  return (
    <div 
      className={`absolute hidden lg:flex items-center justify-center w-12 h-12 rounded-xl border backdrop-blur-sm shadow-lg ${colorClasses[color]} ${className}`}
      style={{
        animation: `float ${duration}s ease-in-out infinite`,
        animationDelay: `${delay}s`,
      }}
    >
      <Icon className="w-6 h-6" />
    </div>
  );
};

// Add floating animation keyframes via style tag
const FloatingAnimationStyles = () => (
  <style>{`
    @keyframes float {
      0%, 100% { transform: translateY(0px) rotate(0deg); }
      25% { transform: translateY(-10px) rotate(2deg); }
      50% { transform: translateY(-5px) rotate(0deg); }
      75% { transform: translateY(-15px) rotate(-2deg); }
    }
    @keyframes float-slow {
      0%, 100% { transform: translateY(0px) rotate(0deg); }
      50% { transform: translateY(-20px) rotate(3deg); }
    }
    @keyframes pulse-glow {
      0%, 100% { box-shadow: 0 0 20px rgba(59, 130, 246, 0.3); }
      50% { box-shadow: 0 0 40px rgba(59, 130, 246, 0.6); }
    }
  `}</style>
);

// Animated counter component
const AnimatedCounter = ({ end, duration = 2000, suffix = '' }) => {
  const [count, setCount] = useState(0);
  
  useEffect(() => {
    let startTime;
    const animate = (currentTime) => {
      if (!startTime) startTime = currentTime;
      const progress = Math.min((currentTime - startTime) / duration, 1);
      setCount(Math.floor(progress * end));
      if (progress < 1) requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
  }, [end, duration]);
  
  return <span>{count.toLocaleString()}{suffix}</span>;
};

// Feature card component
const FeatureCard = ({ icon: Icon, title, description, stat, statLabel, color = 'blue' }) => {
  const colorClasses = {
    blue: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
    green: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
    purple: 'bg-purple-500/10 text-purple-500 border-purple-500/20',
    orange: 'bg-orange-500/10 text-orange-500 border-orange-500/20',
    cyan: 'bg-cyan-500/10 text-cyan-500 border-cyan-500/20',
    pink: 'bg-pink-500/10 text-pink-500 border-pink-500/20',
  };
  
  return (
    <Card className="group relative overflow-hidden border border-slate-200 dark:border-slate-700/50 bg-white dark:bg-slate-800/50 hover:shadow-xl hover:shadow-blue-500/5 transition-all duration-500 hover:-translate-y-1">
      <CardContent className="p-6">
        <div className={`w-12 h-12 rounded-xl ${colorClasses[color]} flex items-center justify-center mb-4 transition-transform duration-300 group-hover:scale-110`}>
          <Icon className="w-6 h-6" />
        </div>
        {stat && (
          <div className="text-3xl font-bold text-slate-900 dark:text-white mb-1">
            {stat}
          </div>
        )}
        {statLabel && (
          <div className="text-xs text-slate-500 dark:text-slate-400 mb-3 uppercase tracking-wider">
            {statLabel}
          </div>
        )}
        <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">{title}</h3>
        <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">{description}</p>
      </CardContent>
      <div className="absolute inset-0 bg-gradient-to-r from-blue-500/0 via-blue-500/5 to-purple-500/0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
    </Card>
  );
};

// Comparison table row
const ComparisonRow = ({ feature, datapulse, competitor }) => (
  <tr className="border-b border-slate-100 dark:border-slate-800">
    <td className="py-4 px-4 text-slate-700 dark:text-slate-300 font-medium">{feature}</td>
    <td className="py-4 px-4 text-center">
      {datapulse ? (
        <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
          <CheckCircle2 className="w-4 h-4" /> {typeof datapulse === 'string' ? datapulse : 'Yes'}
        </span>
      ) : (
        <span className="text-slate-400">—</span>
      )}
    </td>
    <td className="py-4 px-4 text-center">
      {competitor ? (
        <span className="text-slate-600 dark:text-slate-400">{competitor}</span>
      ) : (
        <span className="text-slate-400">—</span>
      )}
    </td>
  </tr>
);

export default function LandingPage() {
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('builder');

  const stats = [
    { value: 45, suffix: '+', label: 'Question Types' },
    { value: 10000, suffix: '+', label: 'Demo Submissions' },
    { value: 99.9, suffix: '%', label: 'Uptime SLA' },
    { value: 50, suffix: '+', label: 'Active Features' },
  ];

  const features = [
    {
      icon: BarChart3,
      title: 'Real-time Dashboard',
      description: 'Monitor submissions, track team activity, and view analytics with live updates.',
      stat: '5,262',
      statLabel: 'Submissions tracked',
      color: 'blue'
    },
    {
      icon: FileText,
      title: 'Advanced Form Builder',
      description: 'Drag-and-drop form creation with skip logic, calculations, and 45+ field types.',
      stat: '45+',
      statLabel: 'Question types',
      color: 'purple'
    },
    {
      icon: MapPin,
      title: 'GPS & Geofencing',
      description: 'Automatic location capture with polygon zones and route visualization.',
      stat: '100%',
      statLabel: 'Accuracy',
      color: 'green'
    },
    {
      icon: Users,
      title: 'Team Management',
      description: 'Assign forms, track progress, and manage permissions across your field team.',
      stat: '47',
      statLabel: 'Active users',
      color: 'orange'
    },
    {
      icon: WifiOff,
      title: 'Offline-First Mode',
      description: 'Collect data without internet. Auto-sync with conflict resolution when online.',
      stat: '0%',
      statLabel: 'Data loss',
      color: 'cyan'
    },
    {
      icon: Camera,
      title: 'Media Capture',
      description: 'Photos, audio, video, signatures, and barcodes with automatic compression.',
      stat: '2,847',
      statLabel: 'Media files',
      color: 'pink'
    },
  ];

  const aiFeatures = [
    { icon: Brain, title: 'AI Transcription', desc: 'Whisper-powered audio to text' },
    { icon: Sparkles, title: 'Sentiment Analysis', desc: 'GPT-4o emotion detection' },
    { icon: Globe, title: 'Auto-Translation', desc: 'Multi-language support' },
    { icon: Shield, title: 'Blockchain Verification', desc: 'SHA-256 data integrity' },
    { icon: Mic, title: 'Voice-to-Text', desc: 'Speak instead of typing' },
    { icon: LineChart, title: 'Predictive Analytics', desc: 'Completion forecasting' },
  ];

  const fieldTypes = [
    'Text Input', 'Number', 'Dropdown', 'Multi-Select', 'Date/Time', 'GPS Location',
    'Photo Capture', 'Audio Recording', 'Video Recording', 'Signature', 'Barcode/QR',
    'Cascading Select', 'Matrix', 'Slider', 'Rating', 'Checkbox', 'Radio', 'File Upload'
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-b border-slate-200 dark:border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/25">
                <Database className="w-5 h-5 text-white" />
              </div>
              <span className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">
                Data<span className="text-blue-600">Pulse</span>
              </span>
            </div>
            
            {/* Desktop Navigation */}
            <div className="hidden md:flex items-center gap-8">
              <a href="#features" className="text-sm font-medium text-slate-600 hover:text-blue-600 dark:text-slate-300 dark:hover:text-blue-400 transition-colors">Features</a>
              <a href="#ai" className="text-sm font-medium text-slate-600 hover:text-blue-600 dark:text-slate-300 dark:hover:text-blue-400 transition-colors">AI Capabilities</a>
              <a href="#compare" className="text-sm font-medium text-slate-600 hover:text-blue-600 dark:text-slate-300 dark:hover:text-blue-400 transition-colors">Compare</a>
              <span onClick={() => navigate('/pricing')} className="text-sm font-medium text-slate-600 hover:text-blue-600 dark:text-slate-300 dark:hover:text-blue-400 transition-colors cursor-pointer">Pricing</span>
            </div>
            
            <div className="hidden md:flex items-center gap-3">
              <Button 
                variant="ghost" 
                onClick={() => navigate('/login')}
                className="text-slate-700 dark:text-slate-300"
                data-testid="nav-login-btn"
              >
                Log In
              </Button>
              <Button 
                onClick={() => navigate('/register')}
                className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-lg shadow-blue-500/25"
                data-testid="nav-signup-btn"
              >
                Start Free Trial
              </Button>
            </div>

            {/* Mobile menu button */}
            <button 
              className="md:hidden p-2"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {mobileMenuOpen && (
          <div className="md:hidden bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 py-4 px-4">
            <div className="flex flex-col gap-4">
              <a href="#features" className="text-slate-700 dark:text-slate-300">Features</a>
              <a href="#ai" className="text-slate-700 dark:text-slate-300">AI Capabilities</a>
              <a href="#compare" className="text-slate-700 dark:text-slate-300">Compare</a>
              <Button variant="outline" onClick={() => navigate('/login')}>Log In</Button>
              <Button onClick={() => navigate('/register')}>Start Free Trial</Button>
            </div>
          </div>
        )}
      </nav>

      {/* Hero Section */}
      <section className="relative pt-32 pb-20 px-4 overflow-hidden">
        {/* Background effects */}
        <div className="absolute inset-0 bg-gradient-to-br from-blue-50 via-indigo-50/50 to-purple-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950" />
        <div className="absolute top-0 left-0 right-0 h-[500px] bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(59,130,246,0.3),rgba(255,255,255,0))] dark:bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(59,130,246,0.15),rgba(255,255,255,0))]" />
        <div className="absolute top-40 -left-32 w-96 h-96 bg-gradient-to-br from-blue-400/30 to-cyan-400/30 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-0 -right-32 w-[500px] h-[500px] bg-gradient-to-br from-purple-400/20 to-pink-400/20 rounded-full blur-3xl" />
        
        <div className="max-w-6xl mx-auto text-center relative z-10">
          <Badge variant="secondary" className="mb-6 px-4 py-2 text-sm font-medium bg-gradient-to-r from-blue-100 to-indigo-100 dark:from-blue-900/50 dark:to-indigo-900/50 text-blue-700 dark:text-blue-300 border border-blue-200/50 dark:border-blue-700/50">
            <Zap className="w-4 h-4 mr-2 inline text-amber-500" />
            Trusted by 500+ Research Organizations Worldwide
          </Badge>
          
          <h1 className="text-4xl sm:text-5xl lg:text-7xl font-bold text-slate-900 dark:text-white mb-8 leading-[1.1] tracking-tight">
            Collect Field Data
            <br />
            <span className="relative">
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 via-cyan-500 to-indigo-600 animate-gradient">
                10x Faster
              </span>
              <svg className="absolute -bottom-2 left-0 w-full" viewBox="0 0 300 12" fill="none">
                <path d="M2 10C50 4 100 2 150 6C200 10 250 4 298 8" stroke="url(#gradient)" strokeWidth="3" strokeLinecap="round"/>
                <defs>
                  <linearGradient id="gradient" x1="0" y1="0" x2="300" y2="0">
                    <stop stopColor="#3B82F6"/>
                    <stop offset="0.5" stopColor="#06B6D4"/>
                    <stop offset="1" stopColor="#6366F1"/>
                  </linearGradient>
                </defs>
              </svg>
            </span>
            {' '}with AI
          </h1>
          
          <p className="text-lg sm:text-xl text-slate-600 dark:text-slate-400 mb-10 max-w-3xl mx-auto leading-relaxed">
            The most powerful offline-first data collection platform. AI transcription, 
            real-time quality monitoring, GPS tracking, and smart analytics — 
            <span className="text-slate-900 dark:text-white font-medium"> all in one place.</span>
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-8">
            <Button 
              size="lg" 
              onClick={() => navigate('/register')}
              className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-700 hover:via-indigo-700 hover:to-purple-700 text-white shadow-xl shadow-blue-500/30 px-10 py-7 text-lg font-semibold group"
              data-testid="hero-trial-btn"
            >
              Start Free — No Card Required
              <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
            </Button>
            <Button 
              size="lg" 
              variant="outline"
              onClick={() => navigate('/demo')}
              className="border-2 border-slate-300 dark:border-slate-600 px-8 py-7 text-lg hover:bg-slate-100 dark:hover:bg-slate-800 group"
              data-testid="hero-demo-btn"
            >
              <Play className="w-5 h-5 mr-2 group-hover:scale-110 transition-transform" />
              Watch Demo
            </Button>
          </div>
          
          <p className="text-sm text-slate-500 dark:text-slate-500 mb-16 flex items-center justify-center gap-6 flex-wrap">
            <span className="flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-emerald-500" /> 14-day free trial</span>
            <span className="flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-emerald-500" /> 500 free submissions</span>
            <span className="flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-emerald-500" /> Works offline</span>
          </p>
          
          {/* Stats Row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6 max-w-4xl mx-auto">
            {stats.map((stat, idx) => (
              <div key={idx} className="bg-white/80 dark:bg-slate-800/60 backdrop-blur-sm rounded-2xl p-5 sm:p-6 shadow-lg shadow-slate-200/50 dark:shadow-none border border-slate-200/80 dark:border-slate-700/50 hover:scale-105 transition-transform duration-300">
                <div className="text-2xl sm:text-4xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent mb-1">
                  <AnimatedCounter end={stat.value} suffix={stat.suffix} />
                </div>
                <div className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-24 px-4 bg-slate-50/50 dark:bg-slate-900/50">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <Badge variant="secondary" className="mb-4">Features</Badge>
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 dark:text-white mb-4">
              What You'll Explore
            </h2>
            <p className="text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
              Click on any feature to see it in action within our interactive demo
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, idx) => (
              <FeatureCard key={idx} {...feature} />
            ))}
          </div>
        </div>
      </section>

      {/* AI Features Section */}
      <section id="ai" className="py-24 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <Badge variant="secondary" className="mb-4 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300">
              <Brain className="w-4 h-4 mr-2 inline" />
              AI-Powered
            </Badge>
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 dark:text-white mb-4">
              Beyond Traditional Data Collection
            </h2>
            <p className="text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
              DataPulse goes beyond SurveyCTO with cutting-edge AI capabilities
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {aiFeatures.map((feature, idx) => (
              <Card key={idx} className="group border border-slate-200 dark:border-slate-700/50 bg-white dark:bg-slate-800/50 hover:shadow-xl hover:shadow-purple-500/5 transition-all duration-500 hover:-translate-y-1 overflow-hidden">
                <CardContent className="p-6">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500/10 to-pink-500/10 border border-purple-500/20 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300">
                    <feature.icon className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                  </div>
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">{feature.title}</h3>
                  <p className="text-sm text-slate-600 dark:text-slate-400">{feature.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Form Builder Preview */}
      <section id="builder" className="py-24 px-4 bg-slate-50/50 dark:bg-slate-900/50">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <Badge variant="secondary" className="mb-4">Try It Now</Badge>
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 dark:text-white mb-4">
              Build a Form Right Here
            </h2>
            <p className="text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
              Explore our drag-and-drop builder. This is the same interface you'll use in the full product.
            </p>
          </div>
          
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl shadow-slate-200/50 dark:shadow-none border border-slate-200 dark:border-slate-700 overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-3 bg-slate-100 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700">
              <div className="w-3 h-3 rounded-full bg-red-400" />
              <div className="w-3 h-3 rounded-full bg-yellow-400" />
              <div className="w-3 h-3 rounded-full bg-green-400" />
              <span className="ml-4 text-sm text-slate-500">DataPulse Form Builder</span>
            </div>
            
            <div className="grid md:grid-cols-3 min-h-[400px]">
              {/* Field Types Panel */}
              <div className="border-r border-slate-200 dark:border-slate-700 p-6 bg-slate-50 dark:bg-slate-900/50">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                  <Zap className="w-4 h-4 text-blue-500" />
                  Field Types
                </h3>
                <div className="flex flex-wrap gap-2">
                  {fieldTypes.slice(0, 12).map((type, idx) => (
                    <span 
                      key={idx}
                      className="px-3 py-1.5 text-xs font-medium bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-300 cursor-pointer hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all"
                    >
                      {type}
                    </span>
                  ))}
                  <span className="px-3 py-1.5 text-xs font-medium text-blue-600 dark:text-blue-400">
                    +{fieldTypes.length - 12} more
                  </span>
                </div>
              </div>
              
              {/* Form Canvas */}
              <div className="md:col-span-2 p-6">
                <div className="border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl p-8 min-h-[300px] flex flex-col items-center justify-center text-center">
                  <div className="w-16 h-16 rounded-2xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center mb-4">
                    <FileText className="w-8 h-8 text-blue-600 dark:text-blue-400" />
                  </div>
                  <h4 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">Form Canvas</h4>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
                    Drag & drop fields here to build your survey
                  </p>
                  <Button 
                    onClick={() => navigate('/login')}
                    className="bg-gradient-to-r from-blue-600 to-indigo-600"
                    data-testid="builder-try-btn"
                  >
                    Try Full Builder
                    <ChevronRight className="w-4 h-4 ml-1" />
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Comparison Table */}
      <section id="compare" className="py-24 px-4">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <Badge variant="secondary" className="mb-4">Comparison</Badge>
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 dark:text-white mb-4">
              Features That Surpass the Competition
            </h2>
            <p className="text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
              See how DataPulse compares to traditional data collection tools
            </p>
          </div>
          
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl shadow-slate-200/50 dark:shadow-none border border-slate-200 dark:border-slate-700 overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-900">
                  <th className="py-4 px-4 text-left text-sm font-semibold text-slate-900 dark:text-white">Feature</th>
                  <th className="py-4 px-4 text-center text-sm font-semibold text-blue-600 dark:text-blue-400">
                    <div className="flex items-center justify-center gap-2">
                      <Database className="w-4 h-4" />
                      DataPulse
                    </div>
                  </th>
                  <th className="py-4 px-4 text-center text-sm font-semibold text-slate-500">Others</th>
                </tr>
              </thead>
              <tbody>
                <ComparisonRow feature="AI Transcription" datapulse="Whisper-powered" competitor="—" />
                <ComparisonRow feature="Sentiment Analysis" datapulse="GPT-4o" competitor="—" />
                <ComparisonRow feature="Auto-Translation" datapulse="AI-powered" competitor="—" />
                <ComparisonRow feature="Data Quality AI" datapulse="AI anomaly detection" competitor="Basic rules" />
                <ComparisonRow feature="Predictive Analytics" datapulse="Completion forecasting" competitor="—" />
                <ComparisonRow feature="Real-time Dashboards" datapulse="Custom widgets" competitor="Limited" />
                <ComparisonRow feature="Blockchain Verification" datapulse="SHA-256 integrity" competitor="—" />
                <ComparisonRow feature="Voice-to-Text Input" datapulse="Full support" competitor="—" />
                <ComparisonRow feature="Advanced Geofencing" datapulse="Polygon zones" competitor="Basic" />
                <ComparisonRow feature="Offline-First" datapulse="Encrypted sync" competitor="Basic" />
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 px-4 bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-600 relative overflow-hidden">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmZmZmYiIGZpbGwtb3BhY2l0eT0iMC4wNSI+PHBhdGggZD0iTTM2IDM0djItSDI0di0yaDEyek0zNiAzMHYySDI0di0yaDEyek0zNiAyNnYySDI0di0yaDEyeiIvPjwvZz48L2c+PC9zdmc+')] opacity-30" />
        
        <div className="max-w-4xl mx-auto text-center relative z-10">
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-6">
            Ready to Transform Your Field Operations?
          </h2>
          <p className="text-lg text-blue-100 mb-10 max-w-2xl mx-auto">
            Join thousands of researchers and organizations already using DataPulse to collect better data, faster.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-8">
            <Button 
              size="lg"
              onClick={() => navigate('/register')}
              className="bg-white text-blue-600 hover:bg-blue-50 shadow-xl px-8 py-6 text-lg font-semibold"
              data-testid="cta-trial-btn"
            >
              Start Free Trial
            </Button>
            <Button 
              size="lg"
              variant="outline"
              onClick={() => navigate('/login')}
              className="border-2 border-white text-white hover:bg-white/10 px-8 py-6 text-lg"
              data-testid="cta-demo-btn"
            >
              Explore Demo Again
            </Button>
          </div>
          
          <p className="text-sm text-blue-200 flex items-center justify-center gap-4 flex-wrap">
            <span className="flex items-center gap-1">
              <CheckCircle2 className="w-4 h-4" /> No credit card required
            </span>
            <span className="flex items-center gap-1">
              <CheckCircle2 className="w-4 h-4" /> 500 free submissions
            </span>
            <span className="flex items-center gap-1">
              <CheckCircle2 className="w-4 h-4" /> Cancel anytime
            </span>
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-4 bg-slate-900 text-slate-400">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center">
                <Database className="w-5 h-5 text-white" />
              </div>
              <span className="text-xl font-bold text-white">
                Data<span className="text-blue-400">Pulse</span>
              </span>
            </div>
            
            <div className="flex items-center gap-8 text-sm">
              <a href="#features" className="hover:text-white transition-colors">Features</a>
              <a href="#ai" className="hover:text-white transition-colors">AI</a>
              <a href="#compare" className="hover:text-white transition-colors">Compare</a>
              <a href="#" className="hover:text-white transition-colors">Privacy</a>
              <a href="#" className="hover:text-white transition-colors">Terms</a>
            </div>
            
            <div className="text-sm">
              © 2026 DataPulse. All rights reserved.
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
