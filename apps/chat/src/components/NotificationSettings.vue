<script setup lang="ts">
import { useSession } from '@clerk/vue';
import { BellIcon, BellOffIcon, CheckCircleIcon, Loader2Icon, XCircleIcon } from 'lucide-vue-next';
import { useNotification } from "../composables/useNotification";
import { usePushNotification } from "../composables/usePushNotification";

const { isSupported, state, enableNotifications, disableNotifications, testPushNotification } = usePushNotification()
const notification = useNotification()
const { session } = useSession();

async function toggleNotifications() {
  if (!session.value?.user.id) {
    return
  }

  try {
    if (state.token) {
      await disableNotifications()
    } else {
      await enableNotifications();
    }
  } catch (error) {
    console.error('Error toggling notifications:', error)
    notification.error('Failed to toggle push notifications')
  }
}

async function sendTestNotification() {
  try {
    await testPushNotification(`Test push notification! ${new Date().toLocaleString()}`)
  } catch (error) {
    console.error('Error sending test notification:', error)
  }
}

</script>

<template>
  <div class="p-6 bg-white dark:bg-gray-800 rounded-lg shadow">
    <div class="flex items-center justify-between mb-6">
      <div>
        <h2 class="text-xl font-semibold dark:text-white">Notification Settings</h2>
        <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Manage how you receive notifications about new messages and reminders
        </p>
      </div>
      <!-- <div class="flex items-center gap-2">
        <span class="text-sm font-medium" :class="[
          token ? 'text-green-600 dark:text-green-400' : 'text-gray-500 dark:text-gray-400'
        ]">
          {{ token ? 'Notifications Enabled' : 'Notifications Disabled' }}
        </span>
      </div> -->
    </div>

    <div v-if="!isSupported"
      class="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
      <div class="flex items-start">
        <div class="flex-shrink-0">
          <XCircleIcon class="h-5 w-5 text-red-400" />
        </div>
        <div class="ml-3">
          <h3 class="text-sm font-medium text-red-800 dark:text-red-200">Browser Not Supported</h3>
          <p class="mt-1 text-sm text-red-700 dark:text-red-300">
            Push notifications are not supported in your browser. Please try using a modern browser like Chrome,
            Firefox, or Edge.
          </p>
        </div>
      </div>
    </div>

    <div v-else class="space-y-6">
      <div class="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
        <div class="flex items-start">
          <div class="flex-shrink-0">
            <BellIcon class="h-5 w-5 text-gray-400" />
          </div>
          <div class="ml-3">
            <h3 class="text-sm font-medium text-gray-900 dark:text-white">Push Notifications</h3>
            <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Get notified instantly when you receive new messages, even when the app is closed.
            </p>
          </div>
        </div>
      </div>

      <div class="flex items-center justify-between">
        <div>
          <h3 class="font-medium dark:text-white">Enable Notifications</h3>
          <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {{ state.token
              ? 'You will receive notifications for new messages'
              : 'Click to enable browser notifications'
            }}
          </p>
        </div>
        <button @click="toggleNotifications"
          class="px-4 py-2 rounded-md transition-colors flex items-center gap-2 min-w-[120px] justify-center"
          :disabled="state.isLoading || state.isRegistering" :class="[
            state.token
              ? 'bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900 dark:text-red-300 dark:hover:bg-red-800'
              : 'bg-blue-100 text-blue-700 hover:bg-blue-200 dark:bg-blue-900 dark:text-blue-300 dark:hover:bg-blue-800',
            (state.isLoading || state.isRegistering) && 'opacity-75 cursor-not-allowed'
          ]">
          <Loader2Icon v-if="state.isLoading || state.isRegistering" class="w-4 h-4 animate-spin" />
          <BellIcon v-else-if="!state.token" class="w-4 h-4" />
          <BellOffIcon v-else class="w-4 h-4" />
          {{ state.isLoading ? 'Disabling...' : state.isRegistering ? 'Enabling...' : state.token ? 'Disable' : 'Enable'
          }}
        </button>
      </div>

      <div v-if="state.token && !state.isLoading && !state.isRegistering" class="space-y-4">
        <div class="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
          <div class="flex items-start">
            <div class="flex-shrink-0">
              <CheckCircleIcon class="h-5 w-5 text-green-400" />
            </div>
            <div class="ml-3">
              <h3 class="text-sm font-medium text-green-800 dark:text-green-200">Notifications Active</h3>
              <p class="mt-1 text-sm text-green-700 dark:text-green-300">
                You will receive notifications for new messages
              </p>
            </div>
          </div>
        </div>

        <div class="flex gap-2">
          <button @click="sendTestNotification"
            class="px-4 py-2 rounded-md bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900 dark:text-green-300 dark:hover:bg-green-800 transition-colors flex items-center gap-2"
            :disabled="state.isLoading || state.isRegistering">
            <BellIcon class="w-4 h-4" />
            Send Test Notification
          </button>
        </div>
      </div>
    </div>
  </div>
</template>