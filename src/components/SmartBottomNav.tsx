"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import BottomNav from "./BottomNav";
import HostBottomNav from "./HostBottomNav";

export default function SmartBottomNav() {
  const [isHost, setIsHost] = useState<boolean | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) { setIsHost(false); return; }
      const { data } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", session.user.id)
        .single();
      setIsHost(data?.role === "host" || data?.role === "both");
    });
  }, []);

  // Render nothing until we know the role to avoid flash of wrong nav
  if (isHost === null) return null;
  return isHost ? <HostBottomNav /> : <BottomNav />;
}
