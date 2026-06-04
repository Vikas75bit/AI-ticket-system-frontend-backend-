import { supabase } from "./supabase";
import { useState } from "react";

function UserDashboard() {

  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  const createTicket = async () => {

    const user = await supabase.auth.getUser();

    const { error } = await supabase
      .from("tickets")
      .insert([
        {
          sender: user.data.user.email,
          subject: subject,
          description: description,
        },
      ]);

    if (error) {
      alert(error.message);
    } else {
      alert("Ticket created!");
      setSubject("");
      setDescription("");
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center">

      <h1 className="text-4xl font-bold mb-6">
        User Portal
      </h1>

      <input
        type="text"
        placeholder="Subject"
        value={subject}
        onChange={(e) => setSubject(e.target.value)}
        className="border p-2 w-80"
      />

      <textarea
        placeholder="Description"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        className="border p-2 w-80 h-32"
      />

      <button
        onClick={createTicket}
        className="bg-blue-500 text-white px-4 py-2 rounded mt-4"
      >
        Submit Ticket
      </button>

      <button
        onClick={handleLogout}
        className="bg-black text-white px-4 py-2 rounded mt-4"
      >
        Logout
      </button>

    </div>
  );
}

export default UserDashboard;