-- Recommendation tracking tables for skill-based recommendations
-- Engine: MySQL 8+ (InnoDB), charset: UTF8MB4

CREATE TABLE IF NOT EXISTS recommendation_events (
  recommendation_id CHAR(36) NOT NULL,
  user_id INT NULL,
  source VARCHAR(32) NOT NULL,
  results JSON NOT NULL,
  skills JSON NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (recommendation_id),
  INDEX idx_reco_events_source_created (source, created_at),
  INDEX idx_reco_events_user_created (user_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS recommendation_picks (
  id BIGINT NOT NULL AUTO_INCREMENT,
  recommendation_id CHAR(36) NOT NULL,
  user_id INT NULL,
  chosen_job_id VARCHAR(255) NOT NULL,
  chosen_rank INT NULL,
  picked_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  INDEX idx_reco_picks_reco_picked (recommendation_id, picked_at),
  INDEX idx_reco_picks_picked_at (picked_at),
  INDEX idx_reco_picks_user_picked (user_id, picked_at),
  CONSTRAINT fk_reco_picks_event
    FOREIGN KEY (recommendation_id) REFERENCES recommendation_events(recommendation_id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
