<script setup lang="ts">
import { BellIcon, BellOffIcon, CheckCircleIcon, Loader2Icon, XCircleIcon } from 'lucide-vue-next';
import { onMounted, ref } from "vue";
import { useAuth } from "../composables/useAuth";
import { useNotification } from "../composables/useNotification";
import { usePushNotification } from "../composables/usePushNotification";

const { isSupported, token, requestPermission, unsubscribe, testPushNotification, checkNotificationPermission, initialize, isLoading, isRegistering } = usePushNotification()
const notification = useNotification()
const permissionStatus = ref<NotificationPermission | 'unsupported'>('default')
const { user } = useAuth()

console.log('token', token.value)

async function checkPermission() {
  permissionStatus.value = await checkNotificationPermission()
}

async function toggleNotifications() {
  console.log('token', token.value)
  try {
    if (token.value) {
      await unsubscribe()
    } else {
      // Check current permission status first
      const currentPermission = await checkNotificationPermission()

      if (currentPermission === "denied") {
        notification.info(
          "It looks like notifications are currently blocked. To enable them, please click the lock/info icon in your browser's address bar and allow notifications for this site."
        )
        return
      }

      // notification.info(
      //   "You'll need to allow notifications in your browser settings to receive updates about new messages. Click 'Allow' when prompted!"
      // )

      const permission = await requestPermission();

      if (permission === "granted") {
        // Initialize push notifications
        const success = await initialize(user.value?.id || '');
        if (success) {
          notification.success("Notifications enabled successfully!");
        } else {
          notification.error("Failed to enable notifications. Please try again.");
        }
      } else {
        notification.error("Permission to send notifications was denied");
      }
    }
  } catch (error) {
    console.error('Error toggling notifications:', error)
    notification.error('Failed to toggle push notifications')
  }
}

async function sendTestNotification() {
  try {
    await testPushNotification()
  } catch (error) {
    console.error('Error sending test notification:', error)
  }
}

onMounted(() => {
  checkPermission()
})
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
            {{ token
              ? 'You will receive notifications for new messages'
              : 'Click to enable browser notifications'
            }}
          </p>
        </div>
        <button @click="toggleNotifications"
          class="px-4 py-2 rounded-md transition-colors flex items-center gap-2 min-w-[120px] justify-center"
          :disabled="isLoading || isRegistering" :class="[
            token
              ? 'bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900 dark:text-red-300 dark:hover:bg-red-800'
              : 'bg-blue-100 text-blue-700 hover:bg-blue-200 dark:bg-blue-900 dark:text-blue-300 dark:hover:bg-blue-800',
            (isLoading || isRegistering) && 'opacity-75 cursor-not-allowed'
          ]">
          <Loader2Icon v-if="isLoading || isRegistering" class="w-4 h-4 animate-spin" />
          <BellIcon v-else-if="!token" class="w-4 h-4" />
          <BellOffIcon v-else class="w-4 h-4" />
          {{ isLoading ? 'Disabling...' : isRegistering ? 'Enabling...' : token ? 'Disable' : 'Enable' }}
        </button>
      </div>

      <div v-if="token" class="space-y-4">
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
            :disabled="isLoading || isRegistering">
            <BellIcon class="w-4 h-4" />
            Send Test Notification
          </button>
        </div>
      </div>
    </div>
  </div>
</template>