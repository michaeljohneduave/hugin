import { tool } from "ai";
import { z } from "zod";
import { PantrySchema, RecipeSchema } from "./schema";

// Add new recipe
export const addRecipe = tool({
	description: "Add a new recipe",
	parameters: z.object({
		name: z.string(),
		ingredients: z.array(z.string()),
		instructions: z.string(),
	}),
	async execute(params, toolOpts) {
		const recipe = await RecipeSchema.create({
			name: params.name,
			ingredients: params.ingredients,
			instructions: params.instructions,
		}).go();

		return recipe.data;
	},
});

// Add new ingredient to recipe
export const addIngredientToRecipe = tool({
	description: "Add a new ingredients to a recipe",
	parameters: z.object({
		name: z.string(),
		ingredients: z.array(z.string()),
	}),
	async execute(params, toolOpts) {
		const recipe = await RecipeSchema.update({
			name: params.name,
		}).append({
			ingredients: params.ingredients,
		});

		return recipe;
	},
});

// Remove ingredients from recipe
export const removeIngredientsFromRecipe = tool({
	description: "Remove ingredients from a recipe",
	parameters: z.object({
		name: z.string(),
		ingredients: z.array(z.string()),
	}),
	async execute(params, toolOpts) {
		const recipe = await RecipeSchema.get({
			name: params.name,
		}).go();

		if (!recipe.data) {
			return "Recipe not found";
		}

		recipe.data.ingredients = recipe.data.ingredients.filter(
			(ingredient) => !params.ingredients.includes(ingredient),
		);

		await RecipeSchema.update({
			name: params.name,
		})
			.set({
				ingredients: recipe.data.ingredients,
			})
			.go();

		return recipe;
	},
});

// Add new pantry items
export const addPantryItems = tool({
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
});

// Remove pantry items
export const removePantryItems = tool({
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
});
// Get all pantry items
export const getAllPantryItems = tool({
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
});

// Get all recipes
export const getAllRecipes = tool({
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
});

// Get all ingredients for a recipe
export const getAllIngredientsForRecipe = tool({
	description: "Get all ingredients for a recipe",
	parameters: z.object({
		name: z.string(),
	}),
	async execute(params, toolOpts) {
		const recipe = await RecipeSchema.get({
			name: params.name,
		}).go();

		if (!recipe.data) {
			return "Recipe not found";
		}

		return recipe.data.ingredients;
	},
});

// Get all recipes for an ingredient
export const getAllRecipesForIngredient = tool({
	description: "Get all recipes for an ingredient",
	parameters: z.object({
		ingredient: z.string(),
	}),
	async execute(params, toolOpts) {
		const recipes = await RecipeSchema.scan.go();

		if (!recipes.data) {
			return "No recipes found";
		}

		return recipes.data.filter((recipe) =>
			recipe.ingredients.includes(params.ingredient),
		);
	},
});
