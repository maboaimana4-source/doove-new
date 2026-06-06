import { motion } from 'framer-motion';
import { Download, Github, Monitor, Apple, Sparkles, MousePointer2, Layout, Video, Zap } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useState, useEffect } from 'react';

// NOTE: We are now hosting the binaries locally on this server to bypass GitHub Private Repo restrictions.
const GITHUB_REPO_URL = "https://github.com/maboaimana4-source/doove-new";
const DOWNLOAD_BASE_URL = "/downloads";

const Navbar = () => {
  const [downloadUrl, setDownloadUrl] = useState(`${DOWNLOAD_BASE_URL}/Doove-windows-x64.exe`);

  useEffect(() => {
    const ua = window.navigator.userAgent.toLowerCase();
    if (ua.includes('win')) {
      setDownloadUrl(`${DOWNLOAD_BASE_URL}/Doove-windows-x64.exe`);
    } else if (ua.includes('mac')) {
      setDownloadUrl(`${DOWNLOAD_BASE_URL}/Doove-macos-x64.dmg`);
    } else if (ua.includes('linux')) {
      setDownloadUrl(`${DOWNLOAD_BASE_URL}/Doove-linux-x64.AppImage`);
    } else {
      setDownloadUrl("https://github.com/maboaimana4-source/doove-new/releases/tag/v1.3.9");
    }
  }, []);

  return (
    <nav className="fixed top-0 w-full z-50 border-b border-white/10 bg-zinc-950/80 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2">
          <img src="/logo.svg" alt="Doove Logo" className="w-8 h-8" />
          <span className="text-xl font-bold tracking-tight">DOOVE</span>
        </Link>
        <div className="hidden md:flex items-center gap-8 text-sm font-medium text-zinc-400">
          <a href="#features" className="hover:text-white transition-colors">Features</a>
          <a href="https://github.com/maboaimana4-source/doove-new" className="flex items-center gap-2 hover:text-white transition-colors">
            <Github size={18} />
            GitHub
          </a>
          <Link to="/pay" className="text-doove-purple hover:text-white transition-colors font-bold tracking-widest text-[10px] uppercase">
            Doove Pro
          </Link>
        </div>
        <div className="flex items-center gap-4">
          <a 
            href={downloadUrl}
            className="bg-white text-black px-4 py-2 rounded-full text-sm font-semibold hover:bg-zinc-200 transition-colors"
          >
            Download
          </a>
        </div>
      </div>
    </nav>
  );
};

const FeatureSection = ({ title, description, gif, reverse = false }: { title: string, description: string, gif: string, reverse?: boolean }) => (
  <section className="py-24 overflow-hidden">
    <div className={`max-w-7xl mx-auto px-4 flex flex-col ${reverse ? 'md:flex-row-reverse' : 'md:flex-row'} items-center gap-16`}>
      <motion.div 
        initial={{ opacity: 0, x: reverse ? 50 : -50 }}
        whileInView={{ opacity: 1, x: 0 }}
        viewport={{ once: true }}
        className="flex-1"
      >
        <h2 className="text-4xl font-bold mb-6 leading-tight">{title}</h2>
        <p className="text-lg text-zinc-400 leading-relaxed">{description}</p>
      </motion.div>
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        whileInView={{ opacity: 1, scale: 1 }}
        viewport={{ once: true }}
        className="flex-1 relative"
      >
        <div className="absolute -inset-4 bg-gradient-to-r from-doove-purple/20 to-doove-blue/20 blur-3xl rounded-full opacity-50" />
        <img src={gif} alt={title} className="relative rounded-2xl border border-white/10 shadow-2xl w-full" />
      </motion.div>
    </div>
  </section>
);

