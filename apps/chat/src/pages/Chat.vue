<script setup lang="ts">
import carmyAvatar from "@/assets/carmy-avatar.webp";
import loebotteAvatar from "@/assets/loebotte-avatar.webp";
import pearlAvatar from "@/assets/pearl.svg";
import MessageComponent from "@/components/Message.vue";
import RoomEventComponent from "@/components/RoomEvent.vue";
import { useCurrentMessages, useCurrentRoom } from "@/composables/useSync";
import { useWebsocket } from "@/composables/useWebsocket";
import { addMessageToDb, db } from "@/lib/dexie";
import { useUser } from "@clerk/vue";
import { llmAgents, llmRouters } from "@hugin-bot/core/src/ai";
import type { ChatPayload, } from "@hugin-bot/core/src/types";
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from "vue";
import { useRoute, useRouter, } from "vue-router";
import ChatHeader from "../components/ChatHeader.vue";
import MessageInput from "../components/MessageInput.vue";
import { useTheme } from "../composables/useTheme";

export type Attachment = {
	name: string;
	size: string;
	type: string;
};

export interface Bot {
	id: string;
	name: string;
	avatar?: string;
}

const botAvatars = {
	carmy: carmyAvatar,
	pearl: pearlAvatar,
	lobot: loebotteAvatar,
};

const availableBots = llmAgents.concat(llmRouters).map((agent) => ({
	id: agent.id,
	name: agent.name,
	avatar: botAvatars[agent.id as keyof typeof botAvatars],
	type: "llm" as const,
}));

const { room } = useCurrentRoom();
const { messages } = useCurrentMessages();
const { user: clerkUser } = useUser();
const router = useRouter();
const {
	isOnline,
	sendMessage: sendSocketMsg,
} = useWebsocket();
const { isDarkMode } = useTheme();

const messageInput = ref("");
const showAttachmentMenu = ref(false);
const messagesContainer = ref<HTMLDivElement | null>(null);
const showMentionSuggestions = ref(false);
const replyToMessage = ref<ChatPayload | null>(null);

const isScrolledToBottom = ref(true); // sus
const isUserMenuOpen = ref(false);

const currentUser = computed(() => ({
	id: clerkUser.value!.id,
	name: clerkUser.value!.fullName!,
	type: "user" as const,
	avatar: clerkUser.value?.imageUrl,
}));

// Update scrollToBottom function to be smoother and handle image loading
const scrollToBottom = (force = false) => {
	nextTick(() => {
		if (messagesContainer.value && (isScrolledToBottom.value || force)) {
			// Check for all images in the container
			const allImages = messagesContainer.value.querySelectorAll("img");

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
							behavior: "instant",
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
						behavior: "instant",
					});
				}
			} else {
				// No images, scroll immediately
				messagesContainer.value.scrollTo({
					top: messagesContainer.value.scrollHeight,
					behavior: "instant",
				});
			}
		}
	});
};

const handleReplyToMessage = (message: ChatPayload) => {
	replyToMessage.value = message;
	// Focus the message input
	nextTick(() => {
		const textarea = document.querySelector(
			"textarea"
		) as HTMLTextAreaElement;
		if (textarea) textarea.focus();
	});
};

const handleCancelReply = () => {
	replyToMessage.value = null;
};

// When sending a message; the app does the following
// 1. Add the message into indexDB as unsent
// 2. Send the message via ws
// 3. If the message is sent successfully, update the message in indexDB to sent
// 4. If the message is not sent successfully, message will be in a state of "unsent"
const handleSendMessage = (message: ChatPayload) => {

	if (message.roomType === "llm") {
		message.threadId = messages.value[messages.value.length - 1].threadId;
	} else if (replyToMessage.value) {
		message.replyToMessageId = replyToMessage.value.messageId;
		message.threadId = replyToMessage.value.threadId;
		replyToMessage.value = null;
	} else {
		message.replyToMessageId = undefined;
	}

	message.status = "unsent";
	message.createdAt = Date.now();
	message.updatedAt = Date.now();

	sendSocketMsg(message);
};

const handleShowAttachmentMenu = (event: MouseEvent) => {
	const target = event.target as HTMLElement;
	// Close attachment menu if clicking outside
	if (showAttachmentMenu.value && !target.closest("button")) {
		showAttachmentMenu.value = false;
	}
};

const handleOutsideClick = (event: MouseEvent) => {
	const target = event.target as HTMLElement;
	// Close user menu if clicking outside
	if (isUserMenuOpen.value && !target.closest(".user-menu-container")) {
		isUserMenuOpen.value = false;
	}
};

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

watch(() => messages.value.length, (oldLen, newLen) => {
	if (oldLen !== newLen) {
		scrollToBottom();
	}
});

watch(() => room.value, (newRoom) => {
	if (!newRoom) {
		router.push("/");
	}
});

onMounted(() => {
	document.addEventListener("click", handleShowAttachmentMenu);
	document.addEventListener("click", handleOutsideClick);
	// messagesContainer.value?.addEventListener('scroll', handleScroll);
});

onUnmounted(() => {
	// messagesContainer.value?.removeEventListener('scroll', handleScroll);
	document.removeEventListener("click", handleShowAttachmentMenu);
	document.removeEventListener("click", handleOutsideClick);
});
</script>

<template>
	<ChatHeader v-if="room" :title="room.name || room.roomId.split('-')[0] || 'Chat'" :isOnline="isOnline"
		:roomType="room.type" />

	<!-- Messages area -->
	<div v-if="room" ref="messagesContainer" class="flex-1 overflow-y-auto pl-4 pr-2 py-2 space-y-4 min-h-0">
		<!-- Empty room state -->
		<div v-if="messages.length === 0" class="flex justify-center items-center h-full">
			<div class="text-center text-gray-500 dark:text-gray-400">
				<p class="text-lg">No messages yet</p>
				<p class="text-sm">Send a message to start the conversation</p>
			</div>
		</div>

		<!-- Message list -->
		<template v-for="(message, index) in messages" :key="message.messageId">
			<!-- TODO: Remove messages prop -->
			<MessageComponent v-if="message.action === 'message'" :message="message" :roomType="room.type" :index="index"
				:messages="messages" :currentUser="currentUser!" :availableBots="availableBots"
				@reply-to-message="handleReplyToMessage" />
			<RoomEventComponent v-else-if="message.action === 'joinRoom' || message.action === 'leaveRoom'" :event="message"
				:index="index" />
		</template>
	</div>

	<!-- Input area -->
	<div v-if="room">
		<MessageInput :currentUser="currentUser" :roomType="room.type" :currentChatId="room.roomId"
			:availableBots="availableBots" :isDarkMode="isDarkMode" @sendMessage="handleSendMessage" :replyTo="replyToMessage"
			@cancelReply="handleCancelReply" />
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
	background-color: var(--bg-white) !important;
	border-color: var(--border-color) !important;
}

.dark .emoji-picker__search {
	background-color: var(--bg-secondary) !important;
	border-color: var(--input-border) !important;
	color: var(--text-primary) !important;
}

.dark .emoji-picker__category-name {
	background-color: var(--bg-white) !important;
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
