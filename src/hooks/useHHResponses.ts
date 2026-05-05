import { useState, useEffect, useCallback } from 'react';
import { Candidate, CandidateStatus } from '@/data/mockData';

const HH_RESPONSES_URL = 'https://functions.poehali.dev/2a41e2d1-38ab-4c9b-aa98-6800a8333690';

// Маппинг статусов HH.ru -> внутренние статусы
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

  const fullName = `${(applicant.last_name as string) || ''} ${(applicant.first_name as string) || ''}`.trim() || 'Кандидат';
  const phone = (contacts.find((c) => (c as Record<string,unknown>).type === 'cell') as Record<string, unknown> | undefined)?.value as string || '';
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

  const fetchResponses = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${HH_RESPONSES_URL}?resource=negotiations`, {
        headers: { 'X-HH-Token': token },
      });
      if (!res.ok) {
        if (res.status === 403 || res.status === 401) {
          setError('Токен HH.ru устарел — переподключите аккаунт в Настройках');
        } else {
          setError(`Ошибка HH.ru: ${res.status}`);
        }
        return;
      }
      const data = await res.json();
      const items: Record<string, unknown>[] = data.items || [];
      setCandidates(items.map((item, i) => mapHHNegotiation(item, i)));
    } catch {
      setError('Не удалось загрузить отклики с HH.ru');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (connected) fetchResponses();
  }, [connected, fetchResponses]);

  return { candidates, loading, error, connected, refresh: fetchResponses };
}
