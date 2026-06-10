export interface UserProfile {
  uid: string;
  username: string;
  role: "admin" | "owner";
  phone: string;
  requiresPasswordChange?: boolean;
  createdAt?: string;
  password?: string;
}

export interface Chalet {
  id: string;
  name: string;
  description: string;
  ownerId: string;
  ownerName: string;
  pricePerNight: number;
  roomsCount: number;
  bathroomsCount: number;
  locationLink: string;
  images: string[];
  phone: string;
  createdAt?: string;
  instapayAddress?: string;
  walletNumber?: string;
}

export interface Booking {
  id: string;
  chaletId: string;
  chaletName: string;
  ownerId: string;
  customerName: string;
  customerPhone: string;
  customerLocation: string;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  totalPrice: number;
  status: "pending" | "confirmed" | "cancelled" | "rejected";
  createdAt?: string;
  updatedAt?: string;
}

export interface Review {
  id: string;
  chaletId: string;
  customerName: string;
  rating: number; // 1-5
  comment: string;
  createdAt: string;
}

export interface SiteConfig {
  id: string; // always 'site-config'
  siteName: string;
  logoUrl: string;
  backgroundImageUrl: string;
}
