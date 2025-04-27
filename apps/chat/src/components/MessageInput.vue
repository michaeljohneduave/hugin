<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref } from 'vue';
import EmojiPicker from 'vue3-emoji-picker';
import 'vue3-emoji-picker/css';
import { useDeviceDetection } from '@/composables/useDeviceDetection';
import type { Bot } from '@/pages/Chat.vue';
import type { ChatPayload, User } from '@hugin-bot/core/src/types';
import {
  File as FileIcon,
  Search as SearchIcon,
  Send as SendIcon,
  Smile as SmileIcon,
} from "lucide-vue-next";
import FilePreview from './FilePreview.vue';
import GifPicker from './GifPicker.vue';

const props = defineProps<{
  currentUser: User | null;
  currentChatId: string;
  availableBots: Bot[];
  isDarkMode: boolean;
  replyTo?: ChatPayload | null;
}>();

const emit = defineEmits<{
  sendMessage: [message: ChatPayload];
  cancelReply: [];
}>();

// Input state
const messageInput = ref("");
const textareaRef = ref<HTMLTextAreaElement | null>(null);
const showFunctionButtons = ref(false);
const showEmojiPicker = ref(false);
const showGifPicker = ref(false);
const showFileUploadUI = ref(false);

// File attachments
const selectedFile = ref<File | null>(null);
const selectedVideoFile = ref<File | null>(null);
const selectedAudioFile = ref<File | null>(null);
const audioRecording = ref<string | null>(null);

// Add bot-related state
const showBotSuggestions = ref(false);
const taggedBot = ref<Bot | null>(null);
const selectedBotIndex = ref(0); // Track currently selected bot in the dropdown

// Get mobile detection from the composable
const { isMobile } = useDeviceDetection();

// Auto-resize textarea
const autoResize = () => {
  const textarea = textareaRef.value;
  if (!textarea) return;

  // Reset height to calculate proper scrollHeight
  textarea.style.height = "auto";

  // Get line height to calculate lines worth of height
  const computedStyle = window.getComputedStyle(textarea);
  const lineHeight = Number.parseInt(computedStyle.lineHeight) || 20; // fallback to 20px if not specified
  const maxHeight = lineHeight * 6; // Increased from 3 to 6 lines

  // Set height with maximum limit
  const newHeight = Math.min(textarea.scrollHeight, maxHeight);
  textarea.style.height = `${newHeight}px`;

  // Add overflow scrolling if content exceeds max height
  textarea.style.overflowY = textarea.scrollHeight > maxHeight ? 'auto' : 'hidden';
};

// Toggle function buttons container
const toggleFunctionButtons = () => {
  showFunctionButtons.value = !showFunctionButtons.value;
  // Hide everything when toggling off
  if (!showFunctionButtons.value) {
    showEmojiPicker.value = false;
    showGifPicker.value = false;
    showFileUploadUI.value = false;
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
    showFunctionButtons.value = false;
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

// Update the emoji interface and handler
interface EmojiData {
  i: string;  // emoji character
  n: string[]; // names
  r: string;   // representation
  u: string;   // unicode
}

const insertEmoji = (emoji: EmojiData) => {
  messageInput.value += emoji.i;
  // Keep the picker open, don't set showEmojiPicker to false
};

// Update the insertGif function
const selectAndSendGif = (url: string) => {
  if (!props.currentUser) return;

  const message: ChatPayload = {
    messageId: crypto.randomUUID(),
    action: 'message',
    userId: props.currentUser.id,
    user: props.currentUser,
    roomId: props.currentChatId,
    createdAt: Date.now(),
    imageFiles: [url],
    type: "user",
  };

  showGifPicker.value = false;
  emit('sendMessage', message);
};

// Handle input changes for bot tagging
const handleInput = (event: Event) => {
  const textarea = event.target as HTMLTextAreaElement;
  const text = textarea.value;
  const lastChar = text[textarea.selectionStart - 1];

  if (lastChar === '@') {
    showBotSuggestions.value = true;
    selectedBotIndex.value = 0; // Reset selection when showing suggestions
  }

  autoResize();
};

// Handle keyboard navigation for bot suggestions
const handleKeydown = (event: KeyboardEvent) => {
  if (!showBotSuggestions.value) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      sendMessage();
    }
    return;
  }

  switch (event.key) {
    case 'Enter':
      event.preventDefault();
      sendMessage();
      break;
    case 'Escape':
      event.preventDefault();
      showBotSuggestions.value = false;
      break;
  }
};

