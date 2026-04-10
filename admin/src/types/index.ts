// src/types/index.ts
export interface Category {
  id:          string;
  name:        string;
  slug:        string;
  parent_id:   string | null;
  is_active:   boolean;
  sort_order:  number;
  children?:   Category[];
}

export interface Brand {
  id:          string;
  name:        string;
  slug:        string;
  logo_url?:   string;
  website_url?: string;
  is_active:   boolean;
}

export interface Seller {
  id:              string;
  business_name:   string;
  email:           string;
  status:          'pending' | 'approved' | 'rejected';
  commission_rate: number;
  total_earned:    number;
  wallet_balance:  number;
  created_at:      string;
}

export interface AdminUser {
  id:           string;
  email:        string;
  first_name:   string;
  last_name:    string;
  role:         string;
  is_suspended: boolean;
  is_active:    boolean;
  created_at:   string;
}