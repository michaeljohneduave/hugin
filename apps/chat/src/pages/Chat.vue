<script setup lang="ts">
import carmyAvatar from "@/assets/carmy-avatar.webp";
import loebotteAvatar from "@/assets/loebotte-avatar.webp";
import pearlAvatar from "@/assets/pearl-avatar.webp";
import MessageComponent from "@/components/Message.vue";
import RoomEventComponent from '@/components/RoomEvent.vue';
import { useWebsocket } from "@/composables/useWebsocket";
import { useTrpc } from "@/lib/trpc";
import { useAuth, useSession, useUser } from "@clerk/vue";
import { llmAgents, llmRouters } from "@hugin-bot/core/src/ai";
import type { ChatPayload, User } from "@hugin-bot/core/src/types";
import {
	BellIcon,
	LogOutIcon,
	MoonIcon,
	SunIcon,
} from "lucide-vue-next";
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from "vue";
import { version } from '../../package.json';
import MessageInput from "../components/MessageInput.vue";
import NotificationSettings from "../components/NotificationSettings.vue";
import { useTheme } from '../composables/useTheme';

export type Attachment = {
	name: string;
	size: string;
	type: string;
};

export interface Bot {
	id: string;
	name: string;
	avatar?: string;
};

const botAvatars = {
	"carmy": carmyAvatar,
	"pearl": pearlAvatar,
	"lobot": loebotteAvatar
}

const availableBots = llmAgents.concat(llmRouters).map(agent => ({
	id: agent.id,
	name: agent.name,
	avatar: botAvatars[agent.id as keyof typeof botAvatars],
	type: "llm" as const
}));

const unknownBot: User = {
	id: "lobot",
	name: "Loebotte",
	avatar: loebotteAvatar,
	type: "llm" as const
}
const userMap = new Map<string, User>();

const { user: clerkUser } = useUser();
const { signOut } = useAuth();
const { session, } = useSession();
const { isOnline, sendMessage: sendSocketMsg, addMessageHandler, removeMessageHandler, connect } = useWebsocket();
const trpc = useTrpc();
const { isDarkMode, toggleTheme } = useTheme();

const currentUser = computed(() => ({
	id: clerkUser.value!.id,
	name: clerkUser.value!.fullName!,
	type: "user" as const,
	avatar: clerkUser.value?.imageUrl,
}));

const chatRoomId = ref("");
const messageInput = ref("");
const chatMessages = ref<Array<ChatPayload>>([]);
const showAttachmentMenu = ref(false);
const messagesContainer = ref<HTMLDivElement | null>(null);
const showMentionSuggestions = ref(false);
const showNotificationSettings = ref(false);
const replyToMessage = ref<ChatPayload | null>(null);
const isLoadingMessages = ref(true);

const isScrolledToBottom = ref(true);
const isUserMenuOpen = ref(false);

// Update scrollToBottom function to be smoother and handle image loading
const scrollToBottom = (force = false) => {
	nextTick(() => {
		if (messagesContainer.value && (isScrolledToBottom.value || force)) {
			// Check for all images in the container
			const allImages = messagesContainer.value.querySelectorAll('img');

			if (allImages.length > 0) {
				// Count how many images are still loading
				let loadingImagesCount = 0;
				let loadedImagesCount = 0;

				// Function to scroll after all images are loaded
				const scrollAfterImagesLoad = () => {
					loadedImagesCount++;
					if (loadedImagesCount >= loadingImagesCount) {
						messagesContainer.value?.scrollTo({
							top: messagesContainer.value.scrollHeight,
							behavior: 'instant'
						});
					}
				};

				// Check all images
				for (const img of allImages) {
					if (!img.complete) {
						loadingImagesCount++;
						img.onload = scrollAfterImagesLoad;
						img.onerror = scrollAfterImagesLoad;
					}
				}

				// If no images are still loading, scroll immediately
				if (loadingImagesCount === 0) {
					messagesContainer.value.scrollTo({
						top: messagesContainer.value.scrollHeight,
						behavior: 'instant'
					});
				}
			} else {
				// No images, scroll immediately
				messagesContainer.value.scrollTo({
					top: messagesContainer.value.scrollHeight,
					behavior: 'instant'
				});
			}
		}
	});
};

const handleScroll = () => {
	if (!messagesContainer.value) return;

	const { scrollTop, scrollHeight, clientHeight } = messagesContainer.value;
	// Consider "bottom" if within 100px of the bottom
	isScrolledToBottom.value = scrollHeight - scrollTop - clientHeight < 100;
};

