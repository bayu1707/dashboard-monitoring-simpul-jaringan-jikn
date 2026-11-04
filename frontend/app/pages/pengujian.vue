<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue';

interface Region { id: string; name: string; level: 'province' | 'kabKota'; province_id: string | null; origin: string }
interface Candidate { latitude: number; longitude: number; label: string; withinRegion: boolean; note: string; source: string }
interface Institution {
  id: string; external_source: string; external_id: string; name: string; province_id: string; regency_id: string | null;
  address: string; latitude: number | null; longitude: number | null; joined_year: number | null;
  email: string | null; phone: string | null;
  coordinate_source: string | null; coordinate_status: string; landing_page_url: string | null; landing_verified: boolean;
  geocode_status: string; geocode_candidates: Candidate[] | string; location_note: string; version: number;
}
const regions = ref<Region[]>([]);
const institutions = ref<Institution[]>([]);
const ready = ref(false);
const busy = ref(false);
const message = ref('');
const failure = ref('');
const geocoderConfigured = ref(false);
const editing = ref<string | null>(null);
const defaults = () => ({ externalSource: 'manual-test', externalId: '', name: '', provinceId: '', kabKotaId: '', address: '', email: '', phone: '',
  latitude: '' as string | number, longitude: '' as string | number, joinedYear: '' as string | number,
  landingPageUrl: '', landingVerified: false, coordinateSource: '', coordinateConfirmed: false, tryGeocoding: false, version: 1 });
const form = reactive(defaults());
const region = reactive({ id: '', name: '', level: 'kabKota' as 'province' | 'kabKota', provinceId: '' });
const provinces = computed(() => regions.value.filter(r => r.level === 'province'));
const cities = computed(() => regions.value.filter(r => r.level === 'kabKota' && r.province_id === form.provinceId));
watch(() => form.provinceId, () => { if (!cities.value.some(r => r.id === form.kabKotaId)) form.kabKotaId = ''; form.coordinateConfirmed = false; });
watch(() => form.kabKotaId, () => { form.coordinateConfirmed = false; });
async function load() {
  const [status, r, i] = await Promise.all([
    $fetch<{ data: { geocoderConfigured: boolean } }>('/api/development/status'),
    $fetch<{ data: Region[] }>('/api/development/regions'), $fetch<{ data: Institution[] }>('/api/development/institutions'),
  ]);
  regions.value = r.data; institutions.value = i.data; geocoderConfigured.value = status.data.geocoderConfigured; ready.value = true;
}
function errorText(reason: unknown) {
  const error = reason as { data?: { statusMessage?: string; data?: { errors?: Record<string, string[]> } }; message?: string };
  return Object.values(error.data?.data?.errors ?? {}).flat().join(' ') || error.data?.statusMessage || 'Layanan pengujian belum dapat diakses.';
}
async function action(task: () => Promise<void>) {
  busy.value = true; failure.value = ''; message.value = '';
  try { await task(); } catch (e) { failure.value = errorText(e); } finally { busy.value = false; }
}
function reset() { Object.assign(form, defaults()); editing.value = null; }
function edit(row: Institution) {
  editing.value = row.id;
  Object.assign(form, { externalSource: row.external_source, externalId: row.external_id, name: row.name, provinceId: row.province_id,
    kabKotaId: row.regency_id ?? '', address: row.address, latitude: row.latitude ?? '', longitude: row.longitude ?? '',
    email: row.email ?? '', phone: row.phone ?? '',
    joinedYear: row.joined_year ?? '', landingPageUrl: row.landing_page_url ?? '', landingVerified: row.landing_verified,
    coordinateSource: row.coordinate_source ?? '', coordinateConfirmed: false, tryGeocoding: false, version: row.version });
  document.getElementById('institution-name')?.focus();
}
function number(value: string | number) { return value === '' ? null : Number(value); }
async function save(sync = false) {
  await action(async () => {
    const result = await $fetch<{ data: { id: string; message: string; note: string } }>(`/api/development/institutions${sync ? '/sync' : editing.value ? `/${editing.value}` : ''}`, {
      method: !sync && editing.value ? 'PUT' : 'POST', body: { ...form, latitude: number(form.latitude), longitude: number(form.longitude), joinedYear: number(form.joinedYear),
        email: form.email.trim() || null, phone: form.phone.trim() || null,
        kabKotaId: form.kabKotaId || null, landingPageUrl: form.landingPageUrl || null, coordinateSource: form.coordinateSource || null },
    });
    await load();
    const saved = institutions.value.find(r => r.id === result.data.id);
    if (saved) edit(saved);
    message.value = `${result.data.message} ${result.data.note} Peta DATA UJI yang terbuka akan diperbarui otomatis.`;
  });
}
async function saveRegion() {
  await action(async () => {
    await $fetch('/api/development/regions', { method: 'POST', body: { ...region, provinceId: region.level === 'province' ? null : region.provinceId } });
    await load(); message.value = 'Wilayah uji tersimpan. Polygon tidak dibuat; pilih melalui dropdown atau daftar.';
  });
}
function candidates(row: Institution): Candidate[] { return typeof row.geocode_candidates === 'string' ? JSON.parse(row.geocode_candidates) as Candidate[] : row.geocode_candidates; }
function useCandidate(row: Institution, candidate: Candidate) {
  edit(row); form.latitude = candidate.latitude; form.longitude = candidate.longitude; form.coordinateSource = candidate.source; form.coordinateConfirmed = false;
  message.value = 'Kandidat diisikan ke formulir. Periksa lokasi kantor, lalu konfirmasi dan simpan jika benar.';
}
onMounted(() => { void action(load); });
</script>

