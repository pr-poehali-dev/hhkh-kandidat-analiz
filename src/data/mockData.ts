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

export const candidates: Candidate[] = [
  { id: 'c1', name: 'Алексей Петров', position: 'Frontend Developer', source: 'HH.ru', status: 'interview', score: 87, appliedAt: '2026-04-28', updatedAt: '2026-04-30', city: 'Москва', salary: '180 000', experience: 4, phone: '+7 916 123-45-67', email: 'a.petrov@mail.ru', tags: ['React', 'TypeScript'] },
  { id: 'c2', name: 'Мария Соколова', position: 'Product Manager', source: 'Telegram', status: 'offer', score: 92, appliedAt: '2026-04-25', updatedAt: '2026-04-29', city: 'Санкт-Петербург', salary: '220 000', experience: 6, phone: '+7 921 234-56-78', email: 'm.sokolova@gmail.com', tags: ['Agile', 'Analytics'] },
  { id: 'c3', name: 'Дмитрий Иванов', position: 'Backend Developer', source: 'HH.ru', status: 'test', score: 74, appliedAt: '2026-04-27', updatedAt: '2026-04-28', city: 'Казань', salary: '160 000', experience: 3, phone: '+7 905 345-67-89', email: 'd.ivanov@yandex.ru', tags: ['Python', 'Django'] },
  { id: 'c4', name: 'Елена Кузнецова', position: 'UX Designer', source: 'LinkedIn', status: 'review', score: null, appliedAt: '2026-04-30', updatedAt: '2026-04-30', city: 'Москва', salary: '150 000', experience: 5, phone: '+7 903 456-78-90', email: 'e.kuznecova@mail.ru', tags: ['Figma', 'Research'] },
  { id: 'c5', name: 'Андрей Смирнов', position: 'DevOps Engineer', source: 'Habr', status: 'new', score: null, appliedAt: '2026-05-01', updatedAt: '2026-05-01', city: 'Новосибирск', salary: '200 000', experience: 7, phone: '+7 912 567-89-01', email: 'a.smirnov@gmail.com', tags: ['Kubernetes', 'CI/CD'] },
  { id: 'c6', name: 'Ольга Федорова', position: 'Frontend Developer', source: 'HH.ru', status: 'reject', score: 45, appliedAt: '2026-04-22', updatedAt: '2026-04-26', city: 'Екатеринбург', salary: '120 000', experience: 1, phone: '+7 908 678-90-12', email: 'o.fedorova@mail.ru', tags: ['React'] },
  { id: 'c7', name: 'Иван Николаев', position: 'Data Analyst', source: 'HH.ru', status: 'test', score: 68, appliedAt: '2026-04-29', updatedAt: '2026-04-30', city: 'Москва', salary: '140 000', experience: 2, phone: '+7 915 789-01-23', email: 'i.nikolaev@yandex.ru', tags: ['SQL', 'Python'] },
  { id: 'c8', name: 'Светлана Морозова', position: 'HR Manager', source: 'SuperJob', status: 'interview', score: 83, appliedAt: '2026-04-26', updatedAt: '2026-04-29', city: 'Санкт-Петербург', salary: '110 000', experience: 5, phone: '+7 911 890-12-34', email: 's.morozova@gmail.com', tags: ['Recruiting'] },
  { id: 'c9', name: 'Павел Козлов', position: 'Backend Developer', source: 'Habr', status: 'new', score: null, appliedAt: '2026-05-01', updatedAt: '2026-05-01', city: 'Москва', salary: '175 000', experience: 5, phone: '+7 925 901-23-45', email: 'p.kozlov@mail.ru', tags: ['Java', 'Spring'] },
  { id: 'c10', name: 'Анастасия Лебедева', position: 'Marketing Manager', source: 'LinkedIn', status: 'review', score: null, appliedAt: '2026-04-30', updatedAt: '2026-05-01', city: 'Москва', salary: '130 000', experience: 3, phone: '+7 917 012-34-56', email: 'a.lebedeva@yandex.ru', tags: ['SMM', 'Analytics'] },
];

