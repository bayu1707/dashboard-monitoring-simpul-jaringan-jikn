<script setup lang="ts">
import { computed } from 'vue';
import SiteHeader from './components/layout/SiteHeader.vue';
const { demo, pilot, mode } = useInstansiRepository();
const mapSearch = computed(() =>
  demo.value ? '?demo=1' : !pilot.value ? `?data=${mode.value}` : '',
);
</script>
<template>
  <SiteHeader :demo="demo" :pilot="pilot" :database="mode === 'sikn'" :development="mode === 'dev'" :map-search="mapSearch" /><NuxtPage
    :page-key="
      (route) =>
        String(route.query.demo ?? '') +
        ':' +
        String(route.query.data ?? '') +
        ':' +
        route.path
    "
  />
</template>