<template>
  <main class="development-page">
    <header class="development-heading">
      <div><p class="eyebrow">Lingkungan development terpisah</p><h1>Pengujian wilayah dan simpul jaringan</h1></div>
      <div class="development-links"><NuxtLink to="/simpul-jaringan?data=dev" target="_blank">Buka peta DATA UJI ↗</NuxtLink><a href="http://127.0.0.1:8081" target="_blank" rel="noopener noreferrer">Adminer ↗</a></div>
    </header>
    <p class="development-notice">DATA UJI · Gunakan identitas dummy dan alamat publik. Data ini tidak ditulis ke SIKN. Marker memerlukan koordinat yang dikonfirmasi penguji dan lolos pemeriksaan wilayah.</p>
    <p v-if="message" role="status" class="development-success">{{ message }}</p><p v-if="failure" role="alert" class="development-error">{{ failure }} <button type="button" @click="action(load)">Coba lagi</button></p>
    <div v-if="ready" class="development-columns">
      <section class="detail-card">
<h2>{{ editing ? 'Edit instansi uji' : 'Tambah instansi uji' }}</h2>
        <form class="development-form" @submit.prevent="save()">
          <label>Sumber identifier<input v-model="form.externalSource" name="externalSource" required maxlength="40" pattern="[a-z0-9_\-]+" /></label>
          <label>Identifier stabil<input v-model="form.externalId" name="externalId" required maxlength="120" placeholder="uji-serang-001" /></label>
          <label class="full">Nama instansi<input id="institution-name" v-model="form.name" name="name" required maxlength="255" placeholder="Simpul Pengujian Serang" /></label>
          <label>Provinsi<select v-model="form.provinceId" name="provinceId" required><option value="">Pilih provinsi</option><option v-for="r in provinces" :key="r.id" :value="r.id">{{ r.name }}</option></select></label>
          <label>Kabupaten/kota<select v-model="form.kabKotaId" name="kabKotaId" :disabled="!form.provinceId"><option value="">Belum diketahui / tingkat provinsi</option><option v-for="r in cities" :key="r.id" :value="r.id">{{ r.name }}</option></select></label>
          <label class="full">Alamat lengkap<input v-model="form.address" name="address" required maxlength="1000" placeholder="Alamat kantor publik untuk pengujian" /></label>
          <label>Email instansi (opsional)<input v-model="form.email" name="email" type="email" maxlength="254" placeholder="simpul@example.invalid" /></label>
          <label>Telepon instansi (opsional)<input v-model="form.phone" name="phone" type="tel" maxlength="40" placeholder="Nomor kantor, bukan nomor pribadi PIC" /></label>
          <p class="full detail-note">Isi kontak yang diizinkan untuk pengujian. Kosongkan jika belum tersedia; tidak diambil dari akun pengguna atau nama PIC.</p>
          <label>Latitude<input v-model="form.latitude" name="latitude" type="number" step="any" min="-90" max="90" /></label>
          <label>Longitude<input v-model="form.longitude" name="longitude" type="number" step="any" min="-180" max="180" /></label>
          <label>Tahun bergabung<input v-model="form.joinedYear" name="joinedYear" type="number" min="1800" :max="new Date().getFullYear()" placeholder="Kosong jika belum diketahui" /></label>
          <label>Sumber koordinat<input v-model="form.coordinateSource" name="coordinateSource" type="url" placeholder="https://…" /></label>
          <label class="full check"><input v-model="form.coordinateConfirmed" name="coordinateConfirmed" type="checkbox" />Saya telah memeriksa bahwa titik ini merupakan lokasi kantor untuk pengujian.</label>
          <label class="full check"><input v-model="form.tryGeocoding" name="tryGeocoding" type="checkbox" />Jika koordinat kosong, coba geocoding alamat publik melalui provider yang dikonfigurasi.</label>
          <p class="full detail-note">{{ geocoderConfigured ? 'Provider tersedia. Kandidat tetap perlu verifikasi manual.' : 'Provider belum dikonfigurasi. Permintaan akan dicatat sebagai membutuhkan verifikasi; alamat tidak dikirim ke layanan luar.' }}</p>
          <label class="full">Landing Page JIKN<input v-model="form.landingPageUrl" name="landingPageUrl" type="url" placeholder="https://jikn.anri.go.id/deskripsi-arsip/sj/…" /></label>
          <label class="full check"><input v-model="form.landingVerified" name="landingVerified" type="checkbox" />Saya sudah memastikan tautan resmi tersebut milik instansi yang sama.</label>
          <div class="full development-actions"><button :disabled="busy" type="submit">{{ editing ? 'Simpan perubahan' : 'Simpan instansi uji' }}</button><button :disabled="busy || !form.externalId" type="button" @click="save(true)">Uji sinkron ulang</button><button :disabled="busy" type="button" @click="reset">Form baru</button></div>
        </form>
      </section>
      <section class="detail-card">
