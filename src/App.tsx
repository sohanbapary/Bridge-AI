/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Send, Heart, Info, X, ExternalLink, Loader2, AlertCircle, LogIn, LogOut, MapPin } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { sendMessage, ChatMessage } from './services/geminiService';
import { auth, googleProvider, signInWithPopup, signOut, onAuthStateChanged, User } from './lib/firebase';

interface Message {
  id: string;
  role: 'user' | 'bot';
  text: string;
  timestamp: Date;
}

const CRISIS_RESOURCES = [
  { country: 'Global', name: 'Befrienders Worldwide', url: 'https://www.befrienders.org/' },
  { country: 'Global', name: 'International Association for Suicide Prevention', url: 'https://www.iasp.info/resources/Crisis_Centres/' },
  { country: 'USA', name: '988 Suicide & Crisis Lifeline', tel: '988' },
  { country: 'USA', name: 'Crisis Text Line', tel: '741741', note: 'Text HOME' },
  { country: 'UK', name: 'Samaritans', tel: '116 123' },
  { country: 'UK', name: 'Shout Crisis Text Line', tel: '85258', note: 'Text SHOUT' },
  { country: 'Canada', name: 'Talk Suicide Canada', tel: '1-833-456-4566' },
  { country: 'Canada', name: 'Crisis Text Line', tel: '686868', note: 'Text HOME' },
  { country: 'Australia', name: 'Lifeline', tel: '13 11 14' },
  { country: 'Australia', name: 'Beyond Blue', tel: '1300 22 4636' },
  { country: 'India', name: 'Vandrevala Foundation', tel: '9999 666 555' },
  { country: 'India', name: 'AASRA', tel: '9820466726' },
  { country: 'New Zealand', name: '1737, need to talk?', tel: '1737' },
  { country: 'Ireland', name: 'Crisis Text Ireland', tel: '50808', note: 'Text HELLO' },
  { country: 'Singapore', name: 'Samaritans of Singapore', tel: '1767' },
  { country: 'South Africa', name: 'SADAG', tel: '0800 567 567' },
  { country: 'Germany', name: 'TelefonSeelsorge', tel: '0800 111 0 111' },
  { country: 'France', name: 'National Suicide Prevention', tel: '3114' },
  { country: 'Brazil', name: 'CVV', tel: '188' },
];

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'bot',
      text: "Hello. I'm Bridge. I'm here to listen if you're feeling overwhelmed, lonely, or just need to talk for a moment. How are you feeling today?",
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showCrisis, setShowCrisis] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [isDetectingLocation, setIsDetectingLocation] = useState(false);
  const [detectedCountry, setDetectedCountry] = useState<string | null>(null);
  const [showLocationPrompt, setShowLocationPrompt] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });
    return () => unsubscribe();
  }, []);

  // Show location prompt after 45 seconds or after 2 user messages
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!detectedCountry) {
        setShowLocationPrompt(true);
      }
    }, 45000);

    return () => clearTimeout(timer);
  }, [detectedCountry]);

  useEffect(() => {
    const userMessageCount = messages.filter(m => m.role === 'user').length;
    if (userMessageCount >= 2 && !detectedCountry) {
      setShowLocationPrompt(true);
    }
  }, [messages, detectedCountry]);

  const detectLocation = async () => {
    setIsDetectingLocation(true);
    setShowLocationPrompt(false);
    try {
      // Primary attempt using freeipapi.com (CORS friendly)
      const response = await fetch('https://freeipapi.com/api/json');
      const data = await response.json();
      if (data && data.countryName) {
        setDetectedCountry(data.countryName);
        setSearchTerm(data.countryName);
      } else {
        throw new Error('freeipapi failed');
      }
    } catch (error) {
      console.error('Error detecting location (freeipapi):', error);
      // Fallback 1: ipwho.is
      try {
        const fb1 = await fetch('https://ipwho.is/');
        const data1 = await fb1.json();
        if (data1.success && data1.country) {
          setDetectedCountry(data1.country);
          setSearchTerm(data1.country);
        } else {
          throw new Error('ipwhois failed');
        }
      } catch (fb1Error) {
        console.error('Fallback 1 failed:', fb1Error);
        // Fallback 2: ipapi.co (often hits CORS, but worth a try)
        try {
          const fb2 = await fetch('https://ipapi.co/json/');
          const data2 = await fb2.json();
          if (data2.country_name) {
            setDetectedCountry(data2.country_name);
            setSearchTerm(data2.country_name);
          }
        } catch (fb2Error) {
          console.error('All location attempts failed');
        }
      }
    } finally {
      setIsDetectingLocation(false);
    }
  };

  const handleLogin = async () => {
    try {
      await signInWithPopup();
    } catch (error) {
      console.error('Login error:', error);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut();
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const filteredResources = CRISIS_RESOURCES.filter(
    (r) =>
      r.country.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      text: input,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      // Prepare history for Gemini
      const history: ChatMessage[] = messages.map((m) => ({
        role: m.role === 'user' ? 'user' : 'model',
        parts: [{ text: m.text }],
      }));

      const response = await sendMessage(history, input);

      const botMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'bot',
        text: response || "I'm sorry, I couldn't process that. Can you tell me more?",
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, botMessage]);
    } catch (error) {
      console.error('Error sending message:', error);
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'bot',
        text: "I'm having a bit of trouble connecting right now. Please know that help is still available. If you're in immediate danger, please reach out to emergency services or a crisis line.",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-bg-primary text-text-main font-sans selection:bg-brand/10">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 h-16 bg-bg-primary/80 backdrop-blur-md border-b border-border-main z-40 flex items-center justify-between px-10">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-brand" />
          <h1 className="text-lg font-medium tracking-tight text-text-main">Bridge</h1>
        </div>
        <div className="flex items-center gap-6">
          <div className="hidden md:flex gap-6 text-sm text-text-muted items-center">
            {user ? (
              <div className="flex items-center gap-3">
                {user.photoURL && (
                  <img src={user.photoURL} alt="User" className="w-6 h-6 rounded-full border border-border-main" />
                )}
                <span className="text-xs font-medium">Hi, {user.displayName?.split(' ')[0]}</span>
                <button onClick={handleLogout} className="p-1 text-text-muted hover:text-crisis transition-colors" title="Sign Out">
                  <LogOut size={14} />
                </button>
              </div>
            ) : (
              <button 
                onClick={handleLogin}
                className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest hover:text-brand transition-colors"
              >
                <LogIn size={14} />
                Sign In
              </button>
            )}
            <span className="opacity-20">|</span>
            <span>Today</span>
          </div>
          <button
            onClick={() => setShowCrisis(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-full border border-border-main text-text-muted hover:bg-bg-secondary transition-colors text-xs font-bold uppercase tracking-widest"
          >
            <AlertCircle size={14} />
            Support
          </button>
        </div>
      </header>

      {/* Main Chat Area */}
      <main className="max-w-2xl mx-auto pt-24 pb-48 px-6 min-h-screen flex flex-col">
        <div className="flex-1 space-y-10">
          <AnimatePresence initial={false}>
            {messages.map((message) => (
              <motion.div
                key={message.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex flex-col ${message.role === 'user' ? 'items-end' : 'items-start'}`}
              >
                <span className={`text-[10px] uppercase tracking-widest mb-2 ml-4 ${
                  message.role === 'user' ? 'text-text-muted' : 'text-brand font-bold'
                }`}>
                  {message.role === 'user' ? 'You' : 'Bridge'}
                </span>
                <div
                  className={`max-w-[90%] rounded-2xl px-6 py-4 shadow-sm text-[15px] leading-relaxed ${
                    message.role === 'user'
                      ? 'bg-white border border-border-main text-text-main rounded-tl-none'
                      : 'bg-brand text-white rounded-tr-none shadow-md'
                  }`}
                >
                  <div className={`prose prose-sm max-w-none ${message.role === 'bot' ? 'prose-invert' : 'prose-stone'} [&>p]:mb-0`}>
                    <ReactMarkdown>{message.text}</ReactMarkdown>
                  </div>
                  <div
                    className={`mt-2 text-[9px] uppercase tracking-tighter opacity-40 ${
                      message.role === 'user' ? 'text-right' : 'text-left'
                    }`}
                  >
                    {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
          {isLoading && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-start"
            >
              <span className="text-[10px] uppercase tracking-widest mb-2 ml-4 text-brand font-bold">Bridge</span>
              <div className="bg-brand/5 border border-border-main rounded-2xl px-6 py-4 shadow-sm flex items-center gap-3">
                <Loader2 size={16} className="animate-spin text-brand" />
                <span className="text-sm text-brand font-medium">Bridge is thinking...</span>
              </div>
            </motion.div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Delayed Location Prompt */}
        <AnimatePresence>
          {showLocationPrompt && !detectedCountry && (
            <motion.div
              initial={{ opacity: 0, y: 50 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="mt-8 p-6 bg-white border border-border-main rounded-2xl shadow-lg border-t-4 border-t-brand"
            >
              <div className="flex items-start gap-4">
                <div className="p-3 bg-brand/5 rounded-full text-brand">
                  <MapPin size={24} />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-text-main">Find relevant support</h3>
                  <p className="text-sm text-text-muted mt-1 leading-relaxed">
                    Would you like me to find local resources and helplines in your area? 
                    This helps me bridge you to the right human support.
                  </p>
                  <div className="mt-4 flex items-center gap-3">
                    <button
                      onClick={detectLocation}
                      disabled={isDetectingLocation}
                      className="px-6 py-2 bg-brand text-white rounded-full text-sm font-bold hover:opacity-90 transition-all flex items-center gap-2"
                    >
                      {isDetectingLocation ? (
                        <Loader2 size={16} className="animate-spin" />
                      ) : (
                        <>Yes, detect location</>
                      )}
                    </button>
                    <button
                      onClick={() => setShowLocationPrompt(false)}
                      className="px-4 py-2 text-text-muted hover:text-text-main text-sm font-medium transition-colors"
                    >
                      Maybe later
                    </button>
                  </div>
                </div>
                <button
                  onClick={() => setShowLocationPrompt(false)}
                  className="p-1 text-text-muted hover:text-text-main transition-colors"
                >
                  <X size={18} />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Input Area */}
      <div className="fixed bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-bg-primary via-bg-primary to-transparent z-40">
        <div className="max-w-2xl mx-auto flex items-center gap-4 bg-white p-3 rounded-full border border-border-main shadow-xl">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Type a message..."
            className="flex-1 bg-bg-primary/50 text-text-main px-6 py-3 rounded-full focus:outline-none focus:ring-1 focus:ring-brand/30 transition-all text-[15px]"
            disabled={isLoading}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            className="w-12 h-12 flex items-center justify-center rounded-full bg-brand text-white hover:opacity-90 disabled:opacity-50 transition-all"
          >
            <Send size={18} />
          </button>
        </div>
        
        {/* Emergency Banner Style Footer */}
        <div className="max-w-2xl mx-auto mt-6 bg-crisis/10 border border-crisis/20 text-crisis px-4 py-2 rounded-lg flex items-center justify-center gap-4 text-[10px] font-bold uppercase tracking-widest">
          <span>Crisis Support:</span>
          <span className="underline cursor-pointer" onClick={() => setShowCrisis(true)}>988 (USA)</span>
          <span className="opacity-30">|</span>
          <span className="underline cursor-pointer" onClick={() => setShowCrisis(true)}>116 123 (UK)</span>
        </div>
      </div>

      {/* Crisis Modal */}
      <AnimatePresence>
        {showCrisis && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowCrisis(false)}
              className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="fixed inset-x-4 top-24 md:left-1/2 md:right-auto md:-translate-x-1/2 md:w-[500px] bg-bg-primary rounded-3xl p-8 z-[60] shadow-2xl border border-border-main overflow-hidden"
            >
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h2 className="text-xl font-semibold text-text-main flex items-center gap-2">
                    <AlertCircle className="text-crisis" />
                    Human Support
                  </h2>
                  <p className="text-text-muted mt-2 text-sm leading-relaxed">Our goal is to help you connect with people who can offer sustained, professional support.</p>
                </div>
                <button
                  onClick={() => setShowCrisis(false)}
                  className="p-2 hover:bg-bg-secondary rounded-full transition-colors"
                >
                  <X size={20} className="text-text-muted" />
                </button>
              </div>

              <div className="mb-6 space-y-3">
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    placeholder="Filter by country or resource..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="flex-1 bg-white border border-border-main rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-1 focus:ring-brand/30 transition-all"
                  />
                  <button
                    onClick={detectLocation}
                    disabled={isDetectingLocation}
                    className="p-3 bg-bg-secondary border border-border-main rounded-xl text-text-muted hover:text-brand transition-colors disabled:opacity-50"
                    title="Detect my location"
                  >
                    {isDetectingLocation ? (
                      <Loader2 size={18} className="animate-spin" />
                    ) : (
                      <Info size={18} />
                    )}
                  </button>
                </div>
                {detectedCountry && (
                  <p className="text-[10px] text-brand px-1 flex items-center gap-1">
                    <span className="w-1 h-1 rounded-full bg-brand" />
                    Showing resources for <strong>{detectedCountry}</strong>
                  </p>
                )}
              </div>

              <div className="space-y-4 max-h-[50vh] overflow-y-auto pr-2 custom-scrollbar">
                {filteredResources.length > 0 ? (
                  filteredResources.map((resource, i) => (
                    <div key={i} className="p-4 rounded-xl bg-white border border-border-main">
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="text-[9px] font-bold uppercase tracking-wider text-text-muted">
                            {resource.country}
                          </span>
                          <h3 className="text-sm font-semibold text-text-main">{resource.name}</h3>
                          {resource.note && (
                            <p className="text-[10px] text-brand/70 font-medium mt-0.5">{resource.note}</p>
                          )}
                        </div>
                        {resource.tel ? (
                          <a
                            href={`tel:${resource.tel}`}
                            className="bg-brand text-white px-4 py-2 rounded-lg font-bold text-xs hover:opacity-90 transition-colors"
                          >
                            {resource.tel}
                          </a>
                        ) : (
                          <a
                            href={resource.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-2 text-brand hover:bg-brand/5 rounded-lg transition-colors"
                          >
                            <ExternalLink size={18} />
                          </a>
                        )}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-10 text-text-muted text-sm">
                    No resources found for "{searchTerm}"
                  </div>
                )}
              </div>

              <div className="mt-8 pt-6 border-t border-border-main text-center">
                <p className="text-[10px] uppercase tracking-widest text-text-muted font-bold">
                  Immediate Emergency: Call 911 / 999 / 112
                </p>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: #F3F0E8;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #4A5D54;
          border-radius: 10px;
        }
        .prose p {
          margin-top: 0 !important;
          margin-bottom: 0.5rem !important;
        }
        .prose p:last-child {
          margin-bottom: 0 !important;
        }
      `}</style>
    </div>
  );
}
