<script lang="ts" setup>
import type { RouterOutput } from "@hugin-bot/functions/src/trpc";
import {
  Bot,
  LogOut as LogOutIcon,
  Moon as MoonIcon,
  MoreHorizontal as MoreHorizontalIcon,
  Sun as SunIcon,
} from "lucide-vue-next";
import { computed, ref } from 'vue';
import { useAuth } from '../composables/useAuth';
import { useTheme } from '../composables/useTheme';

const { isDarkMode, toggleTheme } = useTheme();
const { user: currentUser, isLoading: isAuthLoading, error: authError, signOut } = useAuth();

const props = defineProps<{
  currentChatId: string;
  rooms: RouterOutput["roomsWithLastMessage"];
  isMobileMenuOpen: boolean;
  isOnline: boolean;
}>();

const emit = defineEmits<{
  selectChat: [chatId: string];
  toggleMobileMenu: [];
  createNewAiChat: [];
}>();

const showUserMenu = ref(false);
const activeTab = ref<'people' | 'ai'>('ai');

// Filter chats based on active tab
const filteredChats = computed(() => {
  return props.rooms.filter(chat => {
    // Filter based on room type
    const isAiChat = chat.type === 'llm';
    return activeTab.value === 'ai' ? isAiChat : !isAiChat;
  });
});

// Handle chat selection
const handleChatSelect = (chatId: string) => {
  emit('selectChat', chatId);
};

// Handle new AI chat creation
const handleNewAiChat = () => {
  emit('createNewAiChat');
};

// Add logout handler
const handleLogout = async () => {
  try {
    await signOut();
  } catch (error) {
    console.error("Error logging out:", error);
  }
};
</script>

<template>
  <div class="relative w-64 h-full bg-white dark:bg-gray-800 shadow-lg flex flex-col">
    <!-- User section -->
    <div class="h-16 flex items-center justify-between px-4 border-b dark:border-gray-700">
      <div class="flex items-center space-x-3">
        <div class="relative">
          <img :src="currentUser?.avatar" alt="" class="h-8 w-8 rounded-full">
          <div class="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-white dark:border-gray-800"
            :class="isOnline ? 'bg-green-500' : 'bg-red-500'"></div>
        </div>
        <div>
          <div class="font-medium">{{ currentUser?.name }}</div>
          <div class="text-sm text-gray-500">{{ isOnline ? "Online" : "Offline" }}</div>
        </div>
      </div>
      <div class="relative">
        <button @click="showUserMenu = !showUserMenu" class="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full">
          <MoreHorizontalIcon class="h-5 w-5" />
        </button>
        <!-- User menu dropdown -->
        <div v-if="showUserMenu"
          class="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-md shadow-lg border dark:border-gray-700 z-50">
          <div class="py-1">
            <button @click="toggleTheme"
              class="flex w-full items-center px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700">
              <SunIcon v-if="isDarkMode" class="h-4 w-4 mr-2" />
              <MoonIcon v-else class="h-4 w-4 mr-2" />
              <span>{{ isDarkMode ? 'Light Mode' : 'Dark Mode' }}</span>
            </button>
            <button @click="handleLogout"
              class="flex w-full items-center px-4 py-2 text-sm text-red-600 hover:bg-gray-100 dark:hover:bg-gray-700">
              <LogOutIcon class="h-4 w-4 mr-2" />
              <span>Logout</span>
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Tabs -->
    <div class="flex border-b dark:border-gray-700">
      <!-- <button @click="activeTab = 'people'"
        class="flex-1 py-3 px-4 flex items-center justify-center space-x-2 text-sm font-medium"
        :class="activeTab === 'people' ? 'text-primary border-b-2 border-primary' : 'text-gray-500 dark:text-gray-400'">
        <UsersIcon class="h-4 w-4" />
        <span>People</span>
      </button> -->
      <!-- <button @click="activeTab = 'ai'"
        class="flex-1 py-3 px-4 flex items-center justify-center space-x-2 text-sm font-medium"
        :class="activeTab === 'ai' ? 'text-primary border-b-2 border-primary' : 'text-gray-500 dark:text-gray-400'">
        <Bot class="h-4 w-4" />
        <span>AI Chats</span>
      </button> -->
    </div>

    <!-- New Chat Button (only shown in AI tab) -->
    <div v-if="activeTab === 'ai'" class="p-4">
      <!-- <button @click="handleNewAiChat"
        class="w-full flex items-center justify-center space-x-2 px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary-dark rounded-lg transition-colors">
        <PlusIcon class="h-4 w-4" />
        <span>New Chat</span>
      </button> -->
    </div>

    <!-- Chat list -->
    <div class="flex-1 overflow-y-auto">
      <!-- <ChatList :rooms="filteredChats" :currentChatId="currentChatId" @select="handleChatSelect" /> -->
    </div>
  </div>
</template>