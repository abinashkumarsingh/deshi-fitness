// Approximate macros per serving unit. Values are rough home-style estimates.
export interface Food { key: string; name: string; category: string; unit: string; cal: number; p: number; c: number; f: number; }

const F = (key: string, name: string, category: string, unit: string, cal: number, p: number, c: number, f: number): Food =>
  ({ key, name, category, unit, cal, p, c, f });

export const foods: Food[] = [
  // Roti / Chawal
  F('roti', 'Roti / Chapati', 'roti_chawal', '1 roti', 75, 2, 15, 0.5),
  F('paratha', 'Plain Paratha', 'roti_chawal', '1 paratha', 180, 4, 25, 7),
  F('aloo-paratha', 'Aloo Paratha', 'roti_chawal', '1 paratha', 260, 5, 36, 10),
  F('naan', 'Naan', 'roti_chawal', '1 naan', 260, 8, 45, 5),
  F('puri', 'Puri', 'roti_chawal', '1 puri', 100, 2, 12, 5),
  F('rice', 'White rice', 'roti_chawal', '1 bowl', 180, 3, 40, 0.5),
  F('brown-rice', 'Brown Rice', 'roti_chawal', '1 bowl', 170, 4, 36, 1.5),
  F('jeera-rice', 'Jeera Rice', 'roti_chawal', '1 bowl', 210, 3, 38, 5),
  F('chicken-biryani', 'Chicken Biryani', 'roti_chawal', '1 plate', 500, 25, 60, 18),
  F('veg-biryani', 'Veg Biryani', 'roti_chawal', '1 plate', 380, 8, 62, 11),
  // Dal
  F('dal-tadka', 'Dal Tadka', 'dal', '1 bowl', 120, 7, 16, 3),
  F('dal-makhani', 'Dal Makhani', 'dal', '1 bowl', 230, 9, 20, 13),
  F('rajma', 'Rajma', 'dal', '1 bowl', 180, 9, 26, 4),
  F('chole', 'Chole', 'dal', '1 bowl', 200, 9, 28, 6),
  F('sambar', 'Sambar', 'dal', '1 bowl', 110, 5, 16, 3),
  F('rasam', 'Rasam', 'dal', '1 bowl', 50, 2, 8, 1),
  // Sabzi
  F('aloo-gobi', 'Aloo Gobi', 'sabzi', '1 bowl', 150, 3, 18, 7),
  F('bhindi', 'Bhindi Masala', 'sabzi', '1 bowl', 130, 3, 12, 8),
  F('palak-paneer', 'Palak Paneer', 'sabzi', '1 bowl', 250, 13, 9, 18),
  F('mixed-veg', 'Mixed Veg', 'sabzi', '1 bowl', 120, 3, 14, 6),
  F('lauki', 'Lauki Sabzi', 'sabzi', '1 bowl', 80, 2, 10, 4),
  F('karela', 'Karela Sabzi', 'sabzi', '1 bowl', 90, 2, 9, 5),
  // Protein
  F('paneer', 'Paneer (raw)', 'protein', '100 g', 265, 18, 4, 20),
  F('paneer-bhurji', 'Paneer Bhurji', 'protein', '1 bowl', 300, 18, 6, 23),
  F('chicken-curry', 'Chicken Curry', 'protein', '1 bowl', 250, 25, 6, 14),
  F('tandoori-chicken', 'Tandoori Chicken', 'protein', '2 pieces', 260, 32, 4, 12),
  F('chicken-breast', 'Chicken Breast (cooked)', 'protein', '100 g', 165, 31, 0, 4),
  F('egg', 'Boiled egg', 'protein', '1 egg', 70, 6, 0.5, 5),
  F('egg-bhurji', 'Egg Bhurji', 'protein', '2 eggs', 200, 13, 4, 15),
  F('fish-curry', 'Fish Curry', 'protein', '1 bowl', 220, 22, 5, 12),
  F('soya-chunks', 'Soya Chunks (dry)', 'protein', '50 g', 170, 26, 16, 0.5),
  F('chana', 'Boiled Chana', 'protein', '1 bowl', 210, 11, 35, 3),
  // Dairy
  F('dahi', 'Curd (dahi)', 'dairy', '1 bowl', 60, 3, 5, 3),
  F('lassi', 'Sweet Lassi', 'dairy', '1 glass', 220, 7, 34, 6),
  F('chaas', 'Chaas', 'dairy', '1 glass', 40, 2, 4, 1.5),
  F('milk', 'Milk', 'dairy', '1 glass', 150, 8, 12, 8),
  F('ghee', 'Ghee', 'dairy', '1 tsp', 45, 0, 0, 5),
  F('butter', 'Butter', 'dairy', '1 tsp', 36, 0, 0, 4),
  F('greek-yogurt', 'Greek yogurt / hung curd', 'dairy', '100 g', 100, 10, 4, 5),
  // Snacks
  F('samosa', 'Samosa', 'snacks', '1 piece', 260, 4, 24, 17),
  F('pakora', 'Pakora', 'snacks', '1 plate', 300, 6, 26, 19),
  F('namkeen', 'Namkeen', 'snacks', '1 small bowl', 270, 6, 22, 18),
  F('biscuits', 'Biscuits', 'snacks', '2 biscuits', 90, 1, 13, 4),
  F('chai', 'Chai (with sugar)', 'snacks', '1 cup', 90, 3, 12, 3),
  F('coffee', 'Coffee (with milk)', 'snacks', '1 cup', 70, 3, 8, 3),
  F('poha', 'Poha', 'snacks', '1 plate', 250, 5, 42, 7),
  // Sweets
  F('gulab-jamun', 'Gulab Jamun', 'sweets', '1 piece', 150, 2, 22, 6),
  F('jalebi', 'Jalebi', 'sweets', '100 g', 380, 3, 60, 15),
  F('rasgulla', 'Rasgulla', 'sweets', '1 piece', 120, 2, 25, 1),
  F('barfi', 'Barfi', 'sweets', '1 piece', 130, 3, 17, 6),
  F('kheer', 'Kheer', 'sweets', '1 bowl', 250, 6, 38, 8),
  // Street
  F('chaat', 'Papdi Chaat', 'street', '1 plate', 330, 8, 45, 13),
  F('pani-puri', 'Pani Puri', 'street', '6 pieces', 220, 4, 36, 7),
  F('vada-pav', 'Vada Pav', 'street', '1 piece', 290, 6, 40, 12),
  F('pav-bhaji', 'Pav Bhaji', 'street', '1 plate', 500, 12, 65, 22),
  // South Indian
  F('dosa', 'Plain Dosa', 'south_indian', '1 dosa', 170, 4, 28, 5),
  F('masala-dosa', 'Masala Dosa', 'south_indian', '1 dosa', 350, 7, 50, 13),
  F('idli', 'Idli', 'south_indian', '1 idli', 60, 2, 12, 0.5),
  F('upma', 'Upma', 'south_indian', '1 plate', 250, 6, 38, 8),
  F('pongal', 'Pongal', 'south_indian', '1 bowl', 260, 7, 36, 10),
  // Regional
  F('bengali-fish', 'Bengali fish curry', 'regional', '1 bowl', 230, 22, 6, 13),
  F('gujarati-thali', 'Gujarati Thali', 'regional', '1 thali', 800, 22, 110, 30),
  // Supplements
  F('whey', 'Whey Protein', 'supplements', '1 scoop', 120, 24, 3, 1.5),
  F('mass-gainer', 'Mass Gainer', 'supplements', '1 serving', 380, 15, 75, 3),
  F('sattu', 'Sattu', 'supplements', '2 tbsp (20 g)', 80, 4, 13, 1),
  F('roasted-chana', 'Roasted Chana', 'supplements', '30 g', 110, 6, 18, 2),
  F('peanut-butter', 'Peanut Butter', 'supplements', '1 tbsp', 95, 4, 3, 8),
  F('banana', 'Banana', 'supplements', '1 banana', 105, 1, 27, 0.4),
  // Fasting / vrat
  F('sabudana-khichdi', 'Sabudana Khichdi', 'vrat', '1 plate', 350, 4, 60, 11),
  F('singhara-roti', 'Singhara Atta Roti', 'vrat', '1 roti', 110, 1, 22, 2),
];
