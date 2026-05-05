import { useState, useEffect, useCallback } from 'react';
import { Candidate, CandidateStatus } from '@/data/mockData';

const HH_RESPONSES_URL = 'https://functions.poehali.dev/2a41e2d1-38ab-4c9b-aa98-6800a8333690';
const HH_AUTH_URL = 'https://functions.poehali.dev/9500c236-1e3e-4291-99b9-5610c7718359';

// Обновляет access_token через refresh_token, возвращает новый токен или null
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

const mapHHStatus = (state: string): CandidateStatus => {
  switch (state) {
    // Collection IDs (точные)
    case 'response': return 'new';
    case 'consider': return 'review';
    case 'phone_interview': return 'review';
    case 'assessment': return 'test';
    case 'interview': return 'interview';
    case 'offer': return 'offer';
    case 'hired': return 'offer';
    // Отказы
    case 'discard_by_employer': return 'reject';
    case 'discard_by_applicant': return 'reject';
    case 'discard_no_interaction': return 'reject';
    case 'discard_vacancy_closed': return 'reject';
    case 'discard_to_other_vacancy': return 'reject';
    default: return 'new';
  }
};

const mapHHNegotiation = (item: Record<string, unknown>, index: number, vacancyName?: string): Candidate => {
  const resume = (item.resume as Record<string, unknown>) || {};
  const area = (resume.area as Record<string, unknown>) || {};
  const salary = (resume.salary as Record<string, unknown>) || {};
  const experience = (resume.total_experience as Record<string, unknown>) || {};
  const contacts = (resume.contact as unknown[]) || [];

  // Имя прямо в resume
  const fullName = `${(resume.last_name as string) || ''} ${(resume.first_name as string) || ''}`.trim() || 'Кандидат';
  const phone = (contacts.find((c) => (c as Record<string, unknown>).type === 'cell') as Record<string, unknown> | undefined)?.value as string || '';
  const email = '';
  const salaryValue = salary.amount ? `${Number(salary.amount).toLocaleString('ru')}` : '—';
  const expMonths = (experience.months as number) || 0;
  const expYears = Math.round(expMonths / 12);

  const vacancyObj = (item.vacancy as Record<string, unknown>) || {};
  const position = vacancyName || (vacancyObj.name as string) || 'Не указано';
  const resumeTitle = (resume.title as string) || '';
  // Используем _collection_id (более точный) или state.id
  const collectionId = (item._collection_id as string) || '';
  const stateId = ((item.state as Record<string, unknown>)?.id as string) || 'response';
  const state = collectionId || stateId;

  return {
    id: `hh-${item.id || index}`,
    name: fullName,
    position,
    source: 'HH.ru',
    status: mapHHStatus(state),
    score: null,
    appliedAt: ((item.created_at as string) || '').slice(0, 10),
    updatedAt: ((item.updated_at as string) || '').slice(0, 10),
    city: (area.name as string) || '',
    salary: salaryValue,
    experience: expYears,
    phone: phone as string,
    email,
    tags: resumeTitle ? [resumeTitle] : [],
  };
};

export interface HHVacancy {
  id: string;
  name: string;
  area: string;
  publishedAt: string;
  candidatesCount: number;
}

export interface UseHHResponsesResult {
  candidates: Candidate[];
  vacancies: HHVacancy[];
  loading: boolean;
  error: string | null;
  connected: boolean;
  refresh: () => void;
}

