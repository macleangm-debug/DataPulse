/**
 * HelpAssistant - AI Chat Widget Component
 * =========================================
 * A floating AI assistant chat widget that connects to GPT-4o via Emergent LLM key.
 * 
 * FEATURES:
 * - Floating action button to open chat
 * - Conversation history within session
 * - Suggested questions for quick start
 * - Feedback buttons on AI responses
 * - Clickable links in responses
 * - Loading states and error handling
 * 
 * SETUP:
 * 1. Copy this file to your frontend/src/components/ folder
 * 2. Ensure backend has /api/help/chat and /api/help/feedback endpoints
 * 3. Import and use in HelpCenterPage:
 *    import { HelpAssistant } from '../components/HelpAssistant';
 *    <HelpAssistant isDark={isDark} />
 * 
 * CUSTOMIZATION:
 * - Modify SUGGESTED_QUESTIONS for your app
 * - Change accentColor to match your brand
 * - Update the welcome message
 */

import React, { useState, useRef, useEffect } from 'react';
import { X, Send, Bot, User, Loader2, Sparkles, ExternalLink, ThumbsUp, ThumbsDown } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

// Customize these questions for your app
const SUGGESTED_QUESTIONS = [
  "How do I get started?",
  "What features are available?",
  "How do I export my data?",
  "How do I add team members?",
  "How do I reset my password?",
  "Where can I find documentation?",
];

// Utility function for class names
function cn(...classes) {
  return classes.filter(Boolean).join(' ');
}

/**
 * Renders message content with clickable markdown links
 */
function MessageContent({ content, isDark, onLinkClick }) {
  const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
  const parts = [];
  let lastIndex = 0;
  let match;
  
  while ((match = linkRegex.exec(content)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ type: 'text', content: content.slice(lastIndex, match.index) });
    }
    parts.push({ type: 'link', text: match[1], url: match[2] });
    lastIndex = match.index + match[0].length;
  }
  
  if (lastIndex < content.length) {
    parts.push({ type: 'text', content: content.slice(lastIndex) });
  }
  
  if (parts.length === 0) {
    return <p className="whitespace-pre-wrap">{content}</p>;
  }
  
  return (
    <div className="whitespace-pre-wrap">
      {parts.map((part, idx) => {
        if (part.type === 'text') return <span key={idx}>{part.content}</span>;
        return (
          <button
            key={idx}
            onClick={() => onLinkClick(part.url)}
            className="inline-flex items-center gap-1 text-teal-400 hover:text-teal-300 underline underline-offset-2 transition-colors"
          >
            {part.text}
            <ExternalLink className="w-3 h-3" />
          </button>
        );
      })}
    </div>
  );
}

