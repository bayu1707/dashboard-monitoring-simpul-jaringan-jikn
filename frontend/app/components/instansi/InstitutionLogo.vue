<script setup lang="ts">
import { ref } from 'vue';
import { Building2 } from '@lucide/vue';
defineProps<{ name: string; url: string | null }>();
const failedUrl = ref<string | null>(null);
</script>
<template>
  <span class="institution-logo"><img
      v-if="url && failedUrl !== url"
      :src="url"
      :alt="`Logo ${name}`"
      @error="failedUrl = url"
/><Building2
      v-else
      :size="28"
      aria-hidden="true"
  /></span>
</template>
