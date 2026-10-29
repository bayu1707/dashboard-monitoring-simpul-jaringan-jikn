<script setup lang="ts">
import { computed, ref, watchEffect, onMounted } from 'vue';
import {
  ArrowLeft,
  CalendarDays,
  Database,
  Info,
  RefreshCw,
} from '@lucide/vue';
import { calculateContribution, formatMetric } from '../../services/metrics';
import { getReturnMapUrl } from '../../services/session';
import DataState from '../../components/layout/DataState.vue';
import ProfileCard from '../../components/instansi/ProfileCard.vue';
import StatisticCards from '../../components/instansi/StatisticCards.vue';
import TrendCard from '../../components/charts/TrendCard.vue';
import DistributionCard from '../../components/charts/DistributionCard.vue';
import CreatorsCard from '../../components/charts/CreatorsCard.vue';
const { repository, mode, demo, query } = useInstansiRepository();
const route = useRoute();
const id = computed(() => String(route.params.id ?? ''));
const { data, error, status, refresh } = await useAsyncData(
  `instansi:${mode.value}:${id.value}`,
  async () => {
    const [detail, references] = await Promise.all([
      repository.getInstansiDetail(id.value),
      repository.getReferenceData(),
    ]);
    return { detail, references };
  },
);
const detail = computed(() => data.value?.detail ?? null);
const instansi = computed(() => detail.value?.instansi ?? null);
const metadata = computed(() => detail.value?.metadata ?? null);
const statistik = computed(() => detail.value?.statistik ?? null);
const returnUrl = ref('/simpul-jaringan' + query.value);
watchEffect(() => {
  returnUrl.value = getReturnMapUrl(query.value, instansi.value ?? undefined);
});
onMounted(() => {
  returnUrl.value = getReturnMapUrl(query.value, instansi.value ?? undefined);
});
const simulation = computed(() => metadata.value?.datasetKind === 'pilot');
const developmentMessage = useDevelopmentRefresh(computed(() => mode.value === 'dev'), computed(() => metadata.value?.id), async () => { await refresh(); });
const jenisName = computed(
  () =>
    data.value?.references.jenisInstansi.find(
      (jenis) => jenis.id === instansi.value?.jenisId,
    )?.name ?? null,
);
const sampleTotal = computed(() => metadata.value?.sampleTotal?.value ?? null);
const contribution = computed(() => {
  if (!statistik.value || !metadata.value) return null;
  if (simulation.value)
    return sampleTotal.value !== null &&
      sampleTotal.value > 0 &&
      statistik.value.jumlahArsip.value !== null
      ? (statistik.value.jumlahArsip.value / sampleTotal.value) * 100
      : null;
  return calculateContribution(statistik.value.jumlahArsip, metadata.value);
});
const monthlyAdded = computed(() =>
  detail.value?.monthlyAdded &&
  detail.value.monthlyAdded.yearMonth ===
    metadata.value?.referenceDate.slice(0, 7)
    ? detail.value.monthlyAdded
    : null,
);
const dateFormatter = new Intl.DateTimeFormat('id-ID', {
  dateStyle: 'long',
  timeZone: 'Asia/Jakarta',
});
const timeFormatter = new Intl.DateTimeFormat('id-ID', {
  dateStyle: 'long',
  timeStyle: 'short',
  timeZone: 'Asia/Jakarta',
});
function date(value: string) {
  return Number.isFinite(Date.parse(value))
    ? dateFormatter.format(new Date(value))
    : 'Belum tersedia';
}
function time(value: string) {
  return Number.isFinite(Date.parse(value))
    ? `${timeFormatter.format(new Date(value))} WIB`
    : 'Belum tersedia';
}
function sourceLink(source: string) {
  try {
    const url = new URL(source);
    return ['http:', 'https:'].includes(url.protocol) ? url.href : null;
  } catch {
    return null;
  }
}
const coordinateLink = computed(() =>
  sourceLink(instansi.value?.coordinateSource ?? ''),
);
</script>
<template>
  <main id="konten" tabindex="-1" class="detail-page">
    <nav v-if="instansi" class="detail-breadcrumb" aria-label="Breadcrumb">
      <NuxtLink :to="returnUrl">Simpul Jaringan</NuxtLink><span aria-hidden="true">/</span><span>{{ instansi.provinceName ?? 'Provinsi belum terverifikasi' }}</span><span aria-hidden="true">/</span><span>{{
        instansi.kabKotaName ?? 'Kabupaten/kota belum terverifikasi'
      }}</span><span aria-hidden="true">/</span><span aria-current="page">{{ instansi.name }}</span>
    </nav>
    <NuxtLink class="back-to-map" :to="returnUrl">
