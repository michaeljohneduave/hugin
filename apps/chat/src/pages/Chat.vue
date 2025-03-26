<script setup lang="ts">
import { useWebsocket } from "@/composables/useWebsocket";
import { useTrpc } from "@/lib/trpc";
import { useSession } from "@clerk/vue";
import EmojiPicker from 'vue3-emoji-picker'
import 'vue3-emoji-picker/css'
import Message, { type ChatPayloadUser } from "@/components/Message.vue";
import Sidebar from "@/components/Sidebar.vue"
import type { RouterOutput } from "@hugin-bot/functions/src/trpc";
import type { ChatPayload, MessagePayload } from "@hugin-bot/functions/src/types";
import {
	Bot as BotIcon,
	File as FileIcon,
	Image as ImageIcon,
	LogOut as LogOutIcon,
	Menu as MenuIcon,
	Mic as MicIcon,
	Moon as MoonIcon,
	MoreHorizontal as MoreHorizontalIcon,
	Plus as PlusIcon,
	Reply as ReplyIcon,
	Send as SendIcon,
	Smile as SmileIcon,
	StopCircle as StopCircleIcon,
	Sun as SunIcon,
	Users as UsersIcon,
	Video as VideoIcon,
	X as XIcon,
} from "lucide-vue-next";
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from "vue";
import MessageInput from "../components/MessageInput.vue";
import { useAuth } from "../composables/useAuth";
import { useTheme } from '../composables/useTheme';
import type { AuthUser } from "../services/auth";
import ChatList from "./ChatList.vue";
import FilePreview from "./FilePreview.vue";
import GifPicker from './GifPicker.vue'
import ModelList from "./ModelList.vue";
import RecordAudio from "./RecordAudio.vue";
import UserList from "./UserList.vue";

export type User = AuthUser & {
	online?: boolean;
};

type Reply = {
	sender: User;
};

export type LLM = {
	id: string;
	name: string;
	type: string;
};

export type Attachment = {
	name: string;
	size: string;
	type: string;
};

type RoomMembers = RouterOutput["roomMembers"];


// State
const messageInput = ref("");
const chatMessages = ref<ChatPayloadUser[]>([]);
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
const replyingTo = ref<Reply | null>(null);
const showMentionSuggestions = ref(false);
const rooms = ref<RouterOutput["roomsWithLastMessage"]>([]);
const roomMembers = ref<Record<string, RouterOutput["roomMembers"][number]>>({});

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
			userId: room.lastMessage.userId,
			message: room.lastMessage.message,
			imageFiles: room.lastMessage.imageFiles || [],
			videoFiles: room.lastMessage.videoFiles || [],
			audioFiles: room.lastMessage.audioFiles || [],
			createdAt: room.lastMessage.createdAt
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

// Available LLMs
const availableLLMs = ref<User[]>([
	{
		id: "gpt4o",
		name: "GPT-4o",
		type: "human",
	},
	{
		id: "claude3",
		name: "Claude 3",
		type: "human",
	},
	{
		id: "gemini",
		name: "Gemini",
		type: "human",
	},
]);

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

