<script setup lang="ts">
import { useSession } from "@clerk/vue";
import { useQuery } from "@tanstack/vue-query";
import { Search as SearchIcon } from "lucide-vue-next";
import { funnel, } from "remeda"
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

const trpc = useTrpc();
const { session } = useSession();
const searchQuery = ref("");
const gifs = ref<GifResult[]>([]);
let debouncedSearch: ReturnType<typeof funnel>;

const props = defineProps<{
	isDarkMode: boolean;
}>();

const emit = defineEmits<{
	select: [url: string];
}>();

// Initialize with trending gifs
const { data: trendingGifs } = useQuery({
	queryKey: ["giphy-trending"],
	queryFn: async () => {
		return await trpc.giphy.trending.query({
			limit: 20,
		});
	},
	enabled: () => import.meta.env.PROD && !!session.value?.user.id,
	staleTime: 1000 * 60 * 60,
	refetchOnMount: true,
});

const { data: searchGifResults, isLoading, error, refetch } = useQuery({
	queryKey: ["giphy-search", searchQuery],
	queryFn: async () => {
		if (!searchQuery.value.trim()) {
			return;
		}

		return await trpc.giphy.search.query({
			query: searchQuery.value.trim(),
			limit: 20,
		});
	},
	enabled: Boolean(searchQuery.value.trim()),
	staleTime: 1000 * 60 * 5, // Cache results for 5 minutes
	refetchOnMount: false,
});

// Update gifs ref when search results change
watch(searchGifResults, (newResults) => {
	if (newResults) {
		gifs.value = newResults;
	}
});

// Watch trending gifs and update when search is empty
watch(trendingGifs, (newResults) => {
	if (newResults && !searchQuery.value.trim()) {
		gifs.value = newResults || [];
	}
});

// Watch search query to handle empty state
watch(searchQuery, (newQuery) => {
	if (!newQuery.trim()) {
		gifs.value = trendingGifs.value || [];
	}
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
	<div class="w-full bg-white dark:bg-gray-800 rounded-lg overflow-hidden flex flex-col">
		<!-- Search header -->
		<div class="p-1">
			<div class="relative flex items-center">
				<SearchIcon class="absolute left-3 w-4 h-4 text-gray-400" />
				<input v-model="searchQuery" type="text" placeholder="Search GIFs..."
					class="w-full py-2 pl-9 pr-3 border border-gray-200 dark:border-gray-700 rounded-md text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:border-blue-500 focus:ring focus:ring-blue-500 focus:ring-opacity-50" />
			</div>
		</div>

		<!-- GIFs grid -->
		<div class="h-80 overflow-y-auto p-3 grid grid-cols-2 md:grid-cols-3 gap-2 relative auto-rows-min">
			<div v-if="isLoading"
				class="absolute inset-0 flex items-center justify-center text-gray-500 dark:text-gray-400 bg-inherit">
				Loading...
			</div>
			<div v-else-if="gifs.length === 0"
				class="absolute inset-0 flex items-center justify-center text-gray-500 dark:text-gray-400 bg-inherit">
				No GIFs found
			</div>
			<template v-else>
				<div v-for="gif in gifs" :key="gif.id"
					class="relative aspect-square cursor-pointer rounded overflow-hidden bg-gray-100 dark:bg-gray-700 w-full hover:opacity-80"
					@click="selectGif(gif)">
					<img :src="gif.images.fixed_width.url" :alt="gif.title" loading="lazy"
						class="absolute inset-0 w-full h-full object-cover" />
				</div>
			</template>
		</div>
	</div>
</template>

<style>
/* Mobile styles that are hard to implement with Tailwind alone */
@media (max-width: 768px) {
	.gif-picker-mobile {
		width: 100%;
		height: 50vh;
		border-radius: 1rem 1rem 0 0;
	}

	.gif-grid-mobile {
		height: calc(50vh - 73px);
	}
}
</style>