const fetchMessages = async (roomId: string) => {
	try {
		isLoadingMessages.value = true;
		const { messages, members } = await trpc.chats.messagesByRoom.query({
			roomId,
			limit: 20,
		});

		const msgs: ChatPayload[] = [];
		for (const msg of messages) {
			let user: User;

			if (msg.type === "event" || msg.type === "user") {
				if (userMap.has(msg.userId)) {
					user = userMap.get(msg.userId)!;
				} else {
					const member = members.find(m => m.userId === msg.userId);

					if (member) {
						user = {
							id: member.userId,
							name: `${member.user.firstName} ${member.user.lastName}`,
							avatar: member.user.avatar,
							type: msg.type,
						}
						userMap.set(msg.userId, user);
					} else {
						user = {
							id: msg.userId,
							name: "Unknown",
							type: msg.type,
						}
					}
				}

			} else {
				user = availableBots.find(bot => bot.id === msg.userId) || unknownBot;
			}

			msgs.push({
				...msg,
				user,
			})
		}

		chatMessages.value = msgs;

		// Wait for Vue to update the DOM before scrolling
		await nextTick();
		scrollToBottom(true);
	} catch (error) {
		console.error('Error fetching messages:', error);
	} finally {
		isLoadingMessages.value = false;
	}
};

const fetchRooms = async () => {
	const rooms = await trpc.chats.userRooms.query();
	return rooms;
};

const handleWebSocketMessage = (event: MessageEvent) => {
	const data = JSON.parse(event.data) as ChatPayload;
	let user: User;

	if (data.type === "event" || data.type === "user") {
		user = userMap.get(data.userId) || {
			id: data.userId,
			name: "Unknown",
			type: data.type,
		};
	} else {
		user = availableBots.find(bot => bot.id === data.userId) || unknownBot;
	}

	data.user = user;
	chatMessages.value.push(data);

	if (data.action === 'message') {
		scrollToBottom();
	}
};

const handleReplyToMessage = (message: ChatPayload) => {
	replyToMessage.value = message;
	// Focus the message input
	nextTick(() => {
		const textarea = document.querySelector('textarea') as HTMLTextAreaElement;
		if (textarea) textarea.focus();
	});
};

const handleCancelReply = () => {
	replyToMessage.value = null;
};

// When sending a message, include the replyToMessageId if replying
const handleSendMessage = (message: ChatPayload) => {
	if (replyToMessage.value) {
		message.replyToMessageId = replyToMessage.value.messageId;
		message.threadId = replyToMessage.value.threadId;
		replyToMessage.value = null;
	} else {
		message.replyToMessageId = undefined;
	}

	sendSocketMsg(message);
};

const handleShowAttachmentMenu = (event: MouseEvent) => {
	const target = event.target as HTMLElement;
	// Close attachment menu if clicking outside
	if (showAttachmentMenu.value && !target.closest("button")) {
		showAttachmentMenu.value = false;
	}
}

const handleOutsideClick = (event: MouseEvent) => {
	const target = event.target as HTMLElement;
	// Close user menu if clicking outside
	if (isUserMenuOpen.value && !target.closest('.user-menu-container')) {
		isUserMenuOpen.value = false;
	}
}

watch(chatMessages.value, () => {
	scrollToBottom(true);
});

// watch(chatRoomId, (oldRoomId, newRoomId) => {
// 	if ( oldRoomId !== newRoomId) {
// 		fetchMessages(newRoomId);
// 	}
// });

// Check for @mentions
watch(messageInput, (newValue) => {
	const lastAtIndex = newValue.lastIndexOf("@");

	if (
		lastAtIndex !== -1 &&
		(lastAtIndex === 0 || newValue[lastAtIndex - 1] === " ")
	) {
		showMentionSuggestions.value = true;
	} else {
		showMentionSuggestions.value = false;
	}
});

console.log("session", session.value)
watch(session, async (val) => {
	if (val?.user) {
		try {
			const rooms = await fetchRooms();
			if (rooms.length > 0) {
				chatRoomId.value = rooms[0].roomId;
				await fetchMessages(rooms[0].roomId);
			} else {
				// No rooms available
				isLoadingMessages.value = false;
			}
		} catch (error) {
			console.error('Error fetching rooms:', error);
			isLoadingMessages.value = false;
		}
		connect();
	}
}, {
	immediate: true,
})

onMounted(() => {
	addMessageHandler(handleWebSocketMessage);
	document.addEventListener("click", handleShowAttachmentMenu);
	document.addEventListener("click", handleOutsideClick);
	messagesContainer.value?.addEventListener('scroll', handleScroll);

	scrollToBottom(true);
});

