import { useCandidates } from '@/hooks/useCandidates';
import StatusBadge from '@/components/StatusBadge';
import Icon from '@/components/ui/icon';
import { useEffect, useState } from 'react';

const TESTS_SYNC_URL = 'https://functions.poehali.dev/f02fbdeb-8e4c-41b9-bbbc-619f2b6dbc83';

interface TestResult {
  test_type: string;
  source_name: string;
  raw_score: string;
  result_data: Record<string, string>;
  created_at: string;
}

interface FormResponse {
  vacancy_name: string;
  respondent_name: string;
  submitted_at: string;
  form_data: Record<string, string>;
  spreadsheet_id: string;
  created_at: string;
}

const TEST_TYPE_LABELS: Record<string, string> = {
  kettell: 'Тест Кеттела 16PF',
  bennett: 'Тест Беннета (мех. понятливость)',
  other: 'Психологический тест',
};

function useTestResults(candidateId: string) {
  const [tests, setTests] = useState<TestResult[]>([]);
  const [forms, setForms] = useState<FormResponse[]>([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const load = async () => {
    const numericId = candidateId.replace('app-', '');
    setLoading(true);
    try {
      const res = await fetch(`${TESTS_SYNC_URL}?action=get&candidate_id=${numericId}`);
      if (res.ok) {
        const data = await res.json();
        setTests(data.tests || []);
        setForms(data.forms || []);
      }
    } finally {
      setLoading(false);
    }
  };

  const sync = async () => {
    setSyncing(true);
    try {
      await fetch(`${TESTS_SYNC_URL}?action=sync`);
      await load();
    } finally {
      setSyncing(false);
    }
  };

  useEffect(() => { load(); }, [candidateId]);

  return { tests, forms, loading, syncing, sync };
}

export default function CandidateCard({ candidateId, onBack }: { candidateId: string; onBack: () => void }) {
  const { candidates } = useCandidates();
  const c = candidates.find((x) => x.id === candidateId) as typeof candidates[0] & { hhResumeId?: string; hhNegotiationId?: string; applicationId?: number };
  const { tests, forms, loading: testsLoading, syncing, sync } = useTestResults(candidateId);
  if (!c) return null;

  const resumeUrl = c.hhResumeId
    ? `https://hh.ru/resume/${c.hhResumeId}`
    : null;

  return (
    <div className="flex flex-col gap-3 animate-fade-in">
      {/* Header */}
      <div className="panel p-3 flex items-center gap-3">
        <button onClick={onBack} className="text-muted-foreground hover:text-foreground flex items-center gap-1 text-xs">
          <Icon name="ArrowLeft" size={13} />
          Назад
        </button>
        <div className="w-px h-4 bg-border" />
        <div className="w-9 h-9 rounded-full bg-primary/20 flex items-center justify-center text-primary font-semibold text-sm">
          {c.name.split(' ').map((n) => n[0]).join('').slice(0, 2)}
        </div>
        <div className="flex-1">
          <div className="font-semibold text-foreground text-sm">{c.name}</div>
          <div className="text-xs text-muted-foreground">{c.position} · {c.city}</div>
        </div>
        <StatusBadge status={c.status} />
        <div className="flex gap-2">
          <button className="text-xs bg-muted px-2.5 py-1.5 rounded hover:bg-secondary transition-colors text-foreground flex items-center gap-1">
            <Icon name="Mail" size={12} />
            Написать
          </button>
          <button className="text-xs bg-muted px-2.5 py-1.5 rounded hover:bg-secondary transition-colors text-foreground flex items-center gap-1">
            <Icon name="Calendar" size={12} />
            Назначить
          </button>
          <button className="text-xs bg-primary text-primary-foreground px-2.5 py-1.5 rounded hover:opacity-90 flex items-center gap-1">
            <Icon name="ChevronRight" size={12} />
            Перевести
          </button>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-3">
        {/* Left: Info */}
        <div className="col-span-3 flex flex-col gap-3">
          <div className="panel">
            <div className="panel-header">
              <span className="text-xs font-semibold text-foreground uppercase tracking-wider">Контакты</span>
            </div>
            <div className="p-3 flex flex-col gap-2">
              {[
                { icon: 'Phone', label: c.phone || '—' },
                { icon: 'Mail', label: c.email || '—' },
                { icon: 'MapPin', label: c.city || '—' },
                { icon: 'Globe', label: c.source },
              ].map((row) => (
                <div key={row.icon} className="flex items-center gap-2">
                  <Icon name={row.icon} size={13} className="text-muted-foreground shrink-0" />
                  <span className="text-xs text-foreground">{row.label}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="panel">
            <div className="panel-header">
              <span className="text-xs font-semibold text-foreground uppercase tracking-wider">Детали</span>
            </div>
            <div className="p-3 flex flex-col gap-2">
              {[
                { label: 'Опыт работы', value: c.experience ? `${c.experience} лет` : '—' },
                { label: 'Ожидаемая ЗП', value: c.salary !== '—' ? `${c.salary} ₽` : '—' },
                { label: 'Дата отклика', value: c.appliedAt || '—' },
                { label: 'Обновлён', value: c.updatedAt || '—' },
              ].map((row) => (
                <div key={row.label} className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">{row.label}</span>
                  <span className="text-xs font-mono-data text-foreground">{row.value}</span>
                </div>
              ))}
            </div>
          </div>

          {c.tags.length > 0 && (
            <div className="panel">
              <div className="panel-header">
                <span className="text-xs font-semibold text-foreground uppercase tracking-wider">Теги</span>
              </div>
              <div className="p-3 flex flex-wrap gap-1.5">
                {c.tags.map((tag) => (
                  <span key={tag} className="bg-muted border border-border text-xs px-2 py-0.5 rounded text-foreground">{tag}</span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Center: Resume placeholder */}
        <div className="col-span-6 panel">
          <div className="panel-header">
            <span className="text-xs font-semibold text-foreground uppercase tracking-wider">Резюме</span>
            {resumeUrl && (
              <a
                href={resumeUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-primary hover:underline flex items-center gap-1"
              >
                <Icon name="ExternalLink" size={11} />
                Открыть на HH.ru
              </a>
            )}
          </div>
          <div className="p-4 flex flex-col items-center justify-center gap-3 text-muted-foreground min-h-48">
            <Icon name="FileText" size={28} />
            <div className="text-sm text-center">
              Полное резюме доступно на HH.ru<br />
              {resumeUrl && (
                <a
                  href={resumeUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline text-xs mt-1 inline-block"
                >
                  Открыть резюме →
                </a>
              )}
            </div>
          </div>
        </div>

        {/* Right: Tests */}
        <div className="col-span-3 flex flex-col gap-3">
          {/* Google Forms */}
          <div className="panel">
            <div className="panel-header">
              <span className="text-xs font-semibold text-foreground uppercase tracking-wider">Анкета</span>
              <button
                onClick={sync}
                disabled={syncing}
                className="text-xs text-primary hover:underline flex items-center gap-1 disabled:opacity-50"
              >
                <Icon name="RefreshCw" size={11} className={syncing ? 'animate-spin' : ''} />
                {syncing ? 'Синхр...' : 'Обновить'}
              </button>
            </div>
            {testsLoading ? (
              <div className="p-4 text-center text-xs text-muted-foreground">Загрузка...</div>
            ) : forms.length === 0 ? (
              <div className="p-4 text-center text-xs text-muted-foreground">Анкета не заполнена</div>
            ) : (
              <div className="p-3 flex flex-col gap-3">
                {forms.map((f, i) => (
                  <div key={i} className="flex flex-col gap-1.5 border-b border-border pb-3 last:border-0 last:pb-0">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-foreground">{f.vacancy_name || 'Анкета'}</span>
                      <span className="text-xs text-muted-foreground">{f.submitted_at ? f.submitted_at.slice(0, 10) : f.created_at?.slice(0, 10)}</span>
                    </div>
                    {f.form_data && (
                      <div className="flex flex-col gap-1">
                        {Object.entries(f.form_data).slice(0, 6).map(([key, val]) => (
                          <div key={key} className="text-xs">
                            <span className="text-muted-foreground">{key}: </span>
                            <span className="text-foreground">{String(val).slice(0, 60)}</span>
                          </div>
                        ))}
                        {Object.keys(f.form_data).length > 6 && (
                          <span className="text-xs text-muted-foreground">+{Object.keys(f.form_data).length - 6} полей...</span>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Psytests */}
          <div className="panel">
            <div className="panel-header">
              <span className="text-xs font-semibold text-foreground uppercase tracking-wider">Психотесты</span>
            </div>
            {testsLoading ? (
              <div className="p-4 text-center text-xs text-muted-foreground">Загрузка...</div>
            ) : tests.length === 0 ? (
              <div className="p-4 text-center text-xs text-muted-foreground">Тесты не пройдены</div>
            ) : (
              <div className="p-3 flex flex-col gap-3">
                {tests.map((t, i) => (
                  <div key={i} className="flex flex-col gap-1 border-b border-border pb-3 last:border-0 last:pb-0">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-foreground">{TEST_TYPE_LABELS[t.test_type] || t.source_name}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">Результат</span>
                      <span className="text-xs font-semibold text-foreground">{t.raw_score || '—'}</span>
                    </div>
                    {t.result_data?.psytests_link && (
                      <a
                        href={t.result_data.psytests_link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-primary hover:underline flex items-center gap-1 mt-0.5"
                      >
                        <Icon name="ExternalLink" size={10} />
                        Полный результат
                      </a>
                    )}
                    <span className="text-xs text-muted-foreground">{t.result_data?.date || t.created_at?.slice(0, 10)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}