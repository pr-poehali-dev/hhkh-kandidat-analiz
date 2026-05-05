export type CandidateStatus = 'new' | 'review' | 'test' | 'interview' | 'offer' | 'reject';

export interface Candidate {
  id: string;
  name: string;
  position: string;
  source: string;
  status: CandidateStatus;
  score: number | null;
  appliedAt: string;
  updatedAt: string;
  city: string;
  salary: string;
  experience: number;
  phone: string;
  email: string;
  tags: string[];
}

export interface Interview {
  id: string;
  candidateId: string;
  candidateName: string;
  position: string;
  date: string;
  time: string;
  type: 'phone' | 'video' | 'office';
  interviewer: string;
  status: 'scheduled' | 'completed' | 'cancelled';
}

export interface HistoryLog {
  id: string;
  candidateId: string;
  candidateName: string;
  action: string;
  user: string;
  timestamp: string;
  details: string;
}

export const candidates: Candidate[] = [];
export const interviews: Interview[] = [];
export const historyLogs: HistoryLog[] = [];
export const vacancies: { id: string; title: string; department: string; openSince: string; candidates: number; stage: string }[] = [];

export const statusLabels: Record<CandidateStatus, string> = {
  new: 'Новый',
  review: 'Рассмотрение',
  test: 'Тест',
  interview: 'Собеседование',
  offer: 'Оффер',
  reject: 'Отказ',
};
