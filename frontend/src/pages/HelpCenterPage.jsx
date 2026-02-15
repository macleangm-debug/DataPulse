import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Search, 
  BookOpen, 
  FileText, 
  BarChart3, 
  Database, 
  Smartphone, 
  Settings, 
  Shield, 
  Plug,
  ChevronRight,
  ArrowLeft,
  ExternalLink,
  MessageCircle,
  Keyboard,
  Sparkles,
  Clock,
  ThumbsUp,
  ThumbsDown,
  X,
  HelpCircle,
  Zap,
  AlertCircle,
  CheckCircle,
  Play
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import axios from 'axios';
import DashboardLayout from '../layouts/DashboardLayout';
import HelpAssistant from '../components/HelpAssistant';

const API_URL = process.env.REACT_APP_BACKEND_URL;

// Icon mapping
const ICONS = {
  BookOpen,
  FileText,
  BarChart3,
  Database,
  Smartphone,
  Settings,
  Shield,
  Plug
};

// Help Categories with detailed info
const HELP_CATEGORIES = [
  { 
    id: 'basics', 
    name: 'Getting Started', 
    icon: 'BookOpen',
    color: 'from-blue-500 to-blue-600',
    description: 'Learn the fundamentals of DataPulse'
  },
  { 
    id: 'forms', 
    name: 'Forms & Builder', 
    icon: 'FileText',
    color: 'from-emerald-500 to-emerald-600',
    description: 'Create and manage data collection forms'
  },
  { 
    id: 'dataviz', 
    name: 'DataViz Studio', 
    icon: 'BarChart3',
    color: 'from-violet-500 to-violet-600',
    description: 'Build dashboards, charts, and reports'
  },
  { 
    id: 'data', 
    name: 'Data Management', 
    icon: 'Database',
    color: 'from-amber-500 to-amber-600',
    description: 'Import, export, and transform data'
  },
  { 
    id: 'mobile', 
    name: 'Mobile & Offline', 
    icon: 'Smartphone',
    color: 'from-cyan-500 to-cyan-600',
    description: 'Offline collection and mobile features'
  },
  { 
    id: 'admin', 
    name: 'Administration', 
    icon: 'Settings',
    color: 'from-slate-500 to-slate-600',
    description: 'Users, roles, and organization settings'
  },
  { 
    id: 'quality', 
    name: 'Quality Control', 
    icon: 'Shield',
    color: 'from-rose-500 to-rose-600',
    description: 'Ensure data quality and integrity'
  },
  { 
    id: 'integrations', 
    name: 'Integrations', 
    icon: 'Plug',
    color: 'from-indigo-500 to-indigo-600',
    description: 'Connect with external systems'
  }
];

// FAQ Data
const FAQ_DATA = [
  {
    question: "How do I create a new form?",
    answer: "Go to Forms page, click 'New Form', then use the drag-and-drop builder to add questions. Save and publish when ready.",
    category: "forms"
  },
  {
    question: "Can I collect data offline?",
    answer: "Yes! DataPulse supports offline-first collection. Data syncs automatically when internet is available.",
    category: "mobile"
  },
  {
    question: "How do I add skip logic to my form?",
    answer: "In the Form Builder, click on a field and open the 'Logic' tab. Set conditions for when the field should appear.",
    category: "forms"
  },
  {
    question: "How do I export my data?",
    answer: "Go to Submissions page, select the form, and click 'Export'. Choose CSV, Excel, or JSON format.",
    category: "data"
  },
  {
    question: "How do I create a dashboard?",
    answer: "Go to Dashboards page, click 'New Dashboard'. Choose a template or start blank, then add widgets and connect data.",
    category: "dataviz"
  },
  {
    question: "How do I add team members?",
    answer: "Go to User Management, click 'Add User', enter their email, and assign a role. They'll receive an invitation.",
    category: "admin"
  },
  {
    question: "What is Quality AI?",
    answer: "Quality AI automatically checks your data for anomalies, duplicates, and quality issues using machine learning.",
    category: "quality"
  },
  {
    question: "How do dashboard templates work?",
    answer: "Templates are pre-configured dashboard layouts. Choose one when creating a dashboard, then customize and connect your data.",
    category: "dataviz"
  }
];

