<script setup lang="ts">
import { computed } from 'vue';
import {
  Building2,
  CalendarDays,
  Hash,
  Mail,
  MapPin,
  Phone,
} from '@lucide/vue';
import type { Instansi } from '../../types/domain';
import { validEmail, validPhone } from '../../services/metrics';
import InstitutionLogo from './InstitutionLogo.vue';
const props = defineProps<{
  instansi: Instansi;
  jenisName: string | null;
  compact?: boolean;
}>();
const phoneHref = computed(
  () => `tel:${props.instansi.phone?.replace(/[\s().-]/g, '') ?? ''}`,
);
const emailHref = computed(() => `mailto:${encodeURIComponent(props.instansi.email ?? '')}`);
</script>
<template>
  <section class="detail-card profile-card" aria-labelledby="profile-title">
    <div class="profile-identity">
      <InstitutionLogo :name="instansi.name" :url="instansi.logoUrl" />
      <div>
        <p class="eyebrow">Simpul jaringan</p>
        <h1 id="profile-title">{{ instansi.name }}</h1>
        <span v-if="instansi.status !== null" class="status-badge"><span aria-hidden="true" class="status-dot" />{{
            instansi.status
          }}</span>
      </div>
    </div>
    <h2 class="detail-section-title">Informasi Instansi</h2>
    <dl class="profile-fields">
      <div v-if="instansi.address"><dt><MapPin :size="17" />Alamat</dt><dd>{{ instansi.address }}</dd></div>
      <div>
        <dt><Hash :size="17" />Kode</dt>
        <dd>{{ instansi.kode ?? 'Belum tersedia' }}</dd>
      </div>
      <div>
        <dt><Building2 :size="17" />Jenis instansi</dt>
        <dd>{{ jenisName ?? 'Belum tersedia' }}</dd>
      </div>
      <div v-if="!compact || instansi.email !== null || instansi.contactSource">
        <dt><Mail :size="17" />{{ instansi.contactSource ? 'Email instansi' : 'Email publik' }}</dt>
        <dd>
          <a
            v-if="validEmail(instansi.email)"
            :href="emailHref"
            >{{ instansi.email }}</a><template v-else>{{ instansi.email ?? 'Belum tersedia' }}</template>
        </dd>
      </div>
      <div v-if="!compact || instansi.phone !== null || instansi.contactSource">
        <dt><Phone :size="17" />{{ instansi.contactSource ? 'Telepon instansi' : 'Telepon publik' }}</dt>
        <dd>
          <a v-if="validPhone(instansi.phone)" :href="phoneHref">{{
            instansi.phone
          }}</a><template v-else>{{ instansi.phone ?? 'Belum tersedia' }}</template>
        </dd>
      </div>
      <div>
        <dt><MapPin :size="17" />Provinsi</dt>
        <dd>{{ instansi.provinceName ?? 'Belum terverifikasi' }}</dd>
      </div>
      <div>
        <dt><MapPin :size="17" />Kabupaten/Kota</dt>
        <dd>{{ instansi.kabKotaName ?? 'Belum terverifikasi' }}</dd>
      </div>
      <div>
        <dt><CalendarDays :size="17" />Tahun bergabung</dt>
        <dd>{{ instansi.joinedYear ?? 'Belum tersedia' }}</dd>
      </div>
      <div v-if="!compact || instansi.status !== null">
        <dt><Building2 :size="17" />Status simpul</dt>
        <dd>{{ instansi.status ?? 'Belum tersedia' }}</dd>
      </div>
    </dl>
    <p v-if="instansi.contactSource" class="detail-note contact-source">
      Sumber kontak: {{ instansi.contactSource }}. {{ instansi.contactNotes }}
    </p>
  </section>
</template>
