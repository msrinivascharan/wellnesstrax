import { NextResponse } from "next/server";
import { loadFoodItems, addFoodItem } from "@/lib/profile-loader";

export async function GET() {
  try {
    const data = await loadFoodItems();
    return NextResponse.json({ data });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load food items";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/** Add a new item to food_items.json. Body: { meal, category, name } */
export async function PUT(req: Request) {
  try {
    const { meal, category, name } = await req.json() as {
      meal: string;
      category: string;
      name: string;
    };
    if (!meal || !category || !name?.trim()) {
      return NextResponse.json({ error: "meal, category and name are required" }, { status: 400 });
    }
    const updated = await addFoodItem(meal, category, name.trim());
    return NextResponse.json({ ok: true, data: updated });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to update food items";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
