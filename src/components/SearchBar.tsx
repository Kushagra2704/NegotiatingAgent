import { Search } from "lucide-react";

export default function SearchBar() {
  return (
    <div className="px-4 pt-4 pb-2">
      <button className="w-full flex items-center gap-3 bg-white rounded-full border border-airbnb-border shadow-md px-4 py-3">
        <Search size={18} className="text-airbnb-dark shrink-0" />
        <span className="text-airbnb-gray text-sm font-medium">
          Start your search
        </span>
      </button>
    </div>
  );
}
