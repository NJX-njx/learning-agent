import React, { useState, useRef, useEffect } from 'react';
import { Send, Paperclip, Image as ImageIcon, Settings, Plus, MessageSquare, User, BrainCircuit, ChevronRight, UploadCloud, FileText, Mic } from 'lucide-react';
import ProfileModal from '../components/ProfileModal';
import ThinkingSidebar from '../components/ThinkingSidebar';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  attachments?: string[];
  thinkingSteps?: any[];
}

const ChatPage: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [profile, setProfile] = useState<any>({
    competencyLevel: '中等',
    learningGoal: '',
    preferredStyle: '讲解+计划'
  });
  const [isLoading, setIsLoading] = useState(false);
  
  // Thinking Sidebar State
  const [isThinkingOpen, setIsThinkingOpen] = useState(false);
  const [activeThinkingSteps, setActiveThinkingSteps] = useState<any[]>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);

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
    if (!input.trim() && !fileInputRef.current?.files?.length) return;

    const newMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
    };

    const file = fileInputRef.current?.files?.[0];
    if (file) {
      newMessage.attachments = [URL.createObjectURL(file)];
    }

    setMessages(prev => [...prev, newMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const formData = new FormData();
      if (file) formData.append('image', file);
      formData.append('profile', JSON.stringify(profile));
      formData.append('message', input);

      const response = await fetch('http://localhost:3001/api/analyze', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (data.success) {
        const assistantMessage: Message = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: "分析完成！我已经将结果同步到 Notion。以下是详细的分析报告...",
          thinkingSteps: data.data.steps
        };
        setMessages(prev => [...prev, assistantMessage]);
      }
    } catch (error) {
      console.error("Error:", error);
      setTimeout(() => {
          const mockSteps = [
              { title: "识别题目内容", status: "completed", duration: "2s", details: "OCR 识别完成，检测到一次函数相关题目。" },
              { title: "分析知识点", status: "completed", duration: "3s", details: "关联知识点：一次函数性质、图像变换。" },
              { title: "生成复盘建议", status: "completed", duration: "2s", details: "建议加强对斜率 k 和截距 b 的理解。" }
          ];
          setMessages(prev => [...prev, {
            id: (Date.now() + 1).toString(),
            role: 'assistant',
            content: "（演示模式）分析完成！这是基于你的错题生成的分析报告。",
            thinkingSteps: mockSteps
          }]);
          setIsLoading(false);
      }, 2000);
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
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
      <div className="w-[260px] bg-black text-gray-100 flex flex-col hidden md:flex flex-shrink-0">
        <div className="p-3">
          <button 
            onClick={() => { setMessages([]); setInput(''); }}
            className="w-full flex items-center gap-2 px-3 py-3 bg-gray-900 hover:bg-gray-800 border border-gray-700 rounded-lg transition-colors text-sm font-medium text-white shadow-sm"
          >
            <Plus size={16} />
            新对话
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto px-2 py-2">
          <div className="px-2 py-2 text-xs font-medium text-gray-500">今天</div>
          <button className="w-full text-left px-3 py-2 rounded-lg hover:bg-gray-900 text-sm text-gray-300 truncate transition-colors">
            一次函数错题分析
          </button>
        </div>

        <div className="p-3 border-t border-gray-800">
          <button 
            onClick={() => setIsProfileOpen(true)}
            className="flex items-center gap-3 w-full px-2 py-3 hover:bg-gray-900 rounded-lg transition-colors"
          >
            <div className="w-8 h-8 bg-violet-600 rounded-full flex items-center justify-center text-white font-medium text-sm">
              S
            </div>
            <div className="text-sm font-medium text-gray-200">Sophie</div>
            <Settings size={16} className="ml-auto text-gray-500" />
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className={`flex-1 flex flex-col relative bg-white h-full transition-all duration-300 ease-in-out ${isThinkingOpen ? 'md:mr-[400px]' : ''}`}>
        {/* Mobile Header */}
        <div className="md:hidden h-14 border-b border-gray-200 flex items-center justify-between px-4 bg-white z-10 flex-shrink-0">
          <span className="font-bold text-gray-800">SophieSync</span>
          <button onClick={() => setIsProfileOpen(true)}><Settings size={20} className="text-gray-600" /></button>
        </div>

        {messages.length === 0 ? (
          /* Empty State / Landing View */
          <div className="flex-1 flex flex-col items-center justify-center p-4 md:p-8 overflow-y-auto">
            <div className="w-full max-w-3xl flex flex-col items-center space-y-8 -mt-20">
              <h1 className="text-3xl md:text-4xl font-semibold text-gray-900">今天想学什么？</h1>
              
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
                  <div className="text-xs text-gray-500">文件、音频、视频</div>
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
              <div className="w-full relative">
                <div className="relative flex items-end gap-2 bg-white border border-gray-200 rounded-2xl shadow-lg focus-within:ring-1 focus-within:ring-black/10 focus-within:border-gray-300 transition-all overflow-hidden p-2">
                  <button 
                    onClick={() => fileInputRef.current?.click()}
                    className="p-3 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition-colors flex-shrink-0"
                  >
                    <Plus size={24} />
                  </button>
                  
                  <textarea
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="学习任何东西..."
                    className="w-full max-h-[200px] py-3 px-2 bg-transparent border-none focus:ring-0 resize-none text-gray-900 placeholder-gray-400 text-lg"
                    rows={1}
                    style={{ minHeight: '52px' }}
                  />
                  
                  <button 
                    onClick={handleSend}
                    disabled={!input.trim() && !fileInputRef.current?.files?.length}
                    className={`p-2 rounded-xl transition-all flex-shrink-0 self-end mb-1 ${
                      input.trim() || fileInputRef.current?.files?.length
                        ? 'bg-black text-white hover:bg-gray-800' 
                        : 'bg-gray-100 text-gray-300 cursor-not-allowed'
                    }`}
                  >
                    <Send size={20} />
                  </button>
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
                  <div key={msg.id} className={`flex gap-4 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                    <div className={`w-8 h-8 rounded-sm flex items-center justify-center flex-shrink-0 ${
                      msg.role === 'assistant' ? 'bg-green-500' : 'bg-gray-200'
                    }`}>
                      {msg.role === 'assistant' ? <BrainCircuit size={18} className="text-white" /> : <User size={18} className="text-gray-600" />}
                    </div>
                    
                    <div className={`flex flex-col max-w-[85%] ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                      {msg.role === 'assistant' && (
                        <span className="text-xs font-bold text-gray-800 mb-1 ml-1">Sophie</span>
                      )}
                      <div className="prose prose-sm max-w-none">
                        {msg.attachments && msg.attachments.map((url, i) => (
                          <img key={i} src={url} alt="upload" className="max-w-xs rounded-lg mb-2 border border-gray-200" />
                        ))}
                        <div className={`py-1 ${
                          msg.role === 'user' 
                            ? 'bg-gray-100 text-gray-900 px-4 py-3 rounded-2xl rounded-tr-none' 
                            : 'bg-transparent text-gray-900 px-0'
                        }`}>
                          {msg.content}
                        </div>
                      </div>
                      
                      {msg.thinkingSteps && (
                        <button
                          onClick={() => openThinkingSidebar(msg.thinkingSteps!)}
                          className="mt-2 flex items-center gap-2 text-xs text-gray-500 hover:text-violet-600 transition-colors bg-gray-50 px-3 py-2 rounded-lg border border-gray-100 hover:border-violet-200 group"
                        >
                          <BrainCircuit size={14} className="text-violet-500 group-hover:scale-110 transition-transform" />
                          <span className="font-medium">已思考 7s</span>
                          <ChevronRight size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
                {isLoading && (
                  <div className="flex gap-4">
                     <div className="w-8 h-8 rounded-sm bg-green-500 flex items-center justify-center flex-shrink-0">
                        <BrainCircuit size={18} className="text-white" />
                     </div>
                     <div className="flex items-center gap-2 text-gray-500 text-sm mt-2">
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" />
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-75" />
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-150" />
                     </div>
                  </div>
                )}
              </div>
            </div>

            {/* Input Area (Bottom) */}
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-white via-white to-transparent pt-10 pb-6 px-4 md:px-0">
              <div className="max-w-3xl mx-auto relative">
                <div className="relative flex items-end gap-2 bg-white border border-gray-200 rounded-2xl shadow-lg focus-within:ring-1 focus-within:ring-black/10 focus-within:border-gray-300 transition-all overflow-hidden p-2">
                  <button 
                    onClick={() => fileInputRef.current?.click()}
                    className="p-3 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition-colors flex-shrink-0"
                  >
                    <Plus size={24} />
                  </button>
                  
                  <textarea
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="发送消息..."
                    className="w-full max-h-[200px] py-3 px-2 bg-transparent border-none focus:ring-0 resize-none text-gray-900 placeholder-gray-400"
                    rows={1}
                    style={{ minHeight: '52px' }}
                  />
                  
                  <button 
                    onClick={handleSend}
                    disabled={!input.trim() && !fileInputRef.current?.files?.length}
                    className={`p-2 rounded-xl transition-all flex-shrink-0 self-end mb-1 ${
                      input.trim() || fileInputRef.current?.files?.length
                        ? 'bg-black text-white hover:bg-gray-800' 
                        : 'bg-gray-100 text-gray-300 cursor-not-allowed'
                    }`}
                  >
                    <Send size={20} />
                  </button>
                </div>
                <div className="text-center mt-2 text-xs text-gray-400">
                  SophieSync 可能也会犯错。请核查重要信息。
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
          onChange={(e) => {
            if (e.target.files?.length) {
               setInput(prev => prev || "我上传了一张图片，请帮我分析。");
            }
          }}
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