import { useEffect, useState } from 'react'

function App() {
  const [isVisible, setIsVisible] = useState(false);
  const [scrollScale, setScrollScale] = useState(0.95);

  useEffect(() => {
    setIsVisible(true);
    
    const handleScroll = () => {
      const scrollY = window.scrollY;
      const maxScroll = 300;
      const scale = Math.min(0.95 + (scrollY / maxScroll) * 0.05, 1);
      setScrollScale(scale);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div className="min-h-screen bg-sparkle-bg text-sparkle-text selection:bg-sparkle-primary/30 relative overflow-hidden">

      {/* Navigation */}
      <nav className={`fixed top-0 left-0 right-0 z-40 px-8 py-6 flex justify-between items-center transition-all duration-1000 delay-300 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4'}`}>
        <div className="flex items-center opacity-40 hover:opacity-100 transition-opacity">
          <img
            src="/logo.png"
            alt="DevScope Logo"
            className="w-8 h-8 rounded-lg"
          />
        </div>
        <a
          href="https://github.com/justelson/dev_scope.git"
          target="_blank"
          rel="noopener noreferrer"
          className="text-white/40 hover:text-white transition-all flex items-center gap-1 text-xs font-medium"
        >
          GitHub ↗
        </a>
      </nav>

      {/* Hero Section */}
      <main className="relative pt-32 pb-20 px-6 max-w-[1600px] mx-auto flex flex-col items-center text-center">
        <div className={`transition-all duration-1000 delay-500 w-full ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-12'}`}>
          <h1 className="text-6xl md:text-7xl font-normal mb-6 tracking-[-0.02em] leading-[1.1] text-white">
            DevScope
          </h1>
          
          <p className="text-xl md:text-2xl font-normal mb-3 tracking-[-0.01em] text-white/90">
            A new standard to code in AI-driven development.
          </p>
          
          <p className="text-sm text-white/40 mb-12">
            AI powered by T3 Code
          </p>

          <div className="flex flex-wrap justify-center gap-6 mb-16">
            <a
              href="https://github.com/justelson/dev_scope.git"
              className="px-8 py-3 bg-white hover:bg-gray-100 text-black rounded-full font-medium transition-all hover:scale-105 active:scale-95 flex items-center gap-2 text-sm"
            >
              Download now
            </a>
          </div>
        </div>

        {/* Ultra-Wide App Preview */}
        <div 
          className={`w-full max-w-[1440px] rounded-lg border-2 border-white/20 bg-sparkle-card/20 backdrop-blur-3xl overflow-hidden shadow-[0_0_150px_rgba(0,0,0,0.95)] delay-700 relative group ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-12'}`}
          style={{ 
            transform: `scale(${scrollScale})`,
            transition: 'transform 0.1s ease-out, opacity 1s 0.7s, translate 1s 0.7s'
          }}
        >
          <img
            src="/app-screenshot.png"
            alt="DevScope App Preview"
            className="w-full h-auto transition-all duration-1000 ease-out"
          />
        </div>
      </main>

      {/* Footer */}
      <footer className={`py-20 text-center transition-all duration-1000 delay-1000 ${isVisible ? 'opacity-100' : 'opacity-0'}`}>
        <div className="flex flex-col items-center gap-4">
          <p className="text-white/40 text-[11px] font-bold tracking-[0.2em] uppercase">
            PRODUCED BY ELSON
          </p>
          <div className="w-8 h-[1px] bg-white/10" />
          <p className="text-white/20 text-[10px] italic">
            devs dont use light mode
          </p>
        </div>
      </footer>
    </div>
  )
}

export default App
