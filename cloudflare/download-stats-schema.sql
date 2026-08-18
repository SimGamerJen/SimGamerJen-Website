CREATE TABLE IF NOT EXISTS download_counts (
    download_date TEXT NOT NULL,
    product TEXT NOT NULL,
    version TEXT NOT NULL,
    package_type TEXT NOT NULL CHECK (package_type IN ('installer', 'portable')),
    downloads INTEGER NOT NULL DEFAULT 0 CHECK (downloads >= 0),
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (download_date, product, version, package_type)
);

CREATE INDEX IF NOT EXISTS idx_download_counts_product_date
    ON download_counts (product, download_date);

CREATE INDEX IF NOT EXISTS idx_download_counts_product_version
    ON download_counts (product, version);
