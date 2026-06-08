import { useEffect, useState } from "react";
import axios from "axios";
import { supabase } from "./supabase";

const API_BASE_URL = "http://localhost:8000";

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

  const [selectedTicket, setSelectedTicket] = useState(null);
  const [overrideText, setOverrideText] = useState("");
  const [resolutionNote, setResolutionNote] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [showPaywall, setShowPaywall] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState(false);

  const [activityFeed, setActivityFeed] = useState([]);
  const [notification, setNotification] = useState({ message: "", type: "" });

  const [selectedCommentTicket, setSelectedCommentTicket] = useState(null);
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState("");
  const [readComments, setReadComments] = useState({});

  useEffect(() => {
    setReadComments(JSON.parse(localStorage.getItem("read_comments") || "{}"));
  }, []);

  const showNotification = (message, type = "error") => {
    setNotification({ message, type });
    setTimeout(() => {
      setNotification({ message: "", type: "" });
    }, 5000);
  };

  const loadComments = async (ticketId) => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/tickets/${ticketId}/comments`
      );
      if (!response.ok) {
        throw new Error("Failed to load comments");
      }
      const data = await response.json();
      const commentsArray = Array.isArray(data) ? data : [];
      setComments(commentsArray);

      // Update read mapping
      const readMap = JSON.parse(localStorage.getItem("read_comments") || "{}");
      readMap[ticketId] = commentsArray.length;
      localStorage.setItem("read_comments", JSON.stringify(readMap));
      setReadComments(readMap);
    } catch (error) {
      console.error(error);
      setComments([]);
    }
  };

  const sendAdminComment = async () => {
    if (!newComment.trim() || !selectedCommentTicket) return;
    try {
      const response = await fetch(
        `${API_BASE_URL}/tickets/${selectedCommentTicket.id}/comments`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            sender: "admin@gmail.com",
            message: newComment,
          }),
        }
      );
      if (!response.ok) {
        throw new Error("Failed to post comment");
      }
      setNewComment("");
      loadComments(selectedCommentTicket.id);
      showNotification("Comment posted successfully!", "success");
    } catch (error) {
      console.error(error);
      showNotification(error.message, "error");
    }
  };

  const getUnreadCount = (ticket) => {
    const readCount = readComments[ticket.id] || 0;
    const totalCount = ticket.comment_count || 0;
    return Math.max(0, totalCount - readCount);
  };

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
      .catch((err) => {
        console.error("Failed to query records stream:", err);
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

  const handleApplyOverride = async (e) => {
    e.preventDefault();
    if (!selectedTicket || !overrideText.trim()) return;

    setIsSubmitting(true);
    try {
      await axios.patch(`http://localhost:8000/tickets/${selectedTicket.id}/override`, {
        manual_action: overrideText,
      });

      fetchAnalytics();
      fetchTickets();

      setSelectedTicket(null);
      setOverrideText("");
      showNotification("Override applied successfully!", "success");
    } catch (err) {
      showNotification(`Override execution failed: ${err.message}`, "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleTriggerCheckout = async (planName, priceAmount) => {
    setCheckoutLoading(true);
    try {
      showNotification(`Redirecting to secure payment sandbox for ${planName}...`, "success");
      await new Promise((resolve) => setTimeout(resolve, 1500));
      showNotification(`Payment successful. Account upgraded to ${planName}!`, "success");
      setShowPaywall(false);
    } catch (err) {
      showNotification(`Payment Gateway Interrupted: ${err.message}`, "error");
    } finally {
      setCheckoutLoading(false);
    }
  };

  const updateStatus = async (ticketId, newStatus) => {
    const { error: updateErr } = await supabase
      .from("tickets")
      .update({
        status: newStatus,
      })
      .eq("id", ticketId);

    if (updateErr) {
      showNotification(`Status update failed: ${updateErr.message}`, "error");
    } else {
      showNotification("Ticket status updated successfully.", "success");
      fetchTickets();
    }
  };

  const updateResolutionNote = async (ticketId, note) => {
    const { error: updateErr } = await supabase
      .from("tickets")
      .update({
        resolution_note: note,
      })
      .eq("id", ticketId);

    if (updateErr) {
      showNotification(`Saving resolution note failed: ${updateErr.message}`, "error");
      return;
    }

    fetchTickets();
    showNotification("Resolution note saved successfully!", "success");
  };

  const assignTicket = async (ticketId, assignedAgent) => {
    const { error: updateErr } = await supabase
      .from("tickets")
      .update({
        assigned_to: assignedAgent,
      })
      .eq("id", ticketId);

    if (updateErr) {
      showNotification(`Assignment failed: ${updateErr.message}`, "error");
      return;
    }

    showNotification(
      assignedAgent ? `Ticket assigned to ${assignedAgent}` : "Ticket unassigned",
      "success"
    );
    fetchTickets();
  };

  const openOverrideModal = (ticket) => {
    setSelectedTicket(ticket);
    setOverrideText("");
    setResolutionNote(ticket.resolution_note || "");
  };

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

  const displayedTickets = filteredTickets.filter((ticket) => {
    if (ticketFilter === "mine") {
      return ticket.assigned_to === "admin@gmail.com";
    }
    if (ticketFilter === "unassigned") {
      return !ticket.assigned_to;
    }
    return true;
  });

  const assignedTickets = tickets.filter((ticket) => ticket.assigned_to).length;
  const unassignedTickets = tickets.filter((ticket) => !ticket.assigned_to).length;

  const priorityData = [
    { name: "High", value: tickets.filter((ticket) => ticket.urgency === "High").length },
    { name: "Medium", value: tickets.filter((ticket) => ticket.urgency === "Medium").length },
    { name: "Low", value: tickets.filter((ticket) => ticket.urgency === "Low").length },
  ];

  const COLORS = ["#f43f5e", "#eab308", "#10b981"];

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 p-8">
        <div className="text-center">
          <div className="inline-block w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mb-4"></div>
          <div className="text-sm font-semibold text-slate-400">Loading Dashboard Framework...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 p-8">
        <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-3xl p-8 text-center shadow-2xl">
          <div className="w-12 h-12 bg-rose-500/10 text-rose-500 rounded-full flex items-center justify-center mx-auto mb-4 text-xl">⚠</div>
          <h2 className="text-lg font-bold text-white mb-2">Failed to Load Dashboard</h2>
          <p className="text-sm text-slate-400 mb-6">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm rounded-xl transition shadow-lg"
          >
            Retry Connection
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen transition-all duration-300 relative pb-12 ${
      darkMode ? "bg-slate-950 text-slate-100" : "bg-slate-50 text-slate-900"
    }`}>
      {/* Toast Notifications */}
      {notification.message && (
        <div className="fixed top-6 left-1/2 transform -translate-x-1/2 z-50 max-w-md w-full px-4">
          <div className={`p-4 rounded-2xl shadow-2xl border backdrop-blur-xl flex items-start gap-3 transition-all duration-300 animate-in fade-in slide-in-from-top-4 ${
            notification.type === "success"
              ? "bg-emerald-950/90 border-emerald-500/30 text-emerald-400"
              : "bg-rose-950/90 border-rose-500/30 text-rose-400"
          }`}>
            <span className="text-base font-bold">{notification.type === "success" ? "✓" : "⚠"}</span>
            <p className="flex-1 text-sm font-semibold leading-tight">{notification.message}</p>
          </div>
        </div>
      )}

      {/* Top Navigation */}
      <nav className={`border-b backdrop-blur-md sticky top-0 z-40 transition-colors duration-300 ${
        darkMode ? "bg-slate-950/80 border-slate-900" : "bg-white/80 border-slate-200"
      }`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-indigo-500 to-purple-600 flex items-center justify-center text-white font-black">A</div>
              <span className="font-extrabold tracking-tight text-lg">AI Support Console</span>
            </div>
            <div className="flex items-center gap-4">
              <button
                onClick={() => setDarkMode(!darkMode)}
                className={`p-2 rounded-xl border transition-colors ${
                  darkMode ? "bg-slate-900 border-slate-800 hover:bg-slate-850" : "bg-slate-100 border-slate-200 hover:bg-slate-200"
                }`}
                title="Toggle Theme"
              >
                {darkMode ? "☀️" : "🌙"}
              </button>
              <button
                onClick={handleLogout}
                className="px-4 py-2 bg-rose-600/10 hover:bg-rose-600 text-rose-500 hover:text-white border border-rose-500/20 text-sm font-bold rounded-xl transition duration-155"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8">
        {analytics && (
          <div className="space-y-8">
            
            {/* Metric Panel Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-5">
              <div className={`p-6 rounded-2xl border shadow-xs ${darkMode ? "bg-slate-900/40 border-slate-900" : "bg-white border-slate-200"}`}>
                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Total Tickets</h2>
                <p className="text-3xl font-extrabold tracking-tight">{analytics.total_tickets}</p>
              </div>

              <div className={`p-6 rounded-2xl border shadow-xs ${darkMode ? "bg-slate-900/40 border-slate-900" : "bg-white border-slate-200"}`}>
                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">High Priority</h2>
                <p className="text-3xl font-extrabold tracking-tight text-rose-500">{analytics.high_priority_tickets}</p>
              </div>

              <div className={`p-6 rounded-2xl border shadow-xs ${darkMode ? "bg-slate-900/40 border-slate-900" : "bg-white border-slate-200"}`}>
                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">System Status</h2>
                <p className="text-3xl font-extrabold tracking-tight text-emerald-500">{analytics.system_status}</p>
              </div>

              <div className={`p-6 rounded-2xl border shadow-xs ${darkMode ? "bg-slate-900/40 border-slate-900" : "bg-white border-slate-200"}`}>
                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Assigned</h2>
                <p className="text-3xl font-extrabold tracking-tight text-indigo-500">{assignedTickets}</p>
              </div>

              <div className={`p-6 rounded-2xl border shadow-xs ${darkMode ? "bg-slate-900/40 border-slate-900" : "bg-white border-slate-200"}`}>
                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Unassigned</h2>
                <p className="text-3xl font-extrabold tracking-tight text-amber-500">{unassignedTickets}</p>
              </div>
            </div>

            {/* Live Activity Feed */}
            {activityFeed.length > 0 && (
              <div className={`rounded-2xl p-6 border shadow-sm ${darkMode ? "bg-slate-900/40 border-slate-900" : "bg-white border-slate-200"}`}>
                <div className="flex items-center gap-2 mb-4">
                  <span className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-pulse"></span>
                  <h2 className="text-base font-bold tracking-tight">Live Console Activity</h2>
                </div>
                <div className="space-y-2 max-h-48 overflow-y-auto pr-2">
                  {activityFeed.map((item, index) => (
                    <div
                      key={index}
                      className={`py-2 px-3 rounded-lg text-xs font-mono flex items-center justify-between border ${
                        darkMode ? "bg-slate-950/50 border-slate-900/50 text-slate-400" : "bg-slate-50/50 border-slate-100 text-slate-650"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-slate-500">[{item.time}]</span>
                        <span className="font-bold text-indigo-400">{item.event.toUpperCase()}</span>
                        <span>Ticket #{item.ticketId}</span>
                      </div>
                      <span className="text-[10px] bg-indigo-500/10 text-indigo-400 border border-indigo-500/25 px-1.5 py-0.5 rounded">Realtime</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Recharts Analytics Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className={`rounded-2xl border shadow-sm p-6 ${darkMode ? "bg-slate-900/40 border-slate-900" : "bg-white border-slate-200"}`}>
                <h2 className="text-base font-bold tracking-tight mb-6">Priority Distribution</h2>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={priorityData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, value }) => `${name}: ${value}`}
                        outerRadius={80}
                        dataKey="value"
                      >
                        {priorityData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index]} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={{ background: darkMode ? "#0f172a" : "#ffffff", border: `1px solid ${darkMode ? "#1e293b" : "#e2e8f0"}`, borderRadius: "12px", color: darkMode ? "#f8fafc" : "#0f172a" }} />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className={`rounded-2xl border shadow-sm p-6 ${darkMode ? "bg-slate-900/40 border-slate-900" : "bg-white border-slate-200"}`}>
                <h2 className="text-base font-bold tracking-tight mb-6">Volume Analysis</h2>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={priorityData}>
                      <CartesianGrid strokeDasharray="3 3" stroke={darkMode ? "#1e293b" : "#f1f5f9"} />
                      <XAxis dataKey="name" stroke="#94a3b8" fontSize={11} />
                      <YAxis stroke="#94a3b8" fontSize={11} />
                      <Tooltip contentStyle={{ background: darkMode ? "#0f172a" : "#ffffff", border: `1px solid ${darkMode ? "#1e293b" : "#e2e8f0"}`, borderRadius: "12px", color: darkMode ? "#f8fafc" : "#0f172a" }} />
                      <Legend />
                      <Bar dataKey="value" fill="#6366f1" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* Live Tickets Table */}
            <div className={`rounded-2xl border shadow-sm p-6 overflow-hidden ${darkMode ? "bg-slate-900/40 border-slate-900" : "bg-white border-slate-200"}`}>
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                <h2 className="text-lg font-bold tracking-tight">Active Ticket Stream</h2>
                <div className="flex gap-2">
                  <button
                    onClick={() => setTicketFilter("all")}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all duration-150 ${
                      ticketFilter === "all"
                        ? "bg-indigo-600 text-white shadow-md"
                        : darkMode ? "bg-slate-900 hover:bg-slate-800 text-slate-400" : "bg-slate-100 hover:bg-slate-200 text-slate-650"
                    }`}
                  >
                    All
                  </button>
                  <button
                    onClick={() => setTicketFilter("mine")}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all duration-150 ${
                      ticketFilter === "mine"
                        ? "bg-indigo-600 text-white shadow-md"
                        : darkMode ? "bg-slate-900 hover:bg-slate-800 text-slate-400" : "bg-slate-100 hover:bg-slate-200 text-slate-650"
                    }`}
                  >
                    Assigned to Me
                  </button>
                  <button
                    onClick={() => setTicketFilter("unassigned")}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all duration-150 ${
                      ticketFilter === "unassigned"
                        ? "bg-indigo-600 text-white shadow-md"
                        : darkMode ? "bg-slate-900 hover:bg-slate-800 text-slate-400" : "bg-slate-100 hover:bg-slate-200 text-slate-650"
                    }`}
                  >
                    Unassigned
                  </button>
                </div>
              </div>

              {/* Filters Dock */}
              <div className="flex flex-col sm:flex-row gap-4 mb-6">
                <div className="relative flex-1">
                  <input
                    type="text"
                    placeholder="Search tickets by subject or sender..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className={`w-full pl-4 pr-10 py-2.5 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition duration-150 ${
                      darkMode ? "bg-slate-950 border-slate-800 text-white placeholder-slate-600" : "bg-white border-slate-300 placeholder-slate-450"
                    }`}
                  />
                </div>

                <select
                  value={urgencyFilter}
                  onChange={(e) => setUrgencyFilter(e.target.value)}
                  className={`border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition duration-150 ${
                    darkMode ? "bg-slate-950 border-slate-800 text-slate-300" : "bg-white border-slate-300 text-slate-750"
                  }`}
                >
                  <option value="All">All Priorities</option>
                  <option value="High">High</option>
                  <option value="Medium">Medium</option>
                  <option value="Low">Low</option>
                </select>
              </div>

              {/* Table Render */}
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm border-collapse">
                  <thead>
                    <tr className={`border-b text-xs font-bold uppercase tracking-wider ${
                      darkMode ? "border-slate-800/80 text-slate-500" : "border-slate-200/80 text-slate-450"
                    }`}>
                      <th className="p-4">Sender</th>
                      <th className="p-4">Subject</th>
                      <th className="p-4">Urgency</th>
                      <th className="p-4">Department</th>
                      <th className="p-4">Sentiment</th>
                      <th className="p-4">Action Summary</th>
                      <th className="p-4">Resolution Note</th>
                      <th className="p-4">Assignee</th>
                      <th className="p-4">Status</th>
                      <th className="p-4 text-center">Control</th>
                    </tr>
                  </thead>
                  <tbody>
                    {displayedTickets.length === 0 ? (
                      <tr>
                        <td colSpan="10" className="p-8 text-center text-slate-500">No active tickets fit the active filters.</td>
                      </tr>
                    ) : (
                      displayedTickets.map((ticket) => (
                        <tr
                          key={ticket.id}
                          className={`border-b transition-colors duration-150 ${
                            darkMode ? "border-slate-900/60 hover:bg-slate-900/30" : "border-slate-100 hover:bg-slate-50/50"
                          }`}
                        >
                          <td className="p-4 font-semibold text-xs truncate max-w-xs">{ticket.sender}</td>
                          <td className="p-4 text-xs font-medium max-w-[180px] truncate" title={ticket.subject}>
                            <span className="flex items-center gap-1.5 flex-wrap">
                              {ticket.subject}
                              {getUnreadCount(ticket) > 0 && (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[8px] font-bold bg-rose-500/10 text-rose-500 border border-rose-500/20 animate-pulse">
                                  🔴 {getUnreadCount(ticket)} new
                                </span>
                              )}
                            </span>
                          </td>
                          <td className="p-4">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              ticket.urgency === "High"
                                ? "bg-rose-500/10 text-rose-500 border border-rose-500/20"
                                : ticket.urgency === "Medium"
                                ? "bg-amber-500/10 text-amber-500 border border-amber-500/20"
                                : "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20"
                            }`}>
                              {ticket.urgency || "Low"}
                            </span>
                          </td>
                          <td className="p-4 font-bold text-xs text-indigo-400">{ticket.department}</td>
                          <td className="p-4 italic text-xs text-slate-400">{ticket.sentiment || "Neutral"}</td>
                          <td className="p-4 max-w-xs truncate">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-mono ${
                              ticket.action_taken?.includes("[MANUAL OVERRIDE]")
                                ? "bg-amber-500/15 text-amber-400 border border-amber-500/25"
                                : "bg-slate-800/40 text-slate-400 border border-slate-700/30"
                            }`}>
                              {ticket.action_taken || "Awaiting triage..."}
                            </span>
                          </td>
                          <td className="p-4 max-w-xs">
                            <div className={`text-xs truncate ${ticket.resolution_note ? "text-emerald-500 font-semibold" : "text-slate-500"}`}>
                              {ticket.resolution_note || "None"}
                            </div>
                          </td>
                          <td className="p-4">
                            <select
                              value={ticket.assigned_to || ""}
                              onChange={(e) => assignTicket(ticket.id, e.target.value)}
                              className={`border rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/25 ${
                                darkMode ? "bg-slate-950 border-slate-850 text-slate-300" : "bg-white border-slate-300 text-slate-750"
                              }`}
                            >
                              <option value="">Unassigned</option>
                              <option value="admin@gmail.com">admin@gmail.com</option>
                            </select>
                          </td>
                          <td className="p-4">
                            <select
                              value={ticket.status || "Open"}
                              onChange={(e) => updateStatus(ticket.id, e.target.value)}
                              className={`border rounded-lg px-2 py-1 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500/25 ${
                                ticket.status === "Resolved"
                                  ? "bg-emerald-550/10 text-emerald-400 border-emerald-500/20"
                                  : ticket.status === "In Progress"
                                  ? "bg-amber-550/10 text-amber-400 border-amber-500/20"
                                  : ticket.status === "Open"
                                  ? "bg-rose-550/10 text-rose-400 border-rose-500/20"
                                  : "bg-slate-850 text-slate-400 border-slate-700/20"
                              }`}
                            >
                              <option value="Open">Open</option>
                              <option value="In Progress">In Progress</option>
                              <option value="Resolved">Resolved</option>
                              <option value="Closed">Closed</option>
                            </select>
                          </td>
                          <td className="p-4 text-center">
                            <div className="flex flex-col sm:flex-row justify-center items-center gap-2">
                              <button
                                onClick={() => openOverrideModal(ticket)}
                                className="px-3 py-1.5 bg-indigo-650 hover:bg-indigo-700 text-white font-bold text-xs rounded-lg shadow-sm transition transform hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
                              >
                                Intervene
                              </button>
                              <button
                                onClick={() => {
                                  setSelectedCommentTicket(ticket);
                                  loadComments(ticket.id);
                                }}
                                className="px-3 py-1.5 bg-slate-150 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 font-bold text-xs rounded-lg shadow-sm transition transform hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
                              >
                                Conversation
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Conversation Panel */}
            {selectedCommentTicket && (
              <div className={`rounded-2xl border shadow-sm p-6 mt-6 ${darkMode ? "bg-slate-900/40 border-slate-900 text-slate-100" : "bg-white border-slate-200 text-slate-900"}`}>
                <div className="flex justify-between items-center mb-6">
                  <div>
                    <h2 className="font-bold text-base tracking-tight">
                      Ticket Conversation
                    </h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Discussion logs on ticket <span className="font-semibold text-slate-700">#{selectedCommentTicket.id}</span> from {selectedCommentTicket.sender}
                    </p>
                  </div>
                  <button
                    onClick={() => setSelectedCommentTicket(null)}
                    className="text-xs text-slate-400 hover:text-slate-655 transition underline cursor-pointer font-bold"
                  >
                    Close Conversation
                  </button>
                </div>

                <div className="space-y-3.5 mb-6 max-h-60 overflow-y-auto pr-1">
                  {(!Array.isArray(comments) || comments.length === 0) ? (
                    <p className="text-xs text-slate-400 italic py-4">No conversation logs found for this ticket yet.</p>
                  ) : (
                    comments.map((comment) => (
                      <div
                        key={comment.id}
                        className={`border-b pb-3 last:border-0 ${darkMode ? "border-slate-850" : "border-slate-100"}`}
                      >
                        <div className="flex justify-between items-center mb-1">
                          <strong className="text-xs font-bold text-slate-400 dark:text-slate-250">
                            {comment.sender}
                          </strong>
                          <span className="text-[10px] text-slate-400">
                            {comment.created_at ? new Date(comment.created_at).toLocaleTimeString() : ""}
                          </span>
                        </div>
                        <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                          {comment.message}
                        </p>
                      </div>
                    ))
                  )}
                </div>

                <div className="border-t pt-4 border-slate-150 dark:border-slate-805">
                  <textarea
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    placeholder="Reply to ticket thread..."
                    className={`w-full px-4 py-3 border rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition duration-150 resize-none ${
                      darkMode ? "bg-slate-950 border-slate-800 text-white placeholder-slate-700" : "bg-white border-slate-200 text-black placeholder-slate-400"
                    }`}
                    rows={3}
                  />
                  <button
                    onClick={sendAdminComment}
                    className="px-4 py-2 bg-indigo-650 hover:bg-indigo-750 text-white font-bold text-xs rounded-xl shadow-md transition mt-2 cursor-pointer active:scale-95"
                  >
                    Send Reply
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Human Intervention Dialog Deck */}
      {selectedTicket && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className={`max-w-lg w-full rounded-2xl shadow-2xl border p-6 overflow-hidden animate-in zoom-in-95 duration-150 ${
            darkMode ? "bg-slate-900 border-slate-800 text-white" : "bg-white border-slate-200 text-slate-900"
          }`}>
            <h2 className="text-xl font-bold tracking-tight mb-1">Human Intervention Deck</h2>
            <p className="text-xs text-slate-400 border-b border-slate-750 pb-3 mb-4">
              Correction controls for ticket <span className="font-mono text-indigo-400 font-semibold">#{selectedTicket.id}</span>
            </p>

            <div className="space-y-3.5 mb-6">
              <div>
                <label className="text-[10px] uppercase font-extrabold tracking-wider text-slate-400 block mb-1">Subject</label>
                <div className={`text-xs p-3 rounded-xl font-medium border ${darkMode ? "bg-slate-950 border-slate-900 text-slate-300" : "bg-slate-50 border-slate-100 text-slate-750"}`}>{selectedTicket.subject}</div>
              </div>
              <div>
                <label className="text-[10px] uppercase font-extrabold tracking-wider text-slate-400 block mb-1">AI Action Summary</label>
                <div className={`text-xs font-mono p-3 rounded-xl border ${darkMode ? "bg-slate-950/60 border-slate-900/50 text-slate-400" : "bg-slate-50/60 border-slate-100/50 text-slate-600"}`}>{selectedTicket.action_taken || "Awaiting triage action"}</div>
              </div>
              <div>
                <label className="text-[10px] uppercase font-extrabold tracking-wider text-slate-400 block mb-1">Current Resolution</label>
                <div className={`text-xs p-3 rounded-xl border ${darkMode ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" : "bg-emerald-50/80 border-emerald-100 text-emerald-700"}`}>
                  {selectedTicket.resolution_note || "No resolution note recorded yet."}
                </div>
              </div>
            </div>

            <form onSubmit={handleApplyOverride}>
              <div className="mb-4">
                <label className="text-[10px] uppercase font-extrabold tracking-wider text-slate-400 block mb-1.5">Executive Action Correction</label>
                <textarea
                  required
                  rows={2}
                  value={overrideText}
                  onChange={(e) => setOverrideText(e.target.value)}
                  placeholder="e.g. Force approved refund, bypassed standard threshold policy."
                  className={`w-full px-3 py-2 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition border ${
                    darkMode ? "bg-slate-950 border-slate-800 text-white placeholder-slate-700" : "bg-white border-slate-200 text-black placeholder-slate-400"
                  }`}
                />
              </div>
              <div className="mb-6">
                <label className="text-[10px] uppercase font-extrabold tracking-wider text-slate-400 block mb-1.5">Customer-Facing Resolution Note</label>
                <textarea
                  rows={2}
                  value={resolutionNote}
                  onChange={(e) => setResolutionNote(e.target.value)}
                  placeholder="Write customer update here..."
                  className={`w-full px-3 py-2 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition border ${
                    darkMode ? "bg-slate-950 border-slate-800 text-white placeholder-slate-700" : "bg-white border-slate-200 text-black placeholder-slate-400"
                  }`}
                />
              </div>

              <div className="flex items-center justify-between gap-3 border-t border-slate-750 pt-4">
                <button
                  type="button"
                  onClick={() => setSelectedTicket(null)}
                  className={`px-4 py-2 rounded-xl font-bold text-xs transition border ${
                    darkMode ? "bg-slate-950 border-slate-850 hover:bg-slate-900 text-slate-400" : "bg-slate-100 hover:bg-slate-200 text-slate-700 border-transparent"
                  }`}
                >
                  Cancel
                </button>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => updateResolutionNote(selectedTicket.id, resolutionNote)}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl transition shadow-sm"
                  >
                    Save Resolution
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-4 py-2 bg-indigo-650 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-md transition"
                  >
                    {isSubmitting ? "Applying..." : "Apply Override"}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Paywall Upgrade Modal Dialog */}
      {showPaywall && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 text-white">
          <div className="max-w-2xl w-full bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl p-8 relative overflow-hidden">
            <div className="text-center mb-8">
              <span className="px-3 py-1 bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 rounded-full text-xs font-bold tracking-widest uppercase">
                Quota Threshold Exceeded
              </span>
              <h2 className="text-2xl font-extrabold text-white mt-4">Elevate Ticket Processing Quota</h2>
              <p className="text-sm text-slate-400 mt-2 max-w-md mx-auto">
                Your workspace has exhausted the default free autonomous triage allocations.
              </p>
            </div>

            {/* Pricing Cards Dock */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 items-stretch">
              {/* Current Free Setup */}
              <div className="bg-slate-950/50 border border-slate-850 rounded-2xl p-6 flex flex-col justify-between opacity-60">
                <div>
                  <h3 className="text-base font-bold text-slate-400">Starter Core Tier</h3>
                  <div className="mt-3 flex items-baseline gap-1 text-slate-300">
                    <span className="text-3xl font-black">₹0</span>
                    <span className="text-xs text-slate-500">/ forever</span>
                  </div>
                  <ul className="mt-6 space-y-2.5 text-xs text-slate-400">
                    <li>❌ Max 10 autonomous triages / month</li>
                    <li>✓ Basic sentiment classification</li>
                    <li>❌ Manual intervention log pipeline</li>
                  </ul>
                </div>
                <button disabled className="w-full py-2.5 mt-8 bg-slate-900 text-slate-700 font-bold text-xs rounded-xl cursor-not-allowed">
                  Current Tier Exhausted
                </button>
              </div>

              {/* Pro Upgrade Target */}
              <div className="bg-gradient-to-b from-slate-850 to-slate-900 border-2 border-indigo-500 rounded-2xl p-6 flex flex-col justify-between shadow-xl relative">
                <div className="absolute -top-3 right-4 px-2 py-0.5 bg-indigo-500 text-white text-[9px] font-bold tracking-wider rounded-full uppercase">
                  Recommended
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Growth Operations Tier</h3>
                  <div className="mt-3 flex items-baseline gap-1 text-white">
                    <span className="text-3xl font-black">₹4,999</span>
                    <span className="text-xs text-slate-400">/ month</span>
                  </div>
                  <ul className="mt-6 space-y-2.5 text-xs text-slate-350">
                    <li>✓ <strong className="text-indigo-400">Unlimited</strong> AI Auto-Triages</li>
                    <li>✓ Priority Background Processing Queue</li>
                    <li>✓ Complete Human Intervention Panel</li>
                  </ul>
                </div>
                <button
                  onClick={() => handleTriggerCheckout("Growth Operations Tier", "₹4,999/mo")}
                  disabled={checkoutLoading}
                  className="w-full py-2.5 mt-8 bg-indigo-650 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-lg transition duration-150 transform active:scale-95 animate-pulse"
                >
                  {checkoutLoading ? "Connecting Secure Server..." : "Unlock Unlimited Operations"}
                </button>
              </div>
            </div>

            {/* Close */}
            <div className="text-center mt-6">
              <button
                onClick={() => setShowPaywall(false)}
                className="text-xs font-semibold text-slate-500 hover:text-slate-350 transition underline"
              >
                Back to Dashboard (Read-Only)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
