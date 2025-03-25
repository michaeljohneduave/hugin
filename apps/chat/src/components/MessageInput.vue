<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue';
import EmojiPicker from 'vue3-emoji-picker';
import 'vue3-emoji-picker/css';
import type { ChatPayload } from "@hugin-bot/functions/src/types";
import {
  File as FileIcon,
  Plus as PlusIcon,
  Smile as SmileIcon,
  X as XIcon,
} from "lucide-vue-next";
import type { AuthUser } from "../services/auth";
import FilePreview from './FilePreview.vue';
import GifPicker from './GifPicker.vue';

const props = defineProps<{
  currentUser: AuthUser | null;
  currentChatId: string;
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
  showEmojiPicker.value = false;
};

// Update the insertGif function
const selectAndSendGif = (url: string) => {
  if (!props.currentUser) return;

  const message: ChatPayload = {
    action: 'sendMessage',
    senderId: props.currentUser.id,
    roomId: props.currentChatId,
    timestamp: Date.now(),
    imageFiles: [url]
  };

  showGifPicker.value = false;
  emit('sendMessage', message);
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
    action: "sendMessage",
    senderId: props.currentUser.id,
    roomId: props.currentChatId,
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

  emit('sendMessage', message);
  messageInput.value = '';
  selectedFile.value = null;
  selectedVideoFile.value = null;
  selectedAudioFile.value = null;
  audioRecording.value = null;
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
            @input="autoResize" @keydown.enter.exact.prevent="sendMessage" ref="textareaRef"></textarea>
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

        <!-- GIF Picker -->
        <div v-if="showGifPicker" class="absolute bottom-20 right-0 z-50">
          <div class="fixed inset-0" @click="showGifPicker = false"></div>
          <div class="relative">
            <GifPicker :isDarkMode="isDarkMode" @select="selectAndSendGif" />
          </div>
        </div>
      </div>
    </form>
  </div>
</template>
