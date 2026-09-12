CREATE USER IF NOT EXISTS reader IDENTIFIED WITH no_password
    SETTINGS readonly = 2, max_execution_time = 30, max_result_rows = 100000, max_memory_usage = 4000000000;
GRANT SELECT ON clickpower.* TO reader;
GRANT SELECT ON clickpower_meta.* TO reader;
GRANT SELECT ON system.numbers TO reader;
GRANT SELECT ON system.one TO reader;
