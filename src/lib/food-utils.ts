/**
 * Shared food helpers — used by FoodLog (entry creation) and Reports (plate balance chart).
 */

/**
 * Guesses the best balanced-plate category for a food name.
 * Priority order prevents mis-classification
 * (e.g. "lassi" → Beverages & Drinks, not One-Pot Dish).
 */
export function autoCategory(name: string): string {
  const lc = name.toLowerCase();

  // Beverages & Drinks — must come first so "lassi", "coffee" etc. win over one-pot
  if (/\b(coffee|tea|juice|shake|smoothie|lassi|sherbet|kombucha|kefir|buttermilk|neer\s*more|coconut water)\b/.test(lc)) {
    return "Beverages & Drinks";
  }

  // One-Pot Dish — complex multi-ingredient preparations (3+ commas OR long + cooked)
  const commas = (lc.match(/,/g) || []).length;
  const hasPrep = /\b(cooked|mixed|prepared|along with|tossed|stir.fried|sautéed|sauteed|roasted)\b/.test(lc);
  if ((commas >= 2 && hasPrep) || commas >= 4 || (name.length > 55 && commas >= 1 && hasPrep)) {
    return "One-Pot Dish";
  }

  // Protein
  if (/\b(egg|chicken|fish|salmon|tuna|sardine|turkey|lamb|mutton|beef|prawn|shrimp|tofu|tempeh|whey|cottage cheese)\b/.test(lc)) {
    return "Protein";
  }

  // Nuts & Seeds (including groundnuts, melon seeds)
  if (/\b(almond|walnut|cashew|pistachio|peanut|groundnut|pecan|hazelnut|macadamia|flaxseed|flax seed|chia seed|pumpkin seed|sunflower seed|sesame|hemp seed|muskmelon seed|watermelon seed|melon seed)\b/.test(lc)) {
    return "Nuts & Seeds";
  }

  // Fruits
  if (/\b(apple|banana|orange|mango|guava|blueberr|strawberr|raspberry|grape|watermelon|papaya|kiwi|pear|peach|plum|avocado|cherry|lemon|lime|pomegranate|fig|apricot)\b/.test(lc)) {
    return "Fruits";
  }

  // Vegetables
  if (/\b(broccoli|spinach|carrot|cucumber|drumstick|tomato|onion|garlic|capsicum|bell pepper|lettuce|cabbage|cauliflower|kale|zucchini|radish|beetroot|sweet potato|potato|yam|okra|brinjal|eggplant|bitter gourd|bottle gourd|ridge gourd|cluster bean|french bean)\b/.test(lc)) {
    return "Vegetables";
  }

  // Dairy
  if (/\b(milk|curd|yogurt|yoghurt|cheese|butter|ghee|cream|paneer)\b/.test(lc)) {
    return "Dairy";
  }

  // Grains & Carbs
  if (/\b(rice|wheat|oat|bread|roti|chapati|noodle|pasta|quinoa|millet|barley|cereal|poha|upma|idli|dosa|porridge|corn|maize|bajra|jowar|ragi)\b/.test(lc)) {
    return "Grains & Carbs";
  }

  // Legumes & Beans
  if (/\b(dal|lentil|chickpea|moong|chana|rajma|soybean|kidney bean|black bean|toor|urad|masoor|moth bean|horse gram|chawli)\b/.test(lc)) {
    return "Legumes & Beans";
  }

  // Spices & Condiments
  if (/\b(masala|turmeric|cumin|coriander seed|garam masala|chili|chilli|curry paste|ketchup|mayo|mustard|vinegar|soy sauce)\b/.test(lc)) {
    return "Spices & Condiments";
  }

  return "Other";
}
