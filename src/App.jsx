import React, { useState, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  onAuthStateChanged, 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword,
  signOut 
} from 'firebase/auth';
import { 
  getFirestore, 
  collection, 
  addDoc, 
  getDocs, 
  query, 
  orderBy, 
  serverTimestamp, 
  deleteDoc, 
  doc 
} from 'firebase/firestore';
import { 
  UploadCloud, Loader2, Library, Plus, ChevronLeft, ChevronRight, 
  Menu, X, ArrowLeft, RotateCcw, LogOut, Trash2, Mail, Lock 
} from 'lucide-react';
import JSZip from 'jszip';

// Firebase Initialization
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

export default function App() {
  // Auth State
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [isLoginView, setIsLoginView] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [authProcessLoading, setAuthProcessLoading] = useState(false);

  // App State
  const [decks, setDecks] = useState([]);
  const [activeDeck, setActiveDeck] = useState(null);
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingText, setLoadingText] = useState("");
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [continuePortrait, setContinuePortrait] = useState(false);

  // Authenticate & Load Decks
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        try {
          const q = query(collection(db, 'users', currentUser.uid, 'decks'), orderBy('createdAt', 'desc'));
          const snapshot = await getDocs(q);
          setDecks(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
        } catch (error) {
          console.error("Error loading decks:", error);
        }
      } else {
        setDecks([]);
        setActiveDeck(null);
      }
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // --- AUTHENTICATION HANDLERS ---
  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    setAuthError('');
    setAuthProcessLoading(true);
    try {
      if (isLoginView) {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        await createUserWithEmailAndPassword(auth, email, password);
      }
      setEmail('');
      setPassword('');
    } catch (err) {
      setAuthError(err.message.replace('Firebase: ', ''));
    } finally {
      setAuthProcessLoading(false);
    }
  };

  const handleLogout = () => {
    signOut(auth);
    setIsMobileMenuOpen(false);
  };

  // --- APP HANDLERS ---
  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      setLoading(true);
      setLoadingText("Extracting text from PowerPoint...");
      setIsMobileMenuOpen(false);

      const zip = new JSZip();
      const loadedZip = await zip.loadAsync(file);
      let fullText = "";

      for (const [filename, fileData] of Object.entries(loadedZip.files)) {
        if (filename.startsWith('ppt/slides/slide') && filename.endsWith('.xml')) {
          const xmlData = await fileData.async('string');
          const matches = xmlData.match(/<a:t>.*?<\/a:t>/g);
          if (matches) {
            fullText += matches.map(m => m.replace(/<a:t>|<\/a:t>/g, '')).join(' ') + " \n";
          }
        }
      }

      if (!fullText.trim()) throw new Error("No readable text found in this PPTX.");

      setLoadingText("Generating smart flashcards with AI...");
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: fullText.substring(0, 15000) })
      });

      if (!response.ok) throw new Error("Failed to generate flashcards from AI.");
      const data = await response.json();
      
      if (!data.flashcards || data.flashcards.length === 0) throw new Error("AI returned empty flashcards.");

      setLoadingText("Saving deck...");
      const deckName = file.name.replace('.pptx', '');
      const deckRef = await addDoc(collection(db, 'users', user.uid, 'decks'), {
        name: deckName,
        cards: data.flashcards,
        createdAt: serverTimestamp()
      });

      const newDeck = { id: deckRef.id, name: deckName, cards: data.flashcards };
      setDecks([newDeck, ...decks]);
      setActiveDeck(newDeck);
      setCurrentCardIndex(0);
      setIsFlipped(false);

    } catch (err) {
      alert("Error: " + err.message);
    } finally {
      setLoading(false);
      setLoadingText("");
      e.target.value = '';
    }
  };

  const handleDeleteDeck = async (e, deckId) => {
    e.stopPropagation(); 
    if (window.confirm("Are you sure you want to delete this deck? This cannot be undone.")) {
      try {
        await deleteDoc(doc(db, 'users', user.uid, 'decks', deckId));
        setDecks(decks.filter(d => d.id !== deckId));
        if (activeDeck?.id === deckId) setActiveDeck(null);
      } catch (err) {
        alert("Failed to delete deck.");
      }
    }
  };

  const nextCard = () => {
    setIsFlipped(false);
    setTimeout(() => setCurrentCardIndex((prev) => (prev + 1) % activeDeck.cards.length), 150);
  };

  const prevCard = () => {
    setIsFlipped(false);
    setTimeout(() => setCurrentCardIndex((prev) => (prev - 1 + activeDeck.cards.length) % activeDeck.cards.length), 150);
  };

  // --- INITIAL LOADING SCREEN ---
  if (authLoading) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-gray-50">
        <Loader2 className="animate-spin text-indigo-600" size={48} />
      </div>
    );
  }

  // --- LOGIN / REGISTER SCREEN ---
  if (!user) {
    return (
      <div className="min-h-screen w-full flex flex-col justify-center items-center bg-gray-50 p-4">
        <div className="max-w-md w-full bg-white rounded-3xl shadow-xl p-8 border border-gray-100">
          <div className="flex justify-center mb-6">
            <div className="w-16 h-16 bg-indigo-100 rounded-2xl flex items-center justify-center">
              <Library className="text-indigo-600" size={32} />
            </div>
          </div>
          <h2 className="text-2xl font-bold text-center text-gray-900 mb-2">
            {isLoginView ? 'Welcome back' : 'Create an account'}
          </h2>
          <p className="text-center text-gray-500 mb-8">
            {isLoginView ? 'Enter your details to access your flashcards.' : 'Sign up to start transforming your slides.'}
          </p>

          <form onSubmit={handleAuthSubmit} className="space-y-4">
            <div>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                <input 
                  type="email" required placeholder="Email address"
                  value={email} onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                />
              </div>
            </div>
            <div>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                <input 
                  type="password" required placeholder="Password (min 6 characters)"
                  value={password} onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                />
              </div>
            </div>

            {authError && <p className="text-red-500 text-sm font-medium text-center">{authError}</p>}

            <button disabled={authProcessLoading} type="submit" className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-lg hover:shadow-xl transition-all disabled:opacity-70 flex justify-center items-center">
              {authProcessLoading ? <Loader2 className="animate-spin" size={24} /> : (isLoginView ? 'Sign In' : 'Sign Up')}
            </button>
          </form>

          <div className="mt-6 text-center">
            <button onClick={() => { setIsLoginView(!isLoginView); setAuthError(''); }} className="text-sm text-indigo-600 hover:text-indigo-800 font-medium">
              {isLoginView ? "Don't have an account? Sign up" : "Already have an account? Sign in"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // --- MAIN APP COMPONENT ---
  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden font-sans relative">
      
      {/* Soft Landscape Warning Overlay (Dismissible) */}
      {!continuePortrait && (
        <div className="fixed inset-0 z-[9999] bg-gray-900/95 backdrop-blur-sm text-white flex-col items-center justify-center hidden portrait:flex md:portrait:hidden p-8 text-center transition-opacity">
          <RotateCcw size={56} className="text-indigo-400 mb-6 animate-pulse" />
          <h2 className="text-2xl font-bold mb-3 text-white">Better in Landscape</h2>
          <p className="text-gray-300 mb-10 max-w-sm leading-relaxed">
            SlideCards is optimized for horizontal viewing. Rotate your phone for the best experience.
          </p>
          <button 
            onClick={() => setContinuePortrait(true)} 
            className="px-8 py-3 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-full text-sm font-semibold text-gray-200 transition-all shadow-lg active:scale-95"
          >
            Continue in portrait mode
          </button>
        </div>
      )}

      {/* Mobile Top Navigation */}
      <div className="md:hidden fixed top-0 w-full bg-gray-900 text-white z-40 px-4 py-3 flex items-center justify-between shadow-md">
        <div className="flex items-center gap-2 font-bold text-lg">
          <Library size={20} className="text-indigo-400" />
          SlideCards AI
        </div>
        <button onClick={() => setIsMobileMenuOpen(true)} className="p-1 text-gray-300 hover:text-white">
          <Menu size={26} />
        </button>
      </div>

      {isMobileMenuOpen && (
        <div className="md:hidden fixed inset-0 bg-black/60 z-40 transition-opacity" onClick={() => setIsMobileMenuOpen(false)} />
      )}

      {/* Sidebar */}
      <div className={`fixed md:static inset-y-0 left-0 z-50 w-72 bg-gray-900 text-white flex flex-col transform transition-transform duration-300 ease-in-out ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0 shadow-2xl md:shadow-none`}>
        <div className="flex p-5 md:p-6 items-center justify-between border-b border-gray-800">
          <div className="flex items-center gap-3">
            <Library className="text-indigo-500" size={28} />
            <h1 className="text-xl font-bold tracking-wide">SlideCards</h1>
          </div>
          <button onClick={() => setIsMobileMenuOpen(false)} className="md:hidden text-gray-400 hover:text-white">
             <X size={24} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          <div className="flex items-center justify-between mb-4 px-2">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Your Decks</p>
            <span className="text-xs text-gray-600 font-medium">{decks.length} Total</span>
          </div>
          
          {decks.map(deck => (
            <div key={deck.id} className={`w-full rounded-xl transition-all duration-200 flex items-center justify-between group ${activeDeck?.id === deck.id ? 'bg-indigo-600 shadow-md' : 'hover:bg-gray-800'}`}>
              <button
                onClick={() => {
                  setActiveDeck(deck);
                  setCurrentCardIndex(0);
                  setIsFlipped(false);
                  setIsMobileMenuOpen(false);
                }}
                className="flex-1 text-left px-4 py-3 flex items-center justify-between truncate"
              >
                <span className={`truncate pr-2 font-medium ${activeDeck?.id === deck.id ? 'text-white' : 'text-gray-300 group-hover:text-white'}`}>{deck.name}</span>
                <span className={`text-xs px-2 py-1 rounded-full ${activeDeck?.id === deck.id ? 'bg-indigo-500' : 'bg-gray-700 text-gray-300'}`}> {deck.cards.length} </span> </button>  <button onClick={(e) => handleDeleteDeck(e, deck.id)} className={`p-3 text-gray-400 hover:text-red-400 transition-colors ${activeDeck?.id === deck.id ? 'text-indigo-200 hover:text-white' : ''}`}
                title="Delete Deck"
              >
                <Trash2 size={18} />
              </button>
            </div>
          ))}
          {decks.length === 0 && (
            <div className="px-2 py-6 text-sm text-gray-500 text-center border-2 border-dashed border-gray-800 rounded-xl mt-4">
              No decks yet.<br/>Upload a PPTX to begin!
            </div>
          )}
        </div>

        <div className="p-4 border-t border-gray-800 space-y-3">
          <button 
            onClick={() => { setActiveDeck(null); setIsMobileMenuOpen(false); }}
            className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 py-3 rounded-xl font-semibold transition-colors shadow-lg"
          >
            <Plus size={20} /> New Deck
          </button>
          
          <div className="pt-2 flex items-center justify-between px-2">
             <div className="text-xs text-gray-500 truncate pr-2 flex items-center gap-2">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                {user.email}
             </div>
             <button onClick={handleLogout} className="text-gray-400 hover:text-red-400 transition-colors" title="Sign Out">
                <LogOut size={20} />
             </button>
          </div>
        </div>
      </div>

      {/* Main Content Area - ADDED overflow-y-auto HERE to allow scrolling in landscape */}
      <div className="flex-1 flex flex-col pt-16 md:pt-0 h-full w-full bg-gray-50/50 relative overflow-y-auto">
        {!activeDeck ? (
          <div className="flex-1 flex flex-col items-center justify-center p-6 sm:p-12 text-center w-full min-h-max pb-24">
            <div className="max-w-xl w-full bg-white rounded-3xl shadow-xl p-8 sm:p-14 border border-gray-100">
              <div className="w-20 h-20 bg-indigo-50 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner">
                 <UploadCloud className="text-indigo-600" size={40} />
              </div>
              <h2 className="text-2xl sm:text-3xl font-bold text-gray-800 mb-4">Upload Presentation</h2>
              <p className="text-gray-500 mb-8 leading-relaxed sm:text-lg">
                Transform your lecture slides into interactive flashcards automatically. We support .pptx files.
              </p>
              
              <label htmlFor="file-upload" className={`relative flex items-center justify-center w-full py-4 px-6 rounded-2xl text-lg font-bold text-white transition-all cursor-pointer ${loading ? 'bg-indigo-400' : 'bg-indigo-600 hover:bg-indigo-700 hover:shadow-lg hover:-translate-y-1'}`}>
            </label>