// Modify handleChatSelect to handle WebSocket room changes
const handleChatSelect = async (chatId: string) => {
	currentChatId.value = chatId;
	// Fetch room members first
	await fetchRoomMembers(chatId);
	// Join new room
	// websocket.value?.send(JSON.stringify({
	// 	action: 'joinRoom',
	// 	roomId: chatId,
	// }));
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

		// Transform messages to match ChatPayload type
		chatMessages.value = messages.map(msg => {
			const user = roomMembers.value[msg.userId];

			return {
				action: "sendMessage",
				senderId: msg.userId,
				roomId: currentChatId.value,
				timestamp: new Date(msg.createdAt).getTime(),
				...(msg.message ? { message: msg.message } : {
					imageFiles: msg.imageFiles || [],
					videoFiles: msg.videoFiles || [],
					audioFiles: msg.audioFiles || []
				}),
				user: user ? {
					id: user.id,
					name: user.name,
					avatar: user.avatar || '/placeholder.svg?height=80&width=80',
					type: user.type
				} : undefined
			};
		});

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

// Modify sendMessage to use WebSocket
const sendMessage = () => {
	if ((!messageInput.value.trim() && !selectedFile.value && !selectedVideoFile.value && !selectedAudioFile.value && !audioRecording.value) || !currentUser.value) return;

	// Convert files to URLs (this should be handled by your file upload service)
	const imageFiles = selectedFile.value ? [URL.createObjectURL(selectedFile.value)] : [];
	const videoFiles = selectedVideoFile.value ? [URL.createObjectURL(selectedVideoFile.value)] : [];
	const audioFiles = selectedAudioFile.value ? [URL.createObjectURL(selectedAudioFile.value)] :
		audioRecording.value ? [audioRecording.value] : [];

	// Create message based on whether we have media files or text
	const message: ChatPayload = {
		action: "sendMessage",
		senderId: currentUser.value.id,
		roomId: currentChatId.value,
		timestamp: Date.now(),
		...(imageFiles.length > 0 || videoFiles.length > 0 || audioFiles.length > 0
			? {
				imageFiles,
				videoFiles,
				audioFiles,
			}
			: {
				message: messageInput.value,
			}),
	};

	sendSocketMsg(message);
	messageInput.value = '';
	selectedFile.value = null;
	selectedVideoFile.value = null;
	selectedAudioFile.value = null;
	audioRecording.value = null;
};

// Update the watch for chatMessages
watch(chatMessages, (newMessages, oldMessages) => {
	// Only scroll if new messages were added
	if (newMessages.length > oldMessages.length) {
		// Force scroll on user's own messages
		const lastMessage = newMessages[newMessages.length - 1];
		const isOwnMessage = lastMessage.senderId === currentUser.value?.id;
		scrollToBottom(isOwnMessage);
	}
}, { deep: true });

// Watch for room changes and fetch messages
watch(currentChatId, (newRoomId) => {
	fetchMessages(newRoomId);
});

// Watch for WebSocket messages to update room members
const handleWebSocketMessage = (event: MessageEvent) => {
	const data = JSON.parse(event.data) as ChatPayload;
	if (data.action === 'sendMessage') {
		const user = roomMembers.value[data.senderId];
		const message: ChatPayloadUser = {
			...data,
			user: user ? {
				id: user.id,
				name: user.name,
				avatar: user.avatar || '/placeholder.svg?height=80&width=80',
				type: user.type
			} : undefined
		};
		chatMessages.value.push(message);

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

// Format date for messages
const formatDate = (timestamp: Date) => {
	const now = new Date();
	const date = new Date(timestamp);

	if (date.toDateString() === now.toDateString()) {
		return "Today";
	}

	if (
		date.toDateString() ===
		new Date(now.setDate(now.getDate() - 1)).toDateString()
	) {
		return "Yesterday";
	}

	return date.toLocaleDateString(undefined, {
		weekday: "long",
		month: "short",
		day: "numeric",
	});
};

// Format time for messages
const formatTime = (timestamp: Date) => {
	return new Date(timestamp).toLocaleTimeString([], {
		hour: "2-digit",
		minute: "2-digit",
	});
};



// Toggle attachment menu
const toggleAttachmentMenu = () => {
	showAttachmentMenu.value = !showAttachmentMenu.value;
};

// Start audio recording
const startRecording = async () => {
	try {
		const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
		const mediaRecorder = new MediaRecorder(stream);
		const audioChunks: BlobPart[] = [];

		mediaRecorder.addEventListener("dataavailable", (event) => {
			audioChunks.push(event.data);
		});

		mediaRecorder.addEventListener("stop", () => {
			const audioBlob = new Blob(audioChunks, { type: "audio/mpeg" });
			audioRecording.value = URL.createObjectURL(audioBlob);
			for (const track of stream.getTracks()) {
				track.stop();
			}
		});

		mediaRecorder.start();
		isRecording.value = true;
		showAttachmentMenu.value = false;

		// Start recording timer
		recordingTime.value = 0;
		recordingInterval.value = setInterval(() => {
			recordingTime.value++;
		}, 1000);

		// Store mediaRecorder in a ref for later access
		window.mediaRecorder = mediaRecorder;
	} catch (error) {
		console.error("Error accessing microphone:", error);
		alert("Could not access microphone. Please check permissions.");
	}
};

// Stop audio recording
const stopRecording = () => {
	if (window.mediaRecorder && window.mediaRecorder.state !== "inactive") {
		window.mediaRecorder.stop();

		if (recordingInterval.value) {
			clearInterval(recordingInterval.value);
		}
		isRecording.value = false;
	}
};

// Cancel audio recording
const cancelRecording = () => {
	if (window.mediaRecorder && window.mediaRecorder.state !== "inactive") {
		window.mediaRecorder.stop();

		if (recordingInterval.value) {
			clearInterval(recordingInterval.value);
		}

		isRecording.value = false;
		audioRecording.value = null;
	}
};

// Remove audio recording
const removeAudio = () => {
	audioRecording.value = null;
};

// Auto-resize textarea
const autoResize = () => {
	const textarea = textareaRef.value;
	if (!textarea) return;

	textarea.style.height = "auto";
	textarea.style.height = `${textarea.scrollHeight}px`;
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

// Filter mentions based on what's being typed after @
const filteredMentions = computed(() => {
	if (!showMentionSuggestions.value) return [];
	const availableMentions = availableLLMs.value;

	const lastAtIndex = messageInput.value.lastIndexOf("@");
	if (lastAtIndex === -1) return availableMentions;

	const query = messageInput.value.slice(lastAtIndex + 1).toLowerCase();
	return availableMentions.filter((llm) =>
		llm.name.toLowerCase().includes(query),
	);
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

// Parse message for LLM mentions
const parseMentions = (message: string) => {
	const mentionRegex = /@([^\s]+)/g;
	const mentions = [];
	let match = mentionRegex.exec(message);

	while (match !== null) {
		const mentionName = match[1];
		const llm = availableLLMs.value.find(
			(l) => l.name.toLowerCase() === mentionName.toLowerCase(),
		);

		if (llm) {
			mentions.push(llm);
		}

		match = mentionRegex.exec(message);
	}

	return mentions;
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
const isMobileMenuOpen = ref(false);
const isSidebarOpen = ref(false);
const showUserMenu = ref(false);
const viewportHeight = ref(window.innerHeight);
const isKeyboardOpen = ref(false);

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

// Add to script section with other refs
const showEmojiPicker = ref(false);
const showGifPicker = ref(false);

// Update the emoji interface and handler
interface EmojiData {
	i: string;  // emoji character
	n: string[]; // names
	r: string;   // representation
	u: string;   // unicode
}

const insertEmoji = (emoji: EmojiData) => {
	messageInput.value += emoji.i;
	showEmojiPicker.value = false;
};

// Update the insertGif function
const selectAndSendGif = (url: string) => {
	// How do I centralize checking or making sure session.user exists
	if (!session.value?.user) {
		return;
	}

	const message: MessagePayload = {
		action: 'sendMessage',
		senderId: session.value?.user.id,
		roomId: currentChatId.value,
		timestamp: Date.now(),
		imageFiles: [url]
	};

	showGifPicker.value = false;
	sendSocketMsg(message);
};

// Update the handleAudioStop function
const handleAudioStop = (audioUrl: string) => {
	audioRecording.value = audioUrl;
};

// Function to update room members
const updateRoomMembers = (members: RouterOutput["roomMembers"]) => {
	const updatedMembers: Record<string, RouterOutput["roomMembers"][number]> = {};
	for (const member of members) {
		updatedMembers[member.id] = member;
	}
	roomMembers.value = updatedMembers;
};

// Add createNewAiChat handler
const handleCreateNewAiChat = async () => {
	if (!currentUser.value) return;

	try {
		// Create a new room with type 'llm'
		const newRoom = await trpc.createAiRoom.mutate({
			type: 'llm',
			name: 'New Chat', // Default name
			userId: currentUser.value.id,
		});

		// Add the new room to the rooms list
		rooms.value = [{
			...newRoom,
		}, ...rooms.value];

		// Switch to the new room
		currentChatId.value = newRoom.roomId;
		await fetchRoomMembers(newRoom.roomId);
		await fetchMessages(newRoom.roomId);
	} catch (error) {
		console.error('Error creating new AI chat:', error);
	}
};

</script>

<template>
	<div v-if="isAuthLoading" class="flex h-screen items-center justify-center">
		<div class="text-gray-500 dark:text-gray-400">Loading...</div>
	</div>
	<div v-else-if="authError" class="flex h-screen items-center justify-center">
		<div class="text-red-500">Error: {{ authError.message }}</div>
	</div>
	<div v-else class="flex h-[var(--vh,100vh)] bg-gray-100 dark:bg-gray-900">
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
		<div class="flex-1 flex flex-col">
			<!-- Chat header -->
			<div class="h-16 flex items-center justify-between px-4 border-b dark:border-gray-700 bg-white dark:bg-gray-800">
				<!-- <div class="flex items-center">
					<button class="md:hidden p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700"
						@click="isMobileMenuOpen = !isMobileMenuOpen">
						<MenuIcon v-if="!isMobileMenuOpen" class="h-6 w-6" />
						<XIcon v-else class="h-6 w-6" />
					</button>
				</div> -->

				<div class="flex-1 flex flex-col items-center">
					<h2 class="text-lg font-medium">{{ currentChatId }}</h2>
				</div>

				<!-- Mobile user list button -->
				<button class="md:hidden p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full"
					@click="isSidebarOpen = !isSidebarOpen">
					<UsersIcon class="h-5 w-5" />
				</button>
			</div>

			<!-- Messages container -->
			<div ref="messagesContainer" class="flex-1 overflow-y-auto px-2 sm:px-4 py-4">
				<template v-for="(message, index) in chatMessages" :key="message.senderId + message.timestamp">
					<Message v-if="currentUser" :message="message" :index="index" :messages="chatMessages"
						:currentUser="currentUser" />
				</template>
			</div>

			<!-- Input area -->
			<MessageInput :currentUser="currentUser" :currentChatId="currentChatId" :isDarkMode="isDarkMode"
				@sendMessage="sendSocketMsg" />
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
