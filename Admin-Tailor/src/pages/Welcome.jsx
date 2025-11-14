import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import '../styles/Welcome.css';

const Welcome = () => {
  const navigate = useNavigate();
  const [exiting, setExiting] = useState(false);
  // Prepare floating orbs once to keep positions stable
  const orbs = useMemo(() => {
    const count = 15;
    return Array.from({ length: count }).map((_, idx) => {
      const size = Math.random() * 60 + 20; // 20px - 80px
      const left = Math.random() * 100; // %
      const top = Math.random() * 100; // %
      const duration = Math.random() * 10 + 15; // 15s - 25s
      const delay = Math.random() * 5; // 0s - 5s
      return {
        id: idx,
        style: {
          width: `${size}px`,
          height: `${size}px`,
          left: `${left}%`,
          top: `${top}%`,
          animation: `float ${duration}s ease-in-out ${delay}s infinite`,
        },
      };
    });
  }, []);

  return (
    <div className="welcome-hero" id="container">
      {/* Soft animated blue gradient background with subtle moving orbs */}
      <div className="welcome-hero__bg">
        {orbs.map((o) => (
          <div key={o.id} className="welcome-hero__orb" style={o.style} />
        ))}
        <div className="welcome-hero__gradient-layer" />
      </div>

      {/* Centered content */}
      <main className={`welcome-hero__content page-enter ${exiting ? 'page-exit' : ''}`} role="main">
        <img 
          src="/logo.png" 
          alt="Logo" 
          className="welcome-hero__logo"
        />
        <h1 className="welcome-hero__title">WELCOME</h1>
        <p className="welcome-hero__subtitle">Smart, seamless tailoring management crafted for speed and precision.</p>
        <button
          className="welcome-hero__cta"
          onClick={() => {
            setExiting(true);
            setTimeout(() => navigate('/login'), 400);
          }}
          aria-label="Get started with TailorCraft"
        >
          Get Started
          <svg className="welcome-hero__cta-arrow" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
          </svg>
        </button>
      </main>
    </div>
  );
};

export default Welcome;