export function useHHResponses(): UseHHResponsesResult {
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [vacancies, setVacancies] = useState<HHVacancy[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const token = localStorage.getItem('hh_access_token');
  const connected = Boolean(token);

  const fetchWithToken = useCallback(async (url: string) => {
    let currentToken = localStorage.getItem('hh_access_token')!;
    let res = await fetch(url, { headers: { 'X-HH-Token': currentToken } });

    // При 401 — пробуем обновить токен автоматически
    if (res.status === 401) {
      const newToken = await tryRefreshToken();
      if (newToken) {
        currentToken = newToken;
        res = await fetch(url, { headers: { 'X-HH-Token': currentToken } });
      }
    }

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      const details = data.details ? ` (${data.details})` : '';
      if (res.status === 401) throw new Error('Токен HH.ru устарел — переподключите аккаунт в Настройках');
      throw new Error(`${data.error || `Ошибка HH.ru: ${res.status}`}${details}`);
    }
    return res.json();
  }, [token]);

  const fetchResponses = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      // Шаг 0: получаем employer_id и manager_id из профиля
      const me = await fetchWithToken(`${HH_RESPONSES_URL}?resource=me`);
      const employerId = (me.employer as Record<string, unknown>)?.id as string || '';
      const managerId = (me.manager as Record<string, unknown>)?.id as string || '';

      // Шаг 1: вакансии работодателя через публичный поиск по employer_id
      const vacUrl = `${HH_RESPONSES_URL}?resource=vacancies&employer_id=${employerId}`;
      const vacData = await fetchWithToken(vacUrl);
      const rawVacancies: Record<string, unknown>[] = (vacData.items as Record<string, unknown>[]) || [];

      if (rawVacancies.length === 0) {
        setCandidates([]);
        setVacancies([]);
        setError('На HH.ru нет активных вакансий. Опубликуйте вакансию — отклики появятся здесь.');
        return;
      }

      // Шаг 2: для каждой вакансии — получаем список коллекций, потом грузим каждую отдельно
      const all: Candidate[] = [];
      let accessDenied = 0;
      const vacancyCountMap: Record<string, number> = {};

      for (const vac of rawVacancies) {
        const vacId = vac.id as string;
        const vacName = (vac.name as string) || 'Не указано';
        const vacItems: Candidate[] = [];

        try {
          // Получаем список статусов
          const statesData = await fetchWithToken(`${HH_RESPONSES_URL}?resource=negotiations_states&vacancy_id=${vacId}`);
          const states: string[] = statesData.states || [];

          // Грузим каждую коллекцию отдельным запросом
          for (const colId of states) {
            try {
              const negData = await fetchWithToken(`${HH_RESPONSES_URL}?resource=negotiations&vacancy_id=${vacId}&col_id=${colId}`);
              const items: Record<string, unknown>[] = negData.items || [];
              vacItems.push(...items.map((item, i) => mapHHNegotiation(item, i, vacName)));
            } catch {
              // коллекция недоступна — пропускаем
            }
          }

          // Дедупликация по ID отклика внутри вакансии
          const seenIds = new Set<string>();
          for (const c of vacItems) {
            if (!seenIds.has(c.id)) {
              seenIds.add(c.id);
              all.push(c);
            }
          }
          vacancyCountMap[vacId] = seenIds.size;
        } catch (e) {
          if (e instanceof Error && e.message.includes('403')) accessDenied++;
          vacancyCountMap[vacId] = 0;
        }
      }

      setCandidates(all);
      setVacancies(rawVacancies.map((v) => ({
        id: v.id as string,
        name: (v.name as string) || '',
        area: ((v.area as Record<string, unknown>)?.name as string) || '',
        publishedAt: ((v.published_at as string) || '').slice(0, 10),
        candidatesCount: vacancyCountMap[v.id as string] || 0,
      })));

      if (all.length === 0 && accessDenied === rawVacancies.length) {
        setError('Для загрузки откликов требуется платный доступ к API HH.ru (тариф работодателя)');
      }
    } catch (e) {
      if (e instanceof Error) {
        if (e.message.includes('403')) {
          setError('Для загрузки откликов требуется платный доступ к API HH.ru');
        } else if (e.message.includes('401')) {
          setError('Токен HH.ru устарел — переподключите аккаунт в Настройках');
        } else {
          setError(e.message);
        }
      }
    } finally {
      setLoading(false);
    }
  }, [token, fetchWithToken]);

  useEffect(() => {
    if (connected) fetchResponses();
  }, [connected, fetchResponses]);

  return { candidates, vacancies, loading, error, connected, refresh: fetchResponses };
}