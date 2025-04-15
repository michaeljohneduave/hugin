<script setup lang="ts">
import loebotteAvatar from "@/assets/loebotte-avatar.webp";
import pearlAvatar from "@/assets/pearl-avatar.webp";
import Message from "@/components/Message.vue";
import RoomEvent from '@/components/RoomEvent.vue';
import Sidebar from "@/components/Sidebar.vue"
import { useWebsocket } from "@/composables/useWebsocket";
import { useTrpc } from "@/lib/trpc";
import { useSession } from "@clerk/vue";
import type { MessageEntityType } from "@hugin-bot/core/src/entities/message.dynamo";
import type { RouterOutput } from "@hugin-bot/functions/src/lib/trpc";
import type { ChatPayload, RoomPayload } from "@hugin-bot/functions/src/lib/types";
import {
	BellIcon,
	LogOutIcon,
	MoonIcon,
	SunIcon,
	Users as UsersIcon,
} from "lucide-vue-next";
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from "vue";
import MessageInput from "../components/MessageInput.vue";
import NotificationSettings from "../components/NotificationSettings.vue";
import { useAuth } from "../composables/useAuth";
import { useTheme } from '../composables/useTheme';
import type { User } from "../services/auth";

// Both for regular user and bot
export type ChatPayloadWithUser = MessageEntityType & {
	user: User
}

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

const availableBots: User[] = [{
	id: 'gemini',
	name: 'Gima',
	avatar: pearlAvatar,
	type: "llm"
}];

const unknownBot: User = {
	id: "lobot",
	name: "Loebotte",
	avatar: loebotteAvatar,
	type: "llm"
}

// State
const messageInput = ref("");
const chatMessages = ref<Array<ChatPayloadWithUser>>([]);
const roomEvents = ref<Array<RoomPayload>>([]);
const showAttachmentMenu = ref(false);
const selectedFile = ref<File | null>(null);
const selectedVideoFile = ref<File | null>(null);
const selectedAudioFile = ref<File | null>(null);
const isRecording = ref(false);
const audioRecording = ref<string | null>(null);
const recordingTime = ref(0);
const recordingInterval = ref<NodeJS.Timeout | null>(null);
const messagesContainer = ref<HTMLDivElement | null>(null);
const textareaRef = ref<HTMLTextAreaElement | null>(null);
const showMentionSuggestions = ref(false);
const rooms = ref<RouterOutput["roomsWithLastMessage"]>([]);
const roomMembers = ref<Record<string, RouterOutput["roomMembers"][number]>>({});
const showNotificationSettings = ref(false);
const replyToMessage = ref<ChatPayloadWithUser | null>(null);

const isMobileMenuOpen = ref(false);
const isSidebarOpen = ref(false);
const showUserMenu = ref(false);
const viewportHeight = ref(window.innerHeight);
const isKeyboardOpen = ref(false);

// Transform rooms data to match Chat type
const formattedRooms = computed(() => {
	return rooms.value.map(room => ({
		roomId: room.roomId,
		userId: room.userId,
		name: room.name,
		type: (room.type || "group") as "group" | "dm",
		createdAt: room.createdAt || Date.now(),
		updatedAt: room.updatedAt || room.createdAt || Date.now(),
		user: {
			firstName: room.user?.firstName || "",
			lastName: room.user?.lastName || "",
			avatar: room.user?.avatar || "/placeholder.svg?height=80&width=80"
		},
		lastMessage: room.lastMessage ? {
			messageId: room.lastMessage.messageId,
			action: "message" as const,
			roomId: room.roomId,
			type: "user" as const,
			userId: room.lastMessage.userId,
			createdAt: room.lastMessage.createdAt,
			message: room.lastMessage.message,
			imageFiles: room.lastMessage.imageFiles || [],
			videoFiles: room.lastMessage.videoFiles || [],
			audioFiles: room.lastMessage.audioFiles || [],
		} : undefined
	}));
});

// Replace the currentUser ref with auth
const { user: currentUser, isLoading: isAuthLoading, error: authError, signOut } = useAuth();
const { session } = useSession();
const { isOnline, sendMessage: sendSocketMsg, addMessageHandler, removeMessageHandler } = useWebsocket();
const trpc = useTrpc();

// Replace the isDarkMode ref with the composable
const { isDarkMode, toggleTheme } = useTheme();

// Add currentChatId ref
const currentChatId = ref("general");
// Function to fetch room members
const fetchRoomMembers = async (roomId: string) => {
	try {
		const members = await trpc.roomMembers.query({
			roomId,
		});
		updateRoomMembers(members);
	} catch (error) {
		console.error('Error fetching room members:', error);
	}
};

// Add isScrolledToBottom ref
const isScrolledToBottom = ref(true);

