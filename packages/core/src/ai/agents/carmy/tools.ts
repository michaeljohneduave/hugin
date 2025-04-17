import { ConditionalCheckFailedException } from "@aws-sdk/client-dynamodb";
import { tool } from "ai";
import { z } from "zod";
import type { AgentContext } from "../..";
import { scrapeUrl } from "../pearl/scraping";
import {
	GroceryListSchema,
	PantrySchema,
	RecipeIngredientSchema,
	RecipeSchema,
} from "./schema";

export const carmyTools = (context: AgentContext) => {
	const personalTools = {
		addRecipe: tool({
			description: "Add a new recipe to the user's recipe list",
			parameters: z.object({
				name: z.string(),
				ingredients: z.array(z.string()),
				instructions: z.string(),
			}),
			async execute(params, toolOpts) {
				try {
					await RecipeSchema.create({
						recipeName: params.name,
						ingredients: params.ingredients,
						instructions: params.instructions,
					}).go();

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
		getAllRecipes: tool({
			description:
				"Get all recipes, if no recipes are found, return an empty array",
			parameters: z.object({}),
			async execute() {
				const recipes = await RecipeSchema.scan.go();

				if (!recipes.data || recipes.data.length === 0) {
					return "No recipes found";
				}

				return recipes.data;
			},
		}),
		updateRecipe: tool({
			description: "Update a recipe",
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
						(ingredient) => !params.ingredients.includes(ingredient),
					) || [];

				if (deleteIngredients.length > 0) {
					await RecipeIngredientSchema.delete(
						deleteIngredients.map((ingredient) => ({
							ingredient,
							recipeName: params.recipeName,
						})),
					).go();
				}

				return "Recipe updated";
			},
		}),
		removeRecipe: tool({
			description: "Remove a recipe from the user's recipe list",
			parameters: z.object({
				recipeName: z.string(),
			}),
			async execute(params, toolOpts) {
				const recipe = await RecipeSchema.delete({
					recipeName: params.recipeName,
				}).go({
					response: "all_old",
				});

				if (!recipe.data) {
					return "Recipe not found";
				}

				await RecipeIngredientSchema.delete(
					recipe.data.ingredients.map((ingredient) => ({
						ingredient,
						recipeName: params.recipeName,
					})),
				).go();

				return "Recipe removed";
			},
		}),
		addPantryItems: tool({
			description:
				"Add items to the pantry, if no unit is provided, infer it from the item name",
			parameters: z.object({
				items: z.array(
					z.object({
						name: z.string(),
						quantity: z.number(),
						unit: z.string().optional(),
						selfLife: z.number().optional(),
					}),
				),
			}),
			async execute(params, toolOpts) {
				await PantrySchema.put(
					params.items.map((item) => ({
						item: item.name,
						quantity: item.quantity,
						unit: item.unit || "unit",
						selfLife: item.selfLife,
					})),
				).go();

				return "Pantry items added";
			},
		}),
		getAllPantryItems: tool({
			description:
				"Get all pantry items, if no pantry items are found, return an empty array",
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
			description: "Update pantry items",
			parameters: z.object({
				items: z.array(
					z.object({
						name: z.string(),
						quantity: z.number(),
						unit: z.string().optional(),
						selfLife: z.number().optional(),
					}),
				),
			}),
			async execute(params, toolOpts) {
				await PantrySchema.put(
					params.items.map((item) => ({
						item: item.name,
						quantity: item.quantity,
						unit: item.unit || "unit",
						selfLife: item.selfLife,
					})),
				).go();

				return "Pantry items updated";
			},
		}),
		removePantryItems: tool({
			description: "Remove pantry items",
			parameters: z.object({
				items: z.array(z.string()),
			}),
			async execute(params, toolOpts) {
				await PantrySchema.delete(
					params.items.map((item) => ({
						item,
					})),
				).go();

				return "Pantry items removed";
			},
		}),
		getAllIngredientsForRecipe: tool({
			description: "Get all ingredients for a recipe",
			parameters: z.object({
				recipeName: z.string(),
			}),
			async execute(params, toolOpts) {
				const recipe = await RecipeSchema.query
					.primary({
						recipeName: params.recipeName,
					})
					.go();

				if (!recipe.data) {
					return "Recipe not found";
				}

				return recipe.data[0].ingredients;
			},
		}),
		getAllRecipesForIngredient: tool({
			description: "Get all recipes for an ingredient",
			parameters: z.object({
				ingredient: z.string(),
			}),
			async execute(params) {
				// const recipes = await RecipeIngredientSchema.query
				// 	.byIngredient({
				// 		ingredient: params.ingredient,
				// 	})
				// 	.go();
				// if (recipes.data.length === 0) {
				// 	return "No recipes found";
				// }
				// return recipes.data.map((recipe) => recipe.name);
			},
		}),
		getGroceryList: tool({
			description: "Get the grocery list",
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
			description: "Create a new grocery list",
			parameters: z.object({
				items: z.array(
					z.object({
						item: z.string(),
						quantity: z.number(),
						unit: z.string(),
					}),
				),
			}),
			async execute(params) {
				await GroceryListSchema.create({
					userId: context.userId,
					items: params.items,
					isCompleted: false,
				}).go();

				return "Grocery list created";
			},
		}),
		addItemsToGroceryList: tool({
			description: "Add an item to the grocery list",
			parameters: z.object({
				items: z.array(
					z.object({
						item: z.string(),
					}),
				),
			}),
			async execute(params, toolOpts) {
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
					(item) =>
						!groceryList.data[0].items.some((i) => i.item === item.item),
				);

				await GroceryListSchema.update({
					userId: context.userId,
					listId: groceryList.data[0].listId,
				})
					.append({
						items: itemsToAdd,
					})
					.go();

				return "Item added to grocery list";
			},
		}),
		removeItemFromGroceryList: tool({
			description: "Remove an item from the grocery list",
			parameters: z.object({
				item: z.string(),
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

				const itemIndex = groceryList.data[0].items.findIndex(
					(item) => item.item === params.item,
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
	};

	return {
		...personalTools,
		scrapeUrl,
	};
};
