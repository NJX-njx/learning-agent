import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Paperclip, Image as ImageIcon, Settings, Plus, MessageSquare, User, BrainCircuit, ChevronRight, UploadCloud, FileText, Mic, Copy, Edit2, ArrowUp, AudioLines, ThumbsUp, ThumbsDown, Share, RotateCw, MoreHorizontal, Volume2, Flag, GitBranch, X, PanelLeft } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import ProfileModal from '../components/ProfileModal';
import ThinkingSidebar from '../components/ThinkingSidebar';

declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  attachments?: string[];
  thinkingSteps?: any[];
}

interface ChatSession {
  id: string;
  title: string;
  date: string;
  messages: Message[];
}

const ChatPage: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [profile, setProfile] = useState<any>(() => {
    const saved = localStorage.getItem('learnerProfile');
    return saved ? JSON.parse(saved) : {
      competencyLevel: '中等',
      learningGoal: '',
      preferredStyle: '讲解+计划'
    };
  });
  const [isLoading, setIsLoading] = useState(false);

  // Chat Sessions State
  const [sessions, setSessions] = useState<ChatSession[]>([
    {
      id: 'mock-1',
      title: '一次函数错题分析',
      date: '今天',
      messages: [
        { id: 'm1', role: 'user', content: '帮我看看这道一次函数的题。' },
        { id: 'm2', role: 'assistant', content: '没问题，请上传题目图片，我会为你分析知识点和解题思路。' }
      ]
    }
  ]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  
  // Sidebar State
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [sidebarWidth, setSidebarWidth] = useState(260);
  const [isResizing, setIsResizing] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);

  // Resize handlers
  const startResizing = useCallback(() => {
    setIsResizing(true);
  }, []);

  const stopResizing = useCallback(() => {
    setIsResizing(false);
  }, []);

  const resize = useCallback((mouseMoveEvent: MouseEvent) => {
    if (isResizing) {
      const newWidth = mouseMoveEvent.clientX;
      if (newWidth > 200 && newWidth < 480) { // Min and max width constraints
        setSidebarWidth(newWidth);
      }
    }
  }, [isResizing]);

  useEffect(() => {
    window.addEventListener("mousemove", resize);
    window.addEventListener("mouseup", stopResizing);
    return () => {
      window.removeEventListener("mousemove", resize);
      window.removeEventListener("mouseup", stopResizing);
    };
  }, [resize, stopResizing]);
  
  // Thinking Sidebar State
  const [isThinkingOpen, setIsThinkingOpen] = useState(false);
  const [activeThinkingSteps, setActiveThinkingSteps] = useState<any[]>([]);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  
  // Voice Input State
  const [isRecording, setIsRecording] = useState(false);
  const recognitionRef = useRef<any>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const toggleRecording = () => {
    if (isRecording) {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      setIsRecording(false);
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("您的浏览器不支持语音输入，请使用 Chrome 或 Edge。");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'zh-CN';
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onstart = () => {
      setIsRecording(true);
    };

    recognition.onend = () => {
      setIsRecording(false);
    };

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setInput(prev => prev + transcript);
    };
    
    recognition.onerror = (event: any) => {
      console.error("Speech recognition error", event.error);
      setIsRecording(false);
    };

    recognitionRef.current = recognition;
    recognition.start();
  };

  const handleNewChat = () => {
    setMessages([]);
    setInput('');
    setSelectedImage(null);
    setCurrentSessionId(null);
    setIsThinkingOpen(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const loadSession = (session: ChatSession) => {
    setMessages(session.messages);
    setCurrentSessionId(session.id);
    setIsThinkingOpen(false);
    // On mobile, close sidebar after selection
    if (window.innerWidth < 768) {
      setIsSidebarOpen(false);
    }
  };

  const handleProfileSubmit = async (data: any) => {
    setProfile(data);
    console.log("Profile updated:", data);
    // Simulate sending to backend
    try {
        console.log("Syncing profile to backend...");
    } catch (e) {
        console.error("Failed to sync profile", e);
    }
  };

  const openThinkingSidebar = (steps: any[]) => {
    setActiveThinkingSteps(steps);
    setIsThinkingOpen(true);
  };

  const handleSend = async () => {
    if (!input.trim() && !selectedImage) return;

    const newMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
    };

    if (selectedImage) {
      newMessage.attachments = [selectedImage];
    }

    // Update Messages State
    const updatedMessages = [...messages, newMessage];
    setMessages(updatedMessages);
    
    // Update Sessions State
    let activeSessionId = currentSessionId;
    if (!activeSessionId) {
      activeSessionId = Date.now().toString();
      setCurrentSessionId(activeSessionId);
      const newSession: ChatSession = {
        id: activeSessionId,
        title: input.slice(0, 20) || '新对话',
        date: '今天',
        messages: updatedMessages
      };
      setSessions(prev => [newSession, ...prev]);
    } else {
      setSessions(prev => prev.map(session => 
        session.id === activeSessionId 
          ? { ...session, messages: updatedMessages }
          : session
      ));
    }

    setInput('');
    setSelectedImage(null);
    setIsLoading(true);

    try {
      const formData = new FormData();
      if (fileInputRef.current?.files?.[0]) {
        formData.append('image', fileInputRef.current.files[0]);
      }
      formData.append('profile', JSON.stringify(profile));
      
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      if (user.learnerId) {
        formData.append('learnerId', user.learnerId);
      }

      formData.append('message', input);

      const response = await fetch('http://localhost:3001/api/analyze', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (data.success) {
        // Combine generated contents into a single message or use the first one
        const responseContent = data.data.contents && data.data.contents.length > 0 
            ? data.data.contents.join("\n\n---\n\n") 
            : "分析完成！我已经将结果同步到 Notion。";

        const assistantMessage: Message = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: responseContent,
          thinkingSteps: data.data.steps
        };
        
        setMessages(prev => {
            const newMessages = [...prev, assistantMessage];
            setSessions(prevSessions => prevSessions.map(session => 
                session.id === activeSessionId 
                  ? { ...session, messages: newMessages }
                  : session
            ));
            return newMessages;
        });
      }
    } catch (error) {
      console.error("Error:", error);
      setTimeout(() => {
          const mockSteps = [
              { title: "识别题目内容", status: "completed", duration: "2s", details: "OCR 识别完成，检测到一次函数相关题目。" },
              { title: "分析知识点", status: "completed", duration: "3s", details: "关联知识点：一次函数性质、图像变换。" },
              { title: "生成复盘建议", status: "completed", duration: "2s", details: "建议加强对斜率 k 和截距 b 的理解。" }
          ];
          
          const assistantMessage: Message = {
            id: (Date.now() + 1).toString(),
            role: 'assistant',
            content: "（演示模式）分析完成！这是基于你的错题生成的分析报告。",
            thinkingSteps: mockSteps
          };

          setMessages(prev => {
            const newMessages = [...prev, assistantMessage];
            setSessions(prevSessions => prevSessions.map(session => 
                session.id === activeSessionId 
                  ? { ...session, messages: newMessages }
                  : session
            ));
            return newMessages;
          });
          setIsLoading(false);
      }, 2000);
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const imageUrl = URL.createObjectURL(file);
      setSelectedImage(imageUrl);
      // Optional: Set default text if empty
      // setInput(prev => prev || "我上传了一张图片，请帮我分析。");
    }
  };

  const clearImage = () => {
    setSelectedImage(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex h-screen bg-white overflow-hidden font-sans">
      <ThinkingSidebar 
        isOpen={isThinkingOpen} 
        onClose={() => setIsThinkingOpen(false)} 
        steps={activeThinkingSteps} 
      />

      {/* Sidebar (Desktop) */}
      {isSidebarOpen && (
        <div 
          ref={sidebarRef}
          className="bg-gray-50 border-r border-gray-200 text-gray-900 flex flex-col hidden md:flex flex-shrink-0 relative group"
          style={{ width: sidebarWidth }}
        >
          <div className="p-4 flex items-center justify-between font-semibold text-gray-700">
             <div className="flex items-center gap-2">
               <BrainCircuit size={20} />
               <span>SophieSync</span>
             </div>
             <button 
               onClick={() => setIsSidebarOpen(false)}
               className="p-1.5 text-gray-500 hover:bg-gray-200 rounded-md transition-colors"
               title="收起侧边栏"
             >
               <PanelLeft size={20} />
             </button>
          </div>

          <div className="px-3 pb-2">
            <button 
              onClick={handleNewChat}
              className="w-full flex items-center gap-2 px-3 py-2 hover:bg-gray-200 rounded-lg transition-colors text-sm font-medium text-gray-700"
            >
              <Edit2 size={16} />
              新对话
            </button>
          </div>
          
          <div className="flex-1 overflow-y-auto px-2 py-2">
            <div className="px-2 py-2 text-xs font-medium text-gray-500">今天</div>
            {sessions.map(session => (
              <button 
                key={session.id}
                onClick={() => loadSession(session)}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm truncate transition-colors ${
                  currentSessionId === session.id 
                    ? 'bg-gray-200 text-gray-900 font-medium' 
                    : 'hover:bg-gray-200 text-gray-700'
                }`}
              >
                {session.title}
              </button>
            ))}
          </div>

          <div className="p-3 border-t border-gray-200">
            <button 
              onClick={() => setIsProfileOpen(true)}
              className="flex items-center gap-3 w-full px-2 py-3 hover:bg-gray-200 rounded-lg transition-colors"
            >
              <div className="w-8 h-8 bg-violet-100 text-violet-600 rounded-full flex items-center justify-center font-medium text-sm">
                S
              </div>
              <div className="text-sm font-medium text-gray-700">Sophie</div>
              <Settings size={16} className="ml-auto text-gray-400" />
            </button>
          </div>

          {/* Resizer Handle */}
          <div
            className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-violet-400 transition-colors z-50"
            onMouseDown={startResizing}
          />
        </div>
      )}

      {/* Main Content */}
      <div className={`flex-1 flex flex-col relative bg-white h-full transition-all duration-300 ease-in-out ${isThinkingOpen ? 'md:mr-[400px]' : ''}`}>
        {/* Mobile Header & Desktop Toggle */}
        <div className="h-14 border-b border-gray-200 flex items-center justify-between px-4 bg-white z-10 flex-shrink-0 md:border-none md:h-auto md:absolute md:top-4 md:left-4 md:w-auto md:bg-transparent">
          {/* Mobile Logo */}
          <span className="font-bold text-gray-800 md:hidden">SophieSync</span>
          
          {/* Desktop Toggle Button (Only visible when sidebar is closed) */}
          {!isSidebarOpen && (
            <button 
              onClick={() => setIsSidebarOpen(true)}
              className="hidden md:flex p-2 text-gray-500 hover:bg-gray-100 rounded-lg transition-colors border border-gray-200 bg-white shadow-sm"
              title="展开侧边栏"
            >
              <PanelLeft size={20} />
            </button>
          )}

          {/* Mobile Settings */}
          <button onClick={() => setIsProfileOpen(true)} className="md:hidden"><Settings size={20} className="text-gray-600" /></button>
        </div>

        {messages.length === 0 ? (
          /* Empty State / Landing View */
          <div className="flex-1 flex flex-col items-center justify-center p-4 md:p-8 overflow-y-auto">
            <div className="w-full max-w-3xl flex flex-col space-y-8 -mt-20">
              <h1 className="text-3xl md:text-4xl font-semibold text-gray-900 text-justify" style={{ textAlignLast: 'justify' }}>What would you like to learn today?</h1>
              
              {/* Action Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full">
                <button 
                  onClick={() => fileInputRef.current?.click()}
                  className="p-4 border border-gray-200 rounded-xl text-left hover:bg-gray-50 transition-all hover:shadow-sm group bg-white"
                >
                  <div className="flex items-center justify-between mb-3">
                    <UploadCloud className="text-green-600 group-hover:scale-110 transition-transform" size={24} />
                    <span className="text-[10px] bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">热门</span>
                  </div>
                  <div className="font-medium text-gray-900 mb-1">上传</div>
                  <div className="text-xs text-gray-500">图片</div>
                </button>

                <button className="p-4 border border-gray-200 rounded-xl text-left hover:bg-gray-50 transition-all hover:shadow-sm group bg-white">
                  <div className="flex items-center justify-between mb-3">
                    <FileText className="text-orange-500 group-hover:scale-110 transition-transform" size={24} />
                  </div>
                  <div className="font-medium text-gray-900 mb-1">粘贴</div>
                  <div className="text-xs text-gray-500">文本、代码、链接</div>
                </button>

                <button className="p-4 border border-gray-200 rounded-xl text-left hover:bg-gray-50 transition-all hover:shadow-sm group bg-white">
                  <div className="flex items-center justify-between mb-3">
                    <Mic className="text-blue-500 group-hover:scale-110 transition-transform" size={24} />
                  </div>
                  <div className="font-medium text-gray-900 mb-1">记录</div>
                  <div className="text-xs text-gray-500">录制课堂、语音笔记</div>
                </button>
              </div>

              {/* Input Area (Centered) */}
              <div className="w-full max-w-3xl relative">
                <div className="relative flex items-end gap-2 bg-[#f4f4f4] rounded-[26px] px-4 py-2 focus-within:ring-1 focus-within:ring-black/5 transition-all">
                  <button 
                    onClick={() => fileInputRef.current?.click()}
                    className="p-2 text-gray-900 hover:bg-gray-200 rounded-full transition-colors flex-shrink-0 mb-1"
                  >
                    <Plus size={24} strokeWidth={2} />
                  </button>
                  
                  <div className="flex-1 flex flex-col min-w-0">
                    {selectedImage && (
                      <div className="pt-2 pb-1">
                        <div className="relative inline-block group">
                          <img 
                            src={selectedImage} 
                            alt="preview" 
                            className="h-16 w-16 object-cover rounded-lg border border-gray-200 shadow-sm" 
                          />
                          <button 
                            onClick={clearImage}
                            className="absolute -top-1.5 -right-1.5 bg-gray-500 text-white rounded-full p-0.5 hover:bg-gray-700 opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
                          >
                            <X size={12} />
                          </button>
                        </div>
                      </div>
                    )}
                    <textarea
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder="询问任何问题"
                      className="w-full max-h-[200px] py-3 px-2 bg-transparent border-none focus:ring-0 outline-none resize-none text-gray-900 placeholder-gray-500 text-lg"
                      rows={1}
                      style={{ minHeight: '52px' }}
                    />
                  </div>
                  
                  <div className="flex items-center gap-2 pr-1 mb-1">
                    {!input.trim() && !selectedImage && (
                      <button 
                        onClick={toggleRecording}
                        className={`p-2 rounded-full transition-colors ${
                          isRecording 
                            ? 'bg-red-100 text-red-600 animate-pulse' 
                            : 'text-gray-900 hover:bg-gray-200'
                        }`}
                      >
                        <Mic size={24} />
                      </button>
                    )}
                    <button 
                      onClick={handleSend}
                      disabled={!input.trim() && !selectedImage}
                      className={`w-10 h-10 rounded-full flex items-center justify-center transition-all flex-shrink-0 ${
                        input.trim() || selectedImage
                          ? 'bg-black text-white hover:bg-gray-800' 
                          : 'bg-black text-white'
                      }`}
                    >
                      {input.trim() || selectedImage ? <ArrowUp size={20} /> : <AudioLines size={20} />}
                    </button>
                  </div>
                </div>
                <div className="text-center mt-3 text-xs text-gray-500">
                  SophieSync 可能也会犯错。请核查重要信息。
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* Chat Interface */
          <>
            <div className="flex-1 overflow-y-auto p-4 md:p-0 scroll-smooth">
              <div className="max-w-3xl mx-auto py-8 space-y-8 pb-32">
                {messages.map((msg) => (
                  <div key={msg.id} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                    
                    <div className={`max-w-[85%] ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                      {/* Thinking Process Indicator (Collapsed) */}
                      {msg.thinkingSteps && (
                        <div className="mb-2">
                          <button
                            onClick={() => openThinkingSidebar(msg.thinkingSteps!)}
                            className="flex items-center gap-2 text-xs text-gray-500 hover:text-black transition-colors bg-gray-50 px-3 py-1.5 rounded-full border border-gray-200 hover:border-gray-300 group"
                          >
                            <BrainCircuit size={12} className="text-gray-400 group-hover:text-black transition-colors" />
                            <span className="font-medium">已思考 7s</span>
                            <ChevronRight size={12} />
                          </button>
                        </div>
                      )}

                      <div className="prose prose-sm max-w-none">
                        {msg.attachments && msg.attachments.map((url, i) => (
                          <img key={i} src={url} alt="upload" className="max-w-xs rounded-lg mb-2 border border-gray-200" />
                        ))}
                        <div className={`py-2 px-4 rounded-2xl ${
                          msg.role === 'user' 
                            ? 'bg-[#f4f4f4] text-gray-900' 
                            : 'bg-transparent text-gray-900 px-0'
                        }`}>
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>
                            {msg.content}
                          </ReactMarkdown>
                        </div>
                        
                        {/* Action Buttons */}
                        <div className={`flex items-center gap-1 mt-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                          <button 
                            onClick={() => navigator.clipboard.writeText(msg.content)}
                            className="p-1.5 text-gray-400 hover:text-gray-900 transition-colors rounded-md hover:bg-gray-100"
                            title="复制"
                          >
                            <Copy size={16} />
                          </button>
                          
                          {msg.role === 'assistant' && (
                            <>
                              <button className="p-1.5 text-gray-400 hover:text-gray-900 transition-colors rounded-md hover:bg-gray-100" title="赞">
                                <ThumbsUp size={16} />
                              </button>
                              <button className="p-1.5 text-gray-400 hover:text-gray-900 transition-colors rounded-md hover:bg-gray-100" title="踩">
                                <ThumbsDown size={16} />
                              </button>
                              <button className="p-1.5 text-gray-400 hover:text-gray-900 transition-colors rounded-md hover:bg-gray-100" title="分享">
                                <Share size={16} />
                              </button>
                              <button className="p-1.5 text-gray-400 hover:text-gray-900 transition-colors rounded-md hover:bg-gray-100" title="重新生成">
                                <RotateCw size={16} />
                              </button>
                              
                              <div className="relative">
                                <button 
                                  onClick={() => setOpenMenuId(openMenuId === msg.id ? null : msg.id)}
                                  className="p-1.5 text-gray-400 hover:text-gray-900 transition-colors rounded-md hover:bg-gray-100"
                                  title="更多"
                                >
                                  <MoreHorizontal size={16} />
                                </button>
                                
                                {openMenuId === msg.id && (
                                  <div className="absolute left-0 top-full mt-1 w-48 bg-white border border-gray-200 rounded-xl shadow-lg z-10 py-1 overflow-hidden">
                                    <button className="w-full px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2">
                                      <GitBranch size={16} />
                                      <span>新聊天中的分支</span>
                                    </button>
                                    <button className="w-full px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2">
                                      <Volume2 size={16} />
                                      <span>朗读</span>
                                    </button>
                                    <button className="w-full px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2">
                                      <Flag size={16} />
                                      <span>举报消息</span>
                                    </button>
                                  </div>
                                )}
                              </div>
                            </>
                          )}

                          {msg.role === 'user' && (
                            <button 
                              onClick={() => setInput(msg.content)}
                              className="p-1.5 text-gray-400 hover:text-gray-900 transition-colors rounded-md hover:bg-gray-100"
                              title="编辑"
                            >
                              <Edit2 size={16} />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
                {isLoading && (
                  <div className="flex flex-col items-start animate-in fade-in duration-300">
                     <div className="flex items-center gap-3 px-4 py-3 bg-white border border-gray-100 rounded-2xl shadow-sm">
                        <div className="relative w-4 h-4 flex items-center justify-center">
                          <div className="absolute inset-0 bg-black rounded-full opacity-20 animate-ping" />
                          <div className="w-2.5 h-2.5 bg-black rounded-full" />
                        </div>
                        <span className="text-sm font-medium text-gray-600">思考中...</span>
                     </div>
                  </div>
                )}
              </div>
            </div>

            {/* Input Area (Bottom) */}
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-white via-white to-transparent pt-10 pb-6 px-4 md:px-0">
              <div className="max-w-3xl mx-auto relative">
                <div className="relative flex items-end gap-2 bg-[#f4f4f4] rounded-[26px] px-4 py-2 focus-within:ring-1 focus-within:ring-black/5 transition-all">
                  <button 
                    onClick={() => fileInputRef.current?.click()}
                    className="p-2 text-gray-900 hover:bg-gray-200 rounded-full transition-colors flex-shrink-0 mb-1"
                  >
                    <Plus size={24} strokeWidth={2} />
                  </button>
                  
                  <div className="flex-1 flex flex-col min-w-0">
                    {selectedImage && (
                      <div className="pt-2 pb-1">
                        <div className="relative inline-block group">
                          <img 
                            src={selectedImage} 
                            alt="preview" 
                            className="h-16 w-16 object-cover rounded-lg border border-gray-200 shadow-sm" 
                          />
                          <button 
                            onClick={clearImage}
                            className="absolute -top-1.5 -right-1.5 bg-gray-500 text-white rounded-full p-0.5 hover:bg-gray-700 opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
                          >
                            <X size={12} />
                          </button>
                        </div>
                      </div>
                    )}
                    <textarea
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder="发送消息..."
                      className="w-full max-h-[200px] py-3 px-2 bg-transparent border-none focus:ring-0 outline-none resize-none text-gray-900 placeholder-gray-400"
                      rows={1}
                      style={{ minHeight: '52px' }}
                    />
                  </div>
                  
                  <button 
                    onClick={handleSend}
                    disabled={!input.trim() && !selectedImage}
                    className={`p-2 rounded-xl transition-all flex-shrink-0 self-end mb-1 ${
                      input.trim() || selectedImage
                        ? 'bg-black text-white hover:bg-gray-800' 
                        : 'bg-gray-100 text-gray-300 cursor-not-allowed'
                    }`}
                  >
                    <Send size={20} />
                  </button>
                </div>
                <div className="text-center mt-2 text-xs text-gray-400">
                  Sophie 可能也会犯错。请核查重要信息。
                </div>
              </div>
            </div>
          </>
        )}

        <input 
          type="file" 
          ref={fileInputRef} 
          className="hidden" 
          accept="image/*"
          onChange={handleFileSelect}
        />
      </div>

      <ProfileModal 
        isOpen={isProfileOpen} 
        onClose={() => setIsProfileOpen(false)} 
        onSubmit={handleProfileSubmit}
        initialData={profile}
        mode="modal"
      />
    </div>
  );
};

export default ChatPage;