// Troubleshooting guides
const TROUBLESHOOTING_DATA = [
  {
    id: "sync-issues",
    title: "Data Not Syncing",
    icon: "AlertCircle",
    steps: [
      "Check your internet connection",
      "Verify you're logged in",
      "Go to Settings > Sync and click 'Force Sync'",
      "If issues persist, contact support"
    ]
  },
  {
    id: "form-errors",
    title: "Form Submission Errors",
    icon: "FileText",
    steps: [
      "Check all required fields are filled",
      "Verify GPS is enabled if location is required",
      "Ensure file sizes are under the limit",
      "Try saving as draft first"
    ]
  },
  {
    id: "login-issues",
    title: "Cannot Log In",
    icon: "Shield",
    steps: [
      "Verify your email and password",
      "Check caps lock is off",
      "Try 'Forgot Password' to reset",
      "Clear browser cache and cookies"
    ]
  }
];

// Keyboard shortcuts
const KEYBOARD_SHORTCUTS = [
  { keys: ['Ctrl', 'S'], action: 'Save current work' },
  { keys: ['Ctrl', 'Z'], action: 'Undo last action' },
  { keys: ['Ctrl', 'Y'], action: 'Redo last action' },
  { keys: ['Ctrl', '/'], action: 'Show keyboard shortcuts' },
  { keys: ['Esc'], action: 'Close dialogs/modals' },
  { keys: ['Ctrl', 'K'], action: 'Quick search' }
];

// What's New section
const WHATS_NEW = [
  {
    version: "2.5.0",
    date: "Feb 2026",
    items: [
      "Dashboard Templates Library with 10 presets",
      "Real-time data integration for DataViz",
      "Edit/Delete custom templates"
    ]
  },
  {
    version: "2.4.0",
    date: "Jan 2026",
    items: [
      "AI-powered Help Center Assistant",
      "Enhanced User Management",
      "Improved form builder performance"
    ]
  }
];

