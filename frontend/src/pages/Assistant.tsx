import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Bot, User, Sparkles, AlertCircle, Trash2, Settings, ChevronDown, ChevronUp, Info } from 'lucide-react';

interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000/api';

export default function Assistant() {
  const initialMessage: Message = {
    role: 'assistant',
    content: 'Hello! I am **Geo Ai**, the core intelligence behind GeoAltitude. I have deep knowledge of our XGBoost models, Data Pipelines, Fuel Analysis, and Risk Assessment modules. How can I assist you today?'
  };

  const [messages, setMessages] = useState<Message[]>([initialMessage]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  // Model Parameters State
  const [temperature, setTemperature] = useState(0.5);
  const [topP, setTopP] = useState(1.0);
  const [maxTokens, setMaxTokens] = useState(1024);
  const [frequencyPenalty, setFrequencyPenalty] = useState(0.0);
  const [presencePenalty, setPresencePenalty] = useState(0.0);
  const [seed, setSeed] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [activeInfo, setActiveInfo] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = { role: 'user', content: input.trim() };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await fetch(`${API_BASE}/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          messages: [...messages, userMessage].filter(m => m.role !== 'system'),
          temperature,
          top_p: topP,
          max_tokens: maxTokens,
          frequency_penalty: frequencyPenalty,
          presence_penalty: presencePenalty,
          ...(seed ? { seed: parseInt(seed) } : {})
        })
      });

      if (!response.ok) {
        let errorMsg = 'Failed to communicate with AI';
        try {
            const errData = await response.json();
            errorMsg = errData.detail || errorMsg;
        } catch(e) {}
        throw new Error(errorMsg);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No readable stream available.");
      
      const decoder = new TextDecoder();
      let assistantResponse = '';
      
      // Initialize an empty assistant message that we will append to
      setMessages(prev => [...prev, { role: 'assistant', content: '' }]);
      setIsLoading(false); // Stop loading spinner since we are streaming now
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        const chunk = decoder.decode(value, { stream: true });
        assistantResponse += chunk;
        
        setMessages(prev => {
          const newMessages = [...prev];
          newMessages[newMessages.length - 1].content = assistantResponse;
          return newMessages;
        });
      }
      
    } catch (error: any) {
      setMessages(prev => [...prev, { 
        role: 'system', 
        content: `Error: ${error.message}` 
      }]);
      setIsLoading(false);
    }
  };

  const clearChat = () => {
    setMessages([initialMessage]);
    setInput('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Basic markdown formatting for display
  const formatText = (text: string) => {
    let formatted = text.replace(/\*\*(.*?)\*\*/g, '<strong class="text-white font-extrabold">$1</strong>');
    formatted = formatted.replace(/`([^`]+)`/g, '<span class="bg-indigo-500/20 text-indigo-300 font-mono px-1.5 py-0.5 rounded text-sm border border-indigo-500/30">$1</span>');
    formatted = formatted.replace(/\n/g, '<br/>');
    formatted = formatted.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" class="text-indigo-400 hover:text-indigo-300 hover:underline transition-colors">$1</a>');
    return <div dangerouslySetInnerHTML={{ __html: formatted }} />;
  };

  return (
    <div className="h-full flex flex-col gap-6 relative">
      {/* Background Animated Gradients */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none rounded-2xl">
        <motion.div 
          animate={{ 
            scale: [1, 1.2, 1],
            opacity: [0.1, 0.2, 0.1],
            rotate: [0, 90, 0]
          }}
          transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
          className="absolute -top-[20%] -right-[10%] w-[60%] h-[60%] bg-gradient-to-br from-indigo-600/20 to-purple-600/20 blur-[100px] rounded-full"
        />
        <motion.div 
          animate={{ 
            scale: [1, 1.5, 1],
            opacity: [0.1, 0.15, 0.1],
          }}
          transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
          className="absolute -bottom-[20%] -left-[10%] w-[50%] h-[50%] bg-gradient-to-tr from-blue-600/20 to-indigo-600/20 blur-[100px] rounded-full"
        />
      </div>

      {/* Header */}
      <div className="flex items-center justify-between mb-2 relative z-10 px-2">
        <div className="flex items-center gap-4">
          <motion.div 
            animate={{ y: [0, -5, 0] }}
            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
            className="relative"
          >
            <div className="absolute inset-0 bg-indigo-500 blur-xl opacity-40 rounded-full animate-pulse" />
            <div className="p-3 bg-gradient-to-tr from-indigo-500/20 to-purple-500/20 border border-indigo-500/40 rounded-2xl text-indigo-400 relative backdrop-blur-md shadow-[0_0_20px_rgba(99,102,241,0.2)]">
              <Sparkles className="w-6 h-6" />
            </div>
          </motion.div>
          <div>
            <h2 className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-purple-400 to-indigo-400 tracking-tight animate-gradient-x">
              Geo Ai
            </h2>
            <p className="text-xs text-indigo-300/70 font-medium tracking-wide uppercase mt-0.5">Core Intelligence Module (Llama 3.1 8B)</p>
          </div>
        </div>
        
        <div className="flex gap-2">
          <button
            onClick={() => setShowSettings(!showSettings)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl border transition-all text-xs font-bold uppercase tracking-wider ${
              showSettings 
                ? 'bg-indigo-500/20 border-indigo-500/50 text-indigo-300' 
                : 'bg-indigo-500/10 border-indigo-500/30 text-indigo-400 hover:bg-indigo-500/20'
            }`}
            title="Model Settings"
          >
            <Settings className="w-4 h-4" /> Settings {showSettings ? <ChevronUp className="w-4 h-4"/> : <ChevronDown className="w-4 h-4"/>}
          </button>
          <button
            onClick={clearChat}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20 hover:text-red-300 transition-all text-xs font-bold uppercase tracking-wider"
            title="Clear Conversation"
          >
            <Trash2 className="w-4 h-4" /> Clear Chat
          </button>
        </div>
      </div>

      {/* Settings Panel */}
      <AnimatePresence>
        {showSettings && (
          <motion.div
            initial={{ height: 0, opacity: 0, overflow: 'hidden' }}
            animate={{ height: 'auto', opacity: 1, transitionEnd: { overflow: 'visible' } }}
            exit={{ height: 0, opacity: 0, overflow: 'hidden' }}
            className="relative z-50 px-2"
          >
            <div className="p-5 glass-panel border border-indigo-500/30 rounded-2xl mb-4 shadow-[0_8px_32px_rgba(0,0,0,0.4)] backdrop-blur-xl grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              
              {/* Temperature */}
              <div className="space-y-2">
                <div className="flex justify-between text-xs font-semibold text-indigo-300 uppercase items-center">
                  <div className="flex items-center gap-1.5 cursor-pointer hover:text-indigo-200 transition-colors" onClick={() => setActiveInfo(activeInfo === 'temperature' ? null : 'temperature')}>
                    <span>Temperature</span>
                    <Info className="w-3.5 h-3.5" />
                  </div>
                  <span className="text-white bg-indigo-500/20 px-1.5 py-0.5 rounded border border-indigo-500/30">{temperature.toFixed(1)}</span>
                </div>
                <input type="range" min="0.1" max="1.0" step="0.1" value={temperature} onChange={(e) => setTemperature(parseFloat(e.target.value))} className="w-full accent-indigo-500 cursor-pointer" />
                <AnimatePresence>
                  {activeInfo === 'temperature' && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                      <div className="mt-1 p-2.5 bg-[#161D30]/90 rounded-lg text-[10px] text-gray-300 border border-indigo-500/20 shadow-inner">
                        <div className="text-indigo-400 font-bold mb-1">Why use this?</div>
                        <p className="mb-2 text-gray-400">Controls the randomness and creativity of the AI's responses.</p>
                        <div className="text-indigo-400 font-bold mb-1">Current Impact:</div>
                        <p className="text-white bg-indigo-500/10 p-1.5 rounded border border-indigo-500/20">
                          {temperature < 0.4 ? "Highly focused and deterministic. Best for math and facts." : temperature > 0.7 ? "Highly creative and random. Good for brainstorming." : "Balanced creativity and focus."}
                        </p>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Top P */}
              <div className="space-y-2">
                <div className="flex justify-between text-xs font-semibold text-indigo-300 uppercase items-center">
                  <div className="flex items-center gap-1.5 cursor-pointer hover:text-indigo-200 transition-colors" onClick={() => setActiveInfo(activeInfo === 'topP' ? null : 'topP')}>
                    <span>Top P</span>
                    <Info className="w-3.5 h-3.5" />
                  </div>
                  <span className="text-white bg-indigo-500/20 px-1.5 py-0.5 rounded border border-indigo-500/30">{topP.toFixed(1)}</span>
                </div>
                <input type="range" min="0.1" max="1.0" step="0.1" value={topP} onChange={(e) => setTopP(parseFloat(e.target.value))} className="w-full accent-indigo-500 cursor-pointer" />
                <AnimatePresence>
                  {activeInfo === 'topP' && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                      <div className="mt-1 p-2.5 bg-[#161D30]/90 rounded-lg text-[10px] text-gray-300 border border-indigo-500/20 shadow-inner">
                        <div className="text-indigo-400 font-bold mb-1">Why use this?</div>
                        <p className="mb-2 text-gray-400">Nucleus sampling. Filters out lower-probability words before selecting them.</p>
                        <div className="text-indigo-400 font-bold mb-1">Current Impact:</div>
                        <p className="text-white bg-indigo-500/10 p-1.5 rounded border border-indigo-500/20">
                          {topP < 0.5 ? "Strict sampling. Only the most likely words are chosen." : topP > 0.9 ? "Full vocabulary available. More varied wording." : "Moderate nucleus sampling."}
                        </p>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Max Tokens */}
              <div className="space-y-2">
                <div className="flex justify-between text-xs font-semibold text-indigo-300 uppercase items-center">
                  <div className="flex items-center gap-1.5 cursor-pointer hover:text-indigo-200 transition-colors" onClick={() => setActiveInfo(activeInfo === 'maxTokens' ? null : 'maxTokens')}>
                    <span>Max Tokens</span>
                    <Info className="w-3.5 h-3.5" />
                  </div>
                  <span className="text-white bg-indigo-500/20 px-1.5 py-0.5 rounded border border-indigo-500/30">{maxTokens}</span>
                </div>
                <input type="range" min="256" max="4096" step="256" value={maxTokens} onChange={(e) => setMaxTokens(parseInt(e.target.value))} className="w-full accent-indigo-500 cursor-pointer" />
                <AnimatePresence>
                  {activeInfo === 'maxTokens' && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                      <div className="mt-1 p-2.5 bg-[#161D30]/90 rounded-lg text-[10px] text-gray-300 border border-indigo-500/20 shadow-inner">
                        <div className="text-indigo-400 font-bold mb-1">Why use this?</div>
                        <p className="mb-2 text-gray-400">Sets the hard limit on how long the AI's response can be.</p>
                        <div className="text-indigo-400 font-bold mb-1">Current Impact:</div>
                        <p className="text-white bg-indigo-500/10 p-1.5 rounded border border-indigo-500/20">
                          {maxTokens < 1000 ? "AI will provide short, concise responses." : maxTokens > 2000 ? "AI can provide very long, detailed explanations." : "AI will provide medium length responses."}
                        </p>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Frequency Penalty */}
              <div className="space-y-2">
                <div className="flex justify-between text-xs font-semibold text-indigo-300 uppercase items-center">
                  <div className="flex items-center gap-1.5 cursor-pointer hover:text-indigo-200 transition-colors" onClick={() => setActiveInfo(activeInfo === 'frequency' ? null : 'frequency')}>
                    <span>Freq. Penalty</span>
                    <Info className="w-3.5 h-3.5" />
                  </div>
                  <span className="text-white bg-indigo-500/20 px-1.5 py-0.5 rounded border border-indigo-500/30">{frequencyPenalty.toFixed(1)}</span>
                </div>
                <input type="range" min="-2.0" max="2.0" step="0.1" value={frequencyPenalty} onChange={(e) => setFrequencyPenalty(parseFloat(e.target.value))} className="w-full accent-indigo-500 cursor-pointer" />
                <AnimatePresence>
                  {activeInfo === 'frequency' && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                      <div className="mt-1 p-2.5 bg-[#161D30]/90 rounded-lg text-[10px] text-gray-300 border border-indigo-500/20 shadow-inner">
                        <div className="text-indigo-400 font-bold mb-1">Why use this?</div>
                        <p className="mb-2 text-gray-400">Penalizes the AI for repeating the exact same phrases and words.</p>
                        <div className="text-indigo-400 font-bold mb-1">Current Impact:</div>
                        <p className="text-white bg-indigo-500/10 p-1.5 rounded border border-indigo-500/20">
                          {frequencyPenalty < 0 ? "AI is encouraged to repeat itself." : frequencyPenalty > 0 ? "AI will actively avoid repeating exact phrases." : "No penalty applied to repetition."}
                        </p>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Presence Penalty */}
              <div className="space-y-2">
                <div className="flex justify-between text-xs font-semibold text-indigo-300 uppercase items-center">
                  <div className="flex items-center gap-1.5 cursor-pointer hover:text-indigo-200 transition-colors" onClick={() => setActiveInfo(activeInfo === 'presence' ? null : 'presence')}>
                    <span>Pres. Penalty</span>
                    <Info className="w-3.5 h-3.5" />
                  </div>
                  <span className="text-white bg-indigo-500/20 px-1.5 py-0.5 rounded border border-indigo-500/30">{presencePenalty.toFixed(1)}</span>
                </div>
                <input type="range" min="-2.0" max="2.0" step="0.1" value={presencePenalty} onChange={(e) => setPresencePenalty(parseFloat(e.target.value))} className="w-full accent-indigo-500 cursor-pointer" />
                <AnimatePresence>
                  {activeInfo === 'presence' && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                      <div className="mt-1 p-2.5 bg-[#161D30]/90 rounded-lg text-[10px] text-gray-300 border border-indigo-500/20 shadow-inner">
                        <div className="text-indigo-400 font-bold mb-1">Why use this?</div>
                        <p className="mb-2 text-gray-400">Penalizes the AI for talking about the same topics repeatedly.</p>
                        <div className="text-indigo-400 font-bold mb-1">Current Impact:</div>
                        <p className="text-white bg-indigo-500/10 p-1.5 rounded border border-indigo-500/20">
                          {presencePenalty < 0 ? "AI will stick closely to the current topic." : presencePenalty > 0 ? "AI will frequently introduce new topics." : "No topic penalty applied."}
                        </p>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Seed */}
              <div className="space-y-2">
                <div className="flex justify-between text-xs font-semibold text-indigo-300 uppercase items-center">
                  <div className="flex items-center gap-1.5 cursor-pointer hover:text-indigo-200 transition-colors" onClick={() => setActiveInfo(activeInfo === 'seed' ? null : 'seed')}>
                    <span>Seed (Reproducibility)</span>
                    <Info className="w-3.5 h-3.5" />
                  </div>
                </div>
                <input type="number" placeholder="Random (e.g. 42)" value={seed} onChange={(e) => setSeed(e.target.value)} className="w-full bg-[#0B0F19]/50 border border-[#374151] rounded-lg px-3 py-1.5 text-white focus:outline-none focus:border-indigo-500/50 text-sm placeholder-gray-500 mt-0.5" />
                <AnimatePresence>
                  {activeInfo === 'seed' && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                      <div className="mt-1 p-2.5 bg-[#161D30]/90 rounded-lg text-[10px] text-gray-300 border border-indigo-500/20 shadow-inner">
                        <div className="text-indigo-400 font-bold mb-1">Why use this?</div>
                        <p className="mb-2 text-gray-400">Forces the AI to generate the exact same response every time for the same prompt. Essential for technical validation.</p>
                        <div className="text-indigo-400 font-bold mb-1">Current Impact:</div>
                        <p className="text-white bg-indigo-500/10 p-1.5 rounded border border-indigo-500/20">
                          {seed ? `Responses are locked to seed ${seed}.` : "Responses are non-deterministic."}
                        </p>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Chat Window */}
      <div className="flex-1 glass-panel border border-[#1F293D]/80 rounded-3xl overflow-hidden flex flex-col relative shadow-[0_8px_32px_rgba(0,0,0,0.4)] z-10 backdrop-blur-xl">
        
        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar scroll-smooth">
          <AnimatePresence initial={false}>
            {messages.map((msg, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 20, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ type: "spring", stiffness: 400, damping: 25 }}
                className={`flex gap-4 max-w-[85%] ${
                  msg.role === 'user' ? 'ml-auto flex-row-reverse' : ''
                } ${msg.role === 'system' ? 'mx-auto max-w-[90%]' : ''}`}
              >
                {/* Avatar */}
                {msg.role !== 'system' && (
                  <div className="relative shrink-0">
                    {msg.role === 'assistant' && (
                      <motion.div 
                        animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.6, 0.3] }}
                        transition={{ duration: 2, repeat: Infinity }}
                        className="absolute inset-0 bg-indigo-500 rounded-xl blur-md"
                      />
                    )}
                    <div className={`w-11 h-11 shrink-0 rounded-xl flex items-center justify-center shadow-lg relative z-10 border ${
                      msg.role === 'user' 
                        ? 'bg-gradient-to-tr from-blue-600 to-indigo-600 text-white border-blue-400/30'
                        : 'bg-gradient-to-tr from-indigo-600 to-purple-600 text-white border-indigo-400/50'
                    }`}>
                      {msg.role === 'user' ? <User className="w-5 h-5" /> : <Bot className="w-6 h-6" />}
                    </div>
                  </div>
                )}
                
                {/* Message Bubble */}
                <div className={`p-5 rounded-2xl shadow-md text-sm/relaxed relative overflow-hidden ${
                  msg.role === 'user' 
                    ? 'bg-blue-600/20 border border-blue-500/30 text-blue-50 rounded-tr-sm backdrop-blur-md' 
                    : msg.role === 'system'
                    ? 'bg-red-500/10 border border-red-500/30 text-red-200 flex items-start gap-3 w-full backdrop-blur-md'
                    : 'bg-[#161D30]/90 border border-[#2D3748] text-[#E5E7EB] rounded-tl-sm backdrop-blur-md shadow-[0_4px_20px_rgba(0,0,0,0.2)]'
                }`}>
                  {msg.role === 'user' && (
                    <div className="absolute inset-0 bg-gradient-to-r from-blue-500/5 to-transparent pointer-events-none" />
                  )}
                  {msg.role === 'system' && <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />}
                  <div className="flex-1 relative z-10">
                    {formatText(msg.content)}
                  </div>
                </div>
              </motion.div>
            ))}
            
            {isLoading && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex gap-4 max-w-[85%]"
              >
                <div className="relative shrink-0">
                  <motion.div 
                    animate={{ scale: [1, 1.3, 1], opacity: [0.4, 0.8, 0.4] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                    className="absolute inset-0 bg-indigo-500 rounded-xl blur-md"
                  />
                  <div className="w-11 h-11 shrink-0 rounded-xl flex items-center justify-center bg-gradient-to-tr from-indigo-600 to-purple-600 text-white relative z-10 border border-indigo-400/50">
                    <Bot className="w-6 h-6" />
                  </div>
                </div>
                <div className="p-5 rounded-2xl rounded-tl-sm bg-[#161D30]/90 border border-[#2D3748] flex items-center gap-3 backdrop-blur-md">
                  <div className="flex gap-1.5">
                    <motion.div animate={{ y: [0, -6, 0] }} transition={{ duration: 0.6, repeat: Infinity, delay: 0 }} className="w-2 h-2 rounded-full bg-indigo-400" />
                    <motion.div animate={{ y: [0, -6, 0] }} transition={{ duration: 0.6, repeat: Infinity, delay: 0.2 }} className="w-2 h-2 rounded-full bg-indigo-400" />
                    <motion.div animate={{ y: [0, -6, 0] }} transition={{ duration: 0.6, repeat: Infinity, delay: 0.4 }} className="w-2 h-2 rounded-full bg-indigo-400" />
                  </div>
                  <span className="text-indigo-300 text-xs font-bold tracking-widest uppercase">Processing...</span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="p-5 bg-black/40 border-t border-[#1F293D]/80 backdrop-blur-xl relative z-20">
          <div className="max-w-4xl mx-auto relative group">
            <div className="absolute -inset-0.5 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-3xl blur opacity-20 group-focus-within:opacity-50 transition duration-500" />
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask Geo Ai about models, data pipelines, or analysis..."
              className="w-full relative bg-[#0B0F19]/90 border border-[#374151] rounded-3xl pl-6 pr-16 py-4 text-[#F3F4F6] focus:outline-none focus:border-indigo-500/50 resize-none custom-scrollbar shadow-inner text-sm"
              rows={1}
              style={{ minHeight: '60px', maxHeight: '200px' }}
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || isLoading}
              className="absolute right-3 bottom-3 p-3 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-400 hover:to-purple-500 text-white rounded-2xl disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-[0_0_20px_rgba(99,102,241,0.5)] group-focus-within:animate-pulse"
            >
              <Send className="w-4 h-4 ml-0.5" />
            </button>
          </div>
          <div className="text-center mt-3 text-[10px] text-[#6B7280] font-medium tracking-wide">
            GEO AI MAY PRODUCE INACCURATE INFORMATION ABOUT TERRAIN DATA. ALWAYS VERIFY CRITICAL ROUTES.
          </div>
        </div>
      </div>
    </div>
  );
}