// Handle bot selection
const selectBot = (bot: Bot) => {
  const beforeCursor = messageInput.value.slice(0, textareaRef.value?.selectionStart || 0);
  const afterCursor = messageInput.value.slice(textareaRef.value?.selectionStart || 0);

  // Replace the @ with the bot tag using template literals
  messageInput.value = `${beforeCursor.slice(0, -1)}@${bot.name} ${afterCursor}`;
  taggedBot.value = bot;
  showBotSuggestions.value = false;

  // Refocus the textarea and move cursor to the end
  nextTick(() => {
    textareaRef.value?.focus();
    const length = messageInput.value.length;
    textareaRef.value?.setSelectionRange(length, length);
  });
};

// Show specific picker
const showPicker = (pickerType: 'emoji' | 'gif' | 'file') => {
  showEmojiPicker.value = pickerType === 'emoji';
  showGifPicker.value = pickerType === 'gif';
  showFileUploadUI.value = pickerType === 'file';
};

// Hide pickers when input field is clicked
const hidePickers = () => {
  showEmojiPicker.value = false;
  showGifPicker.value = false;
  showFileUploadUI.value = false;
  showFunctionButtons.value = false;

  // On mobile, ensure the textarea stays visible when keyboard appears
  nextTick(() => {
    if (isMobile.value && textareaRef.value) {
      // Small delay to let the keyboard appear
      setTimeout(() => {
        textareaRef.value?.scrollIntoView({ behavior: 'instant', block: 'center' });
      }, 300);
    }
  });
};

// Send message
const sendMessage = () => {
  if ((!messageInput.value.trim() && !selectedFile.value && !selectedVideoFile.value && !selectedAudioFile.value && !audioRecording.value) || !props.currentUser) return;

  // Convert files to URLs (this should be handled by your file upload service)
  const imageFiles = selectedFile.value ? [URL.createObjectURL(selectedFile.value)] : [];
  const videoFiles = selectedVideoFile.value ? [URL.createObjectURL(selectedVideoFile.value)] : [];
  const audioFiles = selectedAudioFile.value ? [URL.createObjectURL(selectedAudioFile.value)] :
    audioRecording.value ? [audioRecording.value] : [];

  // Create message based on whether we have media files or text
  const message: ChatPayload = {
    messageId: crypto.randomUUID(),
    action: "message",
    userId: props.currentUser.id,
    roomId: props.currentChatId,
    createdAt: Date.now(),
    type: "user",
    ...(imageFiles.length > 0 || videoFiles.length > 0 || audioFiles.length > 0
      ? {
        imageFiles,
        videoFiles,
        audioFiles,
      }
      : {
        message: messageInput.value,
        taggedBotId: taggedBot.value?.id
      }),
    user: props.currentUser
  };

  if (taggedBot.value) {
    message.mentions = [
      taggedBot.value.id
    ]
  }

  emit('sendMessage', message);
  messageInput.value = '';
  taggedBot.value = null;
  selectedFile.value = null;
  selectedVideoFile.value = null;
  selectedAudioFile.value = null;
  audioRecording.value = null;

  hidePickers();

  // Reset textarea height
  nextTick(() => {
    if (textareaRef.value) {
      textareaRef.value.style.height = 'auto';
      textareaRef.value.focus();
    }
  });
};

// Add click outside handler
const functionButtonsRef = ref<HTMLDivElement | null>(null);

