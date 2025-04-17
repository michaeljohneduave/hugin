// Dynamodb schema
import crypto from "node:crypto";
import { Entity, type EntityItem } from "electrodb";
import { dynamoConfig } from "../../../electro";

export const PantrySchema = new Entity(
	{
		model: {
			entity: "pantry",
			version: "1",
			service: "hugin",
		},
		attributes: {
			item: {
				type: "string",
				required: true,
			},
			quantity: {
				type: "number",
				required: true,
			},
			unit: {
				type: "string",
			},
			selfLife: {
				type: "number",
			},
			addedAt: {
				type: "number",
				default: () => Date.now(),
				readOnly: true,
			},
		},
		indexes: {
			primary: {
				pk: {
					field: "pk",
					composite: ["item"],
				},
				sk: {
					field: "sk",
					composite: [],
				},
			},
		},
	},
	dynamoConfig,
);
export type PantryEntityType = EntityItem<typeof PantrySchema>;

export const RecipeSchema = new Entity(
	{
		model: {
			entity: "recipe",
			version: "1",
			service: "hugin",
		},
		attributes: {
			recipeName: {
				type: "string",
				required: true,
			},
			ingredients: {
				type: "set",
				items: "string",
				required: true,
			},
			instructions: {
				type: "string",
				required: true,
			},
			createdAt: {
				type: "number",
				default: () => Date.now(),
			},
			updatedAt: {
				type: "number",
				watch: "*",
				default: () => Date.now(),
				readOnly: true,
			},
		},
		indexes: {
			primary: {
				pk: {
					field: "pk",
					composite: ["recipeName"],
				},
				sk: {
					field: "sk",
					composite: [],
				},
			},
		},
	},
	dynamoConfig,
);
export type RecipeEntityType = EntityItem<typeof RecipeSchema>;

export const RecipeIngredientSchema = new Entity(
	{
		model: {
			entity: "recipeIngredient",
			version: "1",
			service: "hugin",
		},
		attributes: {
			recipeName: {
				type: "string",
				required: true,
			},
			ingredient: {
				type: "string",
				required: true,
			},
		},
		indexes: {
			primary: {
				pk: {
					field: "pk",
					composite: ["recipeName"],
				},
				sk: {
					field: "sk",
					composite: [],
				},
			},
			byIngredient: {
				index: "gsi1",
				pk: {
					field: "gsi1pk",
					composite: ["ingredient"],
				},
				sk: {
					field: "gsi1sk",
					composite: [],
				},
			},
		},
	},
	dynamoConfig,
);
export type RecipeIngredientEntityType = EntityItem<
	typeof RecipeIngredientSchema
>;

export const FoodPreferenceSchema = new Entity(
	{
		model: {
			entity: "foodPreference",
			version: "1",
			service: "hugin",
		},
		attributes: {
			userId: {
				type: "string",
				required: true,
			},
			userName: {
				type: "string",
				required: true,
			},
			preferences: {
				type: "list",
				items: {
					type: "string",
				},
			},
		},
		indexes: {
			primary: {
				pk: {
					field: "pk",
					composite: ["userName"],
				},
				sk: {
					field: "sk",
					composite: [],
				},
			},
		},
	},
	dynamoConfig,
);
export type FoodPreferenceEntityType = EntityItem<typeof FoodPreferenceSchema>;

export const MealPlanSchema = new Entity(
	{
		model: {
			entity: "mealPlan",
			version: "1",
			service: "hugin",
		},
		attributes: {
			userId: {
				type: "string",
				required: true,
			},
			date: {
				type: "string",
				required: true,
			},
		},
		indexes: {
			primary: {
				pk: {
					field: "pk",
					composite: ["userId"],
				},
				sk: {
					field: "sk",
					composite: [],
				},
			},
		},
	},
	dynamoConfig,
);
export type MealPlanEntityType = EntityItem<typeof MealPlanSchema>;

// Query patterns
// Get active grocery list by userId
// Update active grocery list by userId
// Get all grocery lists by userId
export const GroceryListSchema = new Entity(
	{
		model: {
			entity: "groceryList",
			version: "1",
			service: "hugin",
		},
		attributes: {
			userId: {
				type: "string",
				required: true,
			},
			listId: {
				type: "string",
				default: () => crypto.randomUUID(),
				required: true,
			},
			items: {
				type: "list",
				items: {
					type: "map",
					properties: {
						item: {
							type: "string",
						},
						checked: {
							type: "boolean",
							default: false,
						},
					},
				},
				required: true,
			},
			isCompleted: {
				type: "boolean",
				default: false,
			},
			createdAt: {
				type: "number",
				default: () => Date.now(),
			},
			updatedAt: {
				type: "number",
				watch: "*",
				default: () => Date.now(),
				readOnly: true,
			},
		},
		indexes: {
			primary: {
				pk: {
					field: "pk",
					composite: ["userId"],
				},
				sk: {
					field: "sk",
					composite: ["listId"],
				},
			},
		},
	},
	dynamoConfig,
);
export type GroceryListEntityType = EntityItem<typeof GroceryListSchema>;
