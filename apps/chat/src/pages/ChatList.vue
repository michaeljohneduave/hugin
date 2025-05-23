<script setup lang="ts">
import { useRooms } from '@/composables/useSync';
import { formatRelativeTime } from '@/lib/utils';
import type { RoomWithLastMessage } from '@hugin-bot/core/src/types';
import { Bot, MessageSquare, Users, X } from 'lucide-vue-next';
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import ChatHeader from "../components/ChatHeader.vue";
const router = useRouter();
const { rooms } = useRooms();
const showNewChatMenu = ref(false);

const getRoomDisplayName = (room: RoomWithLastMessage) => {
  if (room.name) return room.name;
  // if (room.type === 'dm') return `${room.user.firstName} ${room.user.lastName}`;
  return room.roomId.split('-')[0];
};

const handleNewChat = (type: 'dm' | 'group' | 'llm') => {
  showNewChatMenu.value = false;
  switch (type) {
    case "dm":
      break;
    case "group":
      break;
    case "llm": {
      router.push("/chat/new?type=llm");
      break;
    }
  }
};

const handleRoomClick = (roomId: string) => {
  router.push(`/chat/${roomId}`);
};

// Handle click outside to close menu
const handleClickOutside = (event: MouseEvent) => {
  const target = event.target as HTMLElement;
  if (!target.closest('.new-chat-menu') && !target.closest('.new-chat-button')) {
    showNewChatMenu.value = false;
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
  <div class="h-full flex flex-col bg-background dark:bg-gray-800">
    <!-- Header -->
    <ChatHeader title="Pearl Chat" />

    <!-- Room List -->
    <div class="flex-1 overflow-y-auto">
      <div v-if="rooms.length === 0" class="flex items-center justify-center h-full">
        <div class="flex flex-col items-center text-gray-500 dark:text-gray-400">
          <svg class="animate-spin h-8 w-8 mb-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z">
            </path>
          </svg>
          <p>Loading chat rooms...</p>
        </div>
      </div>
      <template v-for="room in rooms" :key="room.roomId">
        <div
          class="p-4 border-b dark:bg-primary border-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 active:bg-gray-100 dark:active:bg-gray-700 cursor-pointer transition-colors"
          @click="handleRoomClick(room.roomId)">
          <div class="flex items-center justify-between">
            <div class="flex items-center space-x-3 min-w-0">
              <!-- Room avatar/icon based on type -->
              <div
                class="flex-shrink-0 w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
                <span class="text-lg font-medium">
                  {{ room.type === 'group' ? '👥' : room.type === 'llm' ? '🤖' : '👤' }}
                </span>
              </div>
              <div class="min-w-0 flex-1">
                <p class="text-primary dark:text-white font-medium truncate">{{ getRoomDisplayName(room) }}</p>
                <p v-if="room.lastMessageUser" class="text-sm text-gray-500 truncate">
                  {{ room.lastMessageUser.name }}: {{ room.lastMessage }}
                </p>
              </div>
            </div>
            <div v-if="room.lastMessageAt" class="flex-shrink-0 text-sm text-gray-500 ml-2">
              {{ formatRelativeTime(room.lastMessageAt || 0) }}
            </div>
          </div>
        </div>
      </template>
    </div>

    <!-- Floating Action Button -->
    <div class="fixed fab-bottom fab-right z-50">
      <button
        class="new-chat-button h-14 w-14 rounded-full bg-primary text-white shadow-lg hover:bg-primary/90 active:bg-primary/80 transition-colors flex items-center justify-center"
        @click="showNewChatMenu = !showNewChatMenu">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
        </svg>
      </button>

      <!-- New Chat Menu - Positioned above FAB -->
      <div v-if="showNewChatMenu"
        class="new-chat-menu absolute bottom-16 right-0 w-48 rounded-lg shadow-lg bg-white dark:bg-gray-800 ring-1 ring-black ring-opacity-5 transform transition-all duration-200 ease-out origin-bottom-right">
        <!-- Menu options -->
        <div class="py-1">
          <!-- <button @click="handleNewChat('dm')"
            class="flex w-full items-center px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700">
            <MessageSquare class="h-4 w-4 mr-3" />
            Direct Message
          </button>
          <button @click="handleNewChat('group')"
            class="flex w-full items-center px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700">
            <Users class="h-4 w-4 mr-3" />
            Group Chat
          </button> -->
          <button @click="handleNewChat('llm')"
            class="flex w-full items-center px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700">
            <Bot class="h-4 w-4 mr-3" />
            AI Chat
          </button>
        </div>
      </div>

      <!-- Mobile full screen menu -->
      <!-- <div v-if="showNewChatMenu" class="fixed inset-0 bg-black/50 z-[-1] sm:hidden" @click="showNewChatMenu = false">
        <div class="fixed bottom-0 inset-x-0 bg-white dark:bg-gray-800 rounded-t-xl p-4">
          <div class="flex items-center justify-between mb-4">
            <h2 class="text-lg font-semibold">New Chat</h2>
            <button @click="showNewChatMenu = false" class="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700">
              <X class="h-5 w-5" />
            </button>
          </div>
          <div class="space-y-2">
            <button @click="handleNewChat('dm')"
              class="flex w-full items-center px-4 py-3 text-base rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700">
              <MessageSquare class="h-5 w-5 mr-3" />
              Direct Message
            </button>
            <button @click="handleNewChat('group')"
              class="flex w-full items-center px-4 py-3 text-base rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700">
              <Users class="h-5 w-5 mr-3" />
              Group Chat
            </button>
            <button @click="handleNewChat('llm')"
              class="flex w-full items-center px-4 py-3 text-base rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700">
              <Bot class="h-5 w-5 mr-3" />
              AI Chat
            </button>
          </div>
        </div>
      </div> -->
    </div>
  </div>
</template>

<style scoped>
.fab-bottom {
  bottom: calc(env(safe-area-inset-bottom) + var(--spacing) * 8);
}

.fab-right {
  right: calc(env(safe-area-inset-right) + var(--spacing) * 8);
}
</style>