const HelpCenterPage = () => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedArticle, setSelectedArticle] = useState(null);
  const [expandedFaq, setExpandedFaq] = useState(null);
  const [showAssistant, setShowAssistant] = useState(false);
  const [activeTab, setActiveTab] = useState('browse'); // browse, faq, shortcuts, troubleshoot, whats-new

  useEffect(() => {
    fetchArticles();
  }, [selectedCategory, searchQuery]);

  const fetchArticles = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (selectedCategory) params.append('category', selectedCategory);
      if (searchQuery) params.append('search', searchQuery);
      
      const response = await axios.get(`${API_URL}/api/help/articles?${params}`);
      setArticles(response.data.articles || []);
    } catch (error) {
      console.error('Error fetching articles:', error);
      setArticles([]);
    } finally {
      setLoading(false);
    }
  };

  const handleArticleClick = async (articleId) => {
    try {
      const response = await axios.get(`${API_URL}/api/help/articles/${articleId}`);
      setSelectedArticle(response.data);
    } catch (error) {
      toast.error('Article not found');
    }
  };

  const submitFeedback = async (helpful) => {
    try {
      await axios.post(`${API_URL}/api/help/feedback`, {
        article_id: selectedArticle?.id,
        helpful
      });
      toast.success('Thanks for your feedback!');
    } catch (error) {
      console.error('Feedback error:', error);
    }
  };

  const filteredFaqs = searchQuery 
    ? FAQ_DATA.filter(f => 
        f.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
        f.answer.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : FAQ_DATA;

  return (
    <DashboardLayout>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
        {/* Hero Section */}
        <div className="bg-gradient-to-br from-violet-600 via-indigo-600 to-blue-600 text-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center"
            >
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/10 rounded-full mb-4">
                <HelpCircle className="w-4 h-4" />
                <span className="text-sm font-medium">Help Center</span>
              </div>
              <h1 className="text-4xl font-bold mb-4">How can we help you?</h1>
              <p className="text-lg text-white/80 mb-8 max-w-2xl mx-auto">
                Search our knowledge base, browse guides, or chat with our AI assistant
              </p>
              
              {/* Search Bar */}
              <div className="max-w-2xl mx-auto relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search for help articles, guides, or FAQs..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-12 pr-4 py-4 rounded-xl bg-white dark:bg-gray-900 text-gray-900 dark:text-white shadow-lg focus:outline-none focus:ring-4 focus:ring-white/25 text-lg"
                  data-testid="help-search-input"
                />
              </div>
            </motion.div>
          </div>
        </div>

        {/* Main Content */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Tabs */}
          <div className="flex gap-2 mb-8 overflow-x-auto pb-2">
            {[
              { id: 'browse', label: 'Browse', icon: BookOpen },
              { id: 'faq', label: 'FAQ', icon: HelpCircle },
              { id: 'troubleshoot', label: 'Troubleshoot', icon: AlertCircle },
              { id: 'shortcuts', label: 'Shortcuts', icon: Keyboard },
              { id: 'whats-new', label: "What's New", icon: Sparkles }
            ].map(tab => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all whitespace-nowrap ${
                    activeTab === tab.id
                      ? 'bg-violet-600 text-white shadow-md'
                      : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                  data-testid={`tab-${tab.id}`}
                >
                  <Icon className="w-4 h-4" />
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* Browse Tab - Categories & Articles */}
          {activeTab === 'browse' && (
            <div className="grid lg:grid-cols-4 gap-8">
              {/* Categories Sidebar */}
              <div className="lg:col-span-1">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Categories</h2>
                <div className="space-y-2">
                  <button
                    onClick={() => setSelectedCategory(null)}
                    className={`w-full text-left px-4 py-3 rounded-lg transition-all ${
                      !selectedCategory
                        ? 'bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300'
                        : 'hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300'
                    }`}
                    data-testid="category-all"
                  >
                    All Categories
                  </button>
                  {HELP_CATEGORIES.map(cat => {
                    const Icon = ICONS[cat.icon] || BookOpen;
                    return (
                      <button
                        key={cat.id}
                        onClick={() => setSelectedCategory(cat.id)}
                        className={`w-full text-left px-4 py-3 rounded-lg transition-all flex items-center gap-3 ${
                          selectedCategory === cat.id
                            ? 'bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300'
                            : 'hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300'
                        }`}
                        data-testid={`category-${cat.id}`}
                      >
                        <Icon className="w-4 h-4" />
                        <span>{cat.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Articles Grid */}
              <div className="lg:col-span-3">
                {selectedArticle ? (
                  <motion.div
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-8"
                  >
                    <button
                      onClick={() => setSelectedArticle(null)}
                      className="flex items-center gap-2 text-violet-600 dark:text-violet-400 hover:underline mb-6"
                      data-testid="back-to-articles"
                    >
                      <ArrowLeft className="w-4 h-4" />
                      Back to articles
                    </button>
                    
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
                      {selectedArticle.title}
                    </h1>
                    
                    <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400 mb-6">
                      <span className="flex items-center gap-1">
                        <Clock className="w-4 h-4" />
                        Updated {selectedArticle.updated_at}
                      </span>
                    </div>
                    
                    <div className="prose dark:prose-invert max-w-none">
                      <div dangerouslySetInnerHTML={{ __html: selectedArticle.content?.replace(/\n/g, '<br/>') }} />
                    </div>
                    
                    {/* Feedback */}
                    <div className="mt-8 pt-6 border-t border-gray-200 dark:border-gray-700">
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">Was this article helpful?</p>
                      <div className="flex gap-2">
                        <button
                          onClick={() => submitFeedback(true)}
                          className="flex items-center gap-2 px-4 py-2 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 rounded-lg hover:bg-green-100 dark:hover:bg-green-900/40 transition-colors"
                          data-testid="feedback-helpful"
                        >
                          <ThumbsUp className="w-4 h-4" />
                          Yes
                        </button>
                        <button
                          onClick={() => submitFeedback(false)}
                          className="flex items-center gap-2 px-4 py-2 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors"
                          data-testid="feedback-not-helpful"
                        >
                          <ThumbsDown className="w-4 h-4" />
                          No
                        </button>
                      </div>
                    </div>
                  </motion.div>
                ) : (
                  <>
                    {/* Category Cards (when no category selected) */}
                    {!selectedCategory && !searchQuery && (
                      <div className="grid md:grid-cols-2 gap-4 mb-8">
                        {HELP_CATEGORIES.map(cat => {
                          const Icon = ICONS[cat.icon] || BookOpen;
                          return (
                            <motion.button
                              key={cat.id}
                              whileHover={{ scale: 1.02 }}
                              whileTap={{ scale: 0.98 }}
                              onClick={() => setSelectedCategory(cat.id)}
                              className="text-left p-6 bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 hover:shadow-md hover:border-violet-300 dark:hover:border-violet-600 transition-all"
                              data-testid={`category-card-${cat.id}`}
                            >
                              <div className={`w-12 h-12 rounded-lg bg-gradient-to-br ${cat.color} flex items-center justify-center mb-4`}>
                                <Icon className="w-6 h-6 text-white" />
                              </div>
                              <h3 className="font-semibold text-gray-900 dark:text-white mb-1">{cat.name}</h3>
                              <p className="text-sm text-gray-500 dark:text-gray-400">{cat.description}</p>
                            </motion.button>
                          );
                        })}
                      </div>
                    )}

                    {/* Articles List */}
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                      {selectedCategory 
                        ? HELP_CATEGORIES.find(c => c.id === selectedCategory)?.name 
                        : searchQuery 
                          ? `Search results for "${searchQuery}"`
                          : 'Popular Articles'}
                    </h3>
                    
                    {loading ? (
                      <div className="flex justify-center py-12">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-violet-600" />
                      </div>
                    ) : articles.length > 0 ? (
                      <div className="space-y-3">
                        {articles.map(article => (
                          <motion.button
                            key={article.id}
                            whileHover={{ x: 4 }}
                            onClick={() => handleArticleClick(article.id)}
                            className="w-full text-left p-4 bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-violet-300 dark:hover:border-violet-600 transition-all flex items-center justify-between group"
                            data-testid={`article-${article.id}`}
                          >
                            <div>
                              <h4 className="font-medium text-gray-900 dark:text-white group-hover:text-violet-600 dark:group-hover:text-violet-400">
                                {article.title}
                              </h4>
                              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                                {article.summary}
                              </p>
                            </div>
                            <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-violet-600 dark:group-hover:text-violet-400" />
                          </motion.button>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-12 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700">
                        <FileText className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                        <p className="text-gray-500 dark:text-gray-400">No articles found</p>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          )}

          {/* FAQ Tab */}
          {activeTab === 'faq' && (
            <div className="max-w-3xl mx-auto">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
                Frequently Asked Questions
              </h2>
              <div className="space-y-3">
                {filteredFaqs.map((faq, idx) => (
                  <motion.div
                    key={idx}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden"
                  >
                    <button
                      onClick={() => setExpandedFaq(expandedFaq === idx ? null : idx)}
                      className="w-full text-left px-6 py-4 flex items-center justify-between"
                      data-testid={`faq-${idx}`}
                    >
                      <span className="font-medium text-gray-900 dark:text-white pr-4">{faq.question}</span>
                      <ChevronRight className={`w-5 h-5 text-gray-400 transition-transform ${expandedFaq === idx ? 'rotate-90' : ''}`} />
                    </button>
                    <AnimatePresence>
                      {expandedFaq === idx && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="overflow-hidden"
                        >
                          <div className="px-6 pb-4 text-gray-600 dark:text-gray-300">
                            {faq.answer}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                ))}
              </div>
            </div>
          )}

          {/* Troubleshooting Tab */}
          {activeTab === 'troubleshoot' && (
            <div className="max-w-3xl mx-auto">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
                Troubleshooting Guides
              </h2>
              <div className="space-y-4">
                {TROUBLESHOOTING_DATA.map((guide, idx) => (
                  <motion.div
                    key={guide.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.1 }}
                    className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-6"
                    data-testid={`troubleshoot-${guide.id}`}
                  >
                    <div className="flex items-start gap-4">
                      <div className="w-10 h-10 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center flex-shrink-0">
                        <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                      </div>
                      <div className="flex-1">
                        <h3 className="font-semibold text-gray-900 dark:text-white mb-3">{guide.title}</h3>
                        <ol className="space-y-2">
                          {guide.steps.map((step, stepIdx) => (
                            <li key={stepIdx} className="flex items-start gap-3">
                              <span className="w-6 h-6 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-xs font-medium text-gray-600 dark:text-gray-400 flex-shrink-0">
                                {stepIdx + 1}
                              </span>
                              <span className="text-gray-600 dark:text-gray-300">{step}</span>
                            </li>
                          ))}
                        </ol>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
              
              <div className="mt-8 p-6 bg-violet-50 dark:bg-violet-900/20 rounded-xl border border-violet-200 dark:border-violet-800">
                <div className="flex items-start gap-4">
                  <MessageCircle className="w-6 h-6 text-violet-600 dark:text-violet-400 flex-shrink-0" />
                  <div>
                    <h3 className="font-semibold text-violet-900 dark:text-violet-100 mb-1">Still need help?</h3>
                    <p className="text-violet-700 dark:text-violet-300 text-sm mb-3">
                      Our AI assistant can help troubleshoot your specific issue.
                    </p>
                    <button
                      onClick={() => setShowAssistant(true)}
                      className="px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 transition-colors text-sm font-medium"
                      data-testid="open-assistant-troubleshoot"
                    >
                      Chat with Assistant
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Keyboard Shortcuts Tab */}
          {activeTab === 'shortcuts' && (
            <div className="max-w-2xl mx-auto">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
                Keyboard Shortcuts
              </h2>
              <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                <div className="divide-y divide-gray-200 dark:divide-gray-700">
                  {KEYBOARD_SHORTCUTS.map((shortcut, idx) => (
                    <div key={idx} className="px-6 py-4 flex items-center justify-between">
                      <span className="text-gray-700 dark:text-gray-300">{shortcut.action}</span>
                      <div className="flex gap-1">
                        {shortcut.keys.map((key, keyIdx) => (
                          <React.Fragment key={keyIdx}>
                            <kbd className="px-2 py-1 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 rounded text-sm font-mono">
                              {key}
                            </kbd>
                            {keyIdx < shortcut.keys.length - 1 && (
                              <span className="text-gray-400">+</span>
                            )}
                          </React.Fragment>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* What's New Tab */}
          {activeTab === 'whats-new' && (
            <div className="max-w-3xl mx-auto">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
                What's New in DataPulse
              </h2>
              <div className="space-y-6">
                {WHATS_NEW.map((release, idx) => (
                  <motion.div
                    key={release.version}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.1 }}
                    className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-6"
                    data-testid={`release-${release.version}`}
                  >
                    <div className="flex items-center gap-3 mb-4">
                      <span className="px-3 py-1 bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300 rounded-full text-sm font-medium">
                        v{release.version}
                      </span>
                      <span className="text-gray-500 dark:text-gray-400 text-sm">{release.date}</span>
                    </div>
                    <ul className="space-y-2">
                      {release.items.map((item, itemIdx) => (
                        <li key={itemIdx} className="flex items-start gap-3">
                          <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                          <span className="text-gray-700 dark:text-gray-300">{item}</span>
                        </li>
                      ))}
                    </ul>
                  </motion.div>
                ))}
              </div>
            </div>
          )}

          {/* Quick Actions */}
          <div className="mt-12 grid md:grid-cols-3 gap-4">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setShowAssistant(true)}
              className="p-6 bg-gradient-to-br from-violet-500 to-indigo-600 rounded-xl text-white text-left"
              data-testid="quick-action-assistant"
            >
              <MessageCircle className="w-8 h-8 mb-3" />
              <h3 className="font-semibold text-lg mb-1">Chat with AI Assistant</h3>
              <p className="text-white/80 text-sm">Get instant answers to your questions</p>
            </motion.button>
            
            <motion.a
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              href="mailto:support@datapulse.io"
              className="p-6 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 text-left hover:border-violet-300 dark:hover:border-violet-600 transition-colors"
              data-testid="quick-action-email"
            >
              <ExternalLink className="w-8 h-8 mb-3 text-gray-400" />
              <h3 className="font-semibold text-lg mb-1 text-gray-900 dark:text-white">Contact Support</h3>
              <p className="text-gray-500 dark:text-gray-400 text-sm">Email us at support@datapulse.io</p>
            </motion.a>
            
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => navigate('/dashboard')}
              className="p-6 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 text-left hover:border-violet-300 dark:hover:border-violet-600 transition-colors"
              data-testid="quick-action-dashboard"
            >
              <Play className="w-8 h-8 mb-3 text-gray-400" />
              <h3 className="font-semibold text-lg mb-1 text-gray-900 dark:text-white">Back to App</h3>
              <p className="text-gray-500 dark:text-gray-400 text-sm">Return to your dashboard</p>
            </motion.button>
          </div>
        </div>

        {/* AI Assistant */}
        <HelpAssistant
          isOpen={showAssistant}
          onClose={() => setShowAssistant(false)}
          onToggle={() => setShowAssistant(!showAssistant)}
        />
      </div>
    </DashboardLayout>
  );
};

export default HelpCenterPage;
