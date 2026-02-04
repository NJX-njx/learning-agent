import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, useNavigate, Navigate } from 'react-router-dom';
import Navbar from './components/Navbar';
import Hero from './components/Hero';
import Features from './components/Features';
import Testimonials from './components/Testimonials';
import CTA from './components/CTA';
import Footer from './components/Footer';
import ChatPage from './pages/ChatPage';
import ProfileModal from './components/ProfileModal';
import AuthModal from './components/AuthModal';

const LandingPage = () => {
  const [showProfileWizard, setShowProfileWizard] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [user, setUser] = useState<any>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      setUser(JSON.parse(storedUser));
    }
  }, []);

  const handleProfileSubmit = (profile: any) => {
    console.log('Profile submitted:', profile);
    localStorage.setItem('learnerProfile', JSON.stringify(profile));
    setShowProfileWizard(false);
    navigate('/chat');
  };

  const handleLogin = (userData: any, token: string) => {
    setUser(userData);
    localStorage.setItem('user', JSON.stringify(userData));
    localStorage.setItem('authToken', token);
    setShowAuthModal(false);
    // After login, show profile wizard if it's a new user or just navigate
    // For now, let's show the wizard to ensure we capture preferences
    setShowProfileWizard(true);
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('user');
    localStorage.removeItem('authToken');
    navigate('/');
  };

  return (
    <>
      <Navbar 
        onLoginClick={() => setShowAuthModal(true)} 
        user={user}
        onLogout={handleLogout}
      />
      <main>
        <Hero onStartClick={() => user ? navigate('/chat') : setShowAuthModal(true)} />
        <Features />
        <Testimonials />
        <CTA onStartClick={() => user ? navigate('/chat') : setShowAuthModal(true)} />
      </main>
      <Footer />
      
      <ProfileModal 
        isOpen={showProfileWizard} 
        onClose={() => setShowProfileWizard(false)}
        onSubmit={handleProfileSubmit}
        mode="wizard"
      />
      
      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        onLogin={handleLogin}
      />
    </>
  );
};

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const user = localStorage.getItem('user');
  const token = localStorage.getItem('authToken');
  if (!user || !token) {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
};

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route 
          path="/chat" 
          element={
            <ProtectedRoute>
              <ChatPage />
            </ProtectedRoute>
          } 
        />
      </Routes>
    </Router>
  );
}

export default App;
