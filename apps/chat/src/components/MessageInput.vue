<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref } from 'vue';
import EmojiPicker from 'vue3-emoji-picker';
import 'vue3-emoji-picker/css';
import type { Bot } from '@/pages/Chat.vue';
import type { ChatPayload } from "@hugin-bot/functions/src/types";
import {
  File as FileIcon,
  Plus as PlusIcon,
  Send as SendIcon,
  Smile as SmileIcon,
} from "lucide-vue-next";
import type { User } from "../services/auth";
import FilePreview from './FilePreview.vue';
import GifPicker from './GifPicker.vue';

const props = defineProps<{
  currentUser: User | null;
  currentChatId: string;
  availableBots: Bot[];
  isDarkMode: boolean;
}>();

const emit = defineEmits<{
  sendMessage: [message: ChatPayload];
}>();

// Input state
const messageInput = ref("");
const textareaRef = ref<HTMLTextAreaElement | null>(null);
const showAttachmentMenu = ref(false);
const showEmojiPicker = ref(false);
const showGifPicker = ref(false);

// File attachments
const selectedFile = ref<File | null>(null);
const selectedVideoFile = ref<File | null>(null);
const selectedAudioFile = ref<File | null>(null);
const audioRecording = ref<string | null>(null);

// Add bot-related state
const showBotSuggestions = ref(false);
const taggedBot = ref<Bot | null>(null);
const selectedBotIndex = ref(0); // Track currently selected bot in the dropdown

// Temporary bot for testing

// Auto-resize textarea
const autoResize = () => {
  const textarea = textareaRef.value;
  if (!textarea) return;

  textarea.style.height = "auto";
  textarea.style.height = `${textarea.scrollHeight}px`;
};

// Toggle attachment menu
const toggleAttachmentMenu = () => {
  showAttachmentMenu.value = !showAttachmentMenu.value;
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
    senderId: props.currentUser.id,
    roomId: props.currentChatId,
    timestamp: Date.now(),
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
    case 'ArrowUp':
      event.preventDefault();
      selectedBotIndex.value = (selectedBotIndex.value - 1 + props.availableBots.length) % props.availableBots.length;
      break;
    case 'ArrowDown':
      event.preventDefault();
      selectedBotIndex.value = (selectedBotIndex.value + 1) % props.availableBots.length;
      break;
    case 'Enter':
      event.preventDefault();
      if (showBotSuggestions.value) {
        selectBot(props.availableBots[selectedBotIndex.value]);
      } else {
        sendMessage();
      }
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
    senderId: props.currentUser.id,
    roomId: props.currentChatId,
    timestamp: Date.now(),
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

  // Reset textarea height
  nextTick(() => {
    if (textareaRef.value) {
      textareaRef.value.style.height = 'auto';
    }
  });
};

// Add click outside handler
const attachmentMenuRef = ref<HTMLDivElement | null>(null);

const handleClickOutside = (event: MouseEvent) => {
  if (attachmentMenuRef.value && !attachmentMenuRef.value.contains(event.target as Node)) {
    showAttachmentMenu.value = false;
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
  <div class="p-2 sm:p-4 bg-white dark:bg-gray-800 border-t dark:border-gray-700">
    <form @submit.prevent="sendMessage" class="flex flex-col space-y-2">
      <!-- File previews -->
      <div v-if="selectedFile || selectedVideoFile || selectedAudioFile || audioRecording" class="flex flex-wrap gap-2">
        <FilePreview v-if="selectedFile" :fileName="selectedFile.name" @remove="removeFile('image')" />
        <FilePreview v-if="selectedVideoFile" :fileName="selectedVideoFile.name" @remove="removeFile('video')" />
        <FilePreview v-if="selectedAudioFile || audioRecording" :fileName="selectedAudioFile?.name || 'Recording'"
          @remove="removeFile('audio')" />
      </div>

      <!-- Input with attachments row -->
      <div class="flex items-center space-x-2">
        <button type="button" @click.stop="toggleAttachmentMenu"
          class="p-2 rounded-full text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700">
          <PlusIcon class="h-5 w-5" />
        </button>

        <!-- Attachment menu popup -->
        <div v-if="showAttachmentMenu" ref="attachmentMenuRef"
          class="absolute bottom-20 left-4 sm:left-72 bg-white dark:bg-gray-800 rounded-md shadow-lg z-10 border dark:border-gray-700">
          <div class="py-1">
            <label
              class="flex items-center px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer">
              <FileIcon class="h-4 w-4 mr-2" />
              <span>Upload file</span>
              <input type="file" class="hidden" @change="handleFileUpload" />
            </label>
          </div>
        </div>

        <div class="flex-1 relative">
          <textarea v-model="messageInput" rows="1" placeholder="Type a message..."
            class="w-full px-3 py-2 text-base border dark:border-gray-600 rounded-lg bg-transparent focus:outline-none focus:ring-2 focus:ring-primary resize-none"
            @input="handleInput" @keydown="handleKeydown" ref="textareaRef"></textarea>

          <!-- Bot suggestions dropdown -->
          <div v-if="showBotSuggestions"
            class="absolute bottom-full left-0 mb-1 w-64 bg-white dark:bg-gray-800 rounded-lg shadow-lg border dark:border-gray-700 max-h-48 overflow-y-auto">
            <div v-for="(bot, index) in availableBots" :key="bot.id" @click="selectBot(bot)"
              class="flex items-center px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer"
              :class="{ 'bg-gray-100 dark:bg-gray-700': index === selectedBotIndex }">
              <img :src="bot.avatar" class="w-6 h-6 rounded-full mr-2 object-cover" alt="" />
              <span class="text-gray-900 dark:text-gray-100">{{ bot.name }}</span>
            </div>
          </div>
        </div>

        <div class="relative">
          <button type="button" @click="showEmojiPicker = !showEmojiPicker"
            class="p-2 rounded-full text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700">
            <SmileIcon class="h-5 w-5" />
          </button>

          <div v-if="showEmojiPicker" class="absolute bottom-12 right-0 z-50">
            <div class="fixed inset-0" @click="showEmojiPicker = false"></div>
            <div class="relative">
              <div class="bg-white dark:bg-gray-800 rounded-lg shadow-lg border dark:border-gray-700">
                <EmojiPicker :dark="isDarkMode" @select="insertEmoji" />
              </div>
            </div>
          </div>
        </div>

        <div class="relative">
          <button type="button" @click="showGifPicker = !showGifPicker"
            class="p-2 rounded-full text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700">
            <span class="font-semibold">GIF</span>
          </button>

          <!-- GIF Picker -->
          <div v-show="showGifPicker" class="md:hidden fixed bottom-0 left-0 right-0 z-50">
            <div class="fixed inset-0 bg-black/20 dark:bg-black/40" @click="showGifPicker = false"></div>
            <div class="relative">
              <GifPicker :isDarkMode="isDarkMode" @select="selectAndSendGif" />
            </div>
          </div>
        </div>
        <button type="submit" class="p-2 rounded-full bg-primary text-primary-foreground hover:bg-primary/90"
          :disabled="!messageInput.trim() && !selectedFile && !selectedVideoFile && !selectedAudioFile && !audioRecording">
          <SendIcon class="h-5 w-5" />
        </button>
      </div>
    </form>
  </div>
</template>
