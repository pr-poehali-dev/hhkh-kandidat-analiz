import { useState, useEffect, useCallback } from 'react';
import { Candidate, CandidateStatus } from '@/data/mockData';

const CANDIDATES_API = 'https://functions.poehali.dev/b9c994a9-3c28-4006-b96c-ddcd619b381d';
const HH_SYNC_URL = 'https://functions.poehali.dev/51035958-9246-42fd-8726-99f107a6cea7';
const HH_RESPONSES_URL = 'https://functions.poehali.dev/2a41e2d1-38ab-4c9b-aa98-6800a8333690';
const HH_AUTH_URL = 'https://functions.poehali.dev/9500c236-1e3e-4291-99b9-5610c7718359';
const MAIL_MONITOR_URL = 'https://functions.poehali.dev/dcb327ec-8acb-41ce-91ba-9b309d581902';


async function tryRefreshToken(): Promise<string | null> {
  const refreshToken = localStorage.getItem('hh_refresh_token');
  if (!refreshToken) return null;
  try {
    const res = await fetch(HH_AUTH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data.access_token) return null;
    localStorage.setItem('hh_access_token', data.access_token);
    if (data.refresh_token) localStorage.setItem('hh_refresh_token', data.refresh_token);
    return data.access_token;
  } catch {
    return null;
  }
}

function mapDbRow(row: Record<string, unknown>): Candidate & { applicationId: number; prevApplicationsCount: number } {
  return {
    id: `app-${row.application_id}`,
    name: `${row.last_name || ''} ${row.first_name || ''}`.trim() || 'Кандидат',
    position: (row.vacancy_name as string) || '',
    source: 'HH.ru',
    status: (row.status as CandidateStatus) || 'new',
    score: (row.test_score as number) || null,
    appliedAt: ((row.applied_at as string) || '').slice(0, 10),
    updatedAt: ((row.updated_at as string) || '').slice(0, 10),
    city: (row.city as string) || '',
    salary: row.salary_amount ? `${Number(row.salary_amount).toLocaleString('ru')}` : '—',
    experience: row.experience_months ? Math.round((row.experience_months as number) / 12) : 0,
    phone: (row.phone as string) || '',
    email: (row.email as string) || '',
    tags: row.resume_title ? [row.resume_title as string] : [],
    applicationId: row.application_id as number,
    prevApplicationsCount: (row.prev_applications_count as number) || 0,
  };
}

export interface HHVacancy {
  id: string;
  name: string;
  area: string;
  publishedAt: string;
  candidatesCount: number;
}

export interface SyncStatus {
  syncing: boolean;
  progress: string;
  lastSync: string | null;
}

export interface UseCandidatesResult {
  candidates: (Candidate & { applicationId: number; prevApplicationsCount: number })[];
  vacancies: HHVacancy[];
  loading: boolean;
  error: string | null;
  connected: boolean;
  syncStatus: SyncStatus;
  refresh: () => void;
  syncFromHH: () => Promise<void>;
}

export function useCandidates(): UseCandidatesResult {
  const [candidates, setCandidates] = useState<(Candidate & { applicationId: number; prevApplicationsCount: number })[]>([]);
  const [vacancies, setVacancies] = useState<HHVacancy[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>({
    syncing: false,
    progress: '',
    lastSync: localStorage.getItem('hh_last_sync'),
  });

  const token = localStorage.getItem('hh_access_token');
  const connected = Boolean(token);

  // Загрузка из БД
  const loadFromDB = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${CANDIDATES_API}?action=list`);
      if (!res.ok) throw new Error(`Ошибка загрузки: ${res.status}`);
      const data = await res.json();
      const rows: Record<string, unknown>[] = data.items || [];
      setCandidates(rows.map(mapDbRow));

      // Статистика по вакансиям из отдельного запроса
      const statsRes = await fetch(`${CANDIDATES_API}?action=vacancy_stats`);
      if (statsRes.ok) {
        const statsData = await statsRes.json();
        setVacancies((statsData.items || []).map((v: Record<string, unknown>) => ({
          id: v.vacancy_id as string,
          name: (v.vacancy_name as string) || '',
          area: '',
          publishedAt: '',
          candidatesCount: Number(v.total) || 0,
        })));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка загрузки');
    } finally {
      setLoading(false);
    }
  }, []);

  // Синхронизация с HH.ru → сохранение в БД
  const syncFromHH = useCallback(async () => {
    let currentToken = localStorage.getItem('hh_access_token');
    if (!currentToken) return;

    setSyncStatus(s => ({ ...s, syncing: true, progress: 'Подключение к HH.ru...' }));
    setError(null);

    const hhFetch = async (url: string) => {
      let res = await fetch(url, { headers: { 'X-HH-Token': currentToken! } });
      if (res.status === 401) {
        const newToken = await tryRefreshToken();
        if (newToken) { currentToken = newToken; res = await fetch(url, { headers: { 'X-HH-Token': newToken } }); }
      }
      if (!res.ok) throw new Error(`HH.ru error ${res.status}`);
      return res.json();
    };

    try {
      // Шаг 1: профиль и вакансии
      const me = await hhFetch(`${HH_RESPONSES_URL}?resource=me`);
      const employerId = (me.employer as Record<string, unknown>)?.id as string || '';
      const vacData = await hhFetch(`${HH_RESPONSES_URL}?resource=vacancies&employer_id=${employerId}`);
      const rawVacancies: Record<string, unknown>[] = vacData.items || [];

      setSyncStatus(s => ({ ...s, progress: `Найдено ${rawVacancies.length} вакансий` }));

      // Шаг 2: для каждой вакансии — синхронизируем коллекции
      for (const vac of rawVacancies) {
        const vacId = vac.id as string;
        const vacName = (vac.name as string) || '';

        setSyncStatus(s => ({ ...s, progress: `Загружаю "${vacName}"...` }));

        const statesData = await hhFetch(`${HH_RESPONSES_URL}?resource=negotiations_states&vacancy_id=${vacId}`);
        const states: string[] = statesData.states || [];

        for (const colId of states) {
          try {
            // Бэкенд сам тянет данные с HH.ru и сохраняет в БД
            setSyncStatus(s => ({ ...s, progress: `"${vacName}" → ${colId}...` }));
            await fetch(HH_SYNC_URL, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'X-HH-Token': currentToken! },
              body: JSON.stringify({ vacancy_id: vacId, vacancy_name: vacName, col_id: colId }),
            });
          } catch {
            // пропускаем недоступные коллекции
          }
        }
      }

      // Проверяем почту — переводим ответивших кандидатов на тестирование
      setSyncStatus(s => ({ ...s, progress: 'Проверяю почту...' }));
      try { await fetch(MAIL_MONITOR_URL); } catch { /* игнорируем */ }

      const now = new Date().toLocaleString('ru');
      localStorage.setItem('hh_last_sync', now);
      setSyncStatus({ syncing: false, progress: '', lastSync: now });

      // Перезагружаем из БД
      await loadFromDB();
    } catch (e) {
      setSyncStatus(s => ({ ...s, syncing: false, progress: '' }));
      setError(e instanceof Error ? e.message : 'Ошибка синхронизации');
    }
  }, [loadFromDB]);

  useEffect(() => {
    // Загружаем из БД при старте
    loadFromDB();
  }, [loadFromDB]);

  return { candidates, vacancies, loading, error, connected, syncStatus, refresh: loadFromDB, syncFromHH };
}