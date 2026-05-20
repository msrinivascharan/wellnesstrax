import fs from "fs/promises";
import path from "path";
import type { UserProfile, FoodRules, FoodItemsData, ActivitiesData } from "@/types";

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

export async function loadActivities(): Promise<ActivitiesData> {
  const raw = await fs.readFile(path.join(DATA_DIR, "activities.json"), "utf-8");
  return JSON.parse(raw) as ActivitiesData;
}
