
import { CleanedData, OptimizedData } from './types';

export const MOCK_CLEANED_DATA: CleanedData = {
  "BSR": "#7,457 in Automotive",
  "asin": "B004AG7XSM",
  "brand": "Bosch",
  "price": 6.61,
  "title": "BOSCH BC1293 QuietCast Premium Ceramic Disc Brake Pad Set - Compatible with Select Lexus ES300h, ES350; Toyota Avalon, Camry; FRONT",
  "ratings": "4.5",
  "reviews": "887 ratings",
  "category": "Automotive›Replacement Parts›Brake System›Brake Pads",
  "features": [
    "[THE BOSCH ADVANTAGE] - The Bosch QuietCast line draws on over 77 years of OE braking excellence...",
    "[QUIETER STOPS] - The industry's best pre-attached OE style multilayer rubber core shims...",
    "[EXCEPTIONAL FRICTION MATERIAL] - Rigorously formulated and tested by Bosch engineers...",
    "[BOSCH DURABILITY] - Powder-coated backing plate prevents rust and corrosion...",
    "[READY TO INSTALL] - Set includes pads for 1 axle (2 wheels)...",
    "FRONT: Compatible with select vehicles..."
  ],
  "shipping": 0,
  "variants": [],
  // Fix: item_width must be a string according to CleanedData interface
  "item_width": "5.3",
  "main_image": "https://picsum.photos/400/400", // Placeholder for demo
  "updated_at": "2025-12-10T15:32:19.874Z",
  "description": "Today, one of every three Asian, Domestic, and European vehicles on the road in North America includes Bosch braking components...",
  "final_price": 6.61,
  // Fix: item_height must be a string according to CleanedData interface
  "item_height": "3.33",
  // Fix: item_length must be a string according to CleanedData interface
  "item_length": "8.5",
  "item_weight": "3.5 pounds",
  "parent_asin": "B004AG7XSM",
  "other_images": [],
  "strike_price": 19.99,
  "coupon_amount": null
};

export const MOCK_OPTIMIZED_DATA: OptimizedData = {
  "optimized_title": "Premium Ceramic Disc Front Brake Pad Set for Lexus ES300h, ES350 and Toyota Avalon, Camry - Quiet Performance",
  "search_keywords": "Ceramic Brake Pads, Disc Brake Pad Set, Quiet Brake Pads, Lexus ES300h, ES350, Toyota Avalon, Camry, Front Brake Pads",
  "optimized_features": [
    "✅ OVER YEARS OF BRAKING EXCELLENCE: Premium line leverages decades of OE braking expertise...",
    "✅ QUIET OPERATION: Advanced multilayer rubber core shims minimize noise...",
    "✅ HIGH-PERFORMANCE FRICTION MATERIAL: Engineered ceramic material delivers exceptional stopping power...",
    "✅ RUST-RESISTANT DESIGN: Powder-coated backing plates prevent corrosion...",
    "✅ COMPLETE INSTALLATION KIT: Includes pads for 1 axle (2 wheels)...",
    "✅ VEHICLE COMPATIBILITY: Fits select models; check fitment..."
  ],
  "optimized_description": "Upgrade your vehicle's braking system with this premium ceramic disc brake pad set designed for front installation. With a legacy of over 77 years..."
};
