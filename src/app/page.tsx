export const instant = false;

import SmartBottomNav from "@/components/SmartBottomNav";
import SearchBar from "@/components/SearchBar";
import CategoryPills from "@/components/CategoryPills";
import ListingCard from "@/components/ListingCard";
import { getListings } from "@/lib/listings";

export default async function HomePage() {
  const allListings = await getListings();

  const ratnagiriListings = allListings.filter((l) => l.area === "Ratnagiri");
  const matheranListings = allListings.filter((l) => l.area === "Matheran");
  const goaListings = allListings.filter((l) => l.state === "Goa");

  return (
    <div className="pb-20">
      <SearchBar />
      <CategoryPills />

      {/* Ratnagiri section */}
      <section className="mt-4 px-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold text-airbnb-dark">
            Check out homes in Ratnagiri
          </h2>
          <button className="w-8 h-8 rounded-full border border-airbnb-border flex items-center justify-center">
            <span className="text-sm">→</span>
          </button>
        </div>
        <div className="grid grid-cols-2 gap-4">
          {ratnagiriListings.map((listing) => (
            <ListingCard key={listing.id} listing={listing} />
          ))}
        </div>
      </section>

      {/* Promo banner */}
      <div className="mx-4 mt-6 rounded-2xl border border-airbnb-border p-4 flex items-center justify-between bg-white shadow-sm">
        <div>
          <p className="text-sm font-semibold text-airbnb-dark leading-snug">
            Your stay supports free<br />emergency housing
          </p>
          <button className="mt-2 border border-airbnb-dark rounded-full px-4 py-1.5 text-xs font-semibold text-airbnb-dark">
            Learn how
          </button>
        </div>
        <div className="text-4xl">🏠</div>
      </div>

      {/* Matheran section */}
      <section className="mt-6 px-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold text-airbnb-dark">
            Homes in Matheran
          </h2>
          <button className="w-8 h-8 rounded-full border border-airbnb-border flex items-center justify-center">
            <span className="text-sm">→</span>
          </button>
        </div>
        <div className="grid grid-cols-2 gap-4">
          {matheranListings.map((listing) => (
            <ListingCard key={listing.id} listing={listing} />
          ))}
        </div>
      </section>

      {/* Goa section */}
      <section className="mt-6 px-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold text-airbnb-dark">
            Top picks in Goa
          </h2>
          <button className="w-8 h-8 rounded-full border border-airbnb-border flex items-center justify-center">
            <span className="text-sm">→</span>
          </button>
        </div>
        <div className="grid grid-cols-2 gap-4">
          {goaListings.map((listing) => (
            <ListingCard key={listing.id} listing={listing} />
          ))}
        </div>
      </section>

      <SmartBottomNav />
    </div>
  );
}