<h2>Tambah wilayah pengujian</h2><p class="detail-note">Referensi nasional sudah tersedia. Gunakan kode uji yang belum ada. Wilayah baru tidak otomatis menjadi wilayah resmi atau memiliki polygon.</p>
        <form class="development-form single" @submit.prevent="saveRegion">
          <label>Level wilayah<select v-model="region.level" name="regionLevel"><option value="kabKota">Kabupaten/kota</option><option value="province">Provinsi</option></select></label>
          <label v-if="region.level === 'kabKota'">Provinsi induk<select v-model="region.provinceId" name="regionProvince" required><option value="">Pilih provinsi</option><option v-for="r in provinces" :key="r.id" :value="r.id">{{ r.name }}</option></select></label>
          <label>Kode wilayah<input v-model="region.id" name="regionId" required :placeholder="region.level === 'province' ? '99' : '36.99'" /></label>
          <label>Nama wilayah<input v-model="region.name" name="regionName" required maxlength="255" placeholder="Kabupaten Pengujian" /></label>
          <button :disabled="busy" type="submit">Simpan wilayah uji</button>
        </form>
      </section>
    </div>
    <section v-if="ready" class="detail-card development-records">
<div class="development-heading"><h2>{{ institutions.length }} instansi pengujian</h2><button :disabled="busy" type="button" @click="action(load)">Muat ulang daftar</button></div>
      <p v-if="!institutions.length">Belum ada instansi uji. Tambahkan melalui formulir di atas.</p>
      <article v-for="row in institutions" :key="row.id" class="development-record" :data-dev-record="row.id">
        <h3>{{ row.name }}</h3><p>{{ row.external_source }} / {{ row.external_id }} · {{ row.coordinate_status }} · Geocoding: {{ row.geocode_status }}</p><p>{{ row.location_note }}</p>
        <div class="development-actions"><button type="button" @click="edit(row)">Edit {{ row.name }}</button><NuxtLink :to="`/simpul-jaringan/dev-${row.id}?data=dev`">Lihat detail</NuxtLink><NuxtLink :to="`/simpul-jaringan?data=dev&provinsi=${row.province_id}${row.regency_id ? `&kabKota=${row.regency_id}` : ''}`" target="_blank">Lihat wilayah di peta ↗</NuxtLink></div>
        <ul v-if="candidates(row).length"><li v-for="(c, index) in candidates(row)" :key="index">{{ c.label }} · {{ c.latitude }}, {{ c.longitude }} · {{ c.note }} <button type="button" @click="useCandidate(row, c)">Tinjau kandidat {{ index + 1 }}</button></li></ul>
      </article>
    </section>
  </main>
</template>

<style scoped>
.development-page{max-width:1300px;margin:0 auto;padding:28px;color:var(--color-text,#183352)}.development-heading,.development-links,.development-actions{display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap}.development-heading h1{font-size:25px;margin:8px 0}.development-links a,.development-actions a{color:#2456b9}.development-notice,.development-success,.development-error{padding:16px;border-radius:10px;line-height:1.6}.development-notice{background:#fff5d6}.development-success{background:#e4f6ee}.development-error{background:#fdeaea}.development-columns{display:grid;grid-template-columns:2fr 1fr;gap:20px;align-items:start}.development-form{display:grid;grid-template-columns:1fr 1fr;gap:15px}.development-form label{display:flex;flex-direction:column;gap:7px;font-size:14px}.development-form input,.development-form select{width:100%;min-height:42px;border:1px solid #cdd8e8;border-radius:7px;padding:10px;background:#fff;color:#183352}.development-form .check{flex-direction:row;align-items:flex-start;line-height:1.6}.check input{width:18px;min-height:18px;flex-shrink:0;margin-top:3px}.full{grid-column:1/-1}.single{grid-template-columns:1fr}.development-page button{padding:10px 15px;border:1px solid #c8d5e5;border-radius:7px;background:#f6f9fe;color:#244b97;cursor:pointer}.development-page button[type=submit]{background:#2459c4;color:#fff}.development-page button:disabled{opacity:.5;cursor:wait}.development-records{margin-top:20px}.development-record{padding:16px 0;border-top:1px solid #dde4ed;overflow-wrap:anywhere}.development-record h3{margin:8px 0}.development-record p{font-size:14px;line-height:1.6}.development-page :focus-visible{outline:3px solid #76a5f1;outline-offset:2px}@media(max-width:760px){.development-page{padding:16px}.development-columns,.development-form{grid-template-columns:1fr}.development-heading h1{font-size:21px}}
</style>
