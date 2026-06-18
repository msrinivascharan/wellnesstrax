import fs from "fs/promises";
import path from "path";
import type { UserProfile, FoodRules, FoodItemsData, ActivitiesData, FoodPreferences } from "@/types";

const DATA_DIR = path.join(process.cwd(), "data");

export async function loadProfile(): Promise<UserProfile> {
  const raw = await fs.readFile(path.join(DATA_DIR, "profile.json"), "utf-8");
  return JSON.parse(raw) as UserProfile;
}

export async function loadFoodRules(): Promise<FoodRules> {
  const raw = await fs.readFile(path.join(DATA_DIR, "food_rules.json"), "utf-8");
  return JSON.parse(raw) as FoodRules;
}

export async function loadFoodItems(): Promise<FoodItemsData> {
  const raw = await fs.readFile(path.join(DATA_DIR, "food_items.json"), "utf-8");
  return JSON.parse(raw) as FoodItemsData;
}

/**
 * Add a new item into food_items.json under the specified meal → category.
 * Creates the category if it doesn't exist. Skips if the item already exists (case-insensitive).
 * Preserves all existing content (including _comment and other metadata).
 */
export async function addFoodItem(
  meal: string,
  category: string,
  name: string
): Promise<FoodItemsData> {
  const filePath = path.join(DATA_DIR, "food_items.json");
  const raw = await fs.readFile(filePath, "utf-8");

  // Preserve the full file structure (including _comment)
  const fullFile = JSON.parse(raw) as Record<string, unknown> & { meals?: Record<string, Record<string, string[]>> };

  if (!fullFile.meals) fullFile.meals = {};
  if (!fullFile.meals[meal]) fullFile.meals[meal] = {};
  if (!fullFile.meals[meal][category]) fullFile.meals[meal][category] = [];

  const existing = fullFile.meals[meal][category];
  if (!existing.some(i => i.toLowerCase() === name.toLowerCase())) {
    existing.push(name);
  }

  await fs.writeFile(filePath, JSON.stringify(fullFile, null, 2), "utf-8");
  return { meals: fullFile.meals } as FoodItemsData;
}

/**
 * Remove an item from food_items.json under meal → category.
 * If the category becomes empty after removal, the category key is deleted too.
 */
export async function removeFoodItem(
  meal: string,
  category: string,
  name: string
): Promise<FoodItemsData> {
  const filePath = path.join(DATA_DIR, "food_items.json");
  const raw = await fs.readFile(filePath, "utf-8");
  const fullFile = JSON.parse(raw) as Record<string, unknown> & { meals?: Record<string, Record<string, string[]>> };

  const items = fullFile.meals?.[meal]?.[category];
  if (items) {
    const filtered = items.filter(i => i.toLowerCase() !== name.toLowerCase());
    if (filtered.length === 0) {
      // Remove empty category
      delete fullFile.meals![meal][category];
    } else {
      fullFile.meals![meal][category] = filtered;
    }
  }

  await fs.writeFile(filePath, JSON.stringify(fullFile, null, 2), "utf-8");
  return { meals: fullFile.meals ?? {} } as FoodItemsData;
}

/**
 * Move an item from one category to another within the same meal.
 * Creates the target category if it doesn't exist.
 * Removes the source category key if it becomes empty after the move.
 */
export async function moveFoodItem(
  meal: string,
  oldCategory: string,
  newCategory: string,
  name: string
): Promise<FoodItemsData> {
  const filePath = path.join(DATA_DIR, "food_items.json");
  const raw = await fs.readFile(filePath, "utf-8");
  const fullFile = JSON.parse(raw) as Record<string, unknown> & { meals?: Record<string, Record<string, string[]>> };

  if (!fullFile.meals) fullFile.meals = {};

  // Remove from old category
  const srcItems = fullFile.meals[meal]?.[oldCategory];
  if (srcItems) {
    const filtered = srcItems.filter(i => i.toLowerCase() !== name.toLowerCase());
    if (filtered.length === 0) {
      delete fullFile.meals[meal][oldCategory];
    } else {
      fullFile.meals[meal][oldCategory] = filtered;
    }
  }

  // Add to new category (create if needed, skip if already present)
  if (!fullFile.meals[meal]) fullFile.meals[meal] = {};
  if (!fullFile.meals[meal][newCategory]) fullFile.meals[meal][newCategory] = [];
  const destItems = fullFile.meals[meal][newCategory];
  if (!destItems.some(i => i.toLowerCase() === name.toLowerCase())) {
    destItems.push(name);
  }

  await fs.writeFile(filePath, JSON.stringify(fullFile, null, 2), "utf-8");
  return { meals: fullFile.meals } as FoodItemsData;
}

export async function loadActivities(): Promise<ActivitiesData> {
  const raw = await fs.readFile(path.join(DATA_DIR, "activities.json"), "utf-8");
  return JSON.parse(raw) as ActivitiesData;
}

export async function loadFoodPreferences(): Promise<FoodPreferences> {
  try {
    const raw = await fs.readFile(path.join(DATA_DIR, "food_preferences.json"), "utf-8");
    const parsed = JSON.parse(raw) as Partial<FoodPreferences>;
    return {
      encourage: Array.isArray(parsed.encourage) ? parsed.encourage : [],
    };
  } catch {
    return { encourage: [] };
  }
}

export async function saveFoodPreferences(prefs: FoodPreferences): Promise<void> {
  const filePath = path.join(DATA_DIR, "food_preferences.json");
  const content = {
    _comment: "User-editable food preference list. encourage = always welcome.",
    encourage: prefs.encourage,
  };
  await fs.writeFile(filePath, JSON.stringify(content, null, 2), "utf-8");
}
