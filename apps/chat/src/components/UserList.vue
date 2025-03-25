<script setup lang="ts">
import { ref } from "vue";
import type { User } from "./GroupChat.vue";

const props = defineProps<{
	currentUserId?: string;
}>();

// Human users in the chat
const humanUsers = ref<User[]>([
	{
		id: "user1",
		name: "Alex Smith",
		avatar: "/placeholder.svg?height=80&width=80",
		online: true,
		type: "human",
	},
	{
		id: "user2",
		name: "Taylor Johnson",
		avatar: "/placeholder.svg?height=80&width=80",
		online: true,
		type: "human",
	},
	{
		id: "user3",
		name: "Jamie Williams",
		avatar: "/placeholder.svg?height=80&width=80",
		online: false,
		type: "human",
	},
	{
		id: "user4",
		name: "Morgan Lee",
		avatar: "/placeholder.svg?height=80&width=80",
		online: true,
		type: "human",
	},
]);
</script>
<template>
	<div class="p-4">
		<h2 class="text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400 font-semibold mb-2">People</h2>
		<ul class="space-y-2">
			<li v-for="user in humanUsers" :key="user.id" class="flex items-center space-x-2">
				<div class="relative">
					<img :src="user.avatar" alt="" class="w-8 h-8 rounded-full" />
					<span class="absolute bottom-0 right-0 w-3 h-3 rounded-full"
						:class="user.online ? 'bg-green-500' : 'bg-gray-300'"></span>
				</div>
				<span class="text-gray-900 dark:text-white">{{ user.name }}</span>
				<span v-if="user.id === currentUserId" class="text-xs text-gray-500 dark:text-gray-400">(you)</span>
			</li>
		</ul>
	</div>
</template>