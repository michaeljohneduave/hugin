<script setup lang="ts">
import type { RouterOutput } from "@hugin-bot/functions/src/trpc";
import { Bot, Hash, MessageSquare } from "lucide-vue-next";
import { ref } from "vue";

export type Chat = {
  roomId: string;
  userId: string;
  name?: string;
  type: "group" | "dm" | "llm";
  createdAt: number;
  updatedAt: number;
  user: {
    firstName: string;
    lastName: string;
    avatar: string;
  };
  lastMessage?: {
    messageId: string;
    userId: string;
    message?: string;
    imageFiles?: string[];
    videoFiles?: string[];
    audioFiles?: string[];
    createdAt: number;
    type: "llm" | "user" | "event";
  };
};

const props = defineProps<{
  currentChatId?: string;
  rooms: RouterOutput["roomsWithLastMessage"];
}>();

const emit = defineEmits<{
  select: [chatId: string]
}>();

function getLastMessagePreview(chat: Chat): string {
  if (!chat.lastMessage) return 'No messages yet';
  if (chat.lastMessage.message) return chat.lastMessage.message;
  if (chat.lastMessage.imageFiles?.length) return '📷 Image';
  if (chat.lastMessage.videoFiles?.length) return '🎥 Video';
  if (chat.lastMessage.audioFiles?.length) return '🎵 Audio';
  return 'No messages yet';
}

function getChatName(chat: Chat): string {
  if (chat.name) return chat.name;
  return `${chat.user.firstName} ${chat.user.lastName}`;
}

function formatRelativeTime(timestamp: number): string {
  const now = new Date();
  const date = new Date(timestamp);
  const diff = now.getTime() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 7) return date.toLocaleDateString();
  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return 'Just now';
}
</script>

<template>
  <ul role="list" class="divide-y divide-gray-200 dark:divide-gray-700">
    <li v-for="chat in rooms" :key="chat.roomId" @click="emit('select', chat.roomId)"
      class="flex gap-3 px-3 py-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800"
      :class="{ 'bg-gray-50 dark:bg-gray-800': chat.roomId === currentChatId }">
      <div class="flex-shrink-0 w-12 h-12 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
        <Hash v-if="chat.type === 'group'" class="w-6 h-6 text-gray-500 dark:text-gray-400" />
        <Bot v-else-if="chat.type === 'llm'" class="w-6 h-6 text-gray-500 dark:text-gray-400" />
        <MessageSquare v-else class="w-6 h-6 text-gray-500 dark:text-gray-400" />
      </div>
      <div class="flex-1 min-w-0">
        <div class="flex items-center justify-between">
          <p class="text-sm font-medium truncate">{{ getChatName(chat) }}</p>
          <p v-if="chat.lastMessage" class="text-xs text-gray-500 dark:text-gray-400">
            {{ formatRelativeTime(chat.lastMessage.createdAt) }}
          </p>
        </div>
        <p class="text-sm text-gray-500 dark:text-gray-400 truncate">
          {{ getLastMessagePreview(chat) }}
        </p>
      </div>
    </li>
  </ul>
</template>