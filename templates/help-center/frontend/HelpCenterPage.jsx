/**
 * HelpCenterPage - Reusable Help Center Component
 * ================================================
 * A complete Help Center page that fetches content from backend APIs.
 * 
 * FEATURES:
 * - Dynamic content from backend APIs
 * - Search with debounce
 * - Categories sidebar with expandable articles
 * - FAQ tab with accordion
 * - Troubleshooting guides with severity levels
 * - Keyboard shortcuts reference
 * - What's New / Release notes
 * - Article viewer with feedback
 * 
 * SETUP:
 * 1. Copy this file to your frontend/src/pages/ folder
 * 2. Copy HelpAssistant.jsx to frontend/src/components/
 * 3. Add route in App.js:
 *    import HelpCenterPage from './pages/HelpCenterPage';
 *    <Route path="/help" element={<HelpCenterPage />} />
 * 4. Ensure REACT_APP_BACKEND_URL is set in .env
 * 
 * CUSTOMIZATION:
 * - Modify ICON_MAP if using different icons
 * - Adjust colors in theme variables
 * - Update DashboardLayout import to match your layout component
 */

import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Search, HelpCircle, ChevronRight, ChevronDown, Users, BarChart3, Settings,
  Zap, AlertCircle, ThumbsUp, ThumbsDown, Keyboard, ArrowLeft, ClipboardList, 
  Sparkles, FileText, Database, Smartphone, Shield, Loader2, Plug, Clock
} from 'lucide-react';
import { HelpAssistant } from '../components/HelpAssistant';
// Update this import to match your layout component
import DashboardLayout from '../layouts/DashboardLayout';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

// Utility function for class names
function cn(...classes) { 
  return classes.filter(Boolean).join(' '); 
}

// Icon mapping - add your icons here
const ICON_MAP = {
  'Zap': Zap,
  'FileText': FileText,
  'BarChart3': BarChart3,
  'Database': Database,
  'Smartphone': Smartphone,
  'Users': Users,
  'Shield': Shield,
  'Settings': Settings,
  'AlertCircle': AlertCircle,
  'HelpCircle': HelpCircle,
  'Plug': Plug,
  'Clock': Clock,
};

