#!/usr/bin/env python3
"""Menyiapkan cluster PostgreSQL dev terpisah. Idempoten; tidak menyentuh SIKN/.env."""
import argparse
import json
from pathlib import Path
import secrets
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]
PRIVATE = ROOT / '.local/development'


def run(command, *, data=None):
    result = subprocess.run([str(x) for x in command], input=data, text=True, capture_output=True)
    if result.returncode:
        # Output PostgreSQL bisa mengandung nilai SQL/rahasia; tidak dicetak.
        raise RuntimeError(f'Langkah {Path(str(command[0])).name} gagal (kode {result.returncode}). Periksa instalasi/port, bukan database SIKN.')
    return result.stdout


def private_json(path, value):
    path.write_text(json.dumps(value, indent=2)+'\n')
    path.chmod(0o600)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--pg-bin', default='/opt/homebrew/opt/postgresql@18/bin')
    parser.add_argument('--port', type=int, default=55440)
    parser.add_argument('--stop', action='store_true')
    parser.add_argument('--test-db', action='store_true', help='Siapkan database tes otomatis terpisah dari data uji pengguna.')
    args = parser.parse_args()
    pg = Path(args.pg_bin)
    PRIVATE.mkdir(mode=0o700, parents=True, exist_ok=True)
    connection = PRIVATE / 'connection.json'
    if connection.exists():
        config = json.loads(connection.read_text())
        if config['port'] != args.port:
            raise RuntimeError('Port berbeda dengan konfigurasi development existing; tidak diganti otomatis.')
    else:
        config = {'host':'127.0.0.1','port':args.port,'database':'jikn_dashboard_dev','username':'jikn_dev_app',
                  'password':secrets.token_urlsafe(32),'apiToken':secrets.token_urlsafe(40),
                  'geocoder':{'enabled':False,'endpoint':None,'userAgent':None}}
        private_json(connection, config)
        private_json(PRIVATE/'editor.json', {'host':'127.0.0.1','port':args.port,'database':'jikn_dashboard_dev','username':'jikn_dev_editor','password':secrets.token_urlsafe(32)})
    pgdata = PRIVATE/'pgdata'
    socket = PRIVATE/'socket'
    socket.mkdir(mode=0o700, exist_ok=True)
    if args.stop:
        run([pg/'pg_ctl','-D',pgdata,'-m','fast','-t','20','stop'])
        print('PostgreSQL development dihentikan; data tersimpan. PostgreSQL SIKN tidak disentuh.')
        return
    if not (pgdata/'PG_VERSION').exists():
        run([pg/'initdb','-D',pgdata,'-U','jikn_dev_owner','--encoding=UTF8','--auth-local=trust','--auth-host=scram-sha-256','--no-instructions'])
        (pgdata/'postgresql.conf').write_text(f"listen_addresses='127.0.0.1'\nport={args.port}\nunix_socket_directories='{socket}'\nshared_buffers='32MB'\nmax_connections=15\nlog_statement='none'\nlog_min_error_statement='panic'\nlogging_collector=off\n")
    status = subprocess.run([str(pg/'pg_ctl'),'-D',str(pgdata),'status'],capture_output=True)
    if status.returncode:
        run([pg/'pg_ctl','-D',pgdata,'-l',PRIVATE/'postgres.log','-t','20','start'])
    (pgdata/'pg_hba.conf').write_text('local all all trust\nhost jikn_dashboard_dev,jikn_dashboard_dev_test jikn_dev_app 127.0.0.1/32 scram-sha-256\nhost jikn_dashboard_dev jikn_dev_editor 127.0.0.1/32 scram-sha-256\nhost all all 127.0.0.1/32 reject\n')
    run([pg/'pg_ctl','-D',pgdata,'reload'])
    if args.test_db:
        config = {**config, 'database':'jikn_dashboard_dev_test'}
        test_file = PRIVATE/'test-connection.json'
        if test_file.exists():
            config = json.loads(test_file.read_text())
        else:
            config['apiToken'] = secrets.token_urlsafe(40)
            private_json(test_file, config)
    base = [pg/'psql','-X','-w','-h',socket,'-p',args.port,'-U','jikn_dev_owner','-At','-v','ON_ERROR_STOP=1']
    def sql(value, db='postgres'):
        return run(base+['-d',db],data=value)
    database_name = config['database']
    if sql(f"SELECT 1 FROM pg_database WHERE datname='{database_name}';").strip() != '1':
        sql(f'CREATE DATABASE {database_name};')
    editor = json.loads((PRIVATE/'editor.json').read_text())
    for c in [config,editor]:
        if sql(f"SELECT 1 FROM pg_roles WHERE rolname='{c['username']}';").strip() != '1':
            sql(f"CREATE ROLE {c['username']} LOGIN PASSWORD '{c['password']}' NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS; ALTER ROLE {c['username']} SET statement_timeout='10s';")
    sql(f'REVOKE ALL ON DATABASE {database_name} FROM PUBLIC; GRANT CONNECT ON DATABASE {database_name} TO jikn_dev_app;'+('' if args.test_db else f'GRANT CONNECT ON DATABASE {database_name} TO jikn_dev_editor;'))
    sql('REVOKE CREATE ON SCHEMA public FROM PUBLIC;',config['database'])
    schema = run(['php','-r',"echo require $argv[1];",ROOT/'backend/database/development/schema.php'])
    sql(schema, config['database'])
    # Referensi nasional tepercaya; tidak menyalin instansi/statistik SIKN.
    refs = json.loads((ROOT/'public/data/datasets/pilot/references.json').read_text())
    rows = []
    for r in refs['provinces']+refs['kabKota']:
        name=r['name'].replace("'","''")
        parent="NULL" if r['provinceId'] is None else "'"+r['provinceId']+"'"
        rows.append(f"('{r['id']}','{name}','{r['level']}',{parent},'reference')")
    sql('INSERT INTO dev_regions(id,name,level,province_id,origin) VALUES '+','.join(rows)+' ON CONFLICT DO NOTHING;',config['database'])
    sql('''GRANT USAGE ON SCHEMA public TO jikn_dev_app,jikn_dev_editor;
GRANT SELECT,INSERT,UPDATE ON dev_regions,dev_institutions,dev_geocode_cache TO jikn_dev_app,jikn_dev_editor;
GRANT DELETE ON dev_institutions,dev_regions TO jikn_dev_editor;
GRANT SELECT ON dev_meta,dev_audit_events TO jikn_dev_app,jikn_dev_editor;''',config['database'])
    print('Database development siap di 127.0.0.1:'+str(args.port)+'. Referensi 38 provinsi/514 kab-kota; instansi uji tetap terpisah. Kredensial hanya berkas privat .local.')


if __name__ == '__main__':
    try:
        main()
    except Exception as exc:
        print(str(exc) if isinstance(exc,RuntimeError) else 'Penyiapan development gagal; kredensial tidak ditampilkan.',file=sys.stderr)
        sys.exit(1)
