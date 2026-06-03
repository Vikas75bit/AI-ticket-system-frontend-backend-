import { useEffect, useState } from "react";
import axios from "axios";
import { supabase } from "./supabase";

import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";

function App() {
  const [analytics, setAnalytics] = useState(null);
  const [tickets, setTickets] = useState([]); 
  const [searchTerm, setSearchTerm] = useState("");
  const [urgencyFilter, setUrgencyFilter] = useState("All");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [darkMode, setDarkMode] = useState(false);

  // --- DAY 10 HUMAN-IN-THE-LOOP STATE CONTROL ---
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [overrideText, setOverrideText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Modularize fetch commands so we can trigger them again instantly after a database patch mutation
  const fetchAnalytics = async () => {
    try {
      const response = await fetch("http://localhost:8000/analytics");
      if (!response.ok) throw new Error("Failed to fetch analytics");
      const data = await response.json();
      setAnalytics(data);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchTickets = () => {
    axios
      .get("http://localhost:8000/tickets")
      .then((response) => {
        setTickets(Array.isArray(response.data) ? response.data : []);
      })
      .catch((error) => {
        console.error("Failed to query records stream:", error);
      });
  };

  useEffect(() => {
    setLoading(true);
    fetchAnalytics();
    fetchTickets();

    const interval = setInterval(() => {
      fetchAnalytics();
      fetchTickets();
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  // --- AXIOS PATCH INTERACTION METHOD ---
  const handleApplyOverride = async (e) => {
    e.preventDefault();
    if (!selectedTicket || !overrideText.trim()) return;

    setIsSubmitting(true);
    try {
      await axios.patch(`http://localhost:8000/tickets/${selectedTicket.id}/override`, {
        manual_action: overrideText,
      });

      // Instantly refresh localized state cache arrays from database sources
      fetchAnalytics();
      fetchTickets();

      // Shut down modal and wipe buffer contexts
      setSelectedTicket(null);
      setOverrideText("");
    } catch (err) {
      alert(`Override Failed to execute across cloud gateway: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // --- LOGOUT HANDLER ---
  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  const filteredTickets = tickets.filter((ticket) => {
    const sender = String(ticket.sender || "");
    const subject = String(ticket.subject || "");
    const normalizedSearchTerm = searchTerm.toLowerCase();

    const matchesSearch =
      sender.toLowerCase().includes(normalizedSearchTerm) ||
      subject.toLowerCase().includes(normalizedSearchTerm);

    const matchesUrgency =
      urgencyFilter === "All" || ticket.urgency === urgencyFilter;

    return matchesSearch && matchesUrgency;
  });

  const priorityData = [
    { name: "High", value: tickets.filter((ticket) => ticket.urgency === "High").length },
    { name: "Medium", value: tickets.filter((ticket) => ticket.urgency === "Medium").length },
    { name: "Low", value: tickets.filter((ticket) => ticket.urgency === "Low").length },
  ];

  const COLORS = ["#ef4444", "#facc15", "#22c55e"];

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200 p-8">
        <div className="rounded-3xl bg-white p-10 shadow-2xl text-center text-xl font-semibold text-slate-700">
          Loading Dashboard Framework...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200 p-8">
        <div className="rounded-3xl bg-white p-10 shadow-2xl text-center text-xl font-semibold text-rose-600">
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen p-6 transition-all duration-500 relative ${
      darkMode ? "bg-slate-900 text-white" : "bg-gradient-to-br from-slate-100 to-slate-200 text-black"
    }`}>
      <div className="flex justify-between items-center mb-10">
        <h1 className={`text-5xl font-extrabold ${darkMode ? "text-white" : "text-slate-800"}`}>
          AI Ticket Dashboard
        </h1>
        <div className="flex gap-3">
          <button
            onClick={() => setDarkMode(!darkMode)}
            className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold transition shadow-lg"
          >
            {darkMode ? "☀️ Light Mode" : "🌙 Dark Mode"}
          </button>
          <button
            onClick={handleLogout}
            className="px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-semibold transition shadow-lg"
          >
            Logout
          </button>
        </div>
      </div>

      {analytics ? (
        <>
          {/* METRIC GRIDS */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className={`p-6 rounded-2xl shadow-lg ${darkMode ? "bg-slate-800 text-white" : "bg-white"}`}>
              <h2 className="text-xl font-semibold text-slate-400 mb-2">Total Tickets</h2>
              <p className="text-4xl font-bold">{analytics.total_tickets}</p>
            </div>

            <div className={`p-6 rounded-2xl shadow-lg ${darkMode ? "bg-slate-800 text-white" : "bg-white"}`}>
              <h2 className="text-xl font-semibold text-slate-400 mb-2">High Priority</h2>
              <p className="text-4xl font-bold text-red-500">{analytics.high_priority_tickets}</p>
            </div>

            <div className={`p-6 rounded-2xl shadow-lg ${darkMode ? "bg-slate-800 text-white" : "bg-white"}`}>
              <h2 className="text-xl font-semibold text-slate-400 mb-2">System Status</h2>
              <p className="text-3xl font-bold text-green-600">{analytics.system_status}</p>
            </div>
          </div>

          {/* RECHARTS DATA VISUALIZATION VECTORS */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-10">
            <div className={`rounded-2xl shadow-lg p-6 ${darkMode ? "bg-slate-800" : "bg-white"}`}>
              <h2 className="text-2xl font-bold mb-6">Ticket Priority Distribution</h2>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={priorityData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, value }) => `${name}: ${value}`}
                    outerRadius={100}
                    dataKey="value"
                  >
                    {priorityData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div className={`rounded-2xl shadow-lg p-6 ${darkMode ? "bg-slate-800" : "bg-white"}`}>
              <h2 className="text-2xl font-bold mb-6">Ticket Volume Analytics</h2>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={priorityData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="value" fill="#8884d8" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* STREAM TABLE SECTION */}
          <div className={`mt-10 rounded-2xl shadow-lg p-6 ${darkMode ? "bg-slate-800" : "bg-white"}`}>
            <h2 className="text-2xl font-bold mb-6">Live Tickets</h2>

            <div className="flex flex-col md:flex-row gap-4 mb-6">
              <input
                type="text"
                placeholder="Search tickets..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className={`border rounded-xl px-4 py-2 w-full md:w-1/2 ${darkMode ? "bg-slate-900 border-slate-700 text-white" : "bg-white"}`}
              />

              <select
                value={urgencyFilter}
                onChange={(e) => setUrgencyFilter(e.target.value)}
                className={`border rounded-xl px-4 py-2 w-full md:w-1/4 ${darkMode ? "bg-slate-900 border-slate-700 text-white" : "bg-white"}`}
              >
                <option value="All">All Priorities</option>
                <option value="High">High</option>
                <option value="Medium">Medium</option>
                <option value="Low">Low</option>
              </select>
            </div>

            <div className="overflow-x-auto mt-4">
              <table className="min-w-full text-left text-sm border-collapse">
                <thead>
                  <tr className="border-b border-slate-700/50 text-slate-400 font-semibold">
                    <th className="p-3">Sender</th>
                    <th className="p-3">Subject</th>
                    <th className="p-3">Urgency</th>
                    <th className="p-3">Department</th>
                    <th className="p-3">Sentiment</th>
                    <th className="p-3">Action Records</th>
                    <th className="p-3 text-center">Intervene</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTickets.map((ticket) => (
                    <tr key={ticket.id} className="border-b border-slate-700/30 hover:bg-slate-500/10 transition-colors duration-150">
                      <td className="p-3 font-medium">{ticket.sender}</td>
                      <td className="p-3 max-w-xs truncate">{ticket.subject}</td>
                      <td className="p-3">
                        <span className={`px-2.5 py-1 rounded-full text-white text-xs font-bold ${
                          ticket.urgency === "High" ? "bg-red-500" : ticket.urgency === "Medium" ? "bg-yellow-500 text-slate-950" : "bg-green-500"
                        }`}>
                          {ticket.urgency || "Low"}
                        </span>
                      </td>
                      <td className="p-3 font-semibold text-blue-400">{ticket.department}</td>
                      <td className="p-3 italic text-slate-400">{ticket.sentiment}</td>
                      <td className="p-3 font-mono text-xs max-w-sm truncate">
                        <span className={`px-2 py-1 rounded text-xs ${
                          ticket.action_taken?.includes("[MANUAL OVERRIDE") ? "bg-amber-500/20 text-amber-400" : "bg-slate-700/30 text-slate-300"
                        }`}>
                          {ticket.action_taken || "Processing..."}
                        </span>
                      </td>
                      <td className="p-3 text-center">
                        <button
                          onClick={() => { setSelectedTicket(ticket); setOverrideText(""); }}
                          className="px-3 py-1 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs rounded-lg transition transform hover:scale-105"
                        >
                          Override
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : (
        <p>Loading analytics streams...</p>
      )}

      {/* --- DAY 10 FULL EXTENSION MODAL DIALOG PORTAL --- */}
      {selectedTicket && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className={`max-w-lg w-full rounded-2xl shadow-2xl border p-6 overflow-hidden ${
            darkMode ? "bg-slate-800 border-slate-700 text-white" : "bg-white border-slate-200 text-black"
          }`}>
            <h2 className="text-2xl font-black mb-1">Human Intervention Deck</h2>
            <p className="text-xs text-slate-400 border-b border-slate-700/40 pb-3 mb-4">
              Overriding ticket <span className="font-mono text-blue-500 font-bold">#{selectedTicket.id}</span> from {selectedTicket.sender}
            </p>

            <div className="space-y-3 mb-4">
              <div>
                <label className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block mb-1">Subject Matter</label>
                <div className={`text-sm p-3 rounded-lg font-medium ${darkMode ? "bg-slate-900" : "bg-slate-100"}`}>{selectedTicket.subject}</div>
              </div>
              <div>
                <label className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block mb-1">Active AI Action Statement</label>
                <div className="text-xs font-mono p-3 rounded-lg bg-slate-900/30 border border-slate-700/30 text-slate-400">{selectedTicket.action_taken}</div>
              </div>
            </div>

            <form onSubmit={handleApplyOverride}>
              <div className="mb-6">
                <label className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block mb-1.5">Executive Response Correction</label>
                <textarea
                  required
                  rows={3}
                  value={overrideText}
                  onChange={(e) => setOverrideText(e.target.value)}
                  placeholder="Type the manual correction here... (e.g., Force approved standard refund exception.)"
                  className={`w-full px-3 py-2 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 transition ${
                    darkMode ? "bg-slate-900 border-slate-700 text-white" : "bg-white border text-black"
                  }`}
                />
              </div>

              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setSelectedTicket(null)}
                  className="px-4 py-2 rounded-xl bg-slate-600 hover:bg-slate-500 font-semibold text-sm text-white transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 disabled:bg-amber-700 font-bold text-sm text-slate-950 shadow-lg transition"
                >
                  {isSubmitting ? "Updating Database..." : "Apply Override"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
