<script setup lang="ts">
// No imports needed as router-view is globally available
import NotificationContainer from './components/NotificationContainer.vue'
</script>

<template>
  <main>
    <router-view></router-view>
    <NotificationContainer />
  </main>
</template>