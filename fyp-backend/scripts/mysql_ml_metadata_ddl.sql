-- ML metadata tables for ESCO + major mapping
-- Charset requirement: UTF8MB4

CREATE TABLE IF NOT EXISTS skills (
  skill_uri VARCHAR(255) NOT NULL,
  preferred_label VARCHAR(255) NOT NULL,
  alt_labels TEXT NULL,
  PRIMARY KEY (skill_uri),
  INDEX idx_skills_preferred_label (preferred_label)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS occupations (
  occ_uri VARCHAR(255) NOT NULL,
  preferred_label VARCHAR(255) NOT NULL,
  PRIMARY KEY (occ_uri),
  INDEX idx_occupations_preferred_label (preferred_label)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS major_occupation_map (
  major_name VARCHAR(255) NOT NULL,
  occ_uri VARCHAR(255) NOT NULL,
  PRIMARY KEY (major_name, occ_uri),
  INDEX idx_major_occ_map_occ_uri (occ_uri)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
