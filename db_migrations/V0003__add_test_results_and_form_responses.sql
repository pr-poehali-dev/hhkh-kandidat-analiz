CREATE TABLE IF NOT EXISTS t_p93338434_hhkh_kandidat_analiz.test_results (
    id SERIAL PRIMARY KEY,
    candidate_id INTEGER REFERENCES t_p93338434_hhkh_kandidat_analiz.candidates(id),
    application_id INTEGER REFERENCES t_p93338434_hhkh_kandidat_analiz.applications(id),
    test_type VARCHAR(50) NOT NULL,
    source_name VARCHAR(255),
    completed_at TIMESTAMP,
    raw_score VARCHAR(50),
    result_data JSONB,
    matched_by VARCHAR(50),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_test_results_candidate_id ON t_p93338434_hhkh_kandidat_analiz.test_results(candidate_id);
CREATE INDEX IF NOT EXISTS idx_test_results_application_id ON t_p93338434_hhkh_kandidat_analiz.test_results(application_id);
CREATE INDEX IF NOT EXISTS idx_test_results_test_type ON t_p93338434_hhkh_kandidat_analiz.test_results(test_type);

CREATE TABLE IF NOT EXISTS t_p93338434_hhkh_kandidat_analiz.form_responses (
    id SERIAL PRIMARY KEY,
    candidate_id INTEGER REFERENCES t_p93338434_hhkh_kandidat_analiz.candidates(id),
    application_id INTEGER REFERENCES t_p93338434_hhkh_kandidat_analiz.applications(id),
    spreadsheet_id VARCHAR(100) NOT NULL,
    vacancy_name VARCHAR(255),
    respondent_name VARCHAR(255),
    respondent_email VARCHAR(255),
    respondent_phone VARCHAR(50),
    submitted_at TIMESTAMP,
    form_data JSONB,
    matched_by VARCHAR(50),
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_form_responses_candidate_id ON t_p93338434_hhkh_kandidat_analiz.form_responses(candidate_id);
CREATE INDEX IF NOT EXISTS idx_form_responses_spreadsheet_id ON t_p93338434_hhkh_kandidat_analiz.form_responses(spreadsheet_id);
