"use client";

import { useState } from "react";

const categories = [
  { id: "all", label: "All", icon: "🌐" },
  { id: "homes", label: "Homes", icon: "🏠" },
  { id: "experiences", label: "Experiences", icon: "🎈" },
  { id: "services", label: "Services", icon: "🛎" },
];

export default function CategoryPills() {
  const [active, setActive] = useState("all");

  return (
    <div className="px-4 py-2">
      <div className="flex gap-3 overflow-x-auto no-scrollbar pb-1">
        {categories.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setActive(cat.id)}
            className={`flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors ${
              active === cat.id
                ? "border-airbnb-dark bg-white text-airbnb-dark shadow-sm"
                : "border-airbnb-border bg-white text-airbnb-dark"
            }`}
          >
            <span>{cat.icon}</span>
            <span>{cat.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
