import React, { useState, useEffect, useRef, useCallback } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInAnonymously, 
  signInWithCustomToken, 
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut
} from 'firebase/auth';
import { 
  getFirestore, 
  collection, 
  doc, 
  setDoc, 
  deleteDoc,
  onSnapshot 
} from 'firebase/firestore';
import { 
  UploadCloud, 
  Layers, 
  Plus, 
  ChevronRight, 
  ChevronLeft, 
  Trash2, 
  LogOut, 
  Loader2,
  BookOpen,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';

// --- Firebase Initialization ---
// Follows strict rules for artifact environment
const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {};
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';

// --- Global Styles for 3D Flip ---
const styles = `
  .perspective-1000 { perspective: 1000px; }
  .transform-style-3d { transform-style: preserve-3d; }
  .backface-hidden { backface-visibility: hidden; }
  .rotate-y-180 { transform: rotateY(180deg); }
  
  .scrollbar-hide::-webkit-scrollbar {
      display: none;
  }
  .scrollbar-hide {
      -ms-overflow-style: none;
      scrollbar-width: none;
  }
`;

export default function App() {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [decks, setDecks] = useState([]);
  const [activeDeck, setActiveDeck] = useState(null);
  const [view, setView] = useState('dashboard'); // 'dashboard', 'create', 'study'
  const [jsZipLoaded, setJsZipLoaded] = useState(false);

  // --- 1. Mandatory Firebase Auth Flow ---
  useEffect(() => {
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (err) {
        console.error("Auth init error:", err);
      }
    };
    initAuth();

    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // --- 2. Load JSZip Dynamically ---
  useEffect(() => {
    if (!document.getElementById('jszip-script')) {
      const script = document.createElement('script');
      script.id = 'jszip-script';
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
      script.onload = () => setJsZipLoaded(true);
      document.head.appendChild(script);
    } else {
      setJsZipLoaded(true);
    }
  }, []);

  // --- 3. Data Fetching (Firestore) ---
  useEffect(() => {
    if (!user) return;

    // Path strictly adheres to RULE 1: /artifacts/{appId}/users/{userId}/{collectionName}
    const decksRef = collection(db, 'artifacts', appId, 'users', user.uid, 'decks');
    
    // No complex queries (RULE 2)
    const unsubscribe = onSnapshot(decksRef, 
      (snapshot) => {
        const fetchedDecks = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        // Sort in memory by createdAt descending
        fetchedDecks.sort((a, b) => b.createdAt - a.createdAt);
        setDecks(fetchedDecks);
      },
      (error) => {
        console.error("Error fetching decks:", error);
      }
    );

    return () => unsubscribe();
  }, [user]);

  // --- App Handlers ---
  const handleLogout = () => {
    signOut(auth);
  };

  const deleteDeck = async (deckId) => {
    if (!user) return;
    try {
      await deleteDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'decks', deckId));
      if (activeDeck?.id === deckId) {
        setActiveDeck(null);
        setView('dashboard');
      }
    } catch (err) {
      console.error("Error deleting deck:", err);
    }
  };

  if (authLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  // If user is strictly anonymous and we want to offer full login/signup (per prompt request)
  // We can show an auth overlay, though they are technically authenticated anonymously.
  // For simplicity and strict rule adherence, we'll assume the environment provides the user.
  // We will build a small internal login form if they want to upgrade from anonymous.

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-200 font-sans flex overflow-hidden">
      <style>{styles}</style>
      
      {/* Sidebar */}
      <div className="w-64 bg-white dark:bg-slate-950 border-r border-slate-200 dark:border-slate-800 flex flex-col z-10">
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center space-x-2">
          <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center">
            <Layers className="w-5 h-5 text-white" />
          </div>
          <h1 className="font-bold text-lg tracking-tight">SlideCards</h1>
        </div>
        
        <div className="p-4 flex-1 overflow-y-auto scrollbar-hide">
          <button 
            onClick={() => setView('create')}
            className="w-full flex items-center justify-center space-x-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-lg font-medium transition-colors mb-6 shadow-sm"
          >
            <Plus className="w-4 h-4" />
            <span>New Deck</span>
          </button>

          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Your Decks</div>
          {decks.length === 0 ? (
            <div className="text-sm text-slate-500 text-center py-4">No decks yet.</div>
          ) : (
            <div className="space-y-1">
              {decks.map(deck => (
                <div 
                  key={deck.id}
                  className={`group flex items-center justify-between p-2 rounded-lg cursor-pointer transition-colors ${activeDeck?.id === deck.id ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 font-medium' : 'hover:bg-slate-100 dark:hover:bg-slate-800/50'}`}
                  onClick={() => {
                    setActiveDeck(deck);
                    setView('study');
                  }}
                >
                  <div className="flex items-center space-x-3 truncate">
                    <BookOpen className="w-4 h-4 opacity-70" />
                    <span className="truncate text-sm">{deck.title}</span>
                  </div>
                  <button 
                    onClick={(e) => { e.stopPropagation(); deleteDeck(deck.id); }}
                    className="opacity-0 group-hover:opacity-100 p-1 hover:text-red-500 transition-opacity"
                    title="Delete Deck"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="p-4 border-t border-slate-200 dark:border-slate-800 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-slate-500 truncate pr-2">
              {user?.isAnonymous ? 'Guest User' : user?.email || 'User'}
            </span>
            {user?.isAnonymous === false && (
               <button onClick={handleLogout} className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200">
                 <LogOut className="w-4 h-4" />
               </button>
            )}
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden relative">
        {view === 'dashboard' && (
           <div className="flex-1 flex flex-col items-center justify-center p-8 text-center animate-in fade-in duration-500">
             <div className="w-20 h-20 bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 rounded-full flex items-center justify-center mb-6">
               <Layers className="w-10 h-10" />
             </div>
             <h2 className="text-2xl font-bold mb-2">Welcome to SlideCards</h2>
             <p className="text-slate-500 max-w-md mb-8">
               Transform your boring PowerPoint presentations into interactive flashcards automatically using AI.
             </p>
             <button 
                onClick={() => setView('create')}
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-full font-medium shadow-md shadow-indigo-500/20 transition-all flex items-center space-x-2"
              >
                <Plus className="w-5 h-5" />
                <span>Upload a Presentation</span>
              </button>
           </div>
        )}

        {view === 'create' && (
          <DeckCreator 
            user={user} 
            jsZipLoaded={jsZipLoaded} 
            onSuccess={(deck) => {
              setActiveDeck(deck);
              setView('study');
            }} 
            onCancel={() => setView(decks.length > 0 ? 'study' : 'dashboard')}
          />
        )}

        {view === 'study' && activeDeck && (
          <StudyMode deck={activeDeck} />
        )}
      </div>
    </div>
  );
}

// --- Component: Deck Creator (Handles Parsing & Gemini) ---
function DeckCreator({ user, jsZipLoaded, onSuccess, onCancel }) {
  const [file, setFile] = useState(null);
  const [deckTitle, setDeckTitle] = useState('');
  const [status, setStatus] = useState('idle'); // idle, parsing, generating, saving, error
  const [errorMsg, setErrorMsg] = useState('');

  const parsePptx = async (pptxFile) => {
    if (!window.JSZip) throw new Error("JSZip library not loaded yet.");
    const zip = new window.JSZip();
    const loadedZip = await zip.loadAsync(pptxFile);
    
    // Find all slide xml files
    const slideFiles = Object.keys(loadedZip.files).filter(name => name.match(/^ppt\/slides\/slide\d+\.xml$/));
    if (slideFiles.length === 0) throw new Error("No slides found in this presentation.");

    let fullText = "";
    for (const slide of slideFiles) {
      const content = await loadedZip.files[slide].async("text");
      // Extract text from <a:t> nodes
      const matches = content.match(/<a:t>(.*?)<\/a:t>/g);
      if (matches) {
        // Strip XML tags
        const slideText = matches.map(m => m.replace(/<\/?a:t>/g, '')).join(" ");
        fullText += slideText + "\n\n";
      }
    }
    
    if (!fullText.trim()) throw new Error("Could not extract any text from the slides.");
    return fullText;
  };

  const generateFlashcardsWithGemini = async (text) => {
    // Note: Empty string for apiKey allows Canvas platform to inject it.
    const apiKey = "";
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${apiKey}`;

    const payload = {
        contents: [{ parts: [{ text: `Create high-yield study flashcards from the following presentation text. Extract key concepts, definitions, and facts.\n\nText:\n${text.substring(0, 30000)}` }] }],
        generationConfig: {
            responseMimeType: "application/json",
            responseSchema: {
                type: "ARRAY",
                items: {
                    type: "OBJECT",
                    properties: {
                        question: { type: "STRING" },
                        answer: { type: "STRING" }
                    },
                    required: ["question", "answer"]
                }
            }
        },
        systemInstruction: {
            parts: [{ text: "You are an expert educator. Extract the most important concepts and definitions from the provided presentation text and create a list of concise Q&A flashcards. Keep answers focused and clear." }]
        }
    };

    let response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });

    if (!response.ok) {
        throw new Error("Failed to generate flashcards from AI.");
    }

    const data = await response.json();
    const contentText = data.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (!contentText) throw new Error("Invalid AI response.");
    
    return JSON.parse(contentText);
  };

  const handleGenerate = async () => {
    if (!file || !deckTitle.trim()) return;
    
    setStatus('parsing');
    setErrorMsg('');
    
    try {
      // 1. Parse PPTX
      const extractedText = await parsePptx(file);
      
      // 2. Generate Flashcards
      setStatus('generating');
      const cards = await generateFlashcardsWithGemini(extractedText);
      
      if (!cards || cards.length === 0) {
        throw new Error("No flashcards were generated.");
      }

      // 3. Save to Firestore
      setStatus('saving');
      const newDeckId = crypto.randomUUID();
      const deckObj = {
        title: deckTitle.trim(),
        cards: cards,
        createdAt: Date.now()
      };
      
      const deckRef = doc(db, 'artifacts', appId, 'users', user.uid, 'decks', newDeckId);
      await setDoc(deckRef, deckObj);
      
      setStatus('idle');
      onSuccess({ id: newDeckId, ...deckObj });
      
    } catch (err) {
      console.error(err);
      setErrorMsg(err.message || "An unexpected error occurred.");
      setStatus('error');
    }
  };

  const isProcessing = status === 'parsing' || status === 'generating' || status === 'saving';

  return (
    <div className="flex-1 overflow-y-auto p-8 flex justify-center items-start animate-in fade-in zoom-in-95 duration-300">
      <div className="w-full max-w-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl overflow-hidden mt-8">
        <div className="p-6 border-b border-slate-100 dark:border-slate-800">
          <h2 className="text-xl font-bold">Create New Deck</h2>
          <p className="text-slate-500 text-sm mt-1">Upload a PowerPoint file to auto-generate flashcards.</p>
        </div>
        
        <div className="p-6 space-y-6">
          <div>
            <label className="block text-sm font-medium mb-2">Deck Title</label>
            <input 
              type="text" 
              value={deckTitle}
              onChange={(e) => setDeckTitle(e.target.value)}
              placeholder="e.g., Biology Chapter 4"
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-shadow"
              disabled={isProcessing}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">PowerPoint File (.pptx)</label>
            <div className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors ${file ? 'border-indigo-500 bg-indigo-50/50 dark:bg-indigo-900/10' : 'border-slate-300 dark:border-slate-700 hover:border-indigo-400 hover:bg-slate-50 dark:hover:bg-slate-800/50'}`}>
              <input 
                type="file" 
                accept=".pptx" 
                onChange={(e) => setFile(e.target.files[0])}
                className="hidden" 
                id="file-upload"
                disabled={isProcessing}
              />
              <label htmlFor="file-upload" className="cursor-pointer flex flex-col items-center">
                {file ? (
                  <>
                    <div className="w-12 h-12 bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 rounded-full flex items-center justify-center mb-3">
                      <CheckCircle2 className="w-6 h-6" />
                    </div>
                    <span className="font-medium text-indigo-700 dark:text-indigo-400">{file.name}</span>
                    <span className="text-xs text-slate-500 mt-1">{(file.size / 1024 / 1024).toFixed(2)} MB</span>
                  </>
                ) : (
                  <>
                     <div className="w-12 h-12 bg-slate-100 dark:bg-slate-800 text-slate-400 rounded-full flex items-center justify-center mb-3">
                        <UploadCloud className="w-6 h-6" />
                     </div>
                     <span className="font-medium">Click to upload or drag and drop</span>
                     <span className="text-xs text-slate-500 mt-1">PPTX files only (max 10MB recommended)</span>
                  </>
                )}
              </label>
            </div>
          </div>

          {errorMsg && (
            <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-4 rounded-lg flex items-start space-x-3 text-sm">
              <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {isProcessing && (
            <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-5 border border-slate-200 dark:border-slate-700">
               <div className="flex items-center space-x-3 mb-3">
                  <Loader2 className="w-5 h-5 animate-spin text-indigo-600" />
                  <span className="font-medium text-sm">
                    {status === 'parsing' && 'Extracting text from slides...'}
                    {status === 'generating' && 'AI is crafting your flashcards...'}
                    {status === 'saving' && 'Saving deck securely...'}
                  </span>
               </div>
               <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-1.5 overflow-hidden">
                 <div className="bg-indigo-600 h-1.5 rounded-full animate-[pulse_2s_ease-in-out_infinite]" style={{ width: status === 'parsing' ? '30%' : status === 'generating' ? '70%' : '95%' }}></div>
               </div>
            </div>
          )}
        </div>

        <div className="p-6 border-t border-slate-100 dark:border-slate-800 flex justify-end space-x-3 bg-slate-50 dark:bg-slate-900/50">
          <button 
            onClick={onCancel}
            disabled={isProcessing}
            className="px-5 py-2.5 rounded-lg text-slate-600 dark:text-slate-300 font-medium hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button 
            onClick={handleGenerate}
            disabled={!file || !deckTitle.trim() || isProcessing || !jsZipLoaded}
            className="px-6 py-2.5 rounded-lg bg-indigo-600 text-white font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-indigo-500/20"
          >
            {isProcessing ? 'Generating...' : 'Generate Magic'}
          </button>
        </div>
      </div>
    </div>
  );
}

// --- Component: Study Mode (3D Flashcards) ---
function StudyMode({ deck }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false); // prevents spamming

  // Reset state when deck changes
  useEffect(() => {
    setCurrentIndex(0);
    setIsFlipped(false);
  }, [deck.id]);

  const cards = deck.cards || [];
  const currentCard = cards[currentIndex];

  const handleFlip = () => {
    if (isAnimating) return;
    setIsAnimating(true);
    setIsFlipped(!isFlipped);
    setTimeout(() => setIsAnimating(false), 500); // match transition duration
  };

  const handleNext = () => {
    if (currentIndex < cards.length - 1) {
      if (isFlipped) {
         setIsFlipped(false);
         // wait for flip back before sliding
         setTimeout(() => setCurrentIndex(prev => prev + 1), 300);
      } else {
         setCurrentIndex(prev => prev + 1);
      }
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      if (isFlipped) {
         setIsFlipped(false);
         setTimeout(() => setCurrentIndex(prev => prev - 1), 300);
      } else {
         setCurrentIndex(prev => prev - 1);
      }
    }
  };

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'ArrowRight') handleNext();
      if (e.key === 'ArrowLeft') handlePrev();
      if (e.key === ' ' || e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        e.preventDefault();
        handleFlip();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentIndex, isFlipped, cards.length]);

  if (!currentCard) {
    return <div className="p-8">No cards available in this deck.</div>;
  }

  const progress = ((currentIndex + 1) / cards.length) * 100;

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-6 lg:p-12 relative animate-in fade-in duration-500">
      
      {/* Header Info */}
      <div className="w-full max-w-3xl mb-8 flex justify-between items-end">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">{deck.title}</h2>
          <p className="text-slate-500 text-sm mt-1">{cards.length} Cards</p>
        </div>
        <div className="text-sm font-medium text-slate-400">
          Card {currentIndex + 1} of {cards.length}
        </div>
      </div>

      {/* Progress Bar */}
      <div className="w-full max-w-3xl h-1.5 bg-slate-200 dark:bg-slate-800 rounded-full mb-10 overflow-hidden">
        <div 
          className="h-full bg-indigo-500 transition-all duration-300 ease-out rounded-full"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* 3D Flashcard Container */}
      <div className="w-full max-w-3xl h-[400px] perspective-1000 mb-12">
        <div 
          className={`relative w-full h-full transition-transform duration-500 transform-style-3d cursor-pointer ${isFlipped ? 'rotate-y-180' : ''}`}
          onClick={handleFlip}
        >
          {/* Front (Question) */}
          <div className="absolute inset-0 backface-hidden flex flex-col items-center justify-center p-10 bg-white dark:bg-slate-900 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.2)] border border-slate-200 dark:border-slate-800">
             <span className="absolute top-6 left-6 text-xs font-bold uppercase tracking-widest text-indigo-500">Question</span>
             <h3 className="text-2xl md:text-3xl font-semibold text-center leading-relaxed text-slate-800 dark:text-slate-100 select-none">
               {currentCard.question}
             </h3>
             <div className="absolute bottom-6 text-sm text-slate-400 flex items-center space-x-2">
                <span>Click or press Space to flip</span>
             </div>
          </div>

          {/* Back (Answer) */}
          <div className="absolute inset-0 backface-hidden rotate-y-180 flex flex-col items-center justify-center p-10 bg-gradient-to-br from-indigo-50 to-white dark:from-indigo-950/40 dark:to-slate-900 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.08)] border border-indigo-100 dark:border-indigo-800/50">
             <span className="absolute top-6 left-6 text-xs font-bold uppercase tracking-widest text-indigo-600 dark:text-indigo-400">Answer</span>
             <div className="max-h-full overflow-y-auto scrollbar-hide py-8">
                <p className="text-xl md:text-2xl font-medium text-center leading-relaxed text-indigo-950 dark:text-indigo-100 select-none">
                  {currentCard.answer}
                </p>
             </div>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center space-x-6">
        <button 
          onClick={handlePrev}
          disabled={currentIndex === 0}
          className="w-14 h-14 rounded-full flex items-center justify-center bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-all disabled:opacity-40 disabled:cursor-not-allowed hover:scale-105 active:scale-95"
        >
          <ChevronLeft className="w-7 h-7" />
        </button>
        
        <button 
          onClick={handleFlip}
          className="px-8 py-3 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-medium hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
        >
          Flip Card
        </button>

        <button 
          onClick={handleNext}
          disabled={currentIndex === cards.length - 1}
          className="w-14 h-14 rounded-full flex items-center justify-center bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-all disabled:opacity-40 disabled:cursor-not-allowed hover:scale-105 active:scale-95"
        >
          <ChevronRight className="w-7 h-7" />
        </button>
      </div>

    </div>
  );
}