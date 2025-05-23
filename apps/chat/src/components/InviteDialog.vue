<script setup lang="ts">
import { useNotification } from '@/composables/useNotification';
import { useTrpc } from '@/composables/useTrpc';
import { MAX_BATCH_INVITES } from '@hugin-bot/core/src/config';
import { computed, ref } from 'vue';
import { useRoute } from 'vue-router';

const emit = defineEmits(['close']);
const route = useRoute();
const trpc = useTrpc();
const notification = useNotification();

const invites = ref(['', '']); // Start with 3 empty input fields
const maxInvites = MAX_BATCH_INVITES;
const isLoading = ref(false);

// Computed property for the Send Invites button's disabled state
const isSendButtonDisabled = computed(() => {
  return isLoading.value || invites.value.filter(email => email.trim() !== '').length === 0;
});

const addInviteField = () => {
  if (invites.value.length < maxInvites) {
    invites.value.push('');
  }
};

const removeInviteField = (index: number) => {
  invites.value.splice(index, 1);
};

const sendInvites = async () => {
  if (!route.params.roomId) {
    notification.error('No room ID found');
    return;
  }

  // Define validInvites within the function scope as it was originally
  const validInvites = invites.value.filter(email => email.trim() !== '');
  if (validInvites.length > 0) {
    isLoading.value = true;
    try {
      await trpc.user.invite.mutate({
        roomId: route.params.roomId as string,
        email: validInvites,
      });
      notification.success('Invites sent successfully');
      emit('close');
    } catch (error) {
      console.error(error);
      notification.error('Failed to send invites');
    } finally {
      isLoading.value = false;
    }
  } else {
    console.log('No valid email addresses to send.');
  }
};

const closeDialog = () => {
  emit('close');
};
</script>

<template>
  <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
    <div class="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-md mx-4">
      <button @click="closeDialog"
        class="sticky top-4 right-4 float-right p-1 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400 z-10">
        <span class="sr-only">Close</span>
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </button>
      <h3 class="text-lg font-medium text-gray-900 dark:text-white mb-6 pt-2">Invite People</h3>

      <form @submit.prevent="sendInvites">
        <div class="space-y-3 mb-6">
          <div v-for="(invite, index) in invites" :key="index" class="flex items-center space-x-2">
            <input type="email" autocomplete="off" v-model="invites[index]" :placeholder="`Email address ${index + 1}`"
              class="flex-grow p-2 text-sm border dark:border-gray-600 rounded-lg bg-transparent dark:text-primary-foreground focus:outline-none"
              :disabled="isLoading" />
            <button v-if="invites.length > 1" type="button" @click="removeInviteField(index)"
              class="p-2 text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700"
              title="Remove email" :disabled="isLoading">
              <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18 12H6" />
              </svg>
            </button>
            <div v-else class="w-9 h-9"></div> <!-- Placeholder to keep alignment -->
          </div>
        </div>

        <button v-if="invites.length < maxInvites" type="button" @click="addInviteField"
          class="w-full mb-4 flex items-center justify-center px-4 py-2 text-sm text-indigo-600 dark:text-indigo-400 border border-indigo-300 dark:border-indigo-500 rounded-md hover:bg-indigo-50 dark:hover:bg-gray-700"
          :disabled="isLoading">
          <svg class="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
          Add
        </button>

        <div class="flex justify-end space-x-3">
          <button type="button" @click="closeDialog"
            class="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-600"
            :disabled="isLoading">
            Cancel
          </button>
          <button type="submit"
            class="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 dark:focus:ring-offset-gray-800"
            :disabled="isSendButtonDisabled" :class="{ 'opacity-50 cursor-not-allowed': isSendButtonDisabled }">
            <span v-if="isLoading">Sending...</span>
            <span v-else>Send Invites</span>
          </button>
        </div>
      </form>
    </div>
  </div>
</template>