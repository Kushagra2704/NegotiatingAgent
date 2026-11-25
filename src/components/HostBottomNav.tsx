"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Search, MessageCircle, User } from "lucide-react";
import { supabase } from "@/lib/supabase";

const navItems = [
  { label: "Explore",      href: "/",                 icon: Search },
  { label: "Negotiations", href: "/host/negotiations", icon: MessageCircle },
  { label: "Profile",      href: "/profile",           icon: User },
];

export default function HostBottomNav() {
  const pathname = usePathname();
  const [badge, setBadge] = useState(0);

  useEffect(() => {
    let token = "";

    async function fetchBadge() {
      if (!token) {
        const { data: { session } } = await supabase.auth.getSession();
        token = session?.access_token ?? "";
      }
      if (!token) return;
      try {
        const res = await fetch("/api/host/badge", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          setBadge(data.needs_reply ?? 0);
        }
      } catch {
        // fail silently — badge just won't update
      }
    }

    fetchBadge();
    const interval = setInterval(fetchBadge, 10000);
    return () => clearInterval(interval);
  }, []);

  return (
    <nav className="fixed bottom-0 inset-x-0 max-w-[430px] mx-auto bg-white border-t border-airbnb-border z-50">
      <div className="flex items-center justify-around h-16 px-2">
        {navItems.map(({ label, href, icon: Icon }) => {
          const isActive = href === "/" ? pathname === "/" : pathname.startsWith(href);
          const showBadge = label === "Negotiations" && badge > 0;

          return (
            <Link
              key={href}
              href={href}
              className="flex flex-col items-center gap-1 flex-1 py-2"
            >
              <div className="relative">
                <Icon
                  size={22}
                  className={isActive ? "text-airbnb-pink" : "text-airbnb-gray"}
                  strokeWidth={isActive ? 2.5 : 1.8}
                />
                {showBadge && (
                  <span className="absolute -top-1.5 -right-2 min-w-[16px] h-4 bg-airbnb-pink text-white text-[9px] font-bold rounded-full flex items-center justify-center px-0.5 leading-none">
                    {badge > 99 ? "99+" : badge}
                  </span>
                )}
              </div>
              <span className={`text-[10px] font-medium ${isActive ? "text-airbnb-pink" : "text-airbnb-gray"}`}>
                {label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
