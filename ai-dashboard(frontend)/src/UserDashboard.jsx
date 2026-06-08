import { supabase } from "./supabase";
import { useState, useEffect, useCallback } from "react";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

function UserDashboard() {
  const [subject, setSubject] = useState("");
  const [summary, setSummary] = useState("");
  const [tickets, setTickets] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPaywall, setShowPaywall] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [notification, setNotification] = useState({ message: "", type: "" });

  const [selectedTicket, setSelectedTicket] = useState(null);
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

  const handleTriggerCheckout = async (planName, priceAmount) => {
    setCheckoutLoading(true);
    try {
      showNotification(`Redirecting to secure payment sandbox for ${planName}...`, "success");
      await new Promise((resolve) => setTimeout(resolve, 1500));
      showNotification(`Upgrade processed successfully. Thank you for subscribing!`, "success");
      setShowPaywall(false);
    } catch (err) {
      showNotification(`Checkout Handshake Interrupted: ${err.message}`, "error");
    } finally {
      setCheckoutLoading(false);
    }
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
      console.error("Error loading comments:", error);
      setComments([]);
    }
  };

  const sendComment = async () => {
    if (!newComment.trim()) return;

    const {
      data: { user },
    } = await supabase.auth.getUser();

    try {
      await fetch(
        `${API_BASE_URL}/tickets/${selectedTicket.id}/comments`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            sender: user.email,
            message: newComment,
          }),
        }
      );

      setNewComment("");
      loadComments(selectedTicket.id);
      showNotification("Comment posted successfully!", "success");
    } catch (error) {
      console.error(error);
      showNotification(error.message, "error");
    }
  };

  const normalizeEmail = (email) =>
    String(email || "").trim().toLowerCase();

  const loadTickets = useCallback(async (showAll = false) => {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return;

    const userEmail = normalizeEmail(user.email);
    setCurrentUser(userEmail);

    try {
      const ticketsUrl = showAll
        ? `${API_BASE_URL}/tickets`
        : `${API_BASE_URL}/tickets/user/${encodeURIComponent(userEmail)}`;

      const response = await fetch(ticketsUrl);

      if (!response.ok) {
        throw new Error(`Failed to load tickets (${response.status})`);
      }

      const data = await response.json();
      setTickets(data || []);
    } catch (error) {
      console.error("Failed to load tickets:", error);
    }
  }, []);

  useEffect(() => {
    loadTickets();

    const channel = supabase
      .channel("tickets-realtime")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "tickets",
        },
        () => {
          loadTickets();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadTickets]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  const createTicket = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      showNotification("Please log in first", "error");
      return;
    }

    const userEmail = normalizeEmail(user.email);

    if (!subject.trim() || !summary.trim()) {
      showNotification("Please enter both subject and summary", "error");
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch(`${API_BASE_URL}/tickets`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sender: userEmail,
          subject: subject.trim(),
          summary: summary.trim(),
        }),
      });

      if (response.status === 402) {
        setShowPaywall(true);
        setIsSubmitting(false);
        return;
      }

      if (!response.ok) {
        throw new Error("Failed to create ticket");
      }

      await response.json();

      setSubject("");
      setSummary("");

      await loadTickets();
      showNotification("Ticket submitted successfully!", "success");
    } catch (error) {
      showNotification(error.message, "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const getUnreadCount = (ticket) => {
    const readCount = readComments[ticket.id] || 0;
    const totalCount = ticket.comment_count || 0;
    return Math.max(0, totalCount - readCount);
  };

  const getStatusColor = (status) => {
    switch (status) {
      case "Open":
        return "bg-rose-500/10 text-rose-500 border border-rose-500/25";
      case "In Progress":
        return "bg-amber-500/10 text-amber-500 border border-amber-500/25";
      case "Resolved":
        return "bg-emerald-500/10 text-emerald-500 border border-emerald-500/25";
      case "Closed":
        return "bg-slate-500/10 text-slate-500 border border-slate-500/25";
      default:
        return "bg-blue-500/10 text-blue-500 border border-blue-500/25";
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-16">
      {/* Toast Notification */}
      {notification.message && (
        <div className="fixed top-6 left-1/2 transform -translate-x-1/2 z-50 max-w-md w-full px-4">
          <div className={`p-4 rounded-2xl shadow-2xl border backdrop-blur-xl flex items-start gap-3 transition-all duration-300 animate-in fade-in slide-in-from-top-4 ${
            notification.type === "success"
              ? "bg-emerald-950/90 border-emerald-500/30 text-emerald-400"
              : "bg-rose-950/90 border-rose-500/30 text-rose-400"
          }`}>
            <span className="text-base font-bold">{notification.type === "success" ? "✓" : "⚠"}</span>
            <p className="flex-1 text-sm font-semibold leading-tight text-white">{notification.message}</p>
          </div>
        </div>
      )}

      {/* Navigation Header */}
      <nav className="border-b bg-white border-slate-200 sticky top-0 z-40 shadow-xs">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-indigo-500 to-purple-600 flex items-center justify-center text-white font-black">U</div>
              <span className="font-extrabold tracking-tight text-lg">Support Dashboard</span>
            </div>
            {currentUser && (
              <div className="flex items-center gap-4">
                <span className="text-xs font-semibold px-3 py-1.5 bg-slate-100 text-slate-600 rounded-full border border-slate-200">
                  Logged in: {currentUser}
                </span>
                <button
                  onClick={handleLogout}
                  className="px-4 py-2 bg-rose-600/10 hover:bg-rose-600 text-rose-500 hover:text-white border border-rose-500/20 text-xs font-bold rounded-xl transition duration-155"
                >
                  Logout
                </button>
              </div>
            )}
          </div>
        </div>
      </nav>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 mt-10">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Submit New Ticket Box */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs sticky top-20">
              <h2 className="text-lg font-bold tracking-tight mb-1 text-slate-900">File a New Ticket</h2>
              <p className="text-xs text-slate-500 mb-6">Explain the problem clearly and our automated AI triager will route it instantly.</p>
              
              <div className="space-y-4">
                <div>
                  <label className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block mb-1.5">Subject</label>
                  <input
                    type="text"
                    placeholder="Brief summary title"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    disabled={isSubmitting}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition duration-150"
                  />
                </div>

                <div>
                  <label className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block mb-1.5">Detailed Summary</label>
                  <textarea
                    placeholder="Describe what occurred, steps to reproduce..."
                    value={summary}
                    onChange={(e) => setSummary(e.target.value)}
                    disabled={isSubmitting}
                    rows={4}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition duration-150 resize-none"
                  />
                </div>

                <button
                  onClick={createTicket}
                  disabled={isSubmitting}
                  className="w-full py-3 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 disabled:opacity-50 text-white font-bold text-sm rounded-xl shadow-lg transition duration-150 transform active:scale-[0.98]"
                >
                  {isSubmitting ? "Routing to AI..." : "Submit Ticket"}
                </button>
              </div>
            </div>
          </div>

          {/* User's Ticket Stream */}
          <div className="lg:col-span-2">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold tracking-tight text-slate-900">
                My Support Tickets ({tickets.length})
              </h2>
              <div className="flex gap-2">
                <button
                  onClick={() => loadTickets(false)}
                  className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-600 font-bold text-xs rounded-lg transition"
                >
                  Refresh
                </button>
                <button
                  onClick={() => loadTickets(true)}
                  className="px-3.5 py-1.5 bg-amber-500/10 hover:bg-amber-500 text-amber-600 hover:text-white border border-amber-500/20 font-bold text-xs rounded-lg transition"
                >
                  All Portal Tickets
                </button>
              </div>
            </div>

            {tickets.length === 0 ? (
              <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center text-slate-500">
                <div className="text-3xl mb-3">💬</div>
                <h3 className="font-bold text-slate-900 mb-1">No Tickets Filed</h3>
                <p className="text-sm text-slate-400">File a new ticket to communicate with active staff agents.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {tickets.map((ticket) => (
                  <div
                    key={ticket.id}
                    className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs hover:shadow-xs transition"
                  >
                    <div className="flex justify-between items-start gap-4 mb-3">
                      <h3 className="font-bold text-base text-slate-900 flex items-center flex-wrap gap-2">
                        {ticket.subject}
                        {getUnreadCount(ticket) > 0 && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[9px] font-bold bg-rose-500/10 text-rose-500 border border-rose-500/20 animate-pulse">
                            🔴 {getUnreadCount(ticket)} new
                          </span>
                        )}
                      </h3>
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${getStatusColor(ticket.status)}`}>
                        {ticket.status || "Open"}
                      </span>
                    </div>

                    <p className="text-sm text-slate-600 leading-relaxed mb-4">
                      {ticket.summary || ticket.description}
                    </p>

                    <div className="flex flex-wrap items-center justify-between gap-3 text-xs pt-4 border-t border-slate-100">
                      <div className="flex gap-4 text-slate-400">
                        <span>Sender: <strong className="text-slate-650 font-semibold">{ticket.sender}</strong></span>
                        <span>Assignee: <strong className="text-slate-650 font-semibold">{ticket.assigned_to || "Awaiting Staff"}</strong></span>
                      </div>
                      {ticket.resolution_note && (
                        <div className="text-[11px] font-medium text-emerald-600 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-xl">
                          Resolution: {ticket.resolution_note}
                        </div>
                      )}
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-100 flex justify-between items-center">
                      <button
                        onClick={() => {
                          console.log("Clicked Ticket:", ticket);

                          setSelectedTicket(ticket);

                          loadComments(ticket.id);
                        }}
                        className="px-3.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 font-bold text-xs rounded-xl transition cursor-pointer active:scale-95 animate-in fade-in"
                      >
                        Open Conversation
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Conversation Panel */}
            {selectedTicket && (
              <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs mt-8">
                <div className="flex justify-between items-center mb-6">
                  <div>
                    <h2 className="text-lg font-bold tracking-tight text-slate-900">
                      Conversation Logs
                    </h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Discussion thread on ticket <span className="font-semibold text-slate-700">#{selectedTicket.id}</span>
                    </p>
                  </div>
                  <button
                    onClick={() => setSelectedTicket(null)}
                    className="text-xs text-slate-400 hover:text-slate-650 transition underline cursor-pointer font-bold"
                  >
                    Close Thread
                  </button>
                </div>

                <div className="space-y-3.5 mb-6 max-h-64 overflow-y-auto pr-1">
                  {(!Array.isArray(comments) || comments.length === 0) ? (
                    <p className="text-xs text-slate-400 italic py-4">No comments posted on this ticket yet.</p>
                  ) : (
                    comments.map((comment) => (
                      <div
                        key={comment.id}
                        className="border-b border-slate-100 pb-3 last:border-0"
                      >
                        <div className="flex justify-between items-center mb-1">
                          <strong className="text-xs font-bold text-slate-800">
                            {comment.sender}
                          </strong>
                          <span className="text-[10px] text-slate-400">
                            {comment.created_at ? new Date(comment.created_at).toLocaleTimeString() : ""}
                          </span>
                        </div>
                        <p className="text-sm text-slate-655 leading-relaxed text-slate-700">
                          {comment.message}
                        </p>
                      </div>
                    ))
                  )}
                </div>

                <div className="border-t border-slate-100 pt-4">
                  <textarea
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    placeholder="Type your message..."
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition duration-150 resize-none"
                    rows={3}
                  />
                  <button
                    onClick={sendComment}
                    className="px-4 py-2 bg-indigo-650 hover:bg-indigo-755 text-white font-bold text-xs rounded-xl shadow-md transition mt-2 cursor-pointer active:scale-95"
                  >
                    Send Message
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

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
                    <span className="text-4xl font-black">₹4,999</span>
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

export default UserDashboard;
