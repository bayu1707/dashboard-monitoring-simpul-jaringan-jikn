<?php

// Hanya dijalankan installer pada cluster development terpisah, bukan artisan migrate.
return <<<'SQL'
CREATE TABLE IF NOT EXISTS dev_meta (
    id integer PRIMARY KEY CHECK (id=1), revision bigint NOT NULL DEFAULT 1,
    updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO dev_meta(id) VALUES (1) ON CONFLICT DO NOTHING;
CREATE TABLE IF NOT EXISTS dev_regions (
    id varchar(5) PRIMARY KEY, name varchar(255) NOT NULL,
    level varchar(10) NOT NULL CHECK (level IN ('province','kabKota')),
    province_id varchar(2) REFERENCES dev_regions(id),
    origin varchar(10) NOT NULL CHECK (origin IN ('reference','testing')),
    created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE(province_id,id),
    CHECK ((level='province' AND id ~ '^[0-9]{2}$' AND province_id IS NULL)
        OR (level='kabKota' AND id ~ '^[0-9]{2}\.[0-9]{2}$' AND province_id=left(id,2)))
);
CREATE TABLE IF NOT EXISTS dev_institutions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    external_source varchar(40) NOT NULL, external_id varchar(120) NOT NULL,
    name varchar(255) NOT NULL CHECK (length(trim(name))>0),
    province_id varchar(2) NOT NULL REFERENCES dev_regions(id),
    regency_id varchar(5), address varchar(1000) NOT NULL,
    latitude double precision, longitude double precision,
    joined_year integer CHECK (joined_year BETWEEN 1800 AND 2200),
    landing_page_url varchar(500), landing_verified boolean NOT NULL DEFAULT false,
    coordinate_status varchar(20) NOT NULL DEFAULT 'missing' CHECK (coordinate_status IN ('missing','needs-review','verified')),
    coordinate_source varchar(1000), coordinate_verified_at timestamptz,
    geocode_status varchar(30) NOT NULL DEFAULT 'not-requested',
    geocode_candidates jsonb NOT NULL DEFAULT '[]', location_note text NOT NULL DEFAULT '',
    version integer NOT NULL DEFAULT 1, deleted_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
    FOREIGN KEY(province_id,regency_id) REFERENCES dev_regions(province_id,id),
    CHECK ((latitude IS NULL AND longitude IS NULL) OR (latitude BETWEEN -90 AND 90 AND longitude BETWEEN -180 AND 180)),
    CHECK (coordinate_status<>'verified' OR (latitude IS NOT NULL AND longitude IS NOT NULL AND coordinate_source IS NOT NULL AND coordinate_verified_at IS NOT NULL)),
    CHECK (NOT landing_verified OR landing_page_url ~ '^https://jikn\.anri\.go\.id/deskripsi-arsip/sj/[a-fA-F0-9-]{36}$')
);
CREATE UNIQUE INDEX IF NOT EXISTS dev_identity_unique ON dev_institutions(lower(external_source),lower(external_id));
-- Penambahan idempoten; record dan ID existing tidak berubah.
ALTER TABLE dev_institutions ADD COLUMN IF NOT EXISTS email varchar(254), ADD COLUMN IF NOT EXISTS phone varchar(40);
CREATE TABLE IF NOT EXISTS dev_geocode_cache (
    cache_key varchar(64) PRIMARY KEY, result jsonb NOT NULL, expires_at timestamptz NOT NULL
);
CREATE TABLE IF NOT EXISTS dev_audit_events (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, institution_id uuid,
    action varchar(10) NOT NULL, details jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE OR REPLACE FUNCTION dev_bump_revision() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
BEGIN
    UPDATE public.dev_meta SET revision=revision+1,updated_at=clock_timestamp() WHERE id=1;
    RETURN NULL;
END; $$;
CREATE OR REPLACE FUNCTION dev_audit_change() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
BEGIN
    INSERT INTO public.dev_audit_events(institution_id,action,details)
    VALUES (coalesce(NEW.id,OLD.id),TG_OP,jsonb_build_object('oldStatus',OLD.coordinate_status,'newStatus',NEW.coordinate_status,'oldVersion',OLD.version,'newVersion',NEW.version));
    RETURN NULL;
END; $$;
CREATE OR REPLACE FUNCTION dev_update_institution() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
BEGIN
    NEW.version=OLD.version+1;
    NEW.updated_at=clock_timestamp();
    IF (NEW.latitude IS DISTINCT FROM OLD.latitude OR NEW.longitude IS DISTINCT FROM OLD.longitude
        OR NEW.address IS DISTINCT FROM OLD.address OR NEW.province_id IS DISTINCT FROM OLD.province_id OR NEW.regency_id IS DISTINCT FROM OLD.regency_id)
        AND NEW.coordinate_verified_at IS NOT DISTINCT FROM OLD.coordinate_verified_at THEN
        NEW.coordinate_status='needs-review';
        NEW.coordinate_verified_at=NULL;
        NEW.location_note='Lokasi diubah langsung; konfirmasi ulang melalui formulir sebelum marker diterbitkan.';
    END IF;
    RETURN NEW;
END; $$;
DO $$ BEGIN
    IF NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgname='dev_regions_revision') THEN
        CREATE TRIGGER dev_regions_revision AFTER INSERT OR UPDATE OR DELETE ON dev_regions FOR EACH STATEMENT EXECUTE FUNCTION dev_bump_revision();
        CREATE TRIGGER dev_institutions_revision AFTER INSERT OR UPDATE OR DELETE ON dev_institutions FOR EACH STATEMENT EXECUTE FUNCTION dev_bump_revision();
        CREATE TRIGGER dev_institutions_audit AFTER INSERT OR UPDATE OR DELETE ON dev_institutions FOR EACH ROW EXECUTE FUNCTION dev_audit_change();
    END IF;
    IF NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgname='dev_institutions_version') THEN
        CREATE TRIGGER dev_institutions_version BEFORE UPDATE ON dev_institutions FOR EACH ROW EXECUTE FUNCTION dev_update_institution();
    END IF;
END; $$;
REVOKE ALL ON FUNCTION dev_bump_revision(),dev_audit_change(),dev_update_institution() FROM PUBLIC;
DO $$ BEGIN
    IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conname='dev_coordinate_pair') THEN
        ALTER TABLE dev_institutions ADD CONSTRAINT dev_coordinate_pair CHECK ((latitude IS NULL AND longitude IS NULL) OR (latitude IS NOT NULL AND longitude IS NOT NULL AND latitude BETWEEN -90 AND 90 AND longitude BETWEEN -180 AND 180));
        ALTER TABLE dev_institutions ADD CONSTRAINT dev_year_not_future CHECK (joined_year IS NULL OR joined_year<=extract(year FROM current_date));
        ALTER TABLE dev_institutions ADD CONSTRAINT dev_landing_safe CHECK (landing_page_url IS NULL OR landing_page_url ~ '^https://jikn\.anri\.go\.id/deskripsi-arsip/sj/[a-fA-F0-9]{8}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{12}$');
        ALTER TABLE dev_institutions ADD CONSTRAINT dev_external_identity_nonempty CHECK (length(trim(external_source))>0 AND length(trim(external_id))>0);
    END IF;
END; $$;
SQL;