const LandingPage = () => {
  const [platform, setPlatform] = useState<'windows' | 'mac' | 'linux' | 'other'>('other');

  useEffect(() => {
    const ua = window.navigator.userAgent.toLowerCase();
    if (ua.includes('win')) setPlatform('windows');
    else if (ua.includes('mac')) setPlatform('mac');
    else if (ua.includes('linux')) setPlatform('linux');
  }, []);

  const getDownloadUrl = (os: 'windows' | 'mac' | 'linux') => {
    if (os === 'windows') return `${DOWNLOAD_BASE_URL}/Doove-windows-x64.exe`;
    if (os === 'mac') return `${DOWNLOAD_BASE_URL}/Doove-macos-x64.dmg`;
    if (os === 'linux') return `${DOWNLOAD_BASE_URL}/Doove-linux-x64.AppImage`;
    return "https://github.com/maboaimana4-source/doove-new/releases/tag/v1.3.10";
  };

  return (
    <div className="min-h-screen">
      <Navbar />
      
      {/* Hero Section */}
      <header className="pt-32 pb-16 relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 text-center relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-doove-purple/10 border border-doove-purple/20 text-doove-purple text-xs font-bold tracking-wider mb-8 uppercase">
              <Sparkles size={14} /> The Recording Revolution
            </span>
            <h1 className="text-5xl md:text-8xl font-black mb-8 leading-[1.1] tracking-tighter">
              MAKE POLISHED VIDEOS <br />
              <span className="gradient-text">WITHOUT THE EDITING GRIND</span>
            </h1>
            <p className="text-xl text-zinc-400 max-w-2xl mx-auto mb-12 leading-relaxed">
              Produce videos with professional motion animations, perfect for product demos, walkthroughs, and more. Built for creators who ship.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <a 
                href={getDownloadUrl('mac')}
                className={`w-full sm:w-auto flex items-center justify-center gap-3 px-8 py-4 rounded-2xl font-bold transition-all transform hover:scale-105 ${platform === 'mac' ? 'bg-white text-black hover:bg-zinc-200' : 'bg-zinc-900 text-white border border-white/10 hover:bg-zinc-800'}`}
              >
                <Apple size={20} />
                Download for macOS
              </a>
              <a 
                href={getDownloadUrl('windows')}
                className={`w-full sm:w-auto flex items-center justify-center gap-3 px-8 py-4 rounded-2xl font-bold transition-all transform hover:scale-105 ${platform === 'windows' ? 'bg-white text-black hover:bg-zinc-200' : 'bg-zinc-900 text-white border border-white/10 hover:bg-zinc-800'}`}
              >
                <Monitor size={20} />
                Download for Windows
              </a>
              {platform === 'linux' && (
                <a 
                  href={getDownloadUrl('linux')}
                  className="w-full sm:w-auto flex items-center justify-center gap-3 px-8 py-4 rounded-2xl font-bold transition-all transform hover:scale-105 bg-white text-black hover:bg-zinc-200"
                >
                  <Download size={20} />
                  Download for Linux
                </a>
              )}
            </div>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.8 }}
            className="mt-20 relative"
          >
            <div className="absolute -inset-10 bg-doove-purple/20 blur-[100px] rounded-full opacity-30 pointer-events-none" />
            <div className="glass p-2 rounded-[2rem] shadow-2xl max-w-5xl mx-auto">
              <img src="/assets/demo.gif" alt="Doove Demo" className="rounded-3xl w-full border border-white/10" />
            </div>
          </motion.div>
        </div>
      </header>

      {/* Features */}
      <div id="features">
        <FeatureSection 
          title="AUTO-ZOOM, SILKY CURSOR & STUNNING BACKGROUNDS"
          description="Doove automatically adds fluid cursor animations and smart zooming to your captures. Spend less time in the editing suite and more time shipping your best work."
          gif="/assets/feature1.gif"
        />
        <FeatureSection 
          title="DYNAMIC WEBCAM BUBBLE OVERLAY"
          description="Intelligent webcam bubbles that expand and shrink dynamically, ensuring you get the spotlight exactly when the narrative demands it."
          gif="/assets/feature2.gif"
          reverse
        />
        <FeatureSection 
          title="SEAMLESS CURSOR PATHS"
          description="Keep your GIFs engaging with seamless cursor paths—no jumps, just motion. Perfect for social media and documentation."
          gif="/assets/CursorLoop.gif"
        />
      </div>

      {/* Feature Grid */}
      <section className="py-24 bg-zinc-900/50">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold mb-16">THE ESSENTIALS</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { icon: <Video className="text-doove-purple" />, title: "Dual-Source Audio", desc: "Capture microphone and system audio with sample-accurate sync." },
              { icon: <Zap className="text-doove-blue" />, title: "Project Persistence", desc: "Doove remembers your workspace. Reopen projects exactly where you left off." },
              { icon: <Monitor className="text-doove-purple" />, title: "Flexible Export", desc: "High-quality MP4s for tutorials or looping GIFs for social media." },
              { icon: <MousePointer2 className="text-doove-blue" />, title: "Cursor Looping", desc: "Perfectly looping cursor paths for the smoothest GIFs imaginable." },
              { icon: <Layout className="text-doove-purple" />, title: "Media Import", desc: "Layer external audio and webcam footage directly into your timeline." },
              { icon: <Sparkles className="text-doove-blue" />, title: "Freemium Model", desc: "Start for free, upgrade to Pro for ultimate recording power." },
            ].map((f, i) => (
              <motion.div 
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="glass p-8 rounded-3xl text-left hover:border-white/20 transition-colors"
              >
                <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center mb-6">
                  {f.icon}
                </div>
                <h3 className="text-xl font-bold mb-4">{f.title}</h3>
                <p className="text-zinc-400 leading-relaxed">{f.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section className="py-24 bg-black">
        <div className="max-w-7xl mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-black mb-4 uppercase tracking-tighter">Choose Your Plan</h2>
            <p className="text-zinc-500 max-w-xl mx-auto">Start for free or unlock total power with Doove Pro.</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            <div className="glass p-12 rounded-[2.5rem] border-white/5">
              <h3 className="text-2xl font-bold mb-2">Free</h3>
              <div className="text-4xl font-black mb-8">0 FCFA</div>
              <ul className="space-y-4 mb-12 text-zinc-400">
                <li className="flex items-center gap-3">✓ 5 min / recording</li>
                <li className="flex items-center gap-3">✓ 3 recordings / day</li>
                <li className="flex items-center gap-3">✓ Doove Watermark</li>
              </ul>
              <Link to="/" className="block w-full py-4 rounded-2xl bg-zinc-900 text-center font-bold">Current Plan</Link>
            </div>
            
            <div className="p-12 rounded-[2.5rem] bg-gradient-to-br from-doove-purple to-doove-blue relative overflow-hidden shadow-2xl shadow-doove-purple/20">
              <div className="absolute top-0 right-0 p-8 opacity-20"><Zap size={80} /></div>
              <h3 className="text-2xl font-bold mb-2">Pro</h3>
              <div className="text-4xl font-black mb-8">5000 FCFA <span className="text-white/60 text-lg font-normal">/month</span></div>
              <ul className="space-y-4 mb-12 text-white/90">
                <li className="flex items-center gap-3">✓ Unlimited recordings</li>
                <li className="flex items-center gap-3">✓ No time limits</li>
                <li className="flex items-center gap-3">✓ Priority Support</li>
                <li className="flex items-center gap-3">✓ Lifetime updates</li>
              </ul>
              <Link to="/pay" className="block w-full py-4 rounded-2xl bg-white text-black text-center font-bold hover:scale-105 transition-transform">Upgrade to Pro</Link>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Footer */}
      <section className="py-24 text-center relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-t from-doove-purple/20 to-transparent opacity-20" />
        <div className="max-w-7xl mx-auto px-4 relative z-10">
          <h2 className="text-4xl md:text-6xl font-black mb-8">READY TO START RECORDING?</h2>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 max-w-xl mx-auto">
            <a 
              href={getDownloadUrl(platform === 'other' ? 'mac' : platform as any)}
              className="w-full bg-white text-black px-10 py-5 rounded-2xl font-bold text-lg hover:bg-zinc-200 transition-all transform hover:scale-105 flex items-center justify-center gap-3"
            >
              <Download size={24} />
              Download for macOS
            </a>
            <a 
              href={getDownloadUrl('windows')}
              className="w-full bg-zinc-900 text-white px-10 py-5 rounded-2xl font-bold text-lg border border-white/10 hover:bg-zinc-800 transition-all transform hover:scale-105 flex items-center justify-center gap-3"
            >
              <Monitor size={24} />
              Download for Windows
            </a>
          </div>
          <p className="mt-8 text-zinc-500 font-medium">Start for free today.</p>
        </div>
      </section>

      <footer className="py-12 border-t border-white/10 text-center text-zinc-500 text-sm">
        <div className="max-w-7xl mx-auto px-4 flex flex-col md:flex-row justify-between items-center gap-8">
          <div className="flex items-center gap-2">
            <img src="/logo.svg" alt="Doove Logo" className="w-6 h-6 grayscale opacity-50" />
            <span className="font-bold tracking-tight">DOOVE</span>
          </div>
          <p>© 2026 Doove Team. All rights reserved.</p>
          <div className="flex gap-6">
            <a href="https://github.com/maboaimana4-source/doove-new" className="hover:text-white transition-colors">GitHub</a>
            <a href="#" className="hover:text-white transition-colors">Discord</a>
            <a href="#" className="hover:text-white transition-colors">Terms</a>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
