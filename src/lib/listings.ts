import { supabase } from "./supabase";
import type { ListingFull } from "./database.types";

const LISTING_SELECT = `
  *,
  listing_images ( id, url, position ),
  listing_amenities ( amenities ( name ) ),
  profiles:host_id ( full_name, avatar_url, is_superhost, host_since )
`;

export async function getListings(state?: string): Promise<ListingFull[]> {
  let query = supabase
    .from("listings")
    .select(LISTING_SELECT)
    .eq("is_active", true)
    .order("review_count", { ascending: false });

  if (state) query = query.eq("state", state);

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as unknown as ListingFull[];
}

export async function getListingById(id: string): Promise<ListingFull | null> {
  const { data, error } = await supabase
    .from("listings")
    .select(LISTING_SELECT)
    .eq("id", id)
    .eq("is_active", true)
    .single();

  if (error) return null;
  return data as unknown as ListingFull;
}

export async function getListingsByArea(area: string): Promise<ListingFull[]> {
  const { data, error } = await supabase
    .from("listings")
    .select(LISTING_SELECT)
    .eq("is_active", true)
    .eq("area", area)
    .order("rating", { ascending: false });

  if (error) throw error;
  return (data ?? []) as unknown as ListingFull[];
}

// Helpers to normalise DB rows into the shape the UI expects
export function getImages(listing: ListingFull): string[] {
  return [...listing.listing_images]
    .sort((a, b) => a.position - b.position)
    .map((img) => img.url);
}

export function getAmenities(listing: ListingFull): string[] {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (listing as any).listing_amenities?.map((la: any) => la.amenities?.name).filter(Boolean) ?? [];
}
