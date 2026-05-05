import { useState, useEffect, useCallback } from 'react';
import { Candidate, CandidateStatus } from '@/data/mockData';

const HH_RESPONSES_URL = 'https://functions.poehali.dev/2a41e2d1-38ab-4c9b-aa98-6800a8333690';

const mapHHStatus = (state: string): CandidateStatus => {
  switch (state) {
    case 'response': return 'new';
    case 'consider': return 'review';
    case 'phone_interview': return 'interview';
    case 'interview': return 'interview';
    case 'offer': return 'offer';
    case 'discard': return 'reject';
    default: return 'new';
  }
};

const mapHHNegotiation = (item: Record<string, unknown>, index: number): Candidate => {
  const resume = (item.resume as Record<string, unknown>) || {};
  const applicant = (resume.owner as Record<string, unknown>) || {};
  const area = (resume.area as Record<string, unknown>) || {};
  const salary = (resume.salary as Record<string, unknown>) || {};
  const experience = (resume.total_experience as Record<string, unknown>) || {};
  const contacts = (resume.contact as unknown[]) || [];

  const fullName = `${(applicant.last_name as string) || ''} ${(applicant.first_name as string) || ''}`.trim()
    || (resume.first_name as string) || 'Кандидат';
  const phone = (contacts.find((c) => (c as Record<string, unknown>).type === 'cell') as Record<string, unknown> | undefined)?.value as string || '';
  const email = (applicant.email as string) || '';
  const salaryValue = salary.amount ? `${Number(salary.amount).toLocaleString('ru')}` : '—';
  const expMonths = (experience.months as number) || 0;
  const expYears = Math.round(expMonths / 12);

  const vacancyObj = (item.vacancy as Record<string, unknown>) || {};
  const position = (vacancyObj.name as string) || (resume.title as string) || 'Не указано';
  const state = ((item.state as Record<string, unknown>)?.id as string) || 'response';

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
    tags: [],
  };
};

export interface UseHHResponsesResult {
  candidates: Candidate[];
  loading: boolean;
  error: string | null;
  connected: boolean;
  refresh: () => void;
}

export function useHHResponses(): UseHHResponsesResult {
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const token = localStorage.getItem('hh_access_token');
  const connected = Boolean(token);

  const fetchWithToken = useCallback(async (url: string) => {
    const res = await fetch(url, { headers: { 'X-HH-Token': token! } });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || `Ошибка HH.ru: ${res.status}`);
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

      // Шаг 1: вакансии работодателя
      let vacData: Record<string, unknown> = {};
      try {
        const vacUrl = `${HH_RESPONSES_URL}?resource=vacancies&employer_id=${employerId}&manager_id=${managerId}`;
        vacData = await fetchWithToken(vacUrl);
      } catch (e) {
        if (e instanceof Error && e.message.includes('404')) {
          setCandidates([]);
          setError('На HH.ru нет активных вакансий. Опубликуйте вакансию — отклики появятся здесь.');
          return;
        }
        throw e;
      }
      const vacancies: Record<string, unknown>[] = (vacData.items as Record<string, unknown>[]) || [];

      if (vacancies.length === 0) {
        setCandidates([]);
        setError('На HH.ru нет активных вакансий. Опубликуйте вакансию — отклики появятся здесь.');
        return;
      }

      // Шаг 2: отклики по каждой вакансии
      const all: Candidate[] = [];
      for (const vac of vacancies) {
        const vacId = vac.id as string;
        try {
          const negData = await fetchWithToken(`${HH_RESPONSES_URL}?resource=negotiations&vacancy_id=${vacId}`);
          const items: Record<string, unknown>[] = negData.items || [];
          all.push(...items.map((item, i) => mapHHNegotiation(item, i)));
        } catch {
          // нет доступа к откликам по вакансии — пропускаем
        }
      }
      setCandidates(all);
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

  return { candidates, loading, error, connected, refresh: fetchResponses };
}