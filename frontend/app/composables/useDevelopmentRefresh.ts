import { onMounted, onBeforeUnmount, ref, type Ref } from 'vue';

/** Poll revisi, bukan render ulang peta pada setiap interval. */
export function useDevelopmentRefresh(enabled: Ref<boolean>, revision: Ref<string | undefined>, refresh: () => Promise<void>) {
  const message = ref('');
  let timer: ReturnType<typeof setInterval> | undefined;
  let busy = false;
  async function check() {
    if (!enabled.value || busy || document.hidden) return;
    busy = true;
    try {
      const result = await $fetch<{ data: { revision: string } }>('/api/development/status');
      if (result.data.revision !== revision.value) await refresh();
      message.value = 'Data uji tersambung · pembaruan otomatis';
    } catch { message.value = 'Pembaruan data uji terputus; tampilan terakhir dipertahankan.'; }
    finally { busy = false; }
  }
  onMounted(() => { if (enabled.value) { void check(); timer = setInterval(() => { void check(); }, 3000); } });
  onBeforeUnmount(() => clearInterval(timer));
  return message;
}
