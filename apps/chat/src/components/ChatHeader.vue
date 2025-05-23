<script setup lang="ts">
import { usePushNotification } from "@/composables/usePushNotification";
import { db } from "@/lib/dexie";
import { useAuth } from "@clerk/vue";
import type { Room } from "@hugin-bot/core/src/types";
import { BellIcon, LogOutIcon, MoonIcon, SunIcon, UserRoundPlusIcon } from "lucide-vue-next";
import { defineProps, onMounted, onUnmounted, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { version } from "../../package.json";
import InviteDialog from "../components/InviteDialog.vue";
import NotificationSettings from "../components/NotificationSettings.vue";
import { useTheme } from "../composables/useTheme";

const props = defineProps<{
  title: string;
  isOnline?: boolean;
  roomType?: Room["type"];
}>();

const isUserMenuOpen = ref(false);
const showNotificationSettings = ref(false);
const showInviteDialog = ref(false);

const router = useRouter();
const route = useRoute();
const { signOut } = useAuth();
const { isDarkMode, toggleTheme } = useTheme();
const { handleLogout: handleLogoutPushNotification } = usePushNotification();

const handleOutsideClick = (event: MouseEvent) => {
  const target = event.target as HTMLElement;
  if (isUserMenuOpen.value && !target.closest(".user-menu-container")) {
    isUserMenuOpen.value = false;
  }
};

const handleLogout = async () => {
  const messages = await db.messages.where("status").equals("unsent").count();

  if (messages > 0) {
    alert("You have unsent messages, these will be deleted when you log out. Do you want to continue?");
  }

  handleLogoutPushNotification();
  await signOut.value();
  isUserMenuOpen.value = false;
};

// Add event listener when component is mounted
onMounted(() => {
  document.addEventListener("click", handleOutsideClick);
});

// Remove event listener when component is unmounted
onUnmounted(() => {
  document.removeEventListener("click", handleOutsideClick);
});
</script>

<template>
  <div class="h-14 flex items-center justify-between px-2 bg-white dark:bg-gray-800">
    <div class="flex-1 flex items-center justify-between">
      <!-- back button-->
      <div class="flex">
        <button @click="router.push('/')" class="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700"
          :class="route.name === 'chat-list' ? 'invisible' : ''">
          <svg class="h-5 w-5 text-gray-700 dark:text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
              d="M15 12H3m0 0l4.5 4.5M3 12l4.5-4.5" />
          </svg>
        </button>
      </div>
      <div class="flex items-center space-x-2">
        <div class="flex flex-col">
          <h2 class="text-lg font-medium text-gray-900 dark:text-white">{{ title }}</h2>
        </div>
        <div v-if="isOnline !== undefined && route.name === 'chat'" class="flex items-center">
          <span class="inline-flex h-2 w-2 rounded-full mr-1" :class="isOnline ? 'bg-green-500' : 'bg-red-500'"></span>
        </div>
      </div>

      <!-- User actions -->
      <div class="flex items-center space-x-2">
        <!-- Dropdown menu -->
        <div class="relative user-menu-container">
          <button @click="isUserMenuOpen = !isUserMenuOpen"
            class="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700">
            <svg class="h-5 w-5 text-gray-700 dark:text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>

          <!-- Dropdown content -->
          <div v-if="isUserMenuOpen"
            class="absolute right-0 mt-2 w-48 rounded-md shadow-lg bg-white dark:bg-gray-800 ring-1 ring-black ring-opacity-5 dark:ring-gray-700 z-50">
            <div class="py-1">
              <!-- Notifications -->
              <button @click="showNotificationSettings = true; isUserMenuOpen = false"
                class="flex items-center w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700">
                <BellIcon class="h-5 w-5 mr-2 text-gray-500 dark:text-gray-300" />
                Notifications
              </button>

              <!-- Dark mode toggle -->
              <button @click="toggleTheme(); isUserMenuOpen = false"
                class="flex items-center w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700">
                <SunIcon v-if="isDarkMode" class="h-5 w-5 mr-2 text-amber-500" />
                <MoonIcon v-else class="h-5 w-5 mr-2 text-gray-500 dark:text-gray-300" />
                {{ isDarkMode ? 'Light Mode' : 'Dark Mode' }}
              </button>

              <button v-if="route.name === 'chat' && roomType === 'group'"
                @click="showInviteDialog = true; isUserMenuOpen = false"
                class="flex items-center w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700">
                <UserRoundPlusIcon class="h-5 w-5 mr-2 text-gray-500 dark:text-gray-300" />
                Invite People
              </button>

              <!-- Divider -->
              <hr class="my-1 border-gray-200 dark:border-gray-700">

              <!-- Logout -->
              <button @click="handleLogout"
                class="flex items-center w-full px-4 py-2 text-left text-sm text-red-500 dark:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-700">
                <LogOutIcon class="h-5 w-5 mr-2" />
                Logout
              </button>
              <div class="flex px-4 py-2">
                <span class="text-xs text-gray-400 dark:text-gray-500 -mt-1">Pearl Chat v{{ version }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
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

  <!-- Invite People Dialog -->
  <InviteDialog v-if="showInviteDialog" @close="showInviteDialog = false" />
</template>
