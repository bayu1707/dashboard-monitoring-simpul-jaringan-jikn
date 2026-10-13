import type { ExplorationState, ReferenceData } from '../../types/domain';
import {
  RotateCcw,
  SlidersHorizontal,
  List,
  X,
  ChevronDown,
} from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import {
  selectProvince,
  selectKabKota,
  selectJenis,
} from '../../services/exploration';
interface Props {
  state: ExplorationState;
  references: ReferenceData;
  onChange: (value: ExplorationState) => void;
  onReset: () => void;
  onList: () => void;
  listOpen: boolean;
}
function FilterFields({
  state,
  references,
  onChange,
  prefix,
}: {
  state: ExplorationState;
  references: ReferenceData;
  onChange: (value: ExplorationState) => void;
  prefix: string;
}) {
  return (
    <>
      <label className="map-filter-field" htmlFor={`${prefix}-province`}>
        <span className="filter-label">Provinsi</span>
        <select
          id={`${prefix}-province`}
          title="Provinsi"
          value={state.provinceId ?? ''}
          onChange={(e) =>
            onChange(selectProvince(state, e.target.value || null, references))
          }
        >
          <option value="">Pilih Provinsi</option>
          {references.provinces.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <ChevronDown className="filter-chevron" size={17} aria-hidden="true" />
      </label>
      <label className="map-filter-field" htmlFor={`${prefix}-kabkota`}>
        <span className="filter-label">Kabupaten / Kota</span>
        <select
          id={`${prefix}-kabkota`}
          title="Kabupaten / Kota"
          disabled={!state.provinceId}
          value={state.kabKotaId ?? ''}
          onChange={(e) =>
            onChange(selectKabKota(state, e.target.value || null, references))
          }
        >
          <option value="">Pilih Kab/Kota</option>
          {references.kabKota
            .filter((p) => p.provinceId === state.provinceId)
            .map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
        </select>
        <ChevronDown className="filter-chevron" size={17} aria-hidden="true" />
      </label>
      <label className="map-filter-field" htmlFor={`${prefix}-jenis`}>
        <span className="filter-label">Jenis Instansi</span>
        <select
          id={`${prefix}-jenis`}
          title="Jenis Instansi"
          disabled={state.level !== 'instansi'}
          value={state.jenisId ?? ''}
          onChange={(e) =>
            onChange(selectJenis(state, e.target.value || null, references))
          }
        >
          <option value="">Semua Jenis</option>
          {references.jenisInstansi.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <ChevronDown className="filter-chevron" size={17} aria-hidden="true" />
      </label>
    </>
  );
}
export function MapFilters(props: Props) {
  const [sheet, setSheet] = useState(false);
  const [draft, setDraft] = useState(props.state);
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (sheet) dialog.current?.showModal();
    else dialog.current?.close();
  }, [sheet]);
  function open() {
    setDraft(props.state);
    setSheet(true);
  }
  function close() {
    setSheet(false);
    trigger.current?.focus();
  }
  function reset() {
    props.onReset();
    close();
  }
  return (
    <>
      <div className="map-toolbar" role="group" aria-label="Filter peta">
        <div className="desktop-filters">
          <FilterFields {...props} prefix="desktop" />
        </div>
        <button className="button mobile-filter" onClick={open} ref={trigger}>
          <SlidersHorizontal size={18} />
          Filter
        </button>
        <button
          className="button reset-button secondary"
          onClick={props.onReset}
          aria-label="Reset seluruh filter"
          title="Reset seluruh filter"
        >
          <RotateCcw size={18} />
          <span>Reset</span>
        </button>
        <button
          className={`button list-button ${props.listOpen ? 'selected' : 'secondary'}`}
          aria-label="Daftar"
          title={
            props.listOpen
              ? 'Tutup daftar wilayah atau instansi'
              : 'Buka daftar wilayah atau instansi'
          }
          aria-expanded={props.listOpen}
          onClick={props.onList}
        >
          <List size={18} />
          Daftar
        </button>
      </div>
      <dialog
        ref={dialog}
        className="filter-sheet"
        aria-labelledby="filter-title"
        onCancel={(e) => {
          e.preventDefault();
          close();
        }}
      >
        <div className="sheet-heading">
          <h2 id="filter-title">Filter wilayah</h2>
          <button
            className="icon-button"
            aria-label="Tutup filter dan buang perubahan"
            onClick={close}
          >
            <X size={20} />
          </button>
        </div>
        <p className="muted">
          Pilih provinsi untuk menjelajahi kabupaten/kota. Jenis instansi
          bersifat opsional.
        </p>
        <div className="sheet-fields">
          <FilterFields
            state={draft}
            references={props.references}
            onChange={setDraft}
            prefix="mobile"
          />
        </div>
        <div className="sheet-actions">
          <button className="button secondary" onClick={reset}>
            Reset
          </button>
          <button className="button secondary" onClick={close}>
            Batal
          </button>
          <button
            className="button"
            onClick={() => {
              props.onChange(draft);
              close();
            }}
          >
            Terapkan
          </button>
        </div>
      </dialog>
    </>
  );
}
