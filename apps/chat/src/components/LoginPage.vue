<script setup lang="ts">
import { SignIn } from "@clerk/vue";
</script>

<template>
  <div class="min-h-screen flex items-center justify-center bg-gray-50">
    <div class="max-w-md w-full space-y-8 p-8 bg-white rounded-lg shadow-lg">
      <div class="text-center">
        <h2 class="mt-6 text-3xl font-extrabold text-gray-900">
          Welcome to Pearl Chat
        </h2>
        <p class="mt-2 text-sm text-gray-600">
          Please sign in to continue
        </p>
      </div>
      <div class="mt-8">
        <SignIn />
      </div>
    </div>
  </div>
</template>