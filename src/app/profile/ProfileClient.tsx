"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  User, LogOut, Bot, MessageCircle, ChevronRight,
  Home, Shield, Star,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import SmartBottomNav from "@/components/SmartBottomNav";

type Profile = {
  full_name: string | null;
  role: "guest" | "host" | "both";
  is_superhost: boolean;
  host_since: number | null;
};

export default function ProfileClient() {
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) {
        router.replace("/login?next=/profile");
        return;
      }
      setEmail(session.user.email ?? null);
      const { data } = await supabase
        .from("profiles")
        .select("full_name, role, is_superhost, host_since")
        .eq("id", session.user.id)
        .single();
      setProfile(data as Profile | null);
      setLoading(false);
    });
  }, [router]);

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.replace("/login");
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center pt-32">
        <div className="w-6 h-6 border-2 border-airbnb-pink border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const isHost = profile?.role === "host" || profile?.role === "both";
  const displayName = profile?.full_name ?? email?.split("@")[0] ?? "User";

  return (
    <div className="px-4 pt-6">
      {/* Avatar + name */}
      <div className="flex items-center gap-4 mb-6">
        <div className="w-16 h-16 rounded-full bg-airbnb-bg border border-airbnb-border flex items-center justify-center shrink-0">
          <User size={28} className="text-airbnb-gray" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-airbnb-dark">{displayName}</h1>
          <p className="text-sm text-airbnb-gray">{email}</p>
          <div className="flex items-center gap-2 mt-1">
            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full capitalize ${
              isHost ? "bg-airbnb-pink/10 text-airbnb-pink" : "bg-sky-100 text-sky-700"
            }`}>
              {profile?.role ?? "guest"}
            </span>
            {profile?.is_superhost && (
              <span className="flex items-center gap-1 text-[10px] font-semibold text-amber-600">
                <Shield size={10} /> Superhost
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Quick links */}
      <div className="bg-airbnb-bg rounded-2xl divide-y divide-airbnb-border mb-4 overflow-hidden">
        {isHost ? (
          <Link
            href="/host/negotiations"
            className="flex items-center justify-between px-4 py-4"
          >
            <div className="flex items-center gap-3">
              <Bot size={18} className="text-airbnb-pink" />
              <span className="text-sm font-medium text-airbnb-dark">Incoming negotiations</span>
            </div>
            <ChevronRight size={16} className="text-airbnb-gray" />
          </Link>
        ) : (
          <Link
            href="/messages"
            className="flex items-center justify-between px-4 py-4"
          >
            <div className="flex items-center gap-3">
              <MessageCircle size={18} className="text-airbnb-pink" />
              <span className="text-sm font-medium text-airbnb-dark">My negotiations</span>
            </div>
            <ChevronRight size={16} className="text-airbnb-gray" />
          </Link>
        )}

        <Link href="/" className="flex items-center justify-between px-4 py-4">
          <div className="flex items-center gap-3">
            <Home size={18} className="text-airbnb-gray" />
            <span className="text-sm font-medium text-airbnb-dark">Browse listings</span>
          </div>
          <ChevronRight size={16} className="text-airbnb-gray" />
        </Link>

        {profile?.host_since && (
          <div className="flex items-center justify-between px-4 py-4">
            <div className="flex items-center gap-3">
              <Star size={18} className="text-amber-500" />
              <span className="text-sm font-medium text-airbnb-dark">
                Hosting since {profile.host_since}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Switch account hint */}
      <div className="bg-airbnb-bg rounded-2xl mb-4 overflow-hidden">
        <Link
          href="/login"
          className="flex items-center justify-between px-4 py-4"
        >
          <div className="flex items-center gap-3">
            <User size={18} className="text-airbnb-gray" />
            <span className="text-sm font-medium text-airbnb-dark">Switch account</span>
          </div>
          <ChevronRight size={16} className="text-airbnb-gray" />
        </Link>
      </div>

      {/* Sign out */}
      <button
        onClick={handleSignOut}
        className="w-full flex items-center justify-center gap-2 border border-red-200 text-red-500 font-semibold text-sm py-4 rounded-2xl"
      >
        <LogOut size={16} />
        Sign out
      </button>

      <SmartBottomNav />
    </div>
  );
}
