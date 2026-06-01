import { useEffect, useState } from "react";
import axios from "axios";

function App() {
const [analytics, setAnalytics] = useState(null);
const [tickets, setTickets] = useState([]); 
const [searchTerm, setSearchTerm] = useState("");
const [urgencyFilter, setUrgencyFilter] = useState("All");
 useEffect(() => {
  axios
  .get("http://localhost:8000/tickets")
  .then((response) => {
    setTickets(Array.isArray(response.data) ? response.data : []);
  })
  .catch((error) => {
    console.error(error);
  });
    axios
      .get("http://localhost:8000/analytics")
      .then((response) => {
        setAnalytics(response.data);
      })
      .catch((error) => {
        console.error(error);
      });
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

return (
  <div className="min-h-screen bg-gray-100 p-8">
    <h1 className="text-4xl font-bold mb-8">
      AI Ticket Dashboard
    </h1>

    {analytics ? (
      <>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

        <div className="bg-white p-6 rounded-2xl shadow">
          <h2 className="text-xl font-semibold mb-2">
            Total Tickets
          </h2>

          <p className="text-3xl font-bold">
            {analytics.total_tickets}
          </p>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow">
          <h2 className="text-xl font-semibold mb-2">
            High Priority
          </h2>

          <p className="text-3xl font-bold text-red-500">
            {analytics.high_priority_tickets}
          </p>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow">
          <h2 className="text-xl font-semibold mb-2">
            System Status
          </h2>

          <p className="text-2xl font-bold text-green-600">
            {analytics.system_status}
          </p>
        </div>

      </div>

      <div className="mt-10 bg-white rounded-2xl shadow p-6">

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
                  className="border-b hover:bg-gray-50"
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
