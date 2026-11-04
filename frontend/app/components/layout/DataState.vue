<script setup lang="ts">
import { AlertCircle, RefreshCw } from '@lucide/vue';
defineProps<{
  title: string;
  description?: string;
  compact?: boolean;
  retry?: boolean;
}>();
defineEmits<{ retry: [] }>();
</script>
<template>
  <div :class="['data-state', { compact }]" role="status">
    <AlertCircle :size="24" aria-hidden="true" />
    <div>
      <h2>{{ title }}</h2>
      <p v-if="description">{{ description }}</p>
      <button v-if="retry" class="button secondary" @click="$emit('retry')">
        <RefreshCw :size="16" />Coba lagi
      </button>
    </div>
  </div>
</template>
