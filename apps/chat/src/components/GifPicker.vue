<script setup lang="ts">
import { useQuery } from "@tanstack/vue-query";
import { Search as SearchIcon } from "lucide-vue-next";
import { debounce, funnel, } from "remeda"
import { onMounted, ref, watch } from "vue";
import { useTrpc } from "../lib/trpc";

interface GifImage {
	url: string;
	width: string;
	height: string;
}

interface GifImages {
	fixed_width: GifImage;
	original: GifImage;
}

interface GifResult {
	id: string;
	title: string;
	images: GifImages;
}

const props = defineProps<{
	isDarkMode: boolean;
}>();

const emit = defineEmits<{
	select: [url: string];
}>();

const trpc = useTrpc();
const searchQuery = ref("");
const gifs = ref<GifResult[]>([]);
let debouncedSearch: ReturnType<typeof funnel>;

const { data: searchResults, isLoading, error, refetch } = useQuery({
	queryKey: ["giphy-search", searchQuery],
	queryFn: async () => {
		if (!searchQuery.value.trim()) {
			return await trpc.giphy.trending.query({ limit: 20 });
		}
		return await trpc.giphy.search.query({
			query: searchQuery.value.trim(),
			limit: 20,
		});
	},
	enabled: true,
	staleTime: 1000 * 60 * 5, // Cache results for 5 minutes
	refetchOnMount: true,
});

// Update gifs ref when search results change
watch(searchResults, (newResults) => {
	if (newResults) {
		gifs.value = newResults;
	}
});

watch(searchQuery, () => {
	debouncedSearch.call();
});

const selectGif = (gif: GifResult) => {
	emit("select", gif.images.original.url);
};

onMounted(() => {
	debouncedSearch = funnel(() => {
		refetch();
	}, {
		minQuietPeriodMs: 500,
	});
});

</script>

<template>
	<div class="gif-picker" :class="{ 'dark': isDarkMode }">
		<!-- Search header -->
		<div class="gif-picker-header">
			<div class="search-container">
				<SearchIcon class="search-icon" />
				<input v-model="searchQuery" type="text" placeholder="Search GIFs..." class="search-input" />
			</div>
		</div>

		<!-- GIFs grid -->
		<div class="gif-grid">
			<div v-if="isLoading" class="loading">
				Loading...
			</div>
			<div v-else-if="gifs.length === 0" class="no-results">
				No GIFs found
			</div>
			<template v-else>
				<div v-for="gif in gifs" :key="gif.id" class="gif-item" @click="selectGif(gif)">
					<img :src="gif.images.fixed_width.url" :alt="gif.title" loading="lazy" />
				</div>
			</template>
		</div>
	</div>
</template>

<style scoped>
.gif-picker {
	width: 320px;
	background: white;
	border-radius: 8px;
	overflow: hidden;
	display: flex;
	flex-direction: column;
	border: 1px solid #e5e7eb;
	box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1);
}

.dark .gif-picker {
	background: #1f2937;
	border-color: #374151;
}

.gif-picker-header {
	padding: 12px;
	border-bottom: 1px solid #e5e7eb;
}

.dark .gif-picker-header {
	border-color: #374151;
}

.search-container {
	position: relative;
	display: flex;
	align-items: center;
}

.search-icon {
	position: absolute;
	left: 12px;
	width: 16px;
	height: 16px;
	color: #9ca3af;
}

.search-input {
	width: 100%;
	padding: 8px 12px 8px 36px;
	border: 1px solid #e5e7eb;
	border-radius: 6px;
	font-size: 14px;
	background: white;
	color: #111827;
}

.dark .search-input {
	background: #111827;
	border-color: #4b5563;
	color: #f9fafb;
}

.search-input:focus {
	outline: none;
	border-color: #3b82f6;
	ring: 2px solid #3b82f6;
}

.gif-grid {
	height: 320px;
	overflow-y: auto;
	padding: 12px;
	display: grid;
	grid-template-columns: repeat(2, 1fr);
	gap: 8px;
}

.gif-item {
	position: relative;
	padding-top: 100%;
	cursor: pointer;
	border-radius: 4px;
	overflow: hidden;
	background: #f3f4f6;
}

.dark .gif-item {
	background: #374151;
}

.gif-item img {
	position: absolute;
	top: 0;
	left: 0;
	width: 100%;
	height: 100%;
	object-fit: cover;
}

.gif-item:hover {
	opacity: 0.8;
}

.loading,
.no-results {
	grid-column: span 2;
	text-align: center;
	padding: 24px;
	color: #6b7280;
}

.dark .loading,
.dark .no-results {
	color: #9ca3af;
}

/* Mobile styles */
@media (max-width: 768px) {
	.gif-picker {
		width: 100%;
		height: 50vh;
		border-radius: 16px 16px 0 0;
	}

	.gif-grid {
		height: calc(50vh - 73px);
		grid-template-columns: repeat(3, 1fr);
	}
}
</style>