const handleClickOutside = (event: MouseEvent) => {
  if (functionButtonsRef.value && !functionButtonsRef.value.contains(event.target as Node)) {
    showFunctionButtons.value = false;
  }
};

onMounted(() => {
  document.addEventListener('click', handleClickOutside);
});

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside);
});
</script>

<template>
  <div class="p-1.5 bg-white dark:bg-gray-800 dark:border-gray-700">
    <form @submit.prevent="sendMessage" class="flex flex-col" :class="[
      props.replyTo ? 'space-y-1' : ''
    ]">
      <!-- File previews -->
      <div v-if="selectedFile || selectedVideoFile || selectedAudioFile || audioRecording" class="flex flex-wrap gap-2">
        <FilePreview v-if="selectedFile" :fileName="selectedFile.name" @remove="removeFile('image')" />
        <FilePreview v-if="selectedVideoFile" :fileName="selectedVideoFile.name" @remove="removeFile('video')" />
        <FilePreview v-if="selectedAudioFile || audioRecording" :fileName="selectedAudioFile?.name || 'Recording'"
          @remove="removeFile('audio')" />
      </div>

      <!-- Reply preview -->
      <div v-if="props.replyTo" class="flex items-center bg-gray-100 dark:bg-gray-700 p-2 rounded-lg">
        <div class="flex-1 flex items-center min-w-0">
          <div class="ml-1 flex-1 min-w-0">
            <div class="text-xs font-medium truncate dark:text-primary-foreground">
              Replying to {{ props.replyTo.user?.name ?? props.replyTo.userId }}
            </div>
            <div class="text-xs text-gray-500 dark:text-gray-400 truncate">
              {{ props.replyTo.message ||
                (props.replyTo.imageFiles?.length ? '📷 Image' :
                  props.replyTo.videoFiles?.length ? '🎥 Video' :
                    props.replyTo.audioFiles?.length ? '🔊 Audio' : '') }}
            </div>
          </div>
        </div>
        <button type="button" @click="emit('cancelReply')"
          class="flex-shrink-0 ml-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>

      <!-- Input with search button -->
      <div class="flex items-center space-x-2">
        <button type="button" @click.stop="toggleFunctionButtons"
          class="rounded-full text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
          :class="{ 'bg-gray-100 dark:bg-gray-700': showFunctionButtons }">
          <SearchIcon class="h-5 w-5" />
        </button>

        <div class="flex-1 relative flex flex-col">
          <textarea v-model="messageInput" rows="1" placeholder="Type a message..."
            class="placeholder-text w-full h-full px-2 py-2 text-sm border dark:text-primary-foreground dark:border-gray-600 rounded-lg bg-transparent focus:outline-none resize-none max-h-textarea overflow-y-auto"
            @input="handleInput" @keydown="handleKeydown" ref="textareaRef" @focus="hidePickers"></textarea>

          <!-- Bot suggestions dropdown -->
          <div v-if="showBotSuggestions"
            class="absolute bottom-full left-0 mb-1 w-64 bg-white dark:bg-gray-800 rounded-lg shadow-lg border dark:border-gray-700 max-h-48 overflow-y-auto">
            <div v-for="(bot, index) in availableBots" :key="bot.id" @click="selectBot(bot)"
              class="flex items-center px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer">
              <img :src="bot.avatar" class="w-6 h-6 rounded-full mr-2 object-cover" alt="" />
              <span class="text-gray-900 dark:text-gray-100">{{ bot.name }}</span>
            </div>
          </div>
        </div>

        <button type="submit" class="pr-1 pb-1 rounded-full text-primary dark:text-blue-400"
          :disabled="!messageInput.trim() && !selectedFile && !selectedVideoFile && !selectedAudioFile && !audioRecording">
          <SendIcon class="h-5 w-5" />
        </button>
      </div>

      <!-- Unified container with buttons and pickers -->
      <transition name="slide-down" persisted>
        <div v-if="showFunctionButtons" class="mt-2 rounded-lg bg-white dark:bg-gray-800 dark:border-gray-700">
          <!-- Function buttons - always visible when container is open -->
          <div class="p-2 flex justify-around dark:border-gray-700">
            <button type="button" @click="showPicker('emoji')" class="function-button"
              :class="{ 'active': showEmojiPicker }">
              <SmileIcon class="h-6 w-6" />
              <span class="text-xs mt-1">Emoji</span>
            </button>
            <button type="button" @click="showPicker('gif')" class="function-button"
              :class="{ 'active': showGifPicker }">
              <div class="h-6 w-6 flex items-center justify-center">
                <span class="font-semibold">GIF</span>
              </div>
              <span class="text-xs mt-1">GIF</span>
            </button>
            <button type="button" @click="showPicker('file')" class="function-button"
              :class="{ 'active': showFileUploadUI }">
              <FileIcon class="h-6 w-6" />
              <span class="text-xs mt-1">File</span>
            </button>
          </div>

          <!-- Content area below buttons -->
          <div>
            <!-- Emoji Picker -->
            <div v-show="showEmojiPicker">
              <EmojiPicker native :theme="isDarkMode ? 'dark' : 'light'" @select="insertEmoji" hideSearch />
            </div>

            <!-- GIF Picker -->
            <div v-show="showGifPicker">
              <GifPicker :isDarkMode="isDarkMode" @select="selectAndSendGif" />
            </div>

            <!-- File Upload WIP UI -->
            <div v-show="showFileUploadUI" class="p-4">
              <div class="flex flex-col items-center justify-center">
                <FileIcon class="h-12 w-12 text-gray-400 dark:text-gray-500 mb-2" />
                <h3 class="text-lg font-medium text-gray-700 dark:text-gray-300">Upload File</h3>
                <p class="text-sm text-gray-500 dark:text-gray-400 mt-1 text-center">
                  Drag and drop a file here, or click to select a file
                </p>
                <label
                  class="mt-4 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 cursor-pointer">
                  <span>Select File</span>
                  <input type="file" class="hidden" @change="handleFileUpload" />
                </label>
              </div>
            </div>
          </div>
        </div>
      </transition>
    </form>
  </div>
