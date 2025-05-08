import { ConditionalCheckFailedException } from "@aws-sdk/client-dynamodb";
import { tool } from "ai";
import { cosineDistance, desc, eq, gt, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import type { AgentContext } from "../..";
import { db } from "../../../drizzle";
import { generateEmbeddings } from "../../libs";
import { today } from "../commonTools";
import { scrapeUrl } from "../pearl/scraping";
import {
	FoodPreferenceSchema,
	GroceryListSchema,
	MealPlanSchema,
	PantrySchema,
	RecipeIngredientSchema,
	RecipeSchema,
} from "./schema.dynamo";
import { Recipe } from "./schema.sql";

export const carmyTools = (context: AgentContext) => {
	const personalTools = {
		addRecipe: tool({
			description: `
				Add a new recipe to the user's recipe list.
				This tool is useful when you have the ingredients, instructions, and name of the recipe.
				`,
			parameters: z.object({
				name: z.string(),
				ingredients: z.array(z.string()),
				instructions: z.string(),
				url: z.string(),
			}),
			async execute(params) {
				try {
					const { embeddings } = await generateEmbeddings([
						`
							${params.name}
							${params.ingredients.join("\n")}
							${params.instructions}
							${params.url || ""}
						`,
					]);

					await db
						.insert(Recipe)
						.values([
							{
								userId: context.userId,
								name: params.name,
								ingredients: params.ingredients.join("\n"),
								instructions: params.instructions,
								url: params.url,
								embedding: embeddings[0],
							},
						])
						.onConflictDoNothing()
						.execute();

					return "Recipe added";
				} catch (e) {
					console.error(e);

					if (e instanceof ConditionalCheckFailedException) {
						return "Recipe already exists? Check your recipe list.";
					}

					return "Error, recipe not added";
				}
			},
		}),
		findRecipes: tool({
			description: `
			Semantically search for recipes.
			This tool is useful when you need to find recipes by ingredient or name.
			Returns an array of recipes with ingredients, instructions, and url.
			`,
			parameters: z.object({
				name: z.string(),
			}),
			async execute(params) {
				const { embeddings } = await generateEmbeddings([`${params.name}`]);
				const similarity = sql<number>`1 - (${cosineDistance(Recipe.embedding, embeddings[0])})`;
				const recipes = await db
					.select({
						recipeId: Recipe.recipeId,
						name: Recipe.name,
						url: Recipe.url,
						userId: Recipe.userId,
						ingredients: Recipe.ingredients,
						instructions: Recipe.instructions,
						similarity,
					})
					.from(Recipe)
					.where(gt(similarity, 0.5))
					.limit(10);

				if (!recipes.length) {
					return "Recipe not found";
				}

				return recipes.filter((r) => r.similarity >= 0.5);
			},
		}),
		getRecipes: tool({
			description: `
				Tool for getting the actual recipes with ingredients, instructions, etc.
			`,
			parameters: z.object({
				recipeNames: z
					.array(z.string())
					.describe("Names of the recipes to get"),
			}),
			async execute(params) {
				const [recipe] = await db
					.select({
						recipeId: Recipe.recipeId,
						name: Recipe.name,
						url: Recipe.url,
						userId: Recipe.userId,
						ingredients: Recipe.ingredients,
						instructions: Recipe.instructions,
					})
					.from(Recipe)
					.where(inArray(Recipe.name, params.recipeNames))
					.limit(100);

				if (!recipe) {
					return "Recipe not found";
				}

				return recipe;
			},
		}),
		getRecipeCount: tool({
			description: `
				Tool for getting the count of recipes in the user's recipe list
			`,
			parameters: z.object({}),
			async execute() {
				const count = await db
					.select({
						count: sql<number>`count(*)`,
					})
					.from(Recipe)
					.limit(1);

				return count[0].count;
			},
		}),
		// getAllRecipes: tool({
		// 	description: `
		// 		Get all recipes from the user's recipe list, only use this as last resort.
		// 		`,
		// 	parameters: z.object({}),
		// 	async execute() {
		// 		const recipes = await db.select({
		// 			recipeId: Recipe.recipeId,
		// 			name: Recipe.name,
		// 			url: Recipe.url,
		// 			userId: Recipe.userId,
		// 			ingredients: Recipe.ingredients,
		// 			instructions: Recipe.instructions,
		// 		}).from(Recipe);

		// 		if (!recipes.length) {
		// 			return "No recipes found";
		// 		}

		// 		return recipes;
		// 	},
		// }),
		updateRecipe: tool({
			description: `
				Update a recipe.
				This tool is useful when you need to update a recipe.
				You can update the name, ingredients, and instructions of the recipe.
				This tool updates the recipe as a whole, so if you want to update one of the ingredients, you need to pass in all the ingredients.
				`,
			parameters: z.object({
				recipeName: z.string(),
				ingredients: z.array(z.string()),
				instructions: z.string(),
			}),
			async execute(params, toolOpts) {
				const recipe = await RecipeSchema.update({
					recipeName: params.recipeName,
				})
					.set({
						ingredients: params.ingredients,
						instructions: params.instructions,
					})
					.go({
						response: "updated_old",
					});

				if (!recipe.data) {
					return "Recipe not found";
				}

				const deleteIngredients =
					recipe.data.ingredients?.filter(
						(ingredient) => !params.ingredients.includes(ingredient)
					) || [];

				if (deleteIngredients.length > 0) {
					await RecipeIngredientSchema.delete(
						deleteIngredients.map((ingredient) => ({
							ingredient,
							recipeName: params.recipeName,
						}))
					).go();
				}

				return "Recipe updated";
			},
		}),
		removeRecipe: tool({
			description: `
				Remove a recipe from the user's recipe list.
				This tool is useful when you need to remove a recipe from the user's recipe list.
				`,
			parameters: z.object({
				recipeIds: z.array(z.string()),
			}),
			async execute(params, toolOpts) {
				// @ts-ignore
				await db
					.delete(Recipe)
					// @ts-ignore
					.where(inArray(Recipe.recipeId, params.recipeIds));
			},
		}),
		addPantryItems: tool({
			description: `
				Add items to the pantry.
				This tool is useful when you need to add items to the pantry.
				If no unit is provided, infer or take a good guess from the item name.
				`,
			parameters: z.object({
				items: z.array(
					z.object({
						name: z.string(),
						quantity: z.number(),
						unit: z.string().optional(),
						shelfLife: z.number().optional(),
					})
				),
			}),
			async execute(params, toolOpts) {
				await PantrySchema.put(
					params.items.map((item) => ({
						item: item.name,
						quantity: item.quantity,
						unit: item.unit || "unit",
						shelfLife: item.shelfLife,
					}))
				).go();

				return "Pantry items added";
			},
		}),
		getAllPantryItems: tool({
			description: `
				Get all pantry items.
				This tool is useful when you need to see all the items in the user's pantry.
				`,
			parameters: z.object({}),
			async execute() {
				const pantryItems = await PantrySchema.scan.go();

				if (!pantryItems.data || pantryItems.data.length === 0) {
					return "No pantry items found";
				}

				return pantryItems.data;
			},
		}),
		updatePantryItems: tool({
			description: `
				Update pantry items.
				This tool is useful when you need to update the quantity, unit, or self life of pantry items.
				`,
			parameters: z.object({
				items: z.array(
					z.object({
						name: z.string(),
						quantity: z.number(),
						unit: z.string().optional(),
						selfLife: z.number().optional(),
					})
				),
			}),
			async execute(params, toolOpts) {
				await PantrySchema.put(
					params.items.map((item) => ({
						item: item.name,
						quantity: item.quantity,
						unit: item.unit || "unit",
						selfLife: item.selfLife,
					}))
				).go();

				return "Pantry items updated";
			},
		}),
		removePantryItems: tool({
			description: `
				Remove pantry items.
				This tool is useful when you need to remove items from the pantry.
				`,
			parameters: z.object({
				items: z.array(z.string()),
			}),
			async execute(params, toolOpts) {
				await PantrySchema.delete(
					params.items.map((item) => ({
						item,
					}))
				).go();

				return "Pantry items removed";
			},
		}),
		getGroceryList: tool({
			description: `
				Get the grocery list.
				This tool is useful when you need to see the current active grocery list.
				`,
			parameters: z.object({}),
			async execute(params) {
				const groceryList = await GroceryListSchema.query
					.primary({
						userId: context.userId,
					})
					.where((attr, op) => op.eq(attr.isCompleted, false))
					.go();

				if (!groceryList.data.length) {
					return "No active grocery list found";
				}

				return groceryList.data[0];
			},
		}),
		createGroceryList: tool({
			description: `
				Create a new grocery list.
				This tool is useful when you need to create a new grocery list.
				`,
			parameters: z.object({
				items: z.array(
					z.object({
						item: z.string(),
						quantity: z.number(),
						unit: z.string(),
					})
				),
			}),
			async execute(params) {
				const existingGroceryList = await GroceryListSchema.query
					.primary({
						userId: context.userId,
					})
					.where((attr, op) => op.eq(attr.isCompleted, false))
					.go();

				if (existingGroceryList.data.length) {
					return "Grocery list already exists";
				}

				await GroceryListSchema.create({
					userId: context.userId,
					items: params.items,
					isCompleted: false,
				}).go();

				return "Grocery list created";
			},
		}),
		addItemsToGroceryList: tool({
			description: `
				Add an item to the grocery list.
				This tool is useful when you need to add an item to the grocery list.
				`,
			parameters: z.object({
				items: z.array(z.string()).describe("Items to add to the grocery list"),
			}),
			async execute(params) {
				const groceryList = await GroceryListSchema.query
					.primary({
						userId: context.userId,
					})
					.where((attr, op) => op.eq(attr.isCompleted, false))
					.go();

				if (!groceryList.data.length) {
					return "Grocery list not found";
				}

				if (groceryList.data.length > 1) {
					return "Multiple active grocery lists found";
				}

				// Check if items are already in the grocery list
				const itemsToAdd = params.items.filter(
					(item) => !groceryList.data[0].items.some((i) => i.item === item)
				);

				await GroceryListSchema.update({
					userId: context.userId,
					listId: groceryList.data[0].listId,
				})
					.append({
						items: itemsToAdd.map((item) => ({
							item,
							checked: false,
						})),
					})
					.go();

				return "Item added to grocery list";
			},
		}),
		removeItemsFromGroceryList: tool({
			description:
				"Remove items from the grocery list, this is useful for removing items already bought or not needed",
			parameters: z.object({
				item: z.array(z.string()),
			}),
			async execute(params) {
				const groceryList = await GroceryListSchema.query
					.primary({
						userId: context.userId,
					})
					.where((attr, op) => op.eq(attr.isCompleted, false))
					.go();

				if (!groceryList.data.length) {
					return "Grocery list not found";
				}

				if (groceryList.data.length > 1) {
					return "Multiple active grocery lists found";
				}

				const itemIndex = groceryList.data[0].items.findIndex((item) =>
					params.item.includes(item.item)
				);

				if (itemIndex === -1) {
					return "Item not found in grocery list";
				}

				groceryList.data[0].items.splice(itemIndex, 1);

				await GroceryListSchema.update({
					userId: context.userId,
					listId: groceryList.data[0].listId,
				})
					.set({
						items: groceryList.data[0].items,
					})
					.go();

				return "Item removed from grocery list";
			},
		}),
		updateGroceryList: tool({
			description: "Update the grocery list",
			parameters: z.object({
				items: z.array(z.string()),
			}),
			async execute(params) {
				const groceryList = await GroceryListSchema.query
					.primary({
						userId: context.userId,
					})
					.where((attr, op) => op.eq(attr.isCompleted, false))
					.go();

				if (!groceryList.data.length) {
					return "Grocery list not found";
				}

				if (groceryList.data.length > 1) {
					return "Multiple active grocery lists found";
				}

				// Mark items as checked
				const itemsToUpdate = groceryList.data[0].items.map((item) => ({
					...item,
					checked: params.items.includes(item.item),
				}));

				await GroceryListSchema.update({
					userId: context.userId,
					listId: groceryList.data[0].listId,
				})
					.set({
						items: itemsToUpdate,
					})
					.go();

				return "Grocery list updated";
			},
		}),
		markGroceryListAsCompleted: tool({
			description: "Mark the current active grocery list as completed",
			parameters: z.object({}),
			async execute() {
				const groceryList = await GroceryListSchema.query
					.primary({
						userId: context.userId,
					})
					.where((attr, op) => op.eq(attr.isCompleted, false))
					.go();

				if (!groceryList.data.length) {
					return "Grocery list not found";
				}

				await GroceryListSchema.update({
					userId: context.userId,
					listId: groceryList.data[0].listId,
				})
					.set({
						isCompleted: true,
					})
					.go({
						response: "updated_old",
					});

				if (!groceryList.data) {
					return "Grocery list not found";
				}

				return "Grocery list marked as completed";
			},
		}),
		getMealPlan: tool({
			description: "Get a meal plan for a date (YYYY-MM-DD)",
			parameters: z.object({
				date: z.string().describe("Meal date"),
			}),
			async execute(params) {
				const { date } = params;
				const foodPreferences = await FoodPreferenceSchema.query
					.primary({
						userId: context.userId,
					})
					.go();

				const mealPlan = await MealPlanSchema.query
					.primary({
						userId: context.userId,
						date,
					})
					.go();

				if (!mealPlan.data.length) {
					return "Meal plan not found";
				}

				return `
          ${foodPreferences.data[0].userName}'s meal plan for ${date}:
          ${mealPlan.data[0].meal}: ${mealPlan.data[0].recipe}
        `;
			},
		}),
		getAllMealPlans: tool({
			description: "Get all meal plans",
			parameters: z.object({}),
			async execute() {
				const mealPlans = await MealPlanSchema.query
					.primary({
						userId: context.userId,
					})
					.go();

				if (!mealPlans.data.length) {
					return "No meal plans found";
				}

				return mealPlans.data
					.map(
						(mealPlan) =>
							`- ${mealPlan.meal} on ${mealPlan.date}: ${mealPlan.recipe}`
					)
					.join("\n");
			},
		}),
		setMealPlan: tool({
			description: "Set a meal plan for a date (YYYY-MM-DD)",
			parameters: z.object({
				date: z.string().describe("Meal date"),
				meal: z.enum(["breakfast", "lunch", "dinner"]).describe("Meal time"),
				recipe: z.string().describe("Recipe name"),
			}),
			async execute(params) {
				const { date, meal, recipe } = params;
				await MealPlanSchema.create({
					userId: context.userId,
					date,
					meal,
					recipe,
				}).go();

				return `${meal} for ${date} set`;
			},
		}),
		getFoodPreferences: tool({
			description: "Get food preferences",
			parameters: z.object({}),
			async execute() {
				const { userId } = context;
				const foodPreferences = await FoodPreferenceSchema.query
					.primary({
						userId,
					})
					.go();

				if (!foodPreferences.data.length) {
					return "No food preferences found";
				}

				return `
          Food Preferences:
          ${foodPreferences.data[0].preferences.map((preference) => `- ${preference}`).join("\n")}
        `;
			},
		}),
		setFoodPreference: tool({
			description: "Set food preference",
			parameters: z.object({
				preferences: z
					.array(z.string())
					.describe(
						"Food preferences, ex: vegetarian, vegan, pescatarian, no vegetables"
					),
			}),
			async execute(params) {
				const { preferences } = params;
				await FoodPreferenceSchema.create({
					userId: context.userId,
					userName: context.userName,
					preferences,
				}).go();

				return "Food preference set";
			},
		}),
	};

	// Define types for the tool structure
	type ToolExecuteFunction = (...args: unknown[]) => Promise<unknown>;

	interface ToolDefinition {
		description: string;
		parameters: unknown;
		execute: ToolExecuteFunction;
		[key: string]: unknown;
	}

	type ToolsObject = Record<string, ToolDefinition>;

	// Define the enhanced return type
	interface EnhancedToolResult<T> {
		data: T;
		metadata: {
			timestamp: string;
			toolName: string;
			[key: string]: unknown;
		};
	}

	// Function to wrap tool execute methods with custom return value
	const wrapToolExecute = <T extends ToolsObject>(toolObj: T): T => {
		const enhancedTools = {} as T;

		for (const [key, value] of Object.entries(toolObj)) {
			if (typeof value === "object" && value !== null) {
				// Create a new tool definition with the same properties
				const enhancedTool = { ...value } as ToolDefinition;

				// If it has an execute method, wrap it
				if (typeof enhancedTool.execute === "function") {
					const originalExecute = enhancedTool.execute;

					// Replace with wrapped version
					enhancedTool.execute = async function (...args: unknown[]) {
						// Call original function
						const result = await originalExecute.apply(this, args);
						console.log(`
						<observation>
							${JSON.stringify(result)}
						</observation>
						`);
						// Add custom return value
						return [
							"<observation>",
							JSON.stringify(result),
							"</observation>",
						].join("\n");
					};
				}

				enhancedTools[key as keyof T] = enhancedTool as T[keyof T];
			} else {
				// For non-object values, just copy them
				enhancedTools[key as keyof T] = value as T[keyof T];
			}
		}

		return enhancedTools;
	};

	// Apply the wrapper to all tools
	return wrapToolExecute({
		...personalTools,
		scrapeUrl,
		today,
	});
};
