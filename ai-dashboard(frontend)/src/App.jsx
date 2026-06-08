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
  const [ticketFilter, setTicketFilter] = useState("all");

  // --- DAY 10 HUMAN-IN-THE-LOOP STATE CONTROL ---
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [overrideText, setOverrideText] = useState("");
  const [resolutionNote, setResolutionNote] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // --- DAY 13 MONETIZATION ENGINE STATE HOOKS ---
  const [showPaywall, setShowPaywall] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState(false);

  const [activityFeed, setActivityFeed] = useState([]);

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

    const channel = supabase
      .channel("admin-tickets")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "tickets",
        },
        (payload) => {
          const activity = {
            time: new Date().toLocaleTimeString(),
            event: payload.eventType,
            ticketId: payload.new?.id || payload.old?.id,
          };

          setActivityFeed((current) => [
            activity,
            ...current.slice(0, 9)
          ]);

          fetchTickets();
          fetchAnalytics();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
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

  // --- DAY 13 INITIALIZE SANDBOX CHECKOUT HANDSHAKE ---
  const handleTriggerCheckout = async (planName, priceAmount) => {
    setCheckoutLoading(true);
    try {
      console.log(`Initializing sandbox checkout handshake for: ${planName} (${priceAmount})`);
      await new Promise((resolve) => setTimeout(resolve, 1500));
      alert(`🔴 REDIRECTING TO PAYMENT GATEWAY SANDBOX 🔴\n\nPlan: ${planName}\nAmount: ${priceAmount}\n\nLoading secure checkout interface...`);
      setShowPaywall(false);
    } catch (err) {
      alert(`Payment Gateway Handshake Interrupted: ${err.message}`);
    } finally {
      setCheckoutLoading(false);
    }
  };

  
  // --- UPDATE STATUS FUNCTION ---
const updateStatus = async (ticketId, newStatus) => {

  const { data, error } = await supabase
    .from("tickets")
    .update({
      status: newStatus,
    })
    .eq("id", ticketId);

  console.log("Ticket ID:", ticketId);
  console.log("New Status:", newStatus);

  console.log("Update Data:", data);
  console.log("Update Error:", error);

  fetchTickets();
};

const updateResolutionNote = async (
  ticketId,
  note
) => {

  const { error } = await supabase
    .from("tickets")
    .update({
      resolution_note: note,
    })
    .eq("id", ticketId);

  if (error) {
    console.error(error);
    alert(error.message);
    return;
  }

  fetchTickets();

  alert("Resolution note saved!");
};

const assignTicket = async (
  ticketId,
  assignedAgent
) => {

  const { error } = await supabase
    .from("tickets")
    .update({
      assigned_to: assignedAgent,
    })
    .eq("id", ticketId);

  if (error) {
    console.error(error);
    return;
  }

  fetchTickets();
};

  const openOverrideModal = (ticket) => {
    setSelectedTicket(ticket);
    setOverrideText("");
    setResolutionNote(ticket.resolution_note || "");
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

  const displayedTickets = filteredTickets.filter(
    (ticket) => {

      if (ticketFilter === "mine") {
        return ticket.assigned_to === "admin@gmail.com";
      }

      if (ticketFilter === "unassigned") {
        return !ticket.assigned_to;
      }

      return true;
    }
  );

  const assignedTickets =
    tickets.filter(
      (ticket) => ticket.assigned_to
    ).length;

  const unassignedTickets =
    tickets.filter(
      (ticket) => !ticket.assigned_to
    ).length;

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
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-6">
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

            <div className="bg-blue-600 text-white p-6 rounded-2xl shadow-lg">
              <h3 className="text-xl font-semibold text-blue-100 mb-2">Assigned Tickets</h3>
              <p className="text-4xl font-bold">{assignedTickets}</p>
            </div>

            <div className="bg-amber-600 text-white p-6 rounded-2xl shadow-lg">
              <h3 className="text-xl font-semibold text-amber-100 mb-2">Unassigned Tickets</h3>
              <p className="text-4xl font-bold">{unassignedTickets}</p>
            </div>
          </div>

          {/* LIVE ACTIVITY FEED */}
          <div className={`rounded-2xl p-6 shadow-lg mt-6 ${darkMode ? "bg-slate-800 text-white" : "bg-white"}`}>
            <h2 className="text-xl font-bold mb-3">
              Live Activity Feed
            </h2>

            {activityFeed.map((item, index) => (
              <div
                key={index}
                className={`border-b py-2 text-sm ${darkMode ? "border-slate-700/50" : "border-slate-200"}`}
              >
                [{item.time}] {item.event}
                {" "}
                Ticket #{item.ticketId}
              </div>
            ))}
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

            <div className="flex gap-2 mb-6">
              <button
                onClick={() => setTicketFilter("all")}
                className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-150 ${
                  ticketFilter === "all"
                    ? "bg-blue-600 text-white shadow-md scale-105"
                    : darkMode
                    ? "bg-slate-700 text-slate-300 hover:bg-slate-600"
                    : "bg-slate-200 text-slate-700 hover:bg-slate-300"
                }`}
              >
                All Tickets
              </button>

              <button
                onClick={() => setTicketFilter("mine")}
                className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-150 ${
                  ticketFilter === "mine"
                    ? "bg-green-600 text-white shadow-md scale-105"
                    : darkMode
                    ? "bg-slate-700 text-slate-300 hover:bg-slate-600"
                    : "bg-slate-200 text-slate-700 hover:bg-slate-300"
                }`}
              >
                My Tickets
              </button>

              <button
                onClick={() => setTicketFilter("unassigned")}
                className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-150 ${
                  ticketFilter === "unassigned"
                    ? "bg-amber-600 text-white shadow-md scale-105"
                    : darkMode
                    ? "bg-slate-700 text-slate-300 hover:bg-slate-600"
                    : "bg-slate-200 text-slate-700 hover:bg-slate-300"
                }`}
              >
                Unassigned
              </button>
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
                    <th className="p-3">Resolution Note</th>
                    <th className="p-3">Assigned To</th>
                    <th className="p-3">Status</th>
                    <th className="p-3 text-center">Intervene</th>
                  </tr>
                </thead>
                <tbody>
                  {displayedTickets.map((ticket) => (
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
                      <td className="p-3 max-w-sm">
                        <div className={`text-xs leading-5 ${
                          ticket.resolution_note ? "text-green-500" : "text-slate-400"
                        }`}>
                          {ticket.resolution_note || "No resolution yet"}
                        </div>
                      </td>
                      <td className="p-3">
                        <select
                          value={ticket.assigned_to || ""}
                          onChange={(e) =>
                            assignTicket(
                              ticket.id,
                              e.target.value
                            )
                          }
                          className={`border rounded-lg px-2 py-1 text-xs ${
                            darkMode
                              ? "bg-slate-900 border-slate-700 text-white"
                              : "bg-white border-slate-300"
                          }`}
                        >
                          <option value="">
                            Unassigned
                          </option>

                          <option value="admin@gmail.com">
                            admin@gmail.com
                          </option>
                        </select>
                      </td>
                      <td className="p-3">
                        <div
                          className={`mb-2 text-xs font-bold ${
                            ticket.status === "Open"
                              ? "text-red-400"
                              : ticket.status === "In Progress"
                              ? "text-yellow-400"
                              : ticket.status === "Resolved"
                              ? "text-green-400"
                              : "text-slate-400"
                          }`}
                        >
                          {ticket.status}
                        </div>
                        <select
                          value={ticket.status || "Open"}
                          onChange={(e) =>
                          updateStatus(
                          ticket.id,
                          e.target.value
                            )
                          }
                          className={`border rounded-lg px-2 py-1 text-xs font-semibold ${
                            darkMode ? "bg-slate-900 border-slate-700 text-white" : "bg-white border-slate-300"
                          }`}
                        >
                      <option value="Open">Open</option>
                          <option value="In Progress">In Progress</option>
                          <option value="Resolved">Resolved</option>
                          <option value="Closed">Closed</option>
                        </select>
                      </td>
                      <td className="p-3 text-center">
                        <button
                          onClick={() => openOverrideModal(ticket)}
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
              <div>
                <label className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block mb-1">Current Resolution Note</label>
                <div className="text-xs p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-green-400">
                  {selectedTicket.resolution_note || "No resolution note saved yet."}
                </div>
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
              <div className="mb-6">
                <label className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block mb-1.5">Resolution Note</label>
                <textarea
                  rows={3}
                  value={resolutionNote}
                  onChange={(e) => setResolutionNote(e.target.value)}
                  placeholder="Write the customer-facing resolution note..."
                  className={`w-full px-3 py-2 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500 transition ${
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
                  type="button"
                  onClick={() =>
                    updateResolutionNote(
                      selectedTicket.id,
                      resolutionNote
                    )
                  }
                  className="bg-green-600 text-white px-4 py-2 rounded"
                >
                  Save Resolution
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

      {/* DEV HELPER TRIGGER BUTTON FOR DAY 13 MANUAL TESTING */}
      <div className="fixed bottom-6 right-6 z-40">
        <button
          onClick={() => setShowPaywall(true)}
          className="px-4 py-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white font-black rounded-full shadow-2xl hover:scale-105 transition duration-200 text-xs border border-purple-400"
        >
          💰 Test Paywall Trigger
        </button>
      </div>

      {/* --- DAY 13 ENTERPRISE PAYWALL UPGRADE MODAL --- */}
      {showPaywall && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4 text-white">
          <div className="max-w-3xl w-full bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl p-8 relative overflow-hidden">
            
            {/* Background design accents */}
            <div className="absolute -top-24 -right-24 w-48 h-48 bg-blue-500/10 rounded-full blur-3xl"></div>
            <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-purple-500/10 rounded-full blur-3xl"></div>

            <div className="text-center mb-8">
              <span className="px-3 py-1 bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-full text-xs font-bold tracking-widest uppercase">
                Usage Quota Exceeded
              </span>
              <h2 className="text-3xl font-black text-white mt-3">Unlock Premium AI Processing</h2>
              <p className="text-sm text-slate-400 mt-1 max-w-md mx-auto">
                Your workspace has hit the limit of 10 free autonomous triages. Upgrade your plan to keep your workflows automated.
              </p>
            </div>

            {/* PRICING CARDS DOCK */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-stretch">
              
              {/* CURRENT FREE PLAN HIGHLIGHT */}
              <div className="bg-slate-800/40 border border-slate-800 rounded-2xl p-6 flex flex-col justify-between relative opacity-60">
                <div>
                  <h3 className="text-lg font-bold text-slate-400">Starter Free Tier</h3>
                  <p className="text-xs text-slate-500 mt-1">For testing evaluation setups.</p>
                  <div className="mt-4 flex items-baseline gap-1 text-slate-300">
                    <span className="text-3xl font-black">₹0</span>
                    <span className="text-xs text-slate-500">/ forever</span>
                  </div>
                  <ul className="mt-6 space-y-2.5 text-xs text-slate-400">
                    <li className="flex items-center gap-2">❌ Max 10 automated triages / month</li>
                    <li className="flex items-center gap-2">✔️ Basic Llama Sentiment analysis</li>
                    <li className="flex items-center gap-2">❌ No Human Override clearance logs</li>
                  </ul>
                </div>
                <button disabled className="w-full py-2.5 mt-8 bg-slate-800 text-slate-600 font-bold text-sm rounded-xl cursor-not-allowed">
                  Current Tier Exhausted
                </button>
              </div>

              {/* PREMIUM ACTIVE TARGET CONVERSION PLAN */}
              <div className="bg-gradient-to-b from-slate-800 to-slate-800/80 border-2 border-blue-500 rounded-2xl p-6 flex flex-col justify-between relative shadow-xl transform scale-[1.02]">
                <div className="absolute -top-3 right-4 px-2.5 py-0.5 bg-blue-500 text-white text-[10px] font-black tracking-wider rounded-full uppercase">
                  Highly Recommended
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">Growth Operations Tier</h3>
                  <p className="text-xs text-blue-400 mt-1">For production-scale automation.</p>
                  <div className="mt-4 flex items-baseline gap-1 text-white">
                    <span className="text-4xl font-black">₹4,999</span>
                    <span className="text-xs text-slate-400">/ month</span>
                  </div>
                  <ul className="mt-6 space-y-2.5 text-xs text-slate-300">
                    <li className="flex items-center gap-2">⚡ <strong className="text-blue-400">Unlimited</strong> Autonomous AI Triages</li>
                    <li className="flex items-center gap-2">⚡ Priority Celery Background Worker Queues</li>
                    <li className="flex items-center gap-2">🔒 Complete Human-in-the-Loop Override Rights</li>
                    <li className="flex items-center gap-2">📊 Advanced Recharts Visual Reporting Metrics</li>
                  </ul>
                </div>
                <button
                  onClick={() => handleTriggerCheckout("Growth Operations Tier", "₹4,999/mo")}
                  disabled={checkoutLoading}
                  className="w-full py-3 mt-8 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-black text-sm rounded-xl shadow-lg transition duration-150 transform active:scale-95"
                >
                  {checkoutLoading ? "Connecting Secure Server Pipe..." : "Unlock Unlimited Premium Tier"}
                </button>
              </div>

            </div>

            {/* CLOSING BUTTON */}
            <div className="text-center mt-6">
              <button onClick={() => setShowPaywall(false)} className="text-xs font-semibold text-slate-500 hover:text-slate-300 transition underline">
                Back to dashboard read-only view
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
export default App;
