<script setup lang="ts">
import type { Bot } from "@/pages/Chat.vue";
import { useSession } from "@clerk/vue"
import type { ChatPayload } from "@hugin-bot/functions/src/types";
import DOMPurify from 'isomorphic-dompurify';
import { marked } from 'marked';
import { computed } from 'vue';
import type { AuthUser } from '../services/auth';

export type ChatPayloadUser = ChatPayload & {
  user?: {
    id: string;
    name: string;
    avatar: string;
    type: string;
  };
};

const props = defineProps<{
  message: ChatPayloadUser;
  index: number;
  currentUser: AuthUser;
  messages: ChatPayloadUser[];
  availableBots: Bot[]
}>();

const { session, isLoaded } = useSession();

const isUser = computed(() => {
  return props.currentUser.id === props.message.senderId;
});

// Check if this is the first message in a group from the same sender
const isFirstInGroup = computed(() => {
  if (props.index === 0) return true;
  const prevMessage = props.messages[props.index - 1];

  // Check if there's a timestamp break
  const timeDiff = props.message.timestamp - prevMessage.timestamp;
  const minutes = timeDiff / (1000 * 60);

  // Consider it a new group if:
  // - Different sender
  // - More than 2 hours gap
  // - Different day
  // - More than 15 minutes between messages
  if (prevMessage.senderId !== props.message.senderId) return true;

  const prevDate = new Date(prevMessage.timestamp).toDateString();
  const currentDate = new Date(props.message.timestamp).toDateString();
  if (prevDate !== currentDate) return true;

  if (minutes > 120) return true; // 2 hour gap
  return minutes > 15; // 15 minute gap
});

// Check if this is the last message in a group from the same sender
const isLastInGroup = computed(() => {
  if (props.index === props.messages.length - 1) return true;
  const nextMessage = props.messages[props.index + 1];

  // Check if there's a timestamp break
  const timeDiff = nextMessage.timestamp - props.message.timestamp;
  const minutes = timeDiff / (1000 * 60);

  // Consider it the end of a group if:
  // - Different sender
  // - More than 2 hours until next message
  // - Different day
  // - More than 15 minutes between messages
  if (nextMessage.senderId !== props.message.senderId) return true;

  const nextDate = new Date(nextMessage.timestamp).toDateString();
  const currentDate = new Date(props.message.timestamp).toDateString();
  if (nextDate !== currentDate) return true;

  if (minutes > 120) return true; // 2 hour gap
  return minutes > 15; // 15 minute gap
});

// Check if we should show a timestamp separator
const showTimestamp = computed(() => {
  if (props.index === 0) return true;
  const prevMessage = props.messages[props.index - 1];
  const timeDiff = props.message.timestamp - prevMessage.timestamp;

  // Show timestamp if:
  // - More than 15 minutes between messages
  // - First message of the day
  // - First message after a long gap (2 hours)
  const minutes = timeDiff / (1000 * 60);
  if (minutes > 120) return true; // Show after 2 hours gap

  const prevDate = new Date(prevMessage.timestamp).toDateString();
  const currentDate = new Date(props.message.timestamp).toDateString();
  if (prevDate !== currentDate) return true;

  return minutes > 15; // Show every 15 minutes
});

// Format relative time
const formatRelativeTime = (timestamp: number) => {
  const now = new Date();
  const date = new Date(timestamp);
  const diff = now.getTime() - timestamp;
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  // Within the same day, show time only
  if (days === 0) {
    return date.toLocaleTimeString([], {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    }).toLowerCase();
  }

  // Yesterday or older, show day and time
  if (days === 1) {
    return `Yesterday ${date.toLocaleTimeString([], {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    }).toLowerCase()}`;
  }

  if (days <= 7) {
    return `${date.toLocaleDateString([], { weekday: 'short' })} ${date.toLocaleTimeString([], {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    }).toLowerCase()}`;
  }

  // Older than a week, show full date and time
  return `${date.toLocaleDateString([], {
    month: 'short',
    day: 'numeric'
  })} ${date.toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  }).toLowerCase()}`;
};

