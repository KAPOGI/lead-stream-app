import React, { useState, useEffect } from 'react';
import { 
  MessageSquare, 
  ThumbsUp, 
  Settings, 
  ExternalLink, 
  Copy, 
  CheckCircle2, 
  RefreshCw,
  Flame,
  Sparkles,
  ChevronRight
} from 'lucide-react';

// --- INTERFACES ---

interface Comment {
  id: string;
  authorDisplayName: string;
  textDisplay: string;
  videoTitle: string;
  publishedAt: string;
  isLead: boolean;
  analysis: string;
  suggestedReply: string;
  replied: boolean;
  thumbnail: string;
}

interface AIAnalysisResult {
  isLead: boolean;
  reason: string;
  reply: string;
}

// --- COMPONENTS ---

const Card = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
  <div className={`bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden ${className}`}>
    {children}
  </div>
);

const Badge = ({ type }: { type: 'lead' | 'general' }) => {
  if (type === 'lead') {
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800 border border-orange-200">
        <Flame className="w-3 h-3 mr-1" />
        Potential Lead
      </span>
    );
  }
  return (
    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600 border border-gray-200">
      <ThumbsUp className="w-3 h-3 mr-1" />
      General
    </span>
  );
};

// --- MOCK DATA FOR DEMO MODE ---

const MOCK_COMMENTS: Comment[] = [
  {
    id: 'c1',
    authorDisplayName: 'Sarah Jenkins',
    textDisplay: 'Great video! I am actually looking to move to the area next month. Do you have a list of recommended buyer agents?',
    videoTitle: 'Top 5 Neighborhoods in 2024',
    publishedAt: new Date().toISOString(),
    isLead: true,
    analysis: "User explicitly states intent to move and asks for agent recommendations.",
    suggestedReply: "Hi Sarah! Thanks for watching. I'd love to help you find the perfect spot. I have a trusted list of agents I work with. Could you email me at [Email] or DM me on Instagram so I can send that over?",
    replied: false,
    thumbnail: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Sarah'
  },
  {
    id: 'c2',
    authorDisplayName: 'Mike_Gaming_99',
    textDisplay: 'First!! Love the editing on this one.',
    videoTitle: 'House Tour: $2M Modern Farmhouse',
    publishedAt: new Date(Date.now() - 86400000).toISOString(),
    isLead: false,
    analysis: "General compliment about video editing.",
    suggestedReply: "Thanks Mike! Appreciate the support.",
    replied: true,
    thumbnail: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Mike'
  },
  {
    id: 'c3',
    authorDisplayName: 'InvestWithTom',
    textDisplay: 'What is the cap rate you usually see for duplexes in this zip code? Im looking to invest around $500k.',
    videoTitle: 'Investment Property Guide',
    publishedAt: new Date(Date.now() - 172800000).toISOString(),
    isLead: true,
    analysis: "User is an investor asking for specific financial metrics (cap rate) with a budget.",
    suggestedReply: "Great question Tom. In this zip, we're seeing around 5-6% for turnkey duplexes. I have a spreadsheet of recent comps. Shoot me an email and we can discuss your $500k target specifically.",
    replied: false,
    thumbnail: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Tom'
  }
];

// --- MAIN APPLICATION ---

