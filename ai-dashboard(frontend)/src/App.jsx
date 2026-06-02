import { useEffect, useState } from "react";
import axios from "axios";

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
 useEffect(() => {

  const fetchAnalytics = async () => {

    try {

      setLoading(true);

      const response = await fetch("import.meta.env.import.meta.env.VITE_API_URL");

      if (!response.ok) {
        throw new Error("Failed to fetch analytics");
      }

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
      .get(`${import.meta.env.VITE_API_URL}/tickets`)
      .then((response) => {
        setTickets(Array.isArray(response.data) ? response.data : []);
      })
      .catch((error) => {
        console.error(error);
      });
  };

  fetchAnalytics();
  fetchTickets();

  const interval = setInterval(() => {
    fetchAnalytics();
    fetchTickets();
  }, 5000);

  return () => clearInterval(interval);

}, []);

const filteredTickets = tickets.filter((ticket) => {
  const sender = String(ticket.sender || "");
  const subject = String(ticket.subject || "");
  const normalizedSearchTerm = searchTerm.toLowerCase();

  const matchesSearch =
    sender
      .toLowerCase()
      .includes(normalizedSearchTerm) ||

    subject
      .toLowerCase()
      .includes(normalizedSearchTerm);

  const matchesUrgency =
    urgencyFilter === "All" ||
    ticket.urgency === urgencyFilter;

  return matchesSearch && matchesUrgency;
});

const priorityData = [
  {
    name: "High",
    value: tickets.filter(
      (ticket) => ticket.urgency === "High"
    ).length,
  },

  {
    name: "Medium",
    value: tickets.filter(
      (ticket) => ticket.urgency === "Medium"
    ).length,
  },

  {
    name: "Low",
    value: tickets.filter(
      (ticket) => ticket.urgency === "Low"
    ).length,
  },
];

const COLORS = [
  "#ef4444",
  "#facc15",
  "#22c55e",
];

if (loading) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200 p-8">
      <div className="rounded-3xl bg-white p-10 shadow-2xl text-center text-xl font-semibold text-slate-700">
        Loading Dashboard...
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
  <div className={`min-h-screen p-4 transition-all duration-500 ${
    darkMode
      ? "bg-slate-900 text-white"
      : "bg-gradient-to-br from-slate-100 to-slate-200 text-black"
  }`}>
    <h1 className="text-5xl font-extrabold mb-10 text-slate-800">
      AI Ticket Dashboard
    </h1>
    <button
      onClick={() => setDarkMode(!darkMode)}
      className="mb-6 px-4 py-2 rounded-xl bg-black text-white hover:scale-105 transition"
    >
      {darkMode ? "☀️ Light Mode" : "🌙 Dark Mode"}
    </button>

    {analytics ? (
      <>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

        <div className={`p-6 rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-300 ${
            darkMode ? "bg-slate-800 text-white" : "bg-white"
          }`}>
          <h2 className="text-xl font-semibold mb-2">
            Total Tickets
          </h2>

          <p className="text-3xl font-bold">
            {analytics.total_tickets}
          </p>
        </div>

        <div className={`p-6 rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-300 ${
            darkMode ? "bg-slate-800 text-white" : "bg-white"
          }`}>
          <h2 className="text-xl font-semibold mb-2">
            High Priority
          </h2>

          <p className="text-3xl font-bold text-red-500">
            {analytics.high_priority_tickets}
          </p>
        </div>

        <div className={`p-6 rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-300 ${
            darkMode ? "bg-slate-800 text-white" : "bg-white"
          }`}>
          <h2 className="text-xl font-semibold mb-2">
            System Status
          </h2>

          <p className="text-2xl font-bold text-green-600">
            {analytics.system_status}
          </p>
        </div>

      </div>

      <div className="mt-10 bg-white rounded-2xl shadow-lg p-6 hover:shadow-2xl transition-all duration-300">
        <h2 className="text-2xl font-bold mb-6">
          Ticket Priority Distribution
        </h2>

        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie
              data={priorityData}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={({ name, value }) => `${name}: ${value}`}
              outerRadius={100}
              fill="#8884d8"
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

      <div className="mt-10 bg-white rounded-2xl shadow-lg p-6 hover:shadow-2xl transition-all duration-300">
        <h2 className="text-2xl font-bold mb-6">
          Ticket Volume Analytics
        </h2>

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

      <div className="mt-10 bg-white rounded-2xl shadow-lg p-6 hover:shadow-2xl transition-all duration-300">

        <h2 className="text-2xl font-bold mb-6">
          Live Tickets
        </h2>

        <div className="flex flex-col md:flex-row gap-4 mb-6">

          <input
            type="text"
            placeholder="Search tickets..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="border rounded-xl px-4 py-2 w-full md:w-1/2"
          />

          <select
            value={urgencyFilter}
            onChange={(e) => setUrgencyFilter(e.target.value)}
            className="border rounded-xl px-4 py-2 w-full md:w-1/4"
          >

            <option value="All">All Priorities</option>
            <option value="High">High</option>
            <option value="Medium">Medium</option>
            <option value="Low">Low</option>

          </select>

        </div>

        <div className="overflow-x-auto mt-4">

          <table className="min-w-full">

            <thead>

              <tr className="border-b">

                <th className="text-left p-3">Sender</th>
                <th className="text-left p-3">Subject</th>
                <th className="text-left p-3">Urgency</th>
                <th className="text-left p-3">Department</th>
                <th className="text-left p-3">Sentiment</th>

              </tr>

            </thead>

            <tbody>

              {filteredTickets.map((ticket) => (

                <tr
                  key={ticket.id}
                  className="border-b hover:bg-slate-100 transition-colors duration-200"
                >

                  <td className="p-3">
                    {ticket.sender}
                  </td>

                  <td className="p-3">
                    {ticket.subject}
                  </td>

                  <td className="p-3">

                    <span
                      className={`px-3 py-1 rounded-full text-white text-sm
                      ${
                        ticket.urgency === "High"
                          ? "bg-red-500"
                          : "bg-green-500"
                      }`}
                    >

                      {ticket.urgency}

                    </span>

                  </td>

                  <td className="p-3">
                    {ticket.department}
                  </td>

                  <td className="p-3">

                    {ticket.sentiment}

                  </td>

                </tr>

              ))}

            </tbody>

          </table>

        </div>

      </div>
      </>
    ) : (
      <p>Loading analytics...</p>
    )}
  </div>
  
);
}
export default App;