// Update scrollToBottom function to be smoother and handle image loading
const scrollToBottom = (force = false) => {
	nextTick(() => {
		if (messagesContainer.value && (isScrolledToBottom.value || force)) {
			// Get the last message's image if it exists
			const lastMessage = messagesContainer.value.lastElementChild;
			if (lastMessage) {
				const lastImage = lastMessage.querySelector('img');
				if (lastImage) {
					// Wait for the last image to load before scrolling
					if (lastImage.complete) {
						messagesContainer.value.scrollTo({
							top: messagesContainer.value.scrollHeight,
							behavior: 'smooth'
						});
					} else {
						lastImage.onload = () => {
							messagesContainer.value?.scrollTo({
								top: messagesContainer.value.scrollHeight,
								behavior: 'smooth'
							});
						};
						lastImage.onerror = () => {
							messagesContainer.value?.scrollTo({
								top: messagesContainer.value.scrollHeight,
								behavior: 'smooth'
							});
						};
					}
				} else {
					// If no image in last message, scroll immediately
					messagesContainer.value.scrollTo({
						top: messagesContainer.value.scrollHeight,
						behavior: 'smooth'
					});
				}
			}
		}
	});
};

// Add scroll event handler to track scroll position
const handleScroll = () => {
	if (!messagesContainer.value) return;

	const { scrollTop, scrollHeight, clientHeight } = messagesContainer.value;
	// Consider "bottom" if within 100px of the bottom
	isScrolledToBottom.value = scrollHeight - scrollTop - clientHeight < 100;
};

// Function to fetch messages for a room
const fetchMessages = async (roomId: string) => {
	try {
		const messages = await trpc.messagesByRoom.query({
			roomId,
		});
		// TODOS: Clean up this transformation
		// Transform messages to match ChatPayload type
		chatMessages.value = messages.filter(msg => msg.type !== "event").map(msg => {
			if (msg.type === "llm") {
				return {
					messageId: msg.messageId,
					action: "message" as const,
					userId: msg.userId,
					roomId: currentChatId.value,
					createdAt: msg.createdAt,
					type: "llm" as const,
					...(msg.message ? { message: msg.message } : {
						imageFiles: msg.imageFiles || [],
						videoFiles: msg.videoFiles || [],
						audioFiles: msg.audioFiles || []
					}),
					user: availableBots.find(bot => bot.id === msg.userId) || unknownBot,
					replyToMessageId: msg.replyToMessageId,
					threadId: msg.threadId,
				}
			}

			const user = roomMembers.value[msg.userId];

			return {
				messageId: msg.messageId,
				action: "message" as const,
				userId: msg.userId,
				roomId: currentChatId.value,
				createdAt: msg.createdAt,
				type: "user" as const,
				...(msg.message ? { message: msg.message } : {
					imageFiles: msg.imageFiles || [],
					videoFiles: msg.videoFiles || [],
					audioFiles: msg.audioFiles || []
				}),
				user: user,
				replyToMessageId: msg.replyToMessageId,
				threadId: msg.threadId,
			}
		})

		roomEvents.value = messages.filter(msg => msg.type === "event").map(msg => ({
			action: msg.action as "joinRoom" | "leaveRoom",
			senderId: msg.userId,
			messageId: msg.messageId,
			roomId: currentChatId.value,
			timestamp: new Date(msg.createdAt).getTime(),
			type: "event",
		}));

		// Wait for Vue to update the DOM before scrolling
		await nextTick();
		scrollToBottom(true);
	} catch (error) {
		console.error('Error fetching messages:', error);
	}
};

// Handle file upload
const handleFileUpload = (event: Event) => {
	const inputElement = event.target as HTMLInputElement;

	if (inputElement.files && inputElement.files.length > 0) {
		const file = inputElement.files[0];
		const fileType = file.type.split('/')[0];

		switch (fileType) {
			case 'image':
				selectedFile.value = file;
				break;
			case 'video':
				selectedVideoFile.value = file;
				break;
			case 'audio':
				selectedAudioFile.value = file;
				break;
			default:
				alert('Unsupported file type. Please upload an image, video, or audio file.');
				return;
		}
		showAttachmentMenu.value = false;
	}
};

// Remove selected file
const removeFile = (type: 'image' | 'video' | 'audio') => {
	switch (type) {
		case 'image':
			selectedFile.value = null;
			break;
		case 'video':
			selectedVideoFile.value = null;
			break;
		case 'audio':
			selectedAudioFile.value = null;
			break;
	}
};

// Update the watch for chatMessages
watch(chatMessages, (newMessages, oldMessages) => {
	// Only scroll if new messages were added
	if (newMessages.length > oldMessages.length) {
		// Force scroll on user's own messages
		const lastMessage = newMessages[newMessages.length - 1];
		const isOwnMessage = lastMessage.userId === currentUser.value?.id;
		scrollToBottom(isOwnMessage);
	}
}, { deep: true });

