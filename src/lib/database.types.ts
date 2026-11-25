export type Json = string | number | boolean | null | { [key: string]: Json } | Json[];

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          full_name: string | null;
          avatar_url: string | null;
          phone: string | null;
          role: "guest" | "host" | "both";
          is_superhost: boolean;
          host_since: number | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          full_name?: string | null;
          avatar_url?: string | null;
          phone?: string | null;
          role?: "guest" | "host" | "both";
          is_superhost?: boolean;
          host_since?: number | null;
        };
        Update: {
          full_name?: string | null;
          avatar_url?: string | null;
          phone?: string | null;
          role?: "guest" | "host" | "both";
          is_superhost?: boolean;
          host_since?: number | null;
        };
        Relationships: [];
      };
      listings: {
        Row: {
          id: string;
          host_id: string;
          title: string;
          description: string | null;
          property_type: string;
          area: string;
          state: string;
          location_text: string | null;
          lat: number | null;
          lng: number | null;
          bedrooms: number;
          beds: number;
          baths: number;
          max_guests: number;
          nightly_price: number;
          original_price: number | null;
          min_price: number | null;
          rating: number | null;
          review_count: number;
          is_guest_favorite: boolean;
          is_superhost: boolean;
          check_in: string | null;
          check_out: string | null;
          cancellation_policy: string | null;
          negotiation_enabled: boolean;
          is_active: boolean;
          embedding: number[] | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          host_id: string;
          title: string;
          description?: string | null;
          property_type: string;
          area: string;
          state: string;
          location_text?: string | null;
          lat?: number | null;
          lng?: number | null;
          bedrooms: number;
          beds: number;
          baths: number;
          max_guests: number;
          nightly_price: number;
          original_price?: number | null;
          min_price?: number | null;
          rating?: number | null;
          review_count?: number;
          is_guest_favorite?: boolean;
          is_superhost?: boolean;
          check_in?: string | null;
          check_out?: string | null;
          cancellation_policy?: string | null;
          negotiation_enabled?: boolean;
          is_active?: boolean;
        };
        Update: {
          host_id?: string;
          title?: string;
          description?: string | null;
          property_type?: string;
          area?: string;
          state?: string;
          location_text?: string | null;
          lat?: number | null;
          lng?: number | null;
          bedrooms?: number;
          beds?: number;
          baths?: number;
          max_guests?: number;
          nightly_price?: number;
          original_price?: number | null;
          min_price?: number | null;
          rating?: number | null;
          review_count?: number;
          is_guest_favorite?: boolean;
          is_superhost?: boolean;
          check_in?: string | null;
          check_out?: string | null;
          cancellation_policy?: string | null;
          negotiation_enabled?: boolean;
          is_active?: boolean;
        };
        Relationships: [];
      };
      listing_images: {
        Row: {
          id: string;
          listing_id: string;
          url: string;
          position: number;
          created_at: string;
        };
        Insert: {
          listing_id: string;
          url: string;
          position: number;
        };
        Update: {
          listing_id?: string;
          url?: string;
          position?: number;
        };
        Relationships: [];
      };
      amenities: {
        Row: { id: number; name: string };
        Insert: { name: string };
        Update: { name?: string };
        Relationships: [];
      };
      listing_amenities: {
        Row: { listing_id: string; amenity_id: number };
        Insert: { listing_id: string; amenity_id: number };
        Update: { listing_id?: string; amenity_id?: number };
        Relationships: [];
      };
      negotiations: {
        Row: {
          id: string;
          listing_id: string;
          guest_id: string;
          booking_id: string | null;
          target_price: number;
          walk_away_price: number;
          comparable_price: number | null;
          close_mode: "auto" | "approval";
          current_offer: number | null;
          status: "active" | "accepted" | "rejected" | "expired" | "walked_away";
          turn_count: number;
          max_turns: number;
          outcome_note: string | null;
          desired_addons: string[] | null;
          started_at: string;
          ended_at: string | null;
          created_at: string;
          buyer_override: boolean;
        };
        Insert: {
          listing_id: string;
          guest_id: string;
          booking_id?: string | null;
          target_price: number;
          walk_away_price: number;
          comparable_price?: number | null;
          close_mode?: "auto" | "approval";
          current_offer?: number | null;
          status?: "active" | "accepted" | "rejected" | "expired" | "walked_away";
          max_turns?: number;
          outcome_note?: string | null;
          desired_addons?: string[] | null;
          ended_at?: string | null;
          buyer_override?: boolean;
        };
        Update: {
          listing_id?: string;
          guest_id?: string;
          booking_id?: string | null;
          target_price?: number;
          walk_away_price?: number;
          comparable_price?: number | null;
          close_mode?: "auto" | "approval";
          current_offer?: number | null;
          status?: "active" | "accepted" | "rejected" | "expired" | "walked_away";
          turn_count?: number;
          max_turns?: number;
          outcome_note?: string | null;
          desired_addons?: string[] | null;
          ended_at?: string | null;
          buyer_override?: boolean;
        };
        Relationships: [];
      };
      turns: {
        Row: {
          id: string;
          negotiation_id: string;
          turn_number: number;
          role: "agent" | "host" | "buyer";
          message: string;
          action: "open" | "counter" | "hold" | "accept" | "walk_away" | null;
          allowed_offer: number | null;
          model_used: string | null;
          is_critical: boolean;
          latency_ms: number | null;
          prompt_tokens: number | null;
          completion_tokens: number | null;
          cost_usd: number | null;
          guardrail_passed: boolean | null;
          retry_count: number;
          created_at: string;
        };
        Insert: {
          negotiation_id: string;
          turn_number: number;
          role: "agent" | "host" | "buyer";
          message: string;
          action?: "open" | "counter" | "hold" | "accept" | "walk_away" | null;
          allowed_offer?: number | null;
          model_used?: string | null;
          is_critical?: boolean;
          latency_ms?: number | null;
          prompt_tokens?: number | null;
          completion_tokens?: number | null;
          cost_usd?: number | null;
          guardrail_passed?: boolean | null;
        };
        Update: {
          negotiation_id?: string;
          turn_number?: number;
          role?: "agent" | "host" | "buyer";
          message?: string;
          action?: "open" | "counter" | "hold" | "accept" | "walk_away" | null;
          allowed_offer?: number | null;
          model_used?: string | null;
          is_critical?: boolean;
          latency_ms?: number | null;
          prompt_tokens?: number | null;
          completion_tokens?: number | null;
          cost_usd?: number | null;
          guardrail_passed?: boolean | null;
        };
        Relationships: [];
      };
      bookings: {
        Row: {
          id: string;
          listing_id: string;
          guest_id: string;
          negotiation_id: string | null;
          check_in_date: string;
          check_out_date: string;
          nights: number;
          guests: number;
          nightly_price: number;
          total_price: number;
          status: "pending" | "confirmed" | "cancelled" | "completed";
          host_message: string | null;
          razorpay_order_id: string | null;
          razorpay_payment_id: string | null;
          payment_status: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          listing_id: string;
          guest_id: string;
          negotiation_id?: string | null;
          check_in_date: string;
          check_out_date: string;
          nights: number;
          guests: number;
          nightly_price: number;
          total_price: number;
          status?: "pending" | "confirmed" | "cancelled" | "completed";
          host_message?: string | null;
          razorpay_order_id?: string | null;
          razorpay_payment_id?: string | null;
          payment_status?: string;
        };
        Update: {
          listing_id?: string;
          guest_id?: string;
          negotiation_id?: string | null;
          check_in_date?: string;
          check_out_date?: string;
          nights?: number;
          guests?: number;
          nightly_price?: number;
          total_price?: number;
          status?: "pending" | "confirmed" | "cancelled" | "completed";
          host_message?: string | null;
          razorpay_order_id?: string | null;
          razorpay_payment_id?: string | null;
          payment_status?: string;
        };
        Relationships: [];
      };
      payments: {
        Row: {
          id: string;
          booking_id: string;
          guest_id: string;
          razorpay_order_id: string | null;
          razorpay_payment_id: string | null;
          amount_paise: number;
          currency: string;
          status: "created" | "authorized" | "captured" | "failed" | "refunded";
          webhook_payload: Json | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          booking_id: string;
          guest_id: string;
          razorpay_order_id?: string | null;
          razorpay_payment_id?: string | null;
          amount_paise: number;
          currency?: string;
          status?: "created" | "authorized" | "captured" | "failed" | "refunded";
          webhook_payload?: Json | null;
        };
        Update: {
          booking_id?: string;
          guest_id?: string;
          razorpay_order_id?: string | null;
          razorpay_payment_id?: string | null;
          amount_paise?: number;
          currency?: string;
          status?: "created" | "authorized" | "captured" | "failed" | "refunded";
          webhook_payload?: Json | null;
        };
        Relationships: [];
      };
      user_payment_methods: {
        Row: {
          id: string;
          user_id: string;
          razorpay_customer_id: string;
          razorpay_token_id: string | null;
          mandate_amount: number;
          created_at: string;
        };
        Insert: {
          user_id: string;
          razorpay_customer_id: string;
          razorpay_token_id?: string | null;
          mandate_amount?: number;
        };
        Update: {
          razorpay_customer_id?: string;
          razorpay_token_id?: string | null;
          mandate_amount?: number;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
  };
}

// Convenience type aliases
export type Listing = Database["public"]["Tables"]["listings"]["Row"];
export type ListingImage = Database["public"]["Tables"]["listing_images"]["Row"];
export type Profile = Database["public"]["Tables"]["profiles"]["Row"];
export type Negotiation = Database["public"]["Tables"]["negotiations"]["Row"];
export type Turn = Database["public"]["Tables"]["turns"]["Row"];
export type Booking = Database["public"]["Tables"]["bookings"]["Row"];
export type Payment = Database["public"]["Tables"]["payments"]["Row"];

// Listing with images and amenities (for display)
export type ListingFull = Listing & {
  listing_images: ListingImage[];
  amenities: { name: string }[];
  profiles: Pick<Profile, "full_name" | "avatar_url" | "is_superhost" | "host_since"> | null;
};
