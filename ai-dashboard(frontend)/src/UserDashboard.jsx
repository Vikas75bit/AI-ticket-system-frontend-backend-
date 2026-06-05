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

    const interval = setInterval(() => {
      loadTickets();
    }, 5000);

    return () => clearInterval(interval);
  }, [loadTickets]);

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
    </div>
  );
}

export default UserDashboard;