export default function App() {
  // State
  const [activeTab, setActiveTab] = useState<'inbox' | 'replied' | 'settings'>('inbox');
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedComment, setSelectedComment] = useState<Comment | null>(null);
  const [filter, setFilter] = useState<'all' | 'leads'>('all');
  
  // Settings State
  const [apiKeyYoutube, setApiKeyYoutube] = useState('');
  const [apiKeyGemini, setApiKeyGemini] = useState('');
  const [channelId, setChannelId] = useState('');
  const [isDemoMode, setIsDemoMode] = useState(true);

  // Load settings on mount
  useEffect(() => {
    const storedYtKey = localStorage.getItem('leadstream_yt_key');
    const storedGemKey = localStorage.getItem('leadstream_gem_key');
    const storedChannel = localStorage.getItem('leadstream_channel');
    
    if (storedYtKey) setApiKeyYoutube(storedYtKey);
    if (storedGemKey) setApiKeyGemini(storedGemKey);
    if (storedChannel) setChannelId(storedChannel);
    
    // Initial load
    loadComments(true); 
  }, []);

  // --- ACTIONS ---

  const loadComments = async (useMock = false) => {
    setLoading(true);
    try {
      if (useMock || isDemoMode) {
        // Simulate network delay
        await new Promise(r => setTimeout(r, 800));
        setComments(MOCK_COMMENTS);
      } else {
        if (!apiKeyYoutube || !channelId) {
          alert("Please configure API Keys in settings first.");
          setActiveTab('settings');
          setLoading(false);
          return;
        }
        await fetchRealComments();
      }
    } catch (error) {
      console.error(error);
      alert("Error loading comments. Check your console or API keys.");
    } finally {
      setLoading(false);
    }
  };

  const fetchRealComments = async () => {
    const endpoint = `https://www.googleapis.com/youtube/v3/commentThreads?part=snippet&allThreadsRelatedToChannelId=${channelId}&maxResults=10&key=${apiKeyYoutube}`;
    
    const response = await fetch(endpoint);
    const data = await response.json();
    
    if (data.error) throw new Error(data.error.message);

    const processed = await Promise.all(data.items.map(async (item: any) => {
      const snippet = item.snippet.topLevelComment.snippet;
      const isLead = await analyzeWithAI(snippet.textDisplay);
      
      return {
        id: item.id,
        authorDisplayName: snippet.authorDisplayName,
        textDisplay: snippet.textDisplay,
        videoTitle: "Unknown Video (API Limitation)", 
        publishedAt: snippet.publishedAt,
        isLead: isLead.isLead,
        analysis: isLead.reason,
        suggestedReply: isLead.reply,
        replied: false,
        thumbnail: snippet.authorProfileImageUrl
      } as Comment;
    }));

    setComments(processed);
  };

  const analyzeWithAI = async (text: string): Promise<AIAnalysisResult> => {
    if (!apiKeyGemini) return { isLead: false, reason: "No AI Key", reply: "Thanks!" };
    
    // Simple keyword heuristic for 'Real' mode without burning tokens in this demo
    const lower = text.toLowerCase();
    const isLead = lower.includes('buy') || lower.includes('sell') || lower.includes('help') || lower.includes('contact');
    return {
      isLead,
      reason: isLead ? "Detected intent keywords." : "General comment.",
      reply: "Thank you for watching! Let me know if you have questions."
    };
  };

  const handleSaveSettings = () => {
    localStorage.setItem('leadstream_yt_key', apiKeyYoutube);
    localStorage.setItem('leadstream_gem_key', apiKeyGemini);
    localStorage.setItem('leadstream_channel', channelId);
    setIsDemoMode(false);
    alert("Settings Saved! Switching to Live Mode.");
    setActiveTab('inbox');
  };

  const toggleReplyStatus = (id: string) => {
    setComments(comments.map(c => c.id === id ? { ...c, replied: !c.replied } : c));
    if (selectedComment?.id === id) {
      setSelectedComment(prev => prev ? ({ ...prev, replied: !prev.replied }) : null);
    }
  };

  // --- RENDER HELPERS ---

  const filteredComments = comments.filter(c => {
    if (activeTab === 'replied') return c.replied;
    if (activeTab === 'inbox') return !c.replied;
    return true;
  }).filter(c => {
    if (filter === 'leads') return c.isLead;
    return true;
  });

  const leadsCount = comments.filter(c => c.isLead && !c.replied).length;

  // --- VIEWS ---

  if (selectedComment) {
    return (
      <div className="bg-gray-50 min-h-screen flex flex-col pb-6 animate-in slide-in-from-right duration-300">
        {/* Header */}
        <div className="bg-white border-b border-gray-200 px-4 py-4 sticky top-0 z-10 flex items-center gap-3">
          <button 
            onClick={() => setSelectedComment(null)}
            className="p-2 -ml-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <ChevronRight className="w-6 h-6 text-gray-500 rotate-180" />
          </button>
          <h1 className="font-semibold text-lg">Analysis</h1>
        </div>

        <div className="p-4 space-y-6">
          {/* Video Context */}
          <div className="flex items-center gap-3 text-sm text-gray-500 mb-2">
            <span className="bg-red-100 text-red-600 px-2 py-1 rounded text-xs font-bold">YOUTUBE</span>
            <span className="truncate">{selectedComment.videoTitle}</span>
          </div>

          {/* The Comment */}
          <Card className="p-5">
            <div className="flex items-start gap-4">
              <img 
                src={selectedComment.thumbnail} 
                className="w-10 h-10 rounded-full bg-gray-200 object-cover" 
                alt="User" 
              />
              <div className="flex-1">
                <h3 className="font-medium text-gray-900">{selectedComment.authorDisplayName}</h3>
                <p className="text-xs text-gray-400 mt-0.5">{new Date(selectedComment.publishedAt).toLocaleDateString()}</p>
                <p className="mt-3 text-gray-800 text-base leading-relaxed">
                  {selectedComment.textDisplay}
                </p>
              </div>
            </div>
          </Card>

          {/* AI Analysis */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-indigo-600" />
              <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider">AI Insight</h3>
            </div>
            <Card className="p-4 border-indigo-100 bg-indigo-50/50">
              <div className="flex justify-between items-start mb-2">
                <Badge type={selectedComment.isLead ? 'lead' : 'general'} />
              </div>
              <p className="text-sm text-gray-700 leading-relaxed">
                {selectedComment.analysis}
              </p>
            </Card>
          </div>

          {/* Smart Reply */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-green-600" />
              <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider">Draft Reply</h3>
            </div>
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-1">
              <textarea 
                className="w-full p-3 text-gray-800 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-green-500/20 text-base"
                rows={4}
                defaultValue={selectedComment.suggestedReply}
              />
              <div className="flex gap-2 p-2 border-t border-gray-100">
                <button 
                  onClick={() => {
                    navigator.clipboard.writeText(selectedComment.suggestedReply);
                    alert("Reply copied to clipboard!");
                  }}
                  className="flex-1 flex items-center justify-center gap-2 bg-gray-100 active:bg-gray-200 text-gray-700 py-3 rounded-xl font-medium transition-all"
                >
                  <Copy className="w-4 h-4" />
                  Copy
                </button>
                <button 
                  className="flex-1 flex items-center justify-center gap-2 bg-gray-900 active:bg-gray-800 text-white py-3 rounded-xl font-medium shadow-lg shadow-gray-200 transition-all"
                  onClick={() => {
                    // In a real app, this would deep link to the comment
                    alert("Opening YouTube...");
                  }}
                >
                  <ExternalLink className="w-4 h-4" />
                  Reply on YT
                </button>
              </div>
            </div>
          </div>

          {/* Actions */}
          <button 
            onClick={() => {
              toggleReplyStatus(selectedComment.id);
              setSelectedComment(null);
            }}
            className={`w-full py-4 rounded-xl font-semibold flex items-center justify-center gap-2 transition-all ${
              selectedComment.replied 
                ? 'bg-gray-200 text-gray-600' 
                : 'bg-green-600 text-white shadow-lg shadow-green-200'
            }`}
          >
            {selectedComment.replied ? (
              <>Mark as Unread</>
            ) : (
              <>
                <CheckCircle2 className="w-5 h-5" />
                Mark as Done
              </>
            )}
          </button>

        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-50 min-h-screen flex flex-col font-sans">
      {/* Top Nav */}
      <div className="bg-white px-4 pt-12 pb-4 border-b border-gray-200 sticky top-0 z-20">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">LeadStream</h1>
            <p className="text-xs text-gray-500 font-medium">
              {isDemoMode ? 'Demo Mode' : 'Connected to Live API'}
            </p>
          </div>
          <button 
            onClick={() => setActiveTab('settings')}
            className="p-2 bg-gray-100 rounded-full text-gray-600 hover:bg-gray-200 transition-colors"
          >
            <Settings className="w-5 h-5" />
          </button>
        </div>

        {/* Filters */}
        {activeTab !== 'settings' && (
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
            <button 
              onClick={() => setFilter('all')}
              className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all ${filter === 'all' ? 'bg-gray-900 text-white shadow-md' : 'bg-white border border-gray-200 text-gray-600'}`}
            >
              All Comments
            </button>
            <button 
              onClick={() => setFilter('leads')}
              className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap flex items-center gap-2 transition-all ${filter === 'leads' ? 'bg-orange-500 text-white shadow-md' : 'bg-white border border-gray-200 text-gray-600'}`}
            >
              <Flame className="w-3 h-3" />
              Leads Only ({leadsCount})
            </button>
            <div className="flex-1"></div>
            <button 
              onClick={() => loadComments(isDemoMode)}
              className="p-2 bg-white border border-gray-200 rounded-full text-gray-600 active:scale-95 transition-transform"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        )}
      </div>

      {/* Main Content */}
      <div className="flex-1 p-4 overflow-y-auto">
        
        {activeTab === 'settings' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <Card className="p-6">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Settings className="w-5 h-5 text-gray-700" />
                App Configuration
              </h2>
              
              <div className="space-y-4">
                <div className="p-3 bg-blue-50 text-blue-800 rounded-lg text-sm">
                  <p className="font-semibold mb-1">How to get keys:</p>
                  <ul className="list-disc list-inside space-y-1 opacity-80">
                    <li>Google Cloud Console for YouTube Data API v3</li>
                    <li>Google AI Studio for Gemini API Key</li>
                  </ul>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">YouTube Channel ID</label>
                  <input 
                    type="text" 
                    className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                    placeholder="UC_x5..."
                    value={channelId}
                    onChange={(e) => setChannelId(e.target.value)}
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">YouTube API Key</label>
                  <input 
                    type="password" 
                    className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                    placeholder="AIza..."
                    value={apiKeyYoutube}
                    onChange={(e) => setApiKeyYoutube(e.target.value)}
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Gemini AI API Key</label>
                  <input 
                    type="password" 
                    className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                    placeholder="AIza..."
                    value={apiKeyGemini}
                    onChange={(e) => setApiKeyGemini(e.target.value)}
                  />
                </div>

                <div className="flex items-center gap-3 pt-2">
                  <button 
                    onClick={handleSaveSettings}
                    className="flex-1 bg-gray-900 text-white py-3 rounded-xl font-semibold shadow-lg shadow-gray-200 active:scale-95 transition-all"
                  >
                    Save & Connect
                  </button>
                  <button 
                    onClick={() => {
                      setIsDemoMode(true);
                      setActiveTab('inbox');
                      loadComments(true);
                    }}
                    className="flex-1 bg-white border border-gray-200 text-gray-700 py-3 rounded-xl font-semibold active:scale-95 transition-all"
                  >
                    Use Demo Mode
                  </button>
                </div>
              </div>
            </Card>
            
            <div className="text-center text-xs text-gray-400 pb-8">
              LeadStream v1.0 • Runs entirely in browser
            </div>
          </div>
        )}

        {activeTab !== 'settings' && (
          <div className="space-y-4">
            {filteredComments.length === 0 && !loading && (
              <div className="text-center py-12">
                <div className="bg-gray-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircle2 className="w-8 h-8 text-gray-400" />
                </div>
                <h3 className="text-gray-900 font-medium">All caught up!</h3>
                <p className="text-gray-500 text-sm mt-1">No comments match your current filter.</p>
              </div>
            )}

            {filteredComments.map((comment) => (
              <div 
                key={comment.id}
                onClick={() => setSelectedComment(comment)}
                className="group active:scale-[0.98] transition-transform duration-200 ease-out cursor-pointer"
              >
                <Card className={`p-4 relative ${comment.isLead ? 'border-l-4 border-l-orange-500' : ''}`}>
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex items-center gap-2">
                      <img 
                        src={comment.thumbnail} 
                        alt="" 
                        className="w-6 h-6 rounded-full bg-gray-100"
                      />
                      <span className="text-xs font-bold text-gray-700">{comment.authorDisplayName}</span>
                    </div>
                    <Badge type={comment.isLead ? 'lead' : 'general'} />
                  </div>
                  
                  <p className="text-gray-800 text-sm line-clamp-2 leading-relaxed mb-3">
                    {comment.textDisplay}
                  </p>
                  
                  <div className="flex items-center justify-between text-xs text-gray-400 border-t border-gray-50 pt-3">
                    <span className="truncate max-w-[60%]">{comment.videoTitle}</span>
                    <div className="flex items-center gap-1 text-indigo-600 font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                      Analyze <ChevronRight className="w-3 h-3" />
                    </div>
                  </div>
                </Card>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Bottom Tab Bar */}
      {activeTab !== 'settings' && !selectedComment && (
        <div className="bg-white border-t border-gray-200 px-6 py-3 pb-6 flex justify-between items-center sticky bottom-0">
          <button 
            onClick={() => setActiveTab('inbox')}
            className={`flex flex-col items-center gap-1 ${activeTab === 'inbox' ? 'text-gray-900' : 'text-gray-400'}`}
          >
            <MessageSquare className="w-6 h-6" fill={activeTab === 'inbox' ? "currentColor" : "none"} />
            <span className="text-[10px] font-medium">New</span>
          </button>
          
          <div className="w-px h-8 bg-gray-100"></div>
          
          <button 
            onClick={() => setActiveTab('replied')}
            className={`flex flex-col items-center gap-1 ${activeTab === 'replied' ? 'text-gray-900' : 'text-gray-400'}`}
          >
            <CheckCircle2 className="w-6 h-6" fill={activeTab === 'replied' ? "currentColor" : "none"} />
            <span className="text-[10px] font-medium">Completed</span>
          </button>
        </div>
      )}
    </div>
  );
}