// Watch for room changes and fetch messages
watch(currentChatId, (newRoomId) => {
	fetchMessages(newRoomId);
});

// When receiving a message, handle it based on type
const handleWebSocketMessage = (event: MessageEvent) => {
	const data = JSON.parse(event.data) as MessageEntityType | RoomPayload;
	console.log("data", data, roomMembers.value);

	if (data.action === 'message') {
		const messageData = data;
		switch (messageData.type) {
			case "llm":
				chatMessages.value.push({
					...messageData,
					user: availableBots.find(bot => bot.id === messageData.userId) || unknownBot,
				});
				break;
			case "user":
				chatMessages.value.push({
					...messageData,
					user: roomMembers.value[messageData.userId],
				});
				break;
		}
		scrollToBottom();
	} else if (data.action === "joinRoom" || data.action === "leaveRoom") {
		const eventData = data as RoomPayload;
		roomEvents.value.push(eventData);
		scrollToBottom();
	}
};

// Update WebSocket message handler
onMounted(async () => {
	if (window?.matchMedia("(prefers-color-scheme: dark)").matches) {
		isDarkMode.value = true;
		document.documentElement.classList.add("dark");
	}

	// Add WebSocket message handler
	addMessageHandler(handleWebSocketMessage);

	// Add scroll event listener
	messagesContainer.value?.addEventListener('scroll', handleScroll);

	// Fetch initial room members and messages
	await Promise.all([
		fetchRoomMembers(currentChatId.value),
		fetchMessages(currentChatId.value)
	]);

	// Initial scroll to bottom
	scrollToBottom(true);
});

// Clean up WebSocket on unmount
onUnmounted(() => {
	removeMessageHandler(handleWebSocketMessage);
	messagesContainer.value?.removeEventListener('scroll', handleScroll);
});

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

// Insert mention into message input
const insertMention = (llm: User) => {
	const lastAtIndex = messageInput.value.lastIndexOf("@");
	if (lastAtIndex !== -1) {
		const beforeAt = messageInput.value.slice(0, lastAtIndex);
		messageInput.value = `${beforeAt}@${llm.name} `;
	}
	showMentionSuggestions.value = false;

	// Focus back on the textarea
	nextTick(() => {
		textareaRef.value?.focus();
	});
};

// Close dropdowns when clicking outside
onMounted(async () => {
	document.addEventListener("click", (event: MouseEvent) => {
		const target = event.target as HTMLElement;
		// Close attachment menu if clicking outside
		if (showAttachmentMenu.value && !target.closest("button")) {
			showAttachmentMenu.value = false;
		}
	});
});

watch(session, async (val) => {
	if (val?.user) {
		const res = await trpc.roomsWithLastMessage.query({
			userId: val.user.id,
		});

		rooms.value = res;

		// If we have rooms, select the first one
		if (res.length > 0) {
			currentChatId.value = res[0].roomId;
			await fetchRoomMembers(res[0].roomId);
			await fetchMessages(res[0].roomId);
		}
	}
}, {
	once: true,
})

// Add logout handler
const handleLogout = async () => {
	try {
		await signOut();
	} catch (error) {
		console.error("Error logging out:", error);
	}
};

// Add with other refs

// Add to script section with other onMounted hooks
onMounted(() => {
	// Close dropdown when clicking outside
	document.addEventListener('click', (event: MouseEvent) => {
		const target = event.target as HTMLElement;
		if (showUserMenu.value && !target.closest('.relative')) {
			showUserMenu.value = false;
		}
	});

	// Handle viewport height changes (keyboard open/close)
	window.addEventListener('resize', () => {
		viewportHeight.value = window.innerHeight;
		// If viewport height decreased significantly, keyboard is likely open
		isKeyboardOpen.value = window.innerHeight < window.outerHeight * 0.8;
	});

	// Handle mobile browser chrome (address bar) showing/hiding
	window.addEventListener('scroll', () => {
		if (window.scrollY > 0) {
			document.documentElement.style.setProperty('--vh', `${window.innerHeight}px`);
		}
	});
});

// Add to script section with other onUnmounted hooks
onUnmounted(() => {
	window.removeEventListener('resize', () => { });
	window.removeEventListener('scroll', () => { });
});

// Function to update room members
const updateRoomMembers = (members: RouterOutput["roomMembers"]) => {
	const updatedMembers: Record<string, RouterOutput["roomMembers"][number]> = {};
	for (const member of members) {
		updatedMembers[member.id] = member;
	}
	roomMembers.value = updatedMembers;
};

