import { useState } from "react";
import { supabase } from "./supabase";

function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [notification, setNotification] = useState({ message: "", type: "" });

  const showNotification = (message, type = "error") => {
    setNotification({ message, type });
    setTimeout(() => {
      setNotification({ message: "", type: "" });
    }, 5000);
  };

  const handleSignup = async () => {
    if (!email || !password) {
      showNotification("Please enter both email and password.");
      return;
    }
    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error) {
      showNotification(error.message, "error");
      setLoading(false);
    } else {
      const { error: roleError } = await supabase
        .from("user_roles")
        .insert([
          {
            id: data.user.id,
            email: email,
            role: "user",
          },
        ]);

      if (roleError) {
        showNotification("Signup succeeded, but role mapping failed: " + roleError.message, "error");
      } else {
        showNotification("Signup successful! You can now log in.", "success");
      }
      setLoading(false);
    }
  };

  const handleLogin = async () => {
    if (!email || !password) {
      showNotification("Please enter both email and password.");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      showNotification(error.message, "error");
      setLoading(false);
    } else {
      // Role mapping session hooks in main.jsx handle redirection
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6 relative overflow-hidden">
      {/* Background radial glow accents */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl"></div>
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl"></div>

      <div className="max-w-md w-full bg-slate-900/40 backdrop-blur-xl border border-slate-800/80 rounded-3xl p-10 shadow-2xl relative z-10 transition-all duration-300 hover:border-slate-800">
        <div className="text-center mb-8">
          <span className="px-3 py-1 bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 rounded-full text-[10px] font-bold tracking-widest uppercase">
            Portal Access
          </span>
          <h1 className="text-3xl font-extrabold text-white mt-4 tracking-tight">
            Welcome Back
          </h1>
          <p className="text-sm text-slate-400 mt-2">
            Sign in to access your intelligent ticket support console.
          </p>
        </div>

        {/* Localized Notifications */}
        {notification.message && (
          <div
            className={`mb-6 p-4 rounded-xl text-sm border flex items-start gap-2.5 transition-all duration-300 ${
              notification.type === "success"
                ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                : "bg-rose-500/10 border-rose-500/20 text-rose-400"
            }`}
          >
            <span>{notification.type === "success" ? "✓" : "⚠"}</span>
            <p className="flex-1 leading-tight">{notification.message}</p>
          </div>
        )}

        <div className="space-y-5">
          <div>
            <label className="text-[11px] uppercase font-bold tracking-wider text-slate-400 block mb-2">
              Email Address
            </label>
            <input
              type="email"
              placeholder="name@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
              className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition duration-150"
            />
          </div>

          <div>
            <label className="text-[11px] uppercase font-bold tracking-wider text-slate-400 block mb-2">
              Password
            </label>
            <input
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
              className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition duration-150"
            />
          </div>

          <div className="pt-2 flex flex-col gap-3">
            <button
              onClick={handleLogin}
              disabled={loading}
              className="w-full py-3 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 disabled:opacity-50 text-white font-bold text-sm rounded-xl shadow-lg transition duration-150 transform active:scale-[0.98]"
            >
              {loading ? "Authenticating..." : "Sign In"}
            </button>

            <button
              onClick={handleSignup}
              disabled={loading}
              className="w-full py-3 bg-slate-950 hover:bg-slate-900 border border-slate-800 disabled:opacity-50 text-slate-300 font-bold text-sm rounded-xl transition duration-150 transform active:scale-[0.98]"
            >
              Create Account
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Login;