export function HelpCenterPage({ isDark = true }) {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  
  // UI State
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState(searchParams.get('category') || null);
  const [activeArticle, setActiveArticle] = useState(searchParams.get('article') || null);
  const [activeTab, setActiveTab] = useState(searchParams.get('tab') || 'home');
  const [expandedFaq, setExpandedFaq] = useState(null);
  const [selectedIssue, setSelectedIssue] = useState(null);
  const [articleFeedback, setArticleFeedback] = useState({});
  const [expandedCategory, setExpandedCategory] = useState(null);

  // Data from API
  const [categories, setCategories] = useState([]);
  const [faqData, setFaqData] = useState([]);
  const [troubleshootingData, setTroubleshootingData] = useState([]);
  const [shortcutsData, setShortcutsData] = useState([]);
  const [whatsNewData, setWhatsNewData] = useState([]);
  const [articleContent, setArticleContent] = useState(null);
  const [searchResults, setSearchResults] = useState([]);
  
  // Loading states
  const [loading, setLoading] = useState(true);
  const [articleLoading, setArticleLoading] = useState(false);

  // Theme colors - customize these for your app
  const bgPrimary = isDark ? 'bg-[#0a1628]' : 'bg-gray-50';
  const bgSecondary = isDark ? 'bg-[#0f1d32]' : 'bg-white';
  const borderColor = isDark ? 'border-white/10' : 'border-gray-200';
  const textPrimary = isDark ? 'text-white' : 'text-gray-900';
  const textSecondary = isDark ? 'text-gray-400' : 'text-gray-600';
  const textMuted = isDark ? 'text-gray-500' : 'text-gray-400';
  const hoverBg = isDark ? 'hover:bg-white/5' : 'hover:bg-gray-100';
  const accentColor = 'teal'; // Change to match your brand

  // Fetch initial data from all endpoints
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [catRes, faqRes, troubleRes, shortcutsRes, whatsNewRes] = await Promise.all([
          fetch(`${BACKEND_URL}/api/help/categories-full`),
          fetch(`${BACKEND_URL}/api/help/faq`),
          fetch(`${BACKEND_URL}/api/help/troubleshooting`),
          fetch(`${BACKEND_URL}/api/help/shortcuts`),
          fetch(`${BACKEND_URL}/api/help/whats-new`)
        ]);
        
        const [catData, faqDataRes, troubleData, shortcutsDataRes, whatsNewDataRes] = await Promise.all([
          catRes.json(),
          faqRes.json(),
          troubleRes.json(),
          shortcutsRes.json(),
          whatsNewRes.json()
        ]);
        
        setCategories(catData.categories || []);
        setFaqData(faqDataRes.faq || []);
        setTroubleshootingData(troubleData.guides || []);
        setShortcutsData(shortcutsDataRes.shortcuts || []);
        setWhatsNewData(whatsNewDataRes.releases || []);
      } catch (error) {
        console.error('Failed to fetch help data:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  // Search with debounce (300ms)
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    
    const searchTimeout = setTimeout(async () => {
      try {
        const res = await fetch(`${BACKEND_URL}/api/help/search?q=${encodeURIComponent(searchQuery)}`);
        const data = await res.json();
        setSearchResults(data.articles || []);
      } catch (error) {
        console.error('Search failed:', error);
      }
    }, 300);
    
    return () => clearTimeout(searchTimeout);
  }, [searchQuery]);

  // Fetch article content when selected
  useEffect(() => {
    if (activeArticle && activeTab === 'article') {
      setArticleLoading(true);
      fetch(`${BACKEND_URL}/api/help/articles/${activeArticle}`)
        .then(res => res.json())
        .then(data => {
          setArticleContent(data);
          setArticleLoading(false);
        })
        .catch(err => {
          console.error('Failed to fetch article:', err);
          setArticleContent({ title: 'Article Not Found', content: 'This article could not be loaded.' });
          setArticleLoading(false);
        });
    }
  }, [activeArticle, activeTab]);

  // Navigation handlers
  const handleArticleClick = (categoryId, articleId) => {
    setActiveCategory(categoryId);
    setActiveArticle(articleId);
    setActiveTab('article');
    setSearchParams({ tab: 'article', category: categoryId, article: articleId });
  };

  const handleBackToHome = () => {
    setActiveTab('home');
    setSearchParams({});
    setArticleContent(null);
  };

  // Feedback handler
  const handleFeedback = async (articleId, isHelpful) => {
    setArticleFeedback(prev => ({ ...prev, [articleId]: isHelpful ? 'yes' : 'no' }));
    try {
      await fetch(`${BACKEND_URL}/api/help/feedback?article_id=${articleId}&helpful=${isHelpful}`, {
        method: 'POST'
      });
    } catch (error) {
      console.error('Feedback submission failed:', error);
    }
  };

  // Utility functions
  const getSeverityColor = (severity) => {
    switch(severity) {
      case 'high': return 'bg-red-500/20 text-red-400';
      case 'medium': return 'bg-amber-500/20 text-amber-400';
      case 'low': return 'bg-blue-500/20 text-blue-400';
      default: return 'bg-gray-500/20 text-gray-400';
    }
  };

  const getTypeColor = (type) => {
    switch(type) {
      case 'feature': return 'bg-green-500/20 text-green-400';
      case 'improvement': return 'bg-blue-500/20 text-blue-400';
      case 'bugfix': return 'bg-amber-500/20 text-amber-400';
      default: return 'bg-gray-500/20 text-gray-400';
    }
  };

  // Group FAQ by category
  const groupedFaq = faqData.reduce((acc, faq) => {
    const cat = faq.category || 'general';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(faq);
    return acc;
  }, {});

  // Get popular articles
  const popularArticles = categories.flatMap(cat => 
    (cat.articles || []).filter(a => a.popular).map(a => ({ ...a, category: cat }))
  ).slice(0, 6);

  // ==========================================================================
  // RENDER FUNCTIONS
  // ==========================================================================

  const renderLoading = () => (
    <div className="flex items-center justify-center h-64">
      <Loader2 className={`w-8 h-8 animate-spin text-${accentColor}-500`} />
    </div>
  );

  const renderArticle = () => {
    if (articleLoading) return renderLoading();
    
    const article = articleContent || { title: 'Loading...', content: '' };
    return (
      <div className="space-y-6">
        <button 
          onClick={handleBackToHome} 
          className={cn("flex items-center gap-2 text-sm", textSecondary, hoverBg, "px-3 py-2 rounded-lg")}
        >
          <ArrowLeft className="w-4 h-4" />Back to Help Center
        </button>
        
        <div className={cn(bgSecondary, borderColor, "border rounded-xl p-6")}>
          <h1 className={cn("text-2xl font-bold mb-4", textPrimary)}>{article.title}</h1>
          {article.summary && <p className={cn("text-sm mb-4", textSecondary)}>{article.summary}</p>}
          <div className={cn("whitespace-pre-wrap leading-relaxed", textSecondary)}>{article.content}</div>
        </div>
        
        <div className={cn(bgSecondary, borderColor, "border rounded-xl p-4")}>
          <p className={cn("text-sm font-medium mb-3", textPrimary)}>Was this article helpful?</p>
          <div className="flex gap-2">
            <button 
              onClick={() => handleFeedback(activeArticle, true)} 
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-lg text-sm transition-colors", 
                articleFeedback[activeArticle] === 'yes' ? "bg-green-500/20 text-green-400" : cn(hoverBg, textSecondary)
              )}
            >
              <ThumbsUp className="w-4 h-4" />Yes, helpful
            </button>
            <button 
              onClick={() => handleFeedback(activeArticle, false)} 
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-lg text-sm transition-colors", 
                articleFeedback[activeArticle] === 'no' ? "bg-red-500/20 text-red-400" : cn(hoverBg, textSecondary)
              )}
            >
              <ThumbsDown className="w-4 h-4" />Not helpful
            </button>
          </div>
        </div>
      </div>
    );
  };

  const renderFaq = () => (
    <div className="space-y-6">
      <h2 className={cn("text-xl font-bold", textPrimary)}>Frequently Asked Questions</h2>
      {Object.entries(groupedFaq).map(([category, questions]) => (
        <div key={category} className="space-y-3">
          <h3 className={cn("font-semibold text-lg capitalize", textPrimary)}>
            {category.replace(/-/g, ' ')}
          </h3>
          {questions.map((faq, qIdx) => {
            const faqId = `${category}-${qIdx}`;
            const isExpanded = expandedFaq === faqId;
            return (
              <div key={qIdx} className={cn(bgSecondary, borderColor, "border rounded-xl overflow-hidden")}>
                <button 
                  onClick={() => setExpandedFaq(isExpanded ? null : faqId)} 
                  className={cn("w-full flex items-center justify-between p-4 text-left", hoverBg)} 
                  data-testid={`faq-${faqId}`}
                >
                  <span className={cn("font-medium", textPrimary)}>{faq.question}</span>
                  <ChevronDown className={cn("w-5 h-5 transition-transform", textSecondary, isExpanded && "rotate-180")} />
                </button>
                {isExpanded && <div className={cn("px-4 pb-4", textSecondary)}>{faq.answer}</div>}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );

  const renderTroubleshooting = () => (
    <div className="space-y-6">
      <h2 className={cn("text-xl font-bold", textPrimary)}>Troubleshooting Guide</h2>
      {troubleshootingData.map((issue) => (
        <div 
          key={issue.id} 
          className={cn(
            bgSecondary, borderColor, 
            "border rounded-xl p-4 cursor-pointer transition-all", 
            selectedIssue === issue.id ? `ring-2 ring-${accentColor}-500/50` : hoverBg
          )} 
          onClick={() => setSelectedIssue(selectedIssue === issue.id ? null : issue.id)} 
          data-testid={`troubleshoot-${issue.id}`}
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-3">
              <h3 className={cn("font-semibold", textPrimary)}>{issue.title}</h3>
              <span className={cn("text-xs px-2 py-0.5 rounded-full", getSeverityColor(issue.severity))}>
                {issue.severity}
              </span>
            </div>
            <ChevronRight className={cn("w-5 h-5 transition-transform", textSecondary, selectedIssue === issue.id && "rotate-90")} />
          </div>
          
          {issue.common_causes && (
            <div className="flex flex-wrap gap-2">
              {issue.common_causes.slice(0, 3).map((cause, idx) => (
                <span key={idx} className={cn("text-xs px-2 py-1 rounded-full", isDark ? "bg-white/10" : "bg-gray-100", textSecondary)}>
                  {cause}
                </span>
              ))}
            </div>
          )}
          
          {selectedIssue === issue.id && (
            <div className={cn("mt-4 pt-4 border-t", borderColor, "space-y-2")}>
              <p className={cn("text-sm font-medium", textPrimary)}>Solutions:</p>
              <ol className="list-decimal list-inside space-y-1">
                {issue.steps.map((step, idx) => (
                  <li key={idx} className={cn("text-sm", textSecondary)}>{step}</li>
                ))}
              </ol>
            </div>
          )}
        </div>
      ))}
      
      <div className={cn(bgSecondary, borderColor, "border rounded-xl p-4 mt-6")}>
        <p className={cn("text-sm", textSecondary)}>
          Still having issues? Contact <a href="mailto:support@yourapp.com" className={`text-${accentColor}-400 hover:underline`}>support@yourapp.com</a>
        </p>
      </div>
    </div>
  );

  const renderShortcuts = () => (
    <div className="space-y-6">
      <h2 className={cn("text-xl font-bold", textPrimary)}>Keyboard Shortcuts</h2>
      {shortcutsData.map((group, idx) => (
        <div key={idx} className={cn(bgSecondary, borderColor, "border rounded-xl p-4")}>
          <h3 className={cn("font-semibold mb-3", textPrimary)}>{group.category}</h3>
          <div className="space-y-2">
            {group.shortcuts.map((shortcut, sIdx) => (
              <div key={sIdx} className="flex items-center justify-between">
                <span className={textSecondary}>{shortcut.action}</span>
                <div className="flex gap-1">
                  {shortcut.keys.map((key, kIdx) => (
                    <kbd key={kIdx} className={cn("px-2 py-1 text-xs rounded font-mono", isDark ? "bg-white/10" : "bg-gray-100", textPrimary)}>
                      {key}
                    </kbd>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );

  const renderWhatsNew = () => (
    <div className="space-y-6">
      <h2 className={cn("text-xl font-bold", textPrimary)}>What's New</h2>
      {whatsNewData.map((release, idx) => (
        <div key={idx} className={cn(bgSecondary, borderColor, "border rounded-xl p-4")} data-testid={`release-${release.version}`}>
          <div className="flex items-center justify-between mb-4">
            <span className={cn("font-bold text-lg", textPrimary)}>v{release.version}</span>
            <span className={textSecondary}>{release.date}</span>
          </div>
          <div className="space-y-3">
            {release.highlights.map((item, hIdx) => (
              <div key={hIdx} className="flex items-start gap-3">
                <span className={cn("px-2 py-0.5 text-xs rounded shrink-0", getTypeColor(item.type))}>
                  {item.type}
                </span>
                <div>
                  <p className={cn("font-medium", textPrimary)}>{item.title}</p>
                  <p className={cn("text-sm", textSecondary)}>{item.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );

  const renderHome = () => (
    <div className="space-y-6">
      {/* Quick Links */}
      <div className={cn(bgSecondary, borderColor, "border rounded-xl p-5")}>
        <h2 className={cn("font-semibold mb-4", textPrimary)}>Quick Links</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { tab: 'faq', icon: HelpCircle, label: 'FAQ' },
            { tab: 'troubleshooting', icon: AlertCircle, label: 'Troubleshooting' },
            { tab: 'shortcuts', icon: Keyboard, label: 'Shortcuts' },
            { tab: 'whats-new', icon: Sparkles, label: "What's New" },
          ].map(({ tab, icon: Icon, label }) => (
            <button 
              key={tab} 
              onClick={() => setActiveTab(tab)} 
              className={cn(
                "flex items-center gap-3 px-4 py-3 rounded-xl transition-all", 
                isDark ? "bg-white/5 hover:bg-white/10" : "bg-gray-100 hover:bg-gray-200", 
                borderColor, `border hover:border-${accentColor}-500/30`
              )}
              data-testid={`quick-link-${tab}`}
            >
              <Icon className={`w-4 h-4 text-${accentColor}-500`} />
              <span className={cn("text-sm", textPrimary)}>{label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Popular Articles */}
      {popularArticles.length > 0 && (
        <div className={cn(bgSecondary, borderColor, "border rounded-xl p-5")}>
          <h2 className={cn("font-semibold mb-4", textPrimary)}>Popular Articles</h2>
          <div className="grid md:grid-cols-2 gap-4">
            {popularArticles.map((article) => {
              const IconComponent = ICON_MAP[article.category.icon] || FileText;
              return (
                <button 
                  key={article.id} 
                  onClick={() => handleArticleClick(article.category.id, article.id)} 
                  className={cn(
                    "text-left p-4 rounded-xl transition-all", 
                    isDark ? "bg-white/5 hover:bg-white/10" : "bg-gray-100 hover:bg-gray-200", 
                    borderColor, `border hover:border-${accentColor}-500/30`
                  )}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <IconComponent className={`w-4 h-4 text-${accentColor}-500`} />
                    <span className={cn("text-xs", textMuted)}>{article.category.title || article.category.name}</span>
                  </div>
                  <h3 className={cn("font-medium mb-1", textPrimary)}>{article.title}</h3>
                  <p className={cn("text-xs", textMuted)}>{article.readTime} read</p>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Categories Preview */}
      {categories.slice(0, 4).map((category) => {
        const IconComponent = ICON_MAP[category.icon] || FileText;
        return (
          <div key={category.id} className={cn(bgSecondary, borderColor, "border rounded-xl p-5")}>
            <div className="flex items-center gap-2 mb-4">
              <IconComponent className={`w-5 h-5 text-${accentColor}-500`} />
              <h2 className={cn("font-semibold", textPrimary)}>{category.title || category.name}</h2>
            </div>
            <p className={cn("text-sm mb-4", textSecondary)}>{category.description}</p>
            <div className="grid md:grid-cols-2 gap-3">
              {(category.articles || []).slice(0, 2).map((article) => (
                <button 
                  key={article.id} 
                  onClick={() => handleArticleClick(category.id, article.id)} 
                  className={cn(
                    "text-left p-3 rounded-lg transition-all flex items-center justify-between", 
                    isDark ? "bg-white/5 hover:bg-white/10" : "bg-gray-100 hover:bg-gray-200"
                  )}
                >
                  <span className={cn("text-sm", textPrimary)}>{article.title}</span>
                  <ChevronRight className={cn("w-4 h-4", textMuted)} />
                </button>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );

  const renderContent = () => {
    if (loading) return renderLoading();

    switch (activeTab) {
      case 'article': return renderArticle();
      case 'faq': return renderFaq();
      case 'troubleshooting': return renderTroubleshooting();
      case 'shortcuts': return renderShortcuts();
      case 'whats-new': return renderWhatsNew();
      default: return renderHome();
    }
  };

  // ==========================================================================
  // MAIN RENDER
  // ==========================================================================

  return (
    <DashboardLayout>
      <div className={cn("min-h-screen p-6", bgPrimary)}>
        {/* Header */}
        <div className="mb-8">
          <h1 className={cn("text-3xl font-bold mb-2", textPrimary)}>Help Center</h1>
          <p className={textSecondary}>Find answers, tutorials, and documentation</p>
        </div>

        {/* Search */}
        <div className="relative mb-8">
          <Search className={cn("absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5", textMuted)} />
          <input 
            value={searchQuery} 
            onChange={(e) => setSearchQuery(e.target.value)} 
            placeholder="Search articles, guides, and FAQs..." 
            className={cn(
              "w-full pl-12 py-4 rounded-xl text-sm", 
              bgSecondary, borderColor, "border", textPrimary, 
              `placeholder-gray-500 outline-none focus:ring-2 focus:ring-${accentColor}-500/50`
            )} 
            data-testid="help-search-input"
          />
          
          {/* Search Results Dropdown */}
          {searchQuery && searchResults.length > 0 && (
            <div className={cn("absolute top-full left-0 right-0 mt-2 max-h-80 overflow-y-auto z-50 rounded-xl shadow-xl", bgSecondary, borderColor, "border")}>
              {searchResults.map((result, idx) => (
                <button 
                  key={idx} 
                  onClick={() => { handleArticleClick(result.category, result.id); setSearchQuery(''); }} 
                  className={cn("w-full text-left px-4 py-3 border-b last:border-0", borderColor, hoverBg)}
                >
                  <p className={cn("text-sm font-medium", textPrimary)}>{result.title}</p>
                  <p className={cn("text-xs", textMuted)}>{result.category} • {result.summary?.slice(0, 60)}...</p>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Main Content Layout */}
        <div className="flex gap-6">
          {/* Sidebar */}
          <div className={cn("w-72 flex-shrink-0 rounded-xl p-5 h-fit sticky top-6", bgSecondary, borderColor, "border")}>
            <div className="flex items-center gap-2 mb-5">
              <div className={`p-1.5 rounded-lg bg-${accentColor}-500/10`}>
                <ClipboardList className={`w-4 h-4 text-${accentColor}-500`} />
              </div>
              <h2 className={cn("font-semibold", textPrimary)}>Categories</h2>
            </div>
            
            <nav className="space-y-1">
              {categories.map((category) => {
                const IconComponent = ICON_MAP[category.icon] || FileText;
                const isExpanded = expandedCategory === category.id;
                return (
                  <div key={category.id}>
                    <button 
                      onClick={() => setExpandedCategory(isExpanded ? null : category.id)} 
                      className={cn(
                        "w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm transition-colors", 
                        isExpanded ? cn(isDark ? "bg-white/5" : "bg-gray-100", textPrimary) : cn(textSecondary, hoverBg)
                      )}
                      data-testid={`category-${category.id}`}
                    >
                      <div className="flex items-center gap-3">
                        <IconComponent className={`w-4 h-4 text-${accentColor}-500/70`} />
                        <span>{category.title || category.name}</span>
                      </div>
                      <ChevronRight className={cn("w-4 h-4 transition-transform", isExpanded && "rotate-90")} />
                    </button>
                    
                    {isExpanded && (
                      <div className="ml-10 mt-1 space-y-1">
                        {(category.articles || []).map((article) => (
                          <button 
                            key={article.id} 
                            onClick={() => handleArticleClick(category.id, article.id)} 
                            className={cn("w-full text-left px-3 py-1.5 text-sm transition-colors rounded", textMuted, `hover:text-${accentColor}-400`)}
                          >
                            {article.title}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </nav>
            
            {/* Quick Access Links */}
            <div className={cn("mt-6 pt-4 border-t", borderColor)}>
              {[
                { tab: 'faq', icon: HelpCircle, label: 'FAQs' },
                { tab: 'troubleshooting', icon: AlertCircle, label: 'Troubleshooting' },
                { tab: 'shortcuts', icon: Keyboard, label: 'Shortcuts' },
                { tab: 'whats-new', icon: Sparkles, label: "What's New" },
              ].map(({ tab, icon: Icon, label }) => (
                <button 
                  key={tab} 
                  onClick={() => setActiveTab(tab)} 
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors", 
                    activeTab === tab ? cn(isDark ? "bg-white/5" : "bg-gray-100", textPrimary) : cn(textSecondary, hoverBg)
                  )}
                  data-testid={`sidebar-${tab}`}
                >
                  <Icon className={`w-4 h-4 text-${accentColor}-500/70`} />
                  <span>{label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Content Area */}
          <div className="flex-1">
            {renderContent()}
          </div>
        </div>

        {/* AI Assistant Widget */}
        <HelpAssistant isDark={isDark} />
      </div>
    </DashboardLayout>
  );
}

export default HelpCenterPage;