</template>

<style>
/* Correctly integrate emoji picker with the container */
.v3-emoji-picker {
  box-shadow: none !important;
  border: none !important;
  width: 100% !important;
  max-height: 300px !important;
}

/* Textarea max height (increased to approximately 6 lines) */
.max-h-textarea {
  max-height: calc(1.5em * 6);
  /* Assumes line-height of approximately 1.5em */
  /* Hide scrollbar but keep scroll functionality */
  scrollbar-width: none;
  /* Firefox */
  -ms-overflow-style: none;
  /* IE and Edge */
}

/* Hide scrollbar for Chrome, Safari and Opera */
.max-h-textarea::-webkit-scrollbar {
  width: 4px;
  background-color: transparent;
}

.max-h-textarea::-webkit-scrollbar-thumb {
  background-color: rgba(155, 155, 155, 0.5);
  border-radius: 4px;
}

/* Function buttons styling for consistent appearance */
.function-button {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 64px;
  height: 64px;
  border-radius: 8px;
  color: rgba(107, 114, 128, 1);
  transition: background-color 0.2s ease;
}

.dark .function-button {
  color: rgba(156, 163, 175, 1);
}

.function-button:hover {
  background-color: rgba(243, 244, 246, 1);
}

.dark .function-button:hover {
  background-color: rgba(55, 65, 81, 1);
}

.function-button.active {
  background-color: rgba(229, 231, 235, 1);
}

.dark .function-button.active {
  background-color: rgba(75, 85, 99, 1);
}

/* Slide down transition animation */
.slide-down-enter-active,
.slide-down-leave-active {
  transition: all 0.3s ease;
  max-height: 500px;
  opacity: 1;
  overflow: hidden;
}

.slide-down-enter-from,
.slide-down-leave-to {
  max-height: 0;
  opacity: 0;
  overflow: hidden;
}

.placeholder-text::placeholder {
  font-size: .875rem;
}
</style>