export const interviews: Interview[] = [
  { id: 'i1', candidateId: 'c1', candidateName: 'Алексей Петров', position: 'Frontend Developer', date: '2026-05-05', time: '11:00', type: 'video', interviewer: 'Анна Семёнова', status: 'scheduled' },
  { id: 'i2', candidateId: 'c2', candidateName: 'Мария Соколова', position: 'Product Manager', date: '2026-05-05', time: '14:00', type: 'office', interviewer: 'Игорь Тихонов', status: 'scheduled' },
  { id: 'i3', candidateId: 'c8', candidateName: 'Светлана Морозова', position: 'HR Manager', date: '2026-05-06', time: '10:00', type: 'video', interviewer: 'Анна Семёнова', status: 'scheduled' },
  { id: 'i4', candidateId: 'c7', candidateName: 'Иван Николаев', position: 'Data Analyst', date: '2026-05-07', time: '15:30', type: 'phone', interviewer: 'Михаил Орлов', status: 'scheduled' },
  { id: 'i5', candidateId: 'c3', candidateName: 'Дмитрий Иванов', position: 'Backend Developer', date: '2026-05-08', time: '12:00', type: 'video', interviewer: 'Игорь Тихонов', status: 'scheduled' },
];

export const historyLogs: HistoryLog[] = [
  { id: 'h1', candidateId: 'c2', candidateName: 'Мария Соколова', action: 'Статус изменён', user: 'Анна Семёнова', timestamp: '2026-04-29 16:42', details: 'interview → offer' },
  { id: 'h2', candidateId: 'c1', candidateName: 'Алексей Петров', action: 'Назначено собеседование', user: 'Анна Семёнова', timestamp: '2026-04-30 10:15', details: '05.05 в 11:00, видеозвонок' },
  { id: 'h3', candidateId: 'c6', candidateName: 'Ольга Федорова', action: 'Отказ', user: 'Михаил Орлов', timestamp: '2026-04-26 14:30', details: 'Низкий балл теста: 45/100' },
  { id: 'h4', candidateId: 'c3', candidateName: 'Дмитрий Иванов', action: 'Тест отправлен', user: 'Система', timestamp: '2026-04-28 09:00', details: 'Автоматически по правилу "Backend вакансии"' },
  { id: 'h5', candidateId: 'c5', candidateName: 'Андрей Смирнов', action: 'Новый отклик', user: 'Система', timestamp: '2026-05-01 08:30', details: 'Источник: Habr Career' },
  { id: 'h6', candidateId: 'c4', candidateName: 'Елена Кузнецова', action: 'На рассмотрении', user: 'Михаил Орлов', timestamp: '2026-04-30 11:00', details: 'Перемещено из новых' },
  { id: 'h7', candidateId: 'c7', candidateName: 'Иван Николаев', action: 'Результат теста', user: 'Система', timestamp: '2026-04-30 18:22', details: 'Балл: 68/100. Проходной порог: 60' },
  { id: 'h8', candidateId: 'c9', candidateName: 'Павел Козлов', action: 'Новый отклик', user: 'Система', timestamp: '2026-05-01 09:15', details: 'Источник: HH.ru' },
];

export const vacancies = [
  { id: 'v1', title: 'Frontend Developer', department: 'Разработка', openSince: '2026-04-01', candidates: 24, stage: 'Активна' },
  { id: 'v2', title: 'Product Manager', department: 'Продукт', openSince: '2026-03-15', candidates: 18, stage: 'Активна' },
  { id: 'v3', title: 'Backend Developer', department: 'Разработка', openSince: '2026-04-10', candidates: 31, stage: 'Активна' },
  { id: 'v4', title: 'UX Designer', department: 'Дизайн', openSince: '2026-04-20', candidates: 12, stage: 'Активна' },
  { id: 'v5', title: 'DevOps Engineer', department: 'Инфраструктура', openSince: '2026-04-25', candidates: 8, stage: 'Активна' },
];

export const statusLabels: Record<CandidateStatus, string> = {
  new: 'Новый',
  review: 'Рассмотрение',
  test: 'Тест',
  interview: 'Собеседование',
  offer: 'Оффер',
  reject: 'Отказ',
};
