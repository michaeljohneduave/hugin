<script setup lang="ts">
import {
  AlertTriangleIcon,
  CheckCircleIcon,
  InfoIcon,
  XCircleIcon,
  XIcon,
} from 'lucide-vue-next'
import { useNotification } from '../composables/useNotification'

const { notifications, remove } = useNotification()

const getIcon = (type: string) => {
  switch (type) {
    case 'success':
      return CheckCircleIcon
    case 'error':
      return XCircleIcon
    case 'info':
      return InfoIcon
    case 'warning':
      return AlertTriangleIcon
    default:
      return InfoIcon
  }
}

const getNotificationClasses = (type: string) => {
  switch (type) {
    case 'success':
      return 'bg-green-50 border-green-200'
    case 'error':
      return 'bg-red-50 border-red-200'
    case 'info':
      return 'bg-blue-50 border-blue-200'
    case 'warning':
      return 'bg-yellow-50 border-yellow-200'
    default:
      return 'bg-gray-50 border-gray-200'
  }
}

const getIconClasses = (type: string) => {
  switch (type) {
    case 'success':
      return 'text-green-400'
    case 'error':
      return 'text-red-400'
    case 'info':
      return 'text-blue-400'
    case 'warning':
      return 'text-yellow-400'
    default:
      return 'text-gray-400'
  }
}
</script>

<!-- NotificationContainer.vue -->
<template>
  <div class="fixed top-4 right-4 z-50 space-y-2 w-[320px] max-w-[420px]">
    <TransitionGroup enter-active-class="transition duration-300 ease-out"
      enter-from-class="transform translate-x-full opacity-0" enter-to-class="transform translate-x-0 opacity-100"
      leave-active-class="transition duration-200 ease-in" leave-from-class="transform translate-x-0 opacity-100"
      leave-to-class="transform translate-x-full opacity-0">
      <div v-for="notification in notifications" :key="notification.id"
        class="flex items-start p-4 rounded-lg shadow-lg border w-full cursor-pointer"
        :class="[getNotificationClasses(notification.type)]" role="alert" @click="() => {
          notification.onClick?.();
          remove(notification.id);
        }">
        <div class="flex-shrink-0 mr-3">
          <component :is="getIcon(notification.type)" class="w-5 h-5" :class="[getIconClasses(notification.type)]" />
        </div>
        <div class="flex-1 mr-2">
          <h3 v-if="notification.title" class="font-semibold text-sm">
            {{ notification.title }}
          </h3>
          <p class="text-sm" :class="{ 'mt-1': notification.title }">
            {{ notification.message }}
          </p>
        </div>
        <button v-if="notification.closeable" @click="remove(notification.id)"
          class="flex-shrink-0 ml-4 text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 rounded">
          <XIcon class="w-4 h-4" />
        </button>
      </div>
    </TransitionGroup>
  </div>
</template>