onUnmounted(() => {
	removeMessageHandler(handleWebSocketMessage);
	messagesContainer.value?.removeEventListener('scroll', handleScroll);
	document.removeEventListener("click", handleShowAttachmentMenu);
	document.removeEventListener("click", handleOutsideClick);
});
</script>

<template>
	<div class="h-dvh bg-gray-100 dark:bg-gray-900">
		<!-- Main content -->
		<div class="h-dvh flex flex-col">
			<!-- Chat header -->
			<div class="h-12 flex items-center justify-between px-2 bg-white dark:bg-gray-800">
				<div class="flex-1 flex items-center justify-between">
					<div class="flex items-center space-x-2">
						<div class="flex flex-col">
							<h2 class="text-lg font-medium text-gray-900 dark:text-white">{{ chatRoomId }}</h2>
							<span class="text-xs text-gray-400 dark:text-gray-500 -mt-1">v{{ version }}</span>
						</div>
						<div class="flex items-center">
							<span class="inline-flex h-2 w-2 rounded-full mr-1"
								:class="isOnline ? 'bg-green-500' : 'bg-red-500'"></span>
							<span class="text-xs text-gray-500 dark:text-gray-400">{{ isOnline ? 'Connected' : 'Disconnected'
							}}</span>
						</div>
					</div>

					<!-- User actions -->
					<div class="flex items-center space-x-2">
						<!-- Dropdown menu -->
						<div class="relative user-menu-container">
							<button @click="isUserMenuOpen = !isUserMenuOpen"
								class="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700">
								<svg class="h-5 w-5 text-gray-700 dark:text-gray-300" fill="none" viewBox="0 0 24 24"
									stroke="currentColor">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
								</svg>
							</button>

							<!-- Dropdown content -->
							<div v-if="isUserMenuOpen"
								class="absolute right-0 mt-2 w-48 rounded-md shadow-lg bg-white dark:bg-gray-800 ring-1 ring-black ring-opacity-5 dark:ring-gray-700 z-50">
								<div class="py-1">
									<!-- Notifications -->
									<button @click="showNotificationSettings = true; isUserMenuOpen = false"
										class="flex items-center w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700">
										<BellIcon class="h-5 w-5 mr-2 text-gray-500 dark:text-gray-300" />
										Notifications
									</button>

									<!-- Dark mode toggle -->
									<button @click="toggleTheme(); isUserMenuOpen = false"
										class="flex items-center w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700">
										<SunIcon v-if="isDarkMode" class="h-5 w-5 mr-2 text-amber-500" />
										<MoonIcon v-else class="h-5 w-5 mr-2 text-gray-500 dark:text-gray-300" />
										{{ isDarkMode ? 'Light Mode' : 'Dark Mode' }}
									</button>

									<!-- Divider -->
									<hr class="my-1 border-gray-200 dark:border-gray-700">

									<!-- Logout -->
									<button @click="signOut(); isUserMenuOpen = false"
										class="flex items-center w-full px-4 py-2 text-left text-sm text-red-500 dark:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-700">
										<LogOutIcon class="h-5 w-5 mr-2" />
										Logout
									</button>
								</div>
							</div>
						</div>
					</div>
				</div>
			</div>

			<!-- Notification Settings Modal -->
			<div v-show="showNotificationSettings"
				class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
				<div class="relative bg-white dark:bg-gray-800 rounded-lg max-width-md w-full mx-4">
					<div class="absolute top-4 right-4">
						<button @click="showNotificationSettings = false"
							class="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300">
							<span class="sr-only">Close</span>
							<svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
							</svg>
						</button>
					</div>
					<NotificationSettings />
				</div>
			</div>

			<!-- Messages area -->
			<div ref="messagesContainer" class="flex-1 overflow-y-auto pl-4 pr-2 py-2 space-y-4 min-h-0">
				<!-- Loading messages state -->
				<div v-if="isLoadingMessages" class="flex justify-center items-center h-full">
					<div class="flex flex-col items-center text-gray-500 dark:text-gray-400">
						<svg class="animate-spin h-8 w-8 mb-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
							<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
							<path class="opacity-75" fill="currentColor"
								d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z">
							</path>
						</svg>
						<p>Loading chat...</p>
					</div>
				</div>

				<!-- No room selected state (only shown when we've confirmed there are no rooms) -->
				<div v-else-if="!chatRoomId && !isLoadingMessages" class="flex justify-center items-center h-full">
					<div class="text-center text-gray-500 dark:text-gray-400">
						<p class="text-lg">No chat room available</p>
						<p class="text-sm">Create a room to start chatting</p>
					</div>
				</div>

				<!-- Empty room state -->
				<div v-else-if="chatMessages.length === 0" class="flex justify-center items-center h-full">
					<div class="text-center text-gray-500 dark:text-gray-400">
						<p class="text-lg">No messages yet</p>
						<p class="text-sm">Send a message to start the conversation</p>
					</div>
				</div>

				<!-- Message list -->
				<template v-for="(message, index) in chatMessages" :key="message.messageId">
					<MessageComponent v-if="message.type === 'llm' || message.type === 'user'" :message="message" :index="index"
						:messages="chatMessages" :currentUser="currentUser!" :availableBots="availableBots"
						@reply-to-message="handleReplyToMessage" />
					<RoomEventComponent v-else :event="message" :index="index" :messages="chatMessages" />
				</template>
			</div>

			<!-- Input area -->
			<div class="">
				<MessageInput :currentUser="currentUser" :currentChatId="chatRoomId" :availableBots="availableBots"
					:isDarkMode="isDarkMode" @sendMessage="handleSendMessage" :replyTo="replyToMessage"
					@cancelReply="handleCancelReply" />
			</div>
		</div>
	</div>
</template>

<style>
/* Update dark mode styles */
:root {
	--vh: 100vh;
	--bg-primary: #ffffff;
	--bg-secondary: #f3f4f6;
	--text-primary: #111827;
	--text-secondary: #4b5563;
	--border-color: #e5e7eb;
	--hover-bg: #f3f4f6;
	--input-bg: #ffffff;
	--input-border: #e5e7eb;
	--shadow-color: rgba(0, 0, 0, 0.1);
}

.dark {
	--bg-primary: #1f2937;
	--bg-secondary: #111827;
	--text-primary: #f9fafb;
	--text-secondary: #9ca3af;
	--border-color: #374151;
	--hover-bg: #374151;
	--input-bg: #1f2937;
	--input-border: #4b5563;
	--shadow-color: rgba(0, 0, 0, 0.3);
}

/* Base styles using CSS variables */
.bg-white {
	background-color: var(--bg-primary);
}

.bg-gray-100 {
	background-color: var(--bg-secondary);
}

.text-gray-900 {
	color: var(--text-primary);
}

.text-gray-500 {
	color: var(--text-secondary);
}

.border-gray-200 {
	border-color: var(--border-color);
}

.hover\:bg-gray-100:hover {
	background-color: var(--hover-bg);
}

/* Input styles */
input,
textarea {
	background-color: var(--input-bg);
	border-color: var(--input-border);
	color: var(--text-primary);
}

/* Shadow styles */
.shadow-lg {
	box-shadow: 0 10px 15px -3px var(--shadow-color);
}

/* Emoji picker dark mode adjustments */
.dark .emoji-picker {
	background-color: var(--bg-primary) !important;
	border-color: var(--border-color) !important;
}

.dark .emoji-picker__search {
	background-color: var(--bg-secondary) !important;
	border-color: var(--input-border) !important;
	color: var(--text-primary) !important;
}

.dark .emoji-picker__category-name {
	background-color: var(--bg-primary) !important;
	color: var(--text-primary) !important;
}

.dark .emoji-picker__emoji:hover {
	background-color: var(--hover-bg) !important;
}

/* Mobile-specific styles for emoji picker */
@media (max-width: 768px) {
	.emoji-picker {
		width: 100vw !important;
		height: 50vh !important;
		position: fixed !important;
		bottom: 0 !important;
		left: 0 !important;
		border-radius: 1rem 1rem 0 0 !important;
	}
}

/* Smooth transitions for theme changes */
* {
	transition: background-color 0.2s ease-in-out, border-color 0.2s ease-in-out, color 0.2s ease-in-out;
}

/* Update emoji picker styles */
.emoji-picker-container {
	max-height: min(420px, 90vh);
	overflow: hidden;
	z-index: 100;
}

.emoji-picker-wrapper {
	max-height: min(420px, 90vh);
	overflow-y: auto;
}

/* Mobile styles */
@media (max-width: 768px) {
	.emoji-picker-container {
		position: fixed !important;
		bottom: 0 !important;
		left: 0 !important;
		right: 0 !important;
		width: 100% !important;
		max-width: 100% !important;
		border-radius: 1rem 1rem 0 0 !important;
		transform: translateY(100%);
		transition: transform 0.2s ease-in-out;
	}

	.emoji-picker-container.active {
		transform: translateY(0);
	}

	.emoji-picker-wrapper {
		max-height: 50vh;
	}
}
</style>