// Handle message reply
const handleReplyToMessage = (message: ChatPayloadWithUser) => {
	replyToMessage.value = message;
	// Focus the message input
	nextTick(() => {
		const textarea = document.querySelector('textarea') as HTMLTextAreaElement;
		if (textarea) textarea.focus();
	});
};

// Cancel a reply
const cancelReply = () => {
	replyToMessage.value = null;
};

// When sending a message, include the replyToMessageId if replying
const handleSendMessage = (message: ChatPayload) => {
	if (replyToMessage.value) {
		message.replyToMessageId = replyToMessage.value.messageId;
		message.threadId = replyToMessage.value.threadId;
		replyToMessage.value = null;
	}

	sendSocketMsg(message);
};

</script>

<template>
	<div v-if="isAuthLoading" class="flex h-screen items-center justify-center">
		<div class="text-gray-500 dark:text-gray-400">Loading...</div>
	</div>
	<div v-else-if="authError" class="flex h-screen items-center justify-center">
		<div class="text-red-500">Error: {{ authError.message }}</div>
	</div>
	<div v-else class="h-[var(--vh,100vh)] bg-gray-100 dark:bg-gray-900">
		<!-- Sidebar -->
		<div class="fixed inset-0 z-40 transform md:relative md:translate-x-0 transition-transform duration-300 ease-in-out"
			:class="[isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full']">
			<!-- Sidebar backdrop -->
			<!-- <div class="absolute inset-0 bg-gray-900/50 md:hidden" @click="isMobileMenuOpen = false"></div> -->

			<!-- Sidebar content -->
			<!-- <Sidebar :currentChatId="currentChatId" :rooms="formattedRooms" :isMobileMenuOpen="isMobileMenuOpen"
				:isOnline="isOnline" @selectChat="handleChatSelect" @createNewAiChat="handleCreateNewAiChat"
				@toggleMobileMenu="isMobileMenuOpen = !isMobileMenuOpen" /> -->
		</div>

		<!-- Main content -->
		<div class="flex-1 flex flex-col h-[var(--vh,100vh)]">
			<!-- Chat header -->
			<div
				class="flex-shrink-0 h-16 flex items-center justify-between px-4 border-b dark:border-gray-700 bg-white dark:bg-gray-800">
				<!-- <div class="flex items-center">
					<button class="md:hidden p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700"
						@click="isMobileMenuOpen = !isMobileMenuOpen">
						<MenuIcon v-if="!isMobileMenuOpen" class="h-6 w-6" />
						<XIcon v-else class="h-6 w-6" />
					</button>
				</div> -->

				<div class="flex-1 flex items-center justify-between">
					<h2 class="text-lg font-medium">{{ currentChatId }}</h2>

					<!-- User actions -->
					<div class="flex items-center space-x-2">
						<!-- Theme toggle -->
						<button @click="toggleTheme" class="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700">
							<SunIcon v-if="isDarkMode" class="h-5 w-5" />
							<MoonIcon v-else class="h-5 w-5" />
						</button>

						<!-- Notifications -->
						<button @click="showNotificationSettings = true"
							class="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700">
							<BellIcon class="h-5 w-5" />
						</button>

						<!-- User menu -->
						<button @click="handleLogout"
							class="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 text-red-500">
							<LogOutIcon class="h-5 w-5" />
						</button>
					</div>
				</div>

				<!-- Mobile user list button -->
				<button class="md:hidden p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full"
					@click="isSidebarOpen = !isSidebarOpen">
					<UsersIcon class="h-5 w-5" />
				</button>
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
			<div ref="messagesContainer" class="flex-1 overflow-y-auto p-4 space-y-4 min-h-0">
				<!-- Show loading or no messages state -->
				<div v-if="chatMessages.length === 0" class="flex justify-center items-center h-full">
					<div class="text-center text-gray-500 dark:text-gray-400">
						<p class="text-lg">No messages yet</p>
						<p class="text-sm">Send a message to start the conversation</p>
					</div>
				</div>

				<!-- Message list -->
				<template v-for="(message, index) in chatMessages" :key="message.messageId">
					<Message v-if="message.type === 'llm' || message.type === 'user'" :message="message" :index="index"
						:messages="chatMessages" :currentUser="currentUser!" :availableBots="availableBots"
						@reply-to-message="handleReplyToMessage" />
				</template>

				<!-- Room events -->
				<template v-for="event in roomEvents" :key="event.messageId">
					<RoomEvent :event="event" :members="roomMembers" :currentUserId="currentUser?.id" />
				</template>
			</div>

			<!-- Input area -->
			<div class="flex-shrink-0">
				<MessageInput :currentUser="currentUser" :currentChatId="currentChatId" :availableBots="availableBots"
					:isDarkMode="isDarkMode" @sendMessage="handleSendMessage" :replyTo="replyToMessage"
					@cancelReply="cancelReply" />
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
