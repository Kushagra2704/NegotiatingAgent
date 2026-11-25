"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Search, Heart, Home, MessageCircle, User } from "lucide-react";

const navItems = [
  { label: "Explore",   href: "/",         icon: Search },
  { label: "Wishlists", href: "/wishlists", icon: Heart },
  { label: "Trips",     href: "/trips",     icon: Home },
  { label: "Messages",  href: "/messages",  icon: MessageCircle },
  { label: "Profile",   href: "/profile",   icon: User },
];

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 inset-x-0 max-w-[430px] mx-auto bg-white border-t border-airbnb-border z-50">
      <div className="flex items-center justify-around h-16 px-2">
        {navItems.map(({ label, href, icon: Icon }) => {
          const isActive =
            href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className="flex flex-col items-center gap-1 flex-1 py-2"
            >
              <Icon
                size={22}
                className={isActive ? "text-airbnb-pink" : "text-airbnb-gray"}
                strokeWidth={isActive ? 2.5 : 1.8}
              />
              <span
                className={`text-[10px] font-medium ${
                  isActive ? "text-airbnb-pink" : "text-airbnb-gray"
                }`}
              >
                {label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
