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
      console.error(error);
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
        (payload) => {
          console.log("Realtime update:", payload);

          loadTickets();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  const createTicket = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      alert("Please log in first");
      return;
    }

    const userEmail = normalizeEmail(user.email);

    if (!subject.trim() || !summary.trim()) {
      alert("Please enter subject and summary");
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

      alert("Ticket created successfully!");
    } catch (error) {
      console.error(error);
      alert(error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case "Open":
        return "text-red-500";
      case "In Progress":
        return "text-yellow-500";
      case "Resolved":
        return "text-green-600";
      case "Closed":
        return "text-gray-500";
      default:
        return "text-blue-500";
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center p-8">
      <h1 className="text-4xl font-bold mb-6">
        User Portal
      </h1>

      {currentUser && (
        <div className="mb-6 text-center">
          <p>Logged in as: {currentUser}</p>
        </div>
      )}

      <input
        type="text"
        placeholder="Subject"
        value={subject}
        onChange={(e) => setSubject(e.target.value)}
        className="border p-2 w-80 mb-2 rounded"
      />

      <textarea
        placeholder="Summary"
        value={summary}
        onChange={(e) => setSummary(e.target.value)}
        className="border p-2 w-80 h-32 rounded"
      />

      <button
        onClick={createTicket}
        disabled={isSubmitting}
        className="bg-blue-600 text-white px-4 py-2 rounded mt-4"
      >
        {isSubmitting ? "Submitting..." : "Submit Ticket"}
      </button>

      <div className="mt-10 w-full max-w-2xl">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold">
            My Tickets ({tickets.length})
          </h2>

          <div>
            <button
              onClick={() => loadTickets(false)}
              className="bg-gray-600 text-white px-3 py-1 rounded text-sm"
            >
              Refresh
            </button>

            <button
              onClick={() => loadTickets(true)}
              className="bg-yellow-600 text-white px-3 py-1 rounded text-sm ml-2"
            >
              All
            </button>
          </div>
        </div>

        {tickets.length === 0 ? (
          <p>No tickets found.</p>
        ) : (
          tickets.map((ticket) => (
            <div
              key={ticket.id}
              className="border rounded-lg p-4 mb-4 shadow-sm"
            >
              <h3 className="font-bold text-lg">
                {ticket.subject}
              </h3>

              <p className="mt-2">
                {ticket.summary || ticket.description}
              </p>

              <div className="mt-3 text-sm text-gray-600">
                Sender: {ticket.sender}
              </div>

              <div className="mt-1 text-sm text-blue-600 font-medium">
                Assigned Agent: {ticket.assigned_to || "Not Assigned Yet"}
              </div>

              <div
                className={`mt-2 font-semibold ${getStatusColor(
                  ticket.status
                )}`}
              >
                Status: {ticket.status || "Open"}
              </div>
              {ticket.resolution_note && (
                <div className="mt-2 text-sm text-green-700">
                  Resolution: {ticket.resolution_note}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      <button
        onClick={handleLogout}
        className="bg-black text-white px-4 py-2 rounded mt-6"
      >
        Logout
      </button>

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

export default UserDashboard;