// Format date for messages
const formatDate = (timestamp: number) => {
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
const formatTime = (timestamp: number) => {
  return new Date(timestamp).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
};

// Configure marked options for safe rendering
const renderer = new marked.Renderer();
marked.setOptions({
  renderer: renderer,
  gfm: true, // GitHub Flavored Markdown
  breaks: true // Convert line breaks to <br>
});

// Safely render markdown content
const renderMarkdown = computed(() => {
  if (!props.message.message) return '';
  // First sanitize the input
  const sanitizedInput = DOMPurify.sanitize(props.message.message);
  // Then render markdown and sanitize the output again
  const htmlContent = marked.parse(sanitizedInput, { async: false }) as string;
  return DOMPurify.sanitize(htmlContent);
});

</script>
<template>
  <!-- Message -->
  <div class="flex flex-col" :class="[
    { 'items-end': isUser },
    { 'items-start': !isUser },
    isFirstInGroup ? 'mt-4' : 'mt-0.5',
    isLastInGroup ? 'mb-4' : 'mb-0.5'
  ]">
    <!-- Timestamp separator -->
    <div v-if="showTimestamp" class="flex justify-center w-full my-2">
      <div class="px-3 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-[11px] text-gray-500 dark:text-gray-400">
        {{ formatRelativeTime(message.timestamp) }}
      </div>
    </div>

    <!-- Sender name (only show for first message in group) -->
    <div v-if="isFirstInGroup && !isUser" class="flex items-center mb-1" :class="[
      isUser ? 'mr-2' : 'ml-2'
    ]">
      <span class="text-xs text-gray-500 dark:text-gray-400">
        {{ message.user?.name || message.senderId }}
      </span>
    </div>

    <!-- Message bubble row -->
    <div class="flex items-end gap-2" :class="[
      isUser ? 'flex-row-reverse' : 'flex-row',
      isUser ? 'mr-2' : 'ml-2'
    ]">
      <!-- Avatar space (always present to maintain alignment) -->
      <div v-if="!isUser" class="flex-shrink-0 w-6">
        <!-- Show avatar for last message in group or after timestamp break -->
        <div v-if="isLastInGroup">
          <div class="relative">
            <img :src="message.user?.avatar" alt="" class="w-6 h-6 rounded-full" />
          </div>
        </div>
      </div>

      <!-- Message content -->
      <div class="max-w-[85vw] sm:max-w-[75vw] md:max-w-[65vw] lg:max-w-3xl rounded-lg px-2 py-1 group relative" :class="[
        isUser
          ? 'bg-primary text-primary-foreground'
          : 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white',
        // Adjust corners based on position in group
        isFirstInGroup ? 'rounded-lg' : '',
        !isFirstInGroup ? 'rounded-lg' : '',
        !isLastInGroup ? (isUser ? 'rounded-br-md' : 'rounded-bl-md') : ''
      ]" :title="new Date(message.timestamp).toLocaleString([], {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
        month: 'short',
        day: 'numeric',
        year: new Date(message.timestamp).getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined
      })">
        <!-- Message text -->
        <div v-if="message.message" class="text break-words prose dark:prose-invert max-w-none prose-sm"
          v-html="renderMarkdown"></div>

        <!-- Image/GIF files -->
        <div v-if="message.imageFiles && message.imageFiles.length > 0" class="space-y-1">
          <div v-for="(image, index) in message.imageFiles" :key="index" class="rounded-lg overflow-hidden">
            <img :src="image" class="max-w-[300px] max-h-[300px] object-contain rounded-lg" loading="lazy" />
          </div>
        </div>

        <!-- Video files -->
        <!-- <div v-if="message.videoFiles && message.videoFiles.length > 0" class="space-y-2">
          <div v-for="(video, index) in message.videoFiles" :key="index" class="rounded-lg overflow-hidden">
            <video controls preload="metadata" class="max-w-[300px] max-h-[300px] rounded-lg bg-black"
              :poster="video.thumbnail">
              <source :src="video.url" :type="video.type">
              Your browser does not support the video tag.
            </video>
          </div>
        </div> -->

        <!-- Audio files -->
        <!-- <div v-if="message.audioFiles && message.audioFiles.length > 0" class="space-y-2">
          <div v-for="(audio, index) in message.audioFiles" :key="index"
            class="flex items-center p-2 bg-gray-100 dark:bg-gray-700 rounded-lg">
            <audio controls preload="metadata" class="w-full h-8">
              <source :src="audio.url" :type="audio.type">
              Your browser does not support the audio element.
            </audio>
          </div>
        </div> -->

        <!-- File attachment -->
        <!-- <div v-if="message.attachment" class="mt-1.5 p-2 bg-gray-100 dark:bg-gray-700 rounded flex items-center">
          <FileIcon class="h-4 w-4 mr-2" />
          <span class="text-sm truncate flex-1">{{ message.attachment.name }}</span>
          <button class="text-primary text-sm">Download</button>
        </div> -->
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Add any component-specific styles here */
</style>