import { useHHResponses } from '@/hooks/useHHResponses';
import { historyLogs, statusLabels, CandidateStatus } from '@/data/mockData';
import Icon from '@/components/ui/icon';
import StatusBadge from '@/components/StatusBadge';

const funnelStages: { status: CandidateStatus; color: string }[] = [
  { status: 'new', color: 'bg-blue-500' },
  { status: 'review', color: 'bg-yellow-500' },
  { status: 'test', color: 'bg-purple-500' },
  { status: 'interview', color: 'bg-cyan-500' },
  { status: 'offer', color: 'bg-green-500' },
  { status: 'reject', color: 'bg-red-500' },
];

export default function Dashboard() {
  const { candidates, vacancies, connected, loading } = useHHResponses();

  const statusCounts = candidates.reduce((acc, c) => {
    acc[c.status] = (acc[c.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const recent = [...candidates].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 6);

  const stats = [
    { label: 'Всего кандидатов', value: candidates.length, icon: 'Users' },
    { label: 'Новых откликов', value: statusCounts['new'] || 0, icon: 'UserPlus' },
    { label: 'На рассмотрении', value: statusCounts['review'] || 0, icon: 'ClipboardCheck' },
    { label: 'Собеседований', value: statusCounts['interview'] || 0, icon: 'CalendarDays' },
    { label: 'Офферов выдано', value: statusCounts['offer'] || 0, icon: 'Award' },
    { label: 'Отказов', value: statusCounts['reject'] || 0, icon: 'UserX' },
  ];

  if (!connected) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4 text-center animate-fade-in">
        <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
          <Icon name="Link" size={22} className="text-muted-foreground" />
        </div>
        <div>
          <div className="text-sm font-medium text-foreground mb-1">HH.ru не подключён</div>
          <div className="text-xs text-muted-foreground">Перейдите в Настройки → Интеграции и подключите аккаунт</div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 animate-fade-in">
      {/* Stats Row */}
      <div className="grid grid-cols-6 gap-2">
        {stats.map((s) => (
          <div key={s.label} className="panel p-3 flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">{s.label}</span>
              <Icon name={s.icon} size={13} className="text-muted-foreground" />
            </div>
            <div className="flex items-end gap-2">
              {loading ? (
                <div className="h-8 w-10 bg-muted rounded animate-pulse" />
              ) : (
                <span className="text-2xl font-semibold font-mono-data text-foreground">{s.value}</span>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-12 gap-3">
        {/* Funnel */}
        <div className="col-span-4 panel">
          <div className="panel-header">
            <span className="text-xs font-semibold text-foreground uppercase tracking-wider">Воронка кандидатов</span>
            <span className="text-xs text-muted-foreground font-mono-data">{candidates.length} всего</span>
          </div>
          <div className="p-3 flex flex-col gap-2">
            {candidates.length === 0 ? (
              <div className="py-6 text-center text-xs text-muted-foreground">Нет данных</div>
            ) : (
              funnelStages.map(({ status, color }) => {
                const count = statusCounts[status] || 0;
                const pct = candidates.length > 0 ? Math.round((count / candidates.length) * 100) : 0;
                return (
                  <div key={status} className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground w-28 shrink-0">{statusLabels[status]}</span>
                    <div className="flex-1 h-4 bg-muted rounded-sm overflow-hidden">
                      <div className={`h-full ${color} opacity-80 transition-all`} style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-xs font-mono-data text-foreground w-6 text-right">{count}</span>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Active Vacancies */}
        <div className="col-span-5 panel">
          <div className="panel-header">
            <span className="text-xs font-semibold text-foreground uppercase tracking-wider">Активные вакансии</span>
          </div>
          {loading ? (
            <div className="py-8 text-center text-xs text-muted-foreground">Загружается...</div>
          ) : vacancies.length === 0 ? (
            <div className="py-8 text-center text-xs text-muted-foreground">Вакансии появятся после подключения HH.ru</div>
          ) : (
            <table className="w-full data-table">
              <thead>
                <tr>
                  <th>Позиция</th>
                  <th>Город</th>
                  <th>Опубликована</th>
                  <th className="text-right">Откликов</th>
                </tr>
              </thead>
              <tbody>
                {vacancies.map((v) => (
                  <tr key={v.id}>
                    <td className="font-medium text-foreground">{v.name}</td>
                    <td className="text-muted-foreground">{v.area}</td>
                    <td className="text-muted-foreground font-mono-data">{v.publishedAt}</td>
                    <td className="text-right">
                      <span className="font-mono-data text-primary font-semibold">{v.candidatesCount}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Activity Feed */}
        <div className="col-span-3 panel">
          <div className="panel-header">
            <span className="text-xs font-semibold text-foreground uppercase tracking-wider">Активность</span>
          </div>
          {historyLogs.length === 0 ? (
            <div className="py-8 text-center text-xs text-muted-foreground">История пуста</div>
          ) : (
            <div className="divide-y divide-border/50">
              {historyLogs.slice(0, 6).map((log) => (
                <div key={log.id} className="px-3 py-2">
                  <div className="flex items-start justify-between gap-1">
                    <span className="text-xs font-medium text-foreground">{log.candidateName}</span>
                    <span className="text-xs text-muted-foreground font-mono-data shrink-0">{log.timestamp.slice(11)}</span>
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">{log.action}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Recent Candidates */}
      <div className="panel">
        <div className="panel-header">
          <span className="text-xs font-semibold text-foreground uppercase tracking-wider">Последние кандидаты</span>
          <span className="text-xs text-muted-foreground">Сортировка: по дате обновления</span>
        </div>
        {recent.length === 0 ? (
          <div className="py-8 text-center text-xs text-muted-foreground">Нет кандидатов</div>
        ) : (
          <table className="w-full data-table">
            <thead>
              <tr>
                <th>Имя</th>
                <th>Позиция</th>
                <th>Источник</th>
                <th>Статус</th>
                <th>Балл теста</th>
                <th>Обновлён</th>
              </tr>
            </thead>
            <tbody>
              {recent.map((c) => (
                <tr key={c.id} className="cursor-pointer">
                  <td className="font-medium text-foreground">{c.name}</td>
                  <td className="text-muted-foreground">{c.position}</td>
                  <td className="text-muted-foreground">{c.source}</td>
                  <td><StatusBadge status={c.status} /></td>
                  <td>
                    {c.score !== null ? (
                      <span className={`font-mono-data text-xs ${c.score >= 75 ? 'stat-up' : c.score >= 60 ? 'text-yellow-400' : 'stat-down'}`}>
                        {c.score}/100
                      </span>
                    ) : <span className="text-muted-foreground text-xs">—</span>}
                  </td>
                  <td className="text-muted-foreground font-mono-data">{c.updatedAt}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}