export function HelpAssistant({ isDark = true }) {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    { 
      role: 'assistant', 
      content: "Hi! I'm the AI Assistant. How can I help you today?", 
      id: 'welcome' 
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState(null);
  const [showSuggestions, setShowSuggestions] = useState(true);
  const [feedback, setFeedback] = useState({});
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  // Theme colors - customize accent color as needed
  const accentColor = 'teal';
  const bgPrimary = isDark ? 'bg-[#0a1628]' : 'bg-gray-50';
  const bgSecondary = isDark ? 'bg-[#0f1d32]' : 'bg-white';
  const borderColor = isDark ? 'border-white/10' : 'border-gray-200';
  const textPrimary = isDark ? 'text-white' : 'text-gray-900';
  const textSecondary = isDark ? 'text-gray-400' : 'text-gray-600';

  // Handle link clicks in messages
  const handleLinkClick = (url) => { 
    setIsOpen(false); 
    navigate(url); 
  };

  // Submit feedback on a message
  const handleFeedback = async (messageId, isHelpful, question) => {
    setFeedback(prev => ({ ...prev, [messageId]: isHelpful ? 'helpful' : 'not-helpful' }));
    try {
      await fetch(`${BACKEND_URL}/api/help/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          session_id: sessionId, 
          message_id: messageId, 
          is_helpful: isHelpful, 
          question 
        })
      });
    } catch (error) { 
      console.error('Failed to submit feedback:', error); 
    }
  };

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => { 
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); 
  }, [messages]);

  // Focus input when chat opens
  useEffect(() => { 
    if (isOpen && inputRef.current) inputRef.current.focus(); 
  }, [isOpen]);

  // Send message to AI
  const sendMessage = async (messageText = null) => {
    const userMessage = (messageText || input).trim();
    if (!userMessage || isLoading) return;

    const userMsgId = `user-${Date.now()}`;
    const assistantMsgId = `assistant-${Date.now()}`;
    
    setInput('');
    setShowSuggestions(false);
    setMessages(prev => [...prev, { role: 'user', content: userMessage, id: userMsgId }]);
    setIsLoading(true);

    try {
      const response = await fetch(`${BACKEND_URL}/api/help/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMessage, session_id: sessionId })
      });
      
      if (!response.ok) throw new Error('Failed to get response');
      
      const data = await response.json();
      setSessionId(data.session_id);
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: data.response, 
        id: assistantMsgId, 
        question: userMessage 
      }]);
    } catch (error) {
      console.error('Chat error:', error);
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: "Sorry, I'm having trouble connecting. Please try again or browse the Help Center articles.", 
        id: assistantMsgId 
      }]);
    } finally { 
      setIsLoading(false); 
    }
  };

  // Handle Enter key
  const handleKeyDown = (e) => { 
    if (e.key === 'Enter' && !e.shiftKey) { 
      e.preventDefault(); 
      sendMessage(); 
    } 
  };

  return (
    <>
      {/* Floating Action Button */}
      <button
        onClick={() => setIsOpen(true)}
        className={cn(
          "fixed bottom-24 right-6 w-14 h-14 rounded-full flex items-center justify-center shadow-lg z-50 transition-all hover:scale-105",
          `bg-gradient-to-r from-${accentColor}-500 to-${accentColor}-600 text-white`,
          isOpen && "hidden"
        )}
        data-testid="help-assistant-btn"
        aria-label="Open AI Assistant"
      >
        <Sparkles className="w-6 h-6" />
      </button>

      {/* Chat Panel */}
      {isOpen && (
        <div className={cn(
          "fixed bottom-24 right-6 w-96 h-[500px] rounded-2xl shadow-2xl z-50 flex flex-col overflow-hidden", 
          bgSecondary, borderColor, "border"
        )}>
          {/* Header */}
          <div className={cn(
            "flex items-center justify-between px-4 py-3 border-b", 
            borderColor, 
            `bg-gradient-to-r from-${accentColor}-500/10 to-${accentColor}-600/10`
          )}>
            <div className="flex items-center gap-3">
              <div className={`w-8 h-8 rounded-full bg-gradient-to-r from-${accentColor}-500 to-${accentColor}-600 flex items-center justify-center`}>
                <Bot className="w-4 h-4 text-white" />
              </div>
              <div>
                <h3 className={cn("font-semibold text-sm", textPrimary)}>AI Assistant</h3>
                <p className={cn("text-xs", textSecondary)}>Powered by AI</p>
              </div>
            </div>
            <button 
              onClick={() => setIsOpen(false)} 
              className={cn("p-1 rounded-lg hover:bg-white/10", textSecondary)}
              aria-label="Close chat"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Messages Area */}
          <div className={cn("flex-1 overflow-y-auto p-4 space-y-4", bgPrimary)}>
            {messages.map((msg, idx) => (
              <div key={msg.id || idx} className={cn("flex gap-3", msg.role === 'user' ? "flex-row-reverse" : "")}>
                {/* Avatar */}
                <div className={cn(
                  "w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0", 
                  msg.role === 'user' 
                    ? "bg-blue-500/20" 
                    : `bg-gradient-to-r from-${accentColor}-500 to-${accentColor}-600`
                )}>
                  {msg.role === 'user' 
                    ? <User className="w-3.5 h-3.5 text-blue-400" /> 
                    : <Bot className="w-3.5 h-3.5 text-white" />
                  }
                </div>
                
                {/* Message Bubble */}
                <div className="flex flex-col gap-1 max-w-[80%]">
                  <div className={cn(
                    "rounded-2xl px-4 py-2.5 text-sm", 
                    msg.role === 'user' 
                      ? "bg-blue-500 text-white rounded-br-md" 
                      : cn(bgSecondary, textPrimary, "rounded-bl-md border", borderColor)
                  )}>
                    {msg.role === 'user' 
                      ? <p className="whitespace-pre-wrap">{msg.content}</p> 
                      : <MessageContent content={msg.content} isDark={isDark} onLinkClick={handleLinkClick} />
                    }
                  </div>
                  
                  {/* Feedback Buttons */}
                  {msg.role === 'assistant' && msg.id !== 'welcome' && (
                    <div className="flex items-center gap-2 mt-1 ml-1">
                      {feedback[msg.id] ? (
                        <span className={cn("text-xs", textSecondary)}>
                          {feedback[msg.id] === 'helpful' ? 'Thanks!' : "We'll improve!"}
                        </span>
                      ) : (
                        <>
                          <span className={cn("text-xs", textSecondary)}>Helpful?</span>
                          <button 
                            onClick={() => handleFeedback(msg.id, true, msg.question)} 
                            className={cn("p-1 rounded hover:bg-white/10", textSecondary, "hover:text-green-400")}
                            aria-label="Mark as helpful"
                          >
                            <ThumbsUp className="w-3.5 h-3.5" />
                          </button>
                          <button 
                            onClick={() => handleFeedback(msg.id, false, msg.question)} 
                            className={cn("p-1 rounded hover:bg-white/10", textSecondary, "hover:text-red-400")}
                            aria-label="Mark as not helpful"
                          >
                            <ThumbsDown className="w-3.5 h-3.5" />
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
            
            {/* Suggested Questions */}
            {showSuggestions && messages.length === 1 && !isLoading && (
              <div className="mt-2">
                <p className={cn("text-xs mb-2", textSecondary)}>Try asking:</p>
                <div className="flex flex-wrap gap-2">
                  {SUGGESTED_QUESTIONS.map((question, idx) => (
                    <button 
                      key={idx} 
                      onClick={() => sendMessage(question)} 
                      className={cn(
                        "text-xs px-3 py-1.5 rounded-full border transition-colors", 
                        borderColor, 
                        isDark ? "bg-white/5 hover:bg-white/10" : "bg-gray-100 hover:bg-gray-200", 
                        `text-${accentColor}-400 hover:text-${accentColor}-300`
                      )}
                    >
                      {question}
                    </button>
                  ))}
                </div>
              </div>
            )}
            
            {/* Loading Indicator */}
            {isLoading && (
              <div className="flex gap-3">
                <div className={`w-7 h-7 rounded-full bg-gradient-to-r from-${accentColor}-500 to-${accentColor}-600 flex items-center justify-center`}>
                  <Bot className="w-3.5 h-3.5 text-white" />
                </div>
                <div className={cn(bgSecondary, "rounded-2xl rounded-bl-md px-4 py-3 border", borderColor)}>
                  <Loader2 className={`w-4 h-4 animate-spin text-${accentColor}-500`} />
                </div>
              </div>
            )}
            
            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div className={cn("p-3 border-t", borderColor)}>
            <div className={cn("flex items-center gap-2 rounded-xl px-3 py-2", isDark ? "bg-white/5" : "bg-gray-100")}>
              <input 
                ref={inputRef} 
                value={input} 
                onChange={(e) => setInput(e.target.value)} 
                onKeyDown={handleKeyDown} 
                placeholder="Ask me anything..." 
                className={cn("flex-1 bg-transparent outline-none text-sm", textPrimary, "placeholder-gray-500")} 
                disabled={isLoading} 
              />
              <button 
                onClick={() => sendMessage()} 
                disabled={!input.trim() || isLoading} 
                className={cn(
                  "p-2 rounded-lg transition-colors", 
                  input.trim() && !isLoading 
                    ? `bg-${accentColor}-500 text-white hover:bg-${accentColor}-600` 
                    : "text-gray-500 cursor-not-allowed"
                )}
                aria-label="Send message"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default HelpAssistant;