<ArrowLeft :size="18" aria-hidden="true" />Kembali ke Peta
</NuxtLink>
    <DataState
      v-if="status === 'pending' && !data"
      title="Memuat profil simpul…"
      description="Membaca snapshot melalui API Laravel."
    />
    <DataState
      v-else-if="error"
      title="Data belum dapat dimuat"
      :description="error.message"
      retry
      @retry="refresh()"
    />
    <template v-else-if="!detail || !instansi || !metadata || !statistik">
<p v-if="demo" class="detail-demo-label">
        DATA DEMO · Instansi sintetis untuk latihan
      </p>
      <DataState
        title="Simpul tidak ditemukan"
        description="ID instansi tidak terdapat dalam snapshot yang dimuat. Kembali ke peta untuk memilih simpul lain."
    />
</template>
    <template v-else>
      <p v-if="demo" class="detail-demo-label">
        DATA DEMO · Instansi dan statistik sintetis untuk latihan, bukan data
        ANRI.
      </p>
      <p v-if="metadata.datasetKind === 'excel'" class="detail-snapshot-label">
        Snapshot Excel · Data Pengelolaan Casefile. Tahun bergabung berasal dari
        Excel; data ini bukan sinkronisasi API SIKN.
      </p>
      <p v-if="metadata.datasetKind === 'development'" class="detail-snapshot-label">DATA UJI · Bukan simpul resmi SIKN/JIKN. {{ developmentMessage }}</p>
      <p v-if="simulation" class="detail-snapshot-label">
        <strong>DATA SIMULASI</strong> · Nama dan tahun bergabung dari Excel.
        {{
          instansi.coordinates
            ? 'Pin kantor dicocokkan dengan sumber publik yang dicatat per instansi.'
            : 'Pin kantor belum dapat dipastikan; instansi tersedia melalui daftar.'
        }}
        Statistik dan grafik adalah contoh, bukan data resmi JIKN.
      </p>
      <p v-if="metadata.datasetKind === 'database'" class="detail-snapshot-label">
        <strong>UJI LOKAL · DATABASE SIKN MARET 2026</strong> · Statistik dibaca
        dari salinan database, bukan API vendor atau data real time. Tahun dari
        Excel dan pin dari kurasi sebelumnya. Angka ini bukan total arsip publik.
      </p>
      <div class="detail-columns">
        <div class="detail-left">
          <ProfileCard
            :instansi="instansi"
            :jenis-name="jenisName"
            :compact="simulation"
          />
          <StatisticCards :statistik="statistik" :simulation="simulation" :database="metadata.datasetKind === 'database'" />
          <section
            class="detail-card contribution-card"
            aria-labelledby="contribution-title"
          >
            <h2 id="contribution-title" class="detail-section-title">
              <Database :size="20" aria-hidden="true" />{{
                simulation
                  ? 'Kontribusi pada percontohan'
                  : 'Kontribusi terhadap JIKN'
              }}<span v-if="simulation" class="simulation-label">SIMULASI</span>
            </h2>
            <template v-if="contribution === null">
<strong class="empty-metric">Belum tersedia</strong>
              <p class="detail-note">
                Persentase memerlukan total nasional dengan definisi, cakupan,
                tanggal acuan, dan snapshot yang cocok. Sampel parsial tidak
                digunakan sebagai total nasional.
              </p>
</template><template v-else>
<div class="contribution-value">
                <strong>{{
                    new Intl.NumberFormat('id-ID', {
                      maximumFractionDigits: 2,
                    }).format(contribution)
                  }}%</strong><span>{{
                  simulation
                    ? 'dari total arsip simulasi pada sampel ini'
                    : 'dari total arsip JIKN pada snapshot ini'
                }}</span>
              </div>
              <div class="contribution-track" aria-hidden="true">
                <span :style="{ width: `${Math.min(contribution, 100)}%` }" />
              </div>
              <p class="detail-note">
                {{ formatMetric(statistik.jumlahArsip.value) }} dari
                {{
                  formatMetric(
                    simulation
                      ? sampleTotal
                      : (metadata.nationalTotal?.value ?? null),
                  )
                }}
                arsip{{ simulation ? ' simulasi' : '' }}. Tanggal acuan:
                {{ date(metadata.referenceDate) }}.
              </p>
