import { useEffect, useState } from 'react'

function App() {
  const [isVisible, setIsVisible] = useState(false);
  const [scrollScale, setScrollScale] = useState(0.95);
  const [isWindows, setIsWindows] = useState(true);

  useEffect(() => {
    setIsVisible(true);
    
    // Detect if user is on Windows
    const userAgent = navigator.userAgent.toLowerCase();
    const platform = navigator.platform.toLowerCase();
    const isWindowsOS = platform.includes('win') || userAgent.includes('windows');
    setIsWindows(isWindowsOS);
    
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
      {/* Animated Grid Background */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute inset-0 grid-dots opacity-20"></div>
        <div className="absolute inset-0 grid-glow"></div>
      </div>

      {/* Navigation */}
      <nav className={`fixed top-0 left-0 right-0 z-40 px-4 md:px-8 py-4 md:py-6 flex justify-between items-center transition-all duration-1000 delay-300 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4'}`}>
        <div className="flex items-center opacity-40 hover:opacity-100 transition-opacity">
          <img
            src="/logo.png"
            alt="DevScope Logo"
            className="w-7 h-7 md:w-8 md:h-8 rounded-lg"
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
      <main className="relative pt-24 md:pt-32 pb-12 md:pb-20 px-4 md:px-6 max-w-[1600px] mx-auto flex flex-col items-center text-center">
        <div className={`transition-all duration-1000 delay-500 w-full ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-12'}`}>
          <h1 className="text-6xl md:text-6xl lg:text-7xl font-bold mb-4 md:mb-6 tracking-[-0.02em] leading-[1.1] text-white">
            DevScope
          </h1>
          
          <p className="text-base md:text-xl lg:text-2xl font-normal mb-3 tracking-[-0.01em] text-white/90 px-4">
            A new standard to code in AI-driven development.
          </p>
          
          <p className="text-xs md:text-sm text-white/40 mb-2 md:mb-3">
            AI powered by T3 Code
          </p>
          
          <p className="hidden md:block text-[10px] md:text-xs mb-8 md:mb-12 font-bold" style={{ color: '#007aff', opacity: 0.6 }}>
            Early alpha • Frequent updates and fixes ongoing
          </p>
          
          <div className="md:hidden h-8" />

          <div className="flex flex-col items-center gap-2">
            <div className="flex flex-wrap justify-center gap-4 md:gap-6">
              <a
                href="https://github.com/justelson/dev_scope.git"
                className="px-6 md:px-8 py-2.5 md:py-3 bg-white hover:bg-gray-100 text-black rounded-full font-medium transition-all hover:scale-105 active:scale-95 flex items-center gap-2 text-sm"
              >
                {isWindows ? 'Download now' : 'View on GitHub'}
              </a>
            </div>
            {!isWindows && (
              <p className="text-xs text-white/40 mt-2">
                Currently only available on Windows
              </p>
            )}
          </div>
          
          <div className="h-10 md:h-16" />
        </div>

        {/* Ultra-Wide App Preview */}
        <div 
          className={`w-full max-w-[1440px] rounded-md md:rounded-lg border border-white/20 md:border-2 bg-sparkle-card/20 backdrop-blur-3xl overflow-hidden shadow-[0_0_80px_rgba(0,0,0,0.95)] md:shadow-[0_0_150px_rgba(0,0,0,0.95)] delay-700 relative group ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-12'}`}
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
      <footer className={`py-12 md:py-20 text-center transition-all duration-1000 delay-1000 ${isVisible ? 'opacity-100' : 'opacity-0'}`}>
        <div className="flex flex-col items-center gap-3 md:gap-4 px-4">
          <p className="md:hidden text-[10px] font-bold mb-2" style={{ color: '#007aff', opacity: 0.6 }}>
            Early alpha • Frequent updates and fixes ongoing
          </p>
          <p className="text-white/40 text-[10px] md:text-[11px] font-bold tracking-[0.2em] uppercase">
            PRODUCED BY ELSON
          </p>
          <div className="w-8 h-[1px] bg-white/10" />
          <p className="text-white/20 text-[9px] md:text-[10px] italic">
            devs dont use light mode
          </p>
        </div>
      </footer>
    </div>
  )
}

export default App
