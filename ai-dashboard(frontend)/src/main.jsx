import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import Login from "./Login";
import "./index.css";
import UserDashboard from "./UserDashboard";

import { useEffect, useState } from "react";
import { supabase } from "./supabase";

function RootApp() {
  const [session, setSession] = useState(null);
  const [role, setRole] = useState(null);

  useEffect(() => {
supabase.auth.getSession().then(
  async ({ data: { session } }) => {

    setSession(session);

    if (session?.user) {

      const { data, error } = await supabase
        .from("user_roles")
        .select("*")
        .eq("id", session.user.id)
        .single();

      console.log("==========");
      console.log("User ID:", session.user.id);
      console.log("Role Data:", data);
      console.log("Role Error:", error);
      console.log("==========");

      setRole(data?.role);
    }
  }
);

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setSession(session);

      if (session?.user) {
        const { data, error } = await supabase
          .from("user_roles")
          .select("*")
          .eq("id", session.user.id)
          .single();

        console.log("==========");
        console.log("User ID:", session.user.id);
        console.log("Role Data:", data);
        console.log("Role Error:", error);
        console.log("==========");

        setRole(data?.role);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  console.log("Session:", session?.user?.email);
  console.log("Role:", role);

  return (
    <>
    {
  !session ? (
    <Login />
  ) : role === "admin" ? (
    <App />
  ) : (
    <UserDashboard />
  )
}
    </>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <RootApp />
  </React.StrictMode>
);