</template>
          </section>
          <section class="detail-card" aria-labelledby="update-title">
            <h2 id="update-title" class="detail-section-title">
              <RefreshCw :size="20" aria-hidden="true" />Pembaruan Data<span
                v-if="simulation"
                class="simulation-label"
                >PERCONTOHAN</span>
            </h2>
            <dl class="update-fields">
              <div>
                <dt><CalendarDays :size="17" />Pembaruan sumber</dt>
                <dd>
                  {{
                    instansi.sourceUpdatedAt === null
                      ? 'Belum tersedia'
                      : date(instansi.sourceUpdatedAt)
                  }}
                </dd>
              </div>
              <div>
                <dt><Database :size="17" />Snapshot diambil</dt>
                <dd>{{ time(metadata.capturedAt) }}</dd>
              </div>
              <div v-if="monthlyAdded">
                <dt>
                  <CalendarDays :size="17" />Record ditambahkan bulan acuan
                </dt>
                <dd>
                  {{ formatMetric(monthlyAdded.count) }} ·
                  {{ monthlyAdded.yearMonth }}
                </dd>
              </div>
            </dl>
            <p class="detail-note">
              Informasi berasal dari snapshot dan bukan pemantauan real time.
            </p>
          </section>
        </div>
        <div class="detail-right">
          <TrendCard
            :key="`tren-${instansi.id}`"
            :series="detail.trenInput"
            :reference-date="metadata.referenceDate"
            :simulation="simulation"
          /><DistributionCard
            :series="detail.distribusiArsip"
            :total-arsip="statistik.jumlahArsip.value"
            :simulation="simulation"
          /><CreatorsCard
            :key="`pencipta-${instansi.id}`"
            :creators="detail.penciptaArsip"
            :multi-creator="detail.multiCreator"
            :simulation="simulation"
          />
          <section
            class="detail-card source-card"
            aria-labelledby="source-title"
          >
            <h2 id="source-title" class="detail-section-title">
              <Info :size="20" />Catatan Sumber
            </h2>
            <p>
              {{
                metadata.coverageDescription ??
                (metadata.coverage === 'full'
                  ? 'Cakupan snapshot: penuh menurut deklarasi sumber.'
                  : 'Cakupan snapshot: parsial. Data ini tidak mewakili total seluruh simpul JIKN.')
              }}
            </p>
            <p v-if="instansi.joinedYearSource">
              Sumber tahun bergabung: {{ instansi.joinedYearSource }}.
            </p>
            <p v-if="instansi.locationVerificationNotes">
              Verifikasi lokasi: {{ instansi.locationVerificationNotes }}
            </p>
            <p v-if="coordinateLink">
              Lokasi kantor:
              <a
                :href="coordinateLink"
                target="_blank"
                rel="noopener noreferrer"
                >{{
                  simulation &&
                  (!instansi.coordinatesVerificationMethod ||
                    instansi.coordinatesVerificationMethod ===
                      'google-maps-place')
                    ? 'Lihat pin Google Maps'
                    : 'Sumber koordinat'
                }}</a>.<template v-if="instansi.coordinatesVerifiedAt">
                Diperiksa {{ time(instansi.coordinatesVerifiedAt) }}.
</template><template
                v-if="!simulation && instansi.coordinatesVerificationNotes"
              >
                {{ instansi.coordinatesVerificationNotes }}
</template>
            </p>
            <p v-if="instansi.coordinateLocationLabel">
              Titik yang ditampilkan: {{ instansi.coordinateLocationLabel }}.
            </p>
            <details :open="!simulation">
              <summary>Referensi dan catatan verifikasi</summary>
              <ul class="source-list">
                <li v-for="source in metadata.sources" :key="source">
                  <a
                    v-if="sourceLink(source)"
                    :href="sourceLink(source)!"
                    target="_blank"
                    rel="noopener noreferrer"
                    >{{ source }}</a><template v-else>{{ source }}</template>
                </li>
              </ul>
              <ul
                v-if="metadata.verificationNotes.length"
                class="verification-notes"
              >
                <li
                  v-for="(note, index) in metadata.verificationNotes"
                  :key="`${index}-${note}`"
                >
                  {{ note }}
                </li>
              </ul>
            </details>
            <p class="detail-note">
              Snapshot {{ metadata.id }} · diambil
              {{ time(metadata.capturedAt) }}. Nilai yang belum diketahui tetap
              ditampilkan sebagai Belum tersedia.
            </p>
          </section>
        </div>
      </div>
    </template>
  </main>
</template>
