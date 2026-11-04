<script setup lang="ts">
import { ref } from 'vue';
import { ExternalLink } from '@lucide/vue';
defineProps<{ demo: boolean; pilot: boolean; database?: boolean; development?: boolean; mapSearch: string }>();
const failed = ref(false);
</script>
<template>
  <a class="skip-link" href="#konten">Lewati ke konten</a>
  <header class="site-header">
    <div class="identity-row">
      <NuxtLink
        :to="`/simpul-jaringan${mapSearch}`"
        class="brand"
        aria-label="JIKN, kembali ke peta nasional"
      >
        <img
          v-if="!failed"
          class="anri-logo"
          src="/assets/logo-anri-symbol.png"
          alt="ANRI"
          @error="failed = true"
        /><span v-else class="anri-text">ANRI</span>
        <span class="brand-name">JARINGAN INFORMASI<br class="mobile-break" />
          KEARSIPAN NASIONAL</span>
      </NuxtLink>
      <div class="header-utility">
        <span v-if="development" class="demo-badge">DATA UJI</span>
        <span v-if="database" class="demo-badge">UJI DATABASE LOKAL</span>
        <span v-if="demo" class="demo-badge">DATA DEMO</span><span v-if="pilot" class="demo-badge">DATA SIMULASI</span><span class="language" aria-label="Bahasa antarmuka: Indonesia"><span class="country-flag" aria-hidden="true" />Indonesia</span><a
          href="https://www.anri.go.id/layanan-publik/sikn-dan-jikn"
          target="_blank"
          rel="noopener noreferrer"
          >Tentang JIKN <ExternalLink :size="13" /></a>
      </div>
    </div>
    <nav aria-label="Menu publik" class="public-nav">
      <span>Beranda</span><span>Deskripsi Arsip</span><span>Pameran Virtual</span><NuxtLink
        aria-current="page"
        class="active"
        :to="`/simpul-jaringan${mapSearch}`"
        >
Simpul Jaringan
</NuxtLink><span>Peta Kartografi</span><span>Layanan Akses</span><span>FAQ</span>
    </nav>
  </header>
</template>
