CREATE TABLE t_p93338434_hhkh_kandidat_analiz.candidates (
    id SERIAL PRIMARY KEY,
    hh_resume_id VARCHAR(100) UNIQUE,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    middle_name VARCHAR(100),
    phone VARCHAR(50),
    email VARCHAR(200),
    city VARCHAR(100),
    age INTEGER,
    gender VARCHAR(20),
    resume_title VARCHAR(200),
    experience_months INTEGER DEFAULT 0,
    salary_amount INTEGER,
    salary_currency VARCHAR(10) DEFAULT 'RUR',
    tags TEXT[] DEFAULT '{}',
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE t_p93338434_hhkh_kandidat_analiz.applications (
    id SERIAL PRIMARY KEY,
    candidate_id INTEGER REFERENCES t_p93338434_hhkh_kandidat_analiz.candidates(id),
    hh_negotiation_id VARCHAR(100) UNIQUE,
    vacancy_id VARCHAR(100),
    vacancy_name VARCHAR(200),
    status VARCHAR(50) DEFAULT 'new',
    hh_status VARCHAR(100),
    applied_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    test_score INTEGER,
    test_notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE t_p93338434_hhkh_kandidat_analiz.interactions (
    id SERIAL PRIMARY KEY,
    candidate_id INTEGER REFERENCES t_p93338434_hhkh_kandidat_analiz.candidates(id),
    application_id INTEGER REFERENCES t_p93338434_hhkh_kandidat_analiz.applications(id),
    type VARCHAR(50),
    content TEXT,
    author VARCHAR(200) DEFAULT 'HR',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_candidates_hh_resume_id ON t_p93338434_hhkh_kandidat_analiz.candidates(hh_resume_id);
CREATE INDEX idx_applications_candidate_id ON t_p93338434_hhkh_kandidat_analiz.applications(candidate_id);
CREATE INDEX idx_applications_vacancy_id ON t_p93338434_hhkh_kandidat_analiz.applications(vacancy_id);
CREATE INDEX idx_applications_status ON t_p93338434_hhkh_kandidat_analiz.applications(status);
CREATE INDEX idx_interactions_candidate_id ON t_p93338434_hhkh_kandidat_analiz.interactions(candidate_id);
