import { useState, useEffect } from 'react';
import { LogIn, LogOut, User, Shield, Server, ExternalLink, AlertCircle, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface DiscordUser {
  id: string;
  username: string;
  discriminator: string;
  avatar: string;
  global_name: string;
}

interface DiscordGuild {
  id: string;
  name: string;
  icon: string;
  owner: boolean;
  permissions: string;
}

export default function App() {
  const [user, setUser] = useState<DiscordUser | null>(null);
  const [guilds, setGuilds] = useState<DiscordGuild[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [config, setConfig] = useState<{ clientIdSet: boolean; clientSecretSet: boolean; redirectUriSet: boolean; redirectUri: string } | null>(null);

  const checkConfig = async () => {
    try {
      const res = await fetch('/api/config-check');
      if (res.ok) {
        const data = await res.json();
        setConfig(data);
      }
    } catch (err) {
      console.error('Failed to check config:', err);
    }
  };

  const loadUserData = async () => {
    try {
      const userRes = await fetch('/api/user');
      if (userRes.ok) {
        const userData = await userRes.json();
        setUser(userData);
        
        // Fetch guilds if user is authenticated
        const guildsRes = await fetch('/api/guilds');
        if (guildsRes.ok) {
          const guildsData = await guildsRes.json();
          setGuilds(guildsData);
        }
      } else {
        setUser(null);
      }
    } catch (err) {
      console.error('Failed to load user data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkConfig();
    loadUserData();

    const handleMessage = (event: MessageEvent) => {
      // Validate origin
      const origin = event.origin;
      if (!origin.endsWith('.run.app') && !origin.includes('localhost')) {
        return;
      }
      
      if (event.data?.type === 'OAUTH_AUTH_SUCCESS') {
        setLoading(true);
        loadUserData();
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const handleLogin = async () => {
    try {
      setError(null);
      const response = await fetch('/api/auth/url');
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to get auth URL');
      }
      const { url } = await response.json();

      // Open Discord auth URL directly in popup
      const width = 500;
      const height = 750;
      const left = window.screenX + (window.outerWidth - width) / 2;
      const top = window.screenY + (window.outerHeight - height) / 2;
      
      const authWindow = window.open(
        url,
        'discord_oauth_popup',
        `width=${width},height=${height},left=${left},top=${top}`
      );

      if (!authWindow) {
        setError('Popup blocked! Please allow popups for this site.');
      }
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      setUser(null);
      setGuilds([]);
    } catch (err) {
      console.error('Logout failed:', err);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <motion.div 
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          className="w-12 h-12 border-4 border-[#5865F2] border-t-transparent rounded-full"
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white font-sans selection:bg-[#5865F2]/30">
      {/* Background Atmosphere */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-[#5865F2]/10 blur-[120px] rounded-full" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-[#5865F2]/5 blur-[120px] rounded-full" />
      </div>

      <main className="relative z-10 max-w-5xl mx-auto px-6 py-12">
        <AnimatePresence mode="wait">
          {!user ? (
            <motion.div
              key="login"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="flex flex-col items-center justify-center min-h-[70vh] text-center"
            >
              <div className="mb-8 p-4 bg-[#5865F2]/10 rounded-3xl border border-[#5865F2]/20">
                <Shield className="w-16 h-16 text-[#5865F2]" />
              </div>
              <h1 className="text-5xl md:text-7xl font-bold tracking-tight mb-6 bg-gradient-to-b from-white to-white/60 bg-clip-text text-transparent">
                Discord Auth Explorer
              </h1>

              {config && (!config.clientIdSet || !config.clientSecretSet || !config.redirectUriSet) && (
                <motion.div 
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mb-8 p-6 bg-amber-500/10 border border-amber-500/20 rounded-2xl text-left max-w-xl"
                >
                  <div className="flex items-center gap-3 text-amber-400 mb-3">
                    <AlertCircle className="w-6 h-6" />
                    <h3 className="font-bold">Configuration Required</h3>
                  </div>
                  <p className="text-sm text-gray-400 mb-4">
                    To use Discord login, you must set the following environment variables in the <b>Settings &gt; Secrets</b> panel:
                  </p>
                  <ul className="space-y-2 text-xs font-mono">
                    <li className={`flex items-center gap-2 ${config.clientIdSet ? 'text-green-400' : 'text-amber-400'}`}>
                      {config.clientIdSet ? '✓' : '✗'} DISCORD_CLIENT_ID
                    </li>
                    <li className={`flex items-center gap-2 ${config.clientSecretSet ? 'text-green-400' : 'text-amber-400'}`}>
                      {config.clientSecretSet ? '✓' : '✗'} DISCORD_CLIENT_SECRET
                    </li>
                    <li className={`flex items-center gap-2 ${config.redirectUriSet ? 'text-green-400' : 'text-amber-400'}`}>
                      {config.redirectUriSet ? '✓' : '✗'} DISCORD_REDIRECT_URI
                    </li>
                  </ul>
                  <div className="mt-4 p-3 bg-black/40 rounded-lg border border-white/5">
                    <p className="text-[10px] text-gray-500 uppercase mb-1">Required Callback URL:</p>
                    <code className="text-[11px] text-[#5865F2] break-all">{config.redirectUri || 'https://YOUR_APP_URL/auth/callback'}</code>
                  </div>
                </motion.div>
              )}

              <p className="text-lg text-gray-400 max-w-xl mb-10 leading-relaxed">
                A secure implementation of the Discord OAuth2 authorization code flow. 
                Experience seamless authentication and profile data fetching.
              </p>

              {error && (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="mb-8 flex items-center gap-3 px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm"
                >
                  <AlertCircle className="w-5 h-5" />
                  {error}
                </motion.div>
              )}

              <button
                onClick={handleLogin}
                className="group relative flex items-center gap-3 px-8 py-4 bg-[#5865F2] hover:bg-[#4752C4] transition-all duration-300 rounded-2xl font-semibold text-lg shadow-xl shadow-[#5865F2]/20 hover:shadow-[#5865F2]/40 active:scale-95"
              >
                <LogIn className="w-6 h-6" />
                Connect with Discord
                <div className="absolute inset-0 rounded-2xl border-2 border-white/0 group-hover:border-white/20 transition-all duration-300" />
              </button>
              
              <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6 text-left max-w-4xl">
                {[
                  { icon: Shield, title: "Secure Flow", desc: "Uses Authorization Code flow with server-side token exchange." },
                  { icon: User, title: "Profile Data", desc: "Fetches username, ID, and avatar using the @me endpoint." },
                  { icon: Server, title: "Guild Access", desc: "Optionally retrieves the list of servers you are in." }
                ].map((item, i) => (
                  <div key={i} className="p-6 bg-white/5 border border-white/10 rounded-2xl hover:bg-white/10 transition-colors">
                    <item.icon className="w-8 h-8 text-[#5865F2] mb-4" />
                    <h3 className="font-semibold mb-2">{item.title}</h3>
                    <p className="text-sm text-gray-400">{item.desc}</p>
                  </div>
                ))}
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="dashboard"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="space-y-8"
            >
              {/* Header */}
              <div className="flex flex-col md:flex-row items-center justify-between gap-6 p-8 bg-white/5 border border-white/10 rounded-3xl backdrop-blur-xl">
                <div className="flex items-center gap-6">
                  <div className="relative">
                    <img 
                      src={user.avatar ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png` : `https://cdn.discordapp.com/embed/avatars/${parseInt(user.id) % 5}.png`}
                      alt={user.username}
                      className="w-24 h-24 rounded-full border-4 border-[#5865F2] shadow-2xl"
                      referrerPolicy="no-referrer"
                    />
                    <div className="absolute bottom-1 right-1 w-6 h-6 bg-green-500 border-4 border-[#1a1a1a] rounded-full" />
                  </div>
                  <div>
                    <h2 className="text-3xl font-bold">{user.global_name || user.username}</h2>
                    <p className="text-gray-400">@{user.username}</p>
                    <div className="flex items-center gap-2 mt-2 px-3 py-1 bg-[#5865F2]/20 border border-[#5865F2]/30 rounded-full w-fit">
                      <CheckCircle2 className="w-4 h-4 text-[#5865F2]" />
                      <span className="text-xs font-medium text-[#5865F2]">Authenticated</span>
                    </div>
                  </div>
                </div>
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-2 px-6 py-3 bg-white/5 hover:bg-red-500/10 border border-white/10 hover:border-red-500/20 transition-all rounded-2xl font-medium text-gray-300 hover:text-red-400"
                >
                  <LogOut className="w-5 h-5" />
                  Sign Out
                </button>
              </div>

              {/* Stats/Info Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="p-6 bg-white/5 border border-white/10 rounded-3xl">
                  <p className="text-sm text-gray-400 mb-1 uppercase tracking-wider font-semibold">Discord ID</p>
                  <p className="text-2xl font-mono font-bold text-[#5865F2]">{user.id}</p>
                </div>
                <div className="p-6 bg-white/5 border border-white/10 rounded-3xl">
                  <p className="text-sm text-gray-400 mb-1 uppercase tracking-wider font-semibold">Servers</p>
                  <p className="text-2xl font-bold">{guilds.length}</p>
                </div>
                <div className="p-6 bg-white/5 border border-white/10 rounded-3xl">
                  <p className="text-sm text-gray-400 mb-1 uppercase tracking-wider font-semibold">Status</p>
                  <p className="text-2xl font-bold text-green-400">Active Session</p>
                </div>
              </div>

              {/* Guilds List */}
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-2xl font-bold flex items-center gap-3">
                    <Server className="w-6 h-6 text-[#5865F2]" />
                    Your Servers
                  </h3>
                  <span className="px-3 py-1 bg-white/5 border border-white/10 rounded-lg text-sm text-gray-400">
                    {guilds.length} Total
                  </span>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {guilds.map((guild) => (
                    <motion.div
                      key={guild.id}
                      whileHover={{ y: -4 }}
                      className="group p-4 bg-white/5 border border-white/10 rounded-2xl hover:bg-white/10 transition-all cursor-default"
                    >
                      <div className="flex items-center gap-4">
                        {guild.icon ? (
                          <img 
                            src={`https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.png`}
                            alt={guild.name}
                            className="w-12 h-12 rounded-xl"
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <div className="w-12 h-12 rounded-xl bg-[#5865F2]/20 flex items-center justify-center text-lg font-bold text-[#5865F2]">
                            {guild.name.charAt(0)}
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold truncate">{guild.name}</p>
                          <div className="flex items-center gap-2">
                            {guild.owner && (
                              <span className="text-[10px] px-2 py-0.5 bg-yellow-500/20 text-yellow-500 border border-yellow-500/30 rounded-full font-bold uppercase">Owner</span>
                            )}
                            <span className="text-[10px] text-gray-500 font-mono truncate">ID: {guild.id}</span>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>

              {/* Footer Info */}
              <div className="pt-12 border-t border-white/10 flex flex-col md:flex-row items-center justify-between gap-4 text-gray-500 text-sm">
                <p>© 2026 Discord Auth Explorer • Built for AI Studio</p>
                <div className="flex items-center gap-6">
                  <a href="https://discord.com/developers/docs/intro" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors flex items-center gap-1">
                    API Docs <ExternalLink className="w-3 h-3" />
                  </a>
                  <a href="#" className="hover:text-white transition-colors">Terms of Service</a>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
