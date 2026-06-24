import fs from "fs/promises";
import path from "path";
import type { UserProfile, FoodRules, ActivitiesData } from "@/types";

const DATA_DIR = path.join(process.cwd(), "data");

export async function loadProfile(): Promise<UserProfile> {
  const raw = await fs.readFile(path.join(DATA_DIR, "profile.json"), "utf-8");
  return JSON.parse(raw) as UserProfile;
}

export async function loadFoodRules(): Promise<FoodRules> {
  const raw = await fs.readFile(path.join(DATA_DIR, "food_rules.json"), "utf-8");
  return JSON.parse(raw) as FoodRules;
}

export async function loadActivities(): Promise<ActivitiesData> {
  const raw = await fs.readFile(path.join(DATA_DIR, "activities.json"), "utf-8");
  return JSON.parse(raw) as ActivitiesData;
}
