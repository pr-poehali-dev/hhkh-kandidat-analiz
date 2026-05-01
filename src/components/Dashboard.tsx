import { candidates, vacancies, historyLogs, statusLabels, CandidateStatus } from '@/data/mockData';
import Icon from '@/components/ui/icon';
import StatusBadge from '@/components/StatusBadge';

const statusCounts = candidates.reduce((acc, c) => {
  acc[c.status] = (acc[c.status] || 0) + 1;
  return acc;
}, {} as Record<string, number>);

const stats = [
  { label: 'Активных вакансий', value: '5', delta: '+1', up: true, icon: 'Briefcase' },
  { label: 'Всего кандидатов', value: '156', delta: '+12', up: true, icon: 'Users' },
  { label: 'Новых откликов', value: '23', delta: '+8', up: true, icon: 'UserPlus' },
  { label: 'Прошли тест', value: '68%', delta: '-4%', up: false, icon: 'ClipboardCheck' },
  { label: 'Офферов выдано', value: '3', delta: '=', up: true, icon: 'Award' },
  { label: 'Отказов', value: '18', delta: '+5', up: false, icon: 'UserX' },
];

const funnelStages: { status: CandidateStatus; color: string }[] = [
  { status: 'new', color: 'bg-blue-500' },
  { status: 'review', color: 'bg-yellow-500' },
  { status: 'test', color: 'bg-purple-500' },
  { status: 'interview', color: 'bg-cyan-500' },
  { status: 'offer', color: 'bg-green-500' },
  { status: 'reject', color: 'bg-red-500' },
];

export default function Dashboard() {
  const recent = [...candidates].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 6);

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
              <span className="text-2xl font-semibold font-mono-data text-foreground">{s.value}</span>
              <span className={`text-xs mb-0.5 font-mono-data ${s.delta === '=' ? 'stat-neutral' : s.up ? 'stat-up' : 'stat-down'}`}>{s.delta}</span>
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
            {funnelStages.map(({ status, color }) => {
              const count = statusCounts[status] || 0;
              const pct = Math.round((count / candidates.length) * 100);
              return (
                <div key={status} className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground w-28 shrink-0">{statusLabels[status]}</span>
                  <div className="flex-1 h-4 bg-muted rounded-sm overflow-hidden">
                    <div className={`h-full ${color} opacity-80 transition-all`} style={{ width: `${pct}%` }} />
                  </div>
                  <span className="text-xs font-mono-data text-foreground w-6 text-right">{count}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Active Vacancies */}
        <div className="col-span-5 panel">
          <div className="panel-header">
            <span className="text-xs font-semibold text-foreground uppercase tracking-wider">Активные вакансии</span>
            <button className="text-xs text-primary hover:underline">Все →</button>
          </div>
          <table className="w-full data-table">
            <thead>
              <tr>
                <th>Позиция</th>
                <th>Отдел</th>
                <th>Открыта</th>
                <th className="text-right">Откликов</th>
              </tr>
            </thead>
            <tbody>
              {vacancies.map((v) => (
                <tr key={v.id} className="cursor-pointer">
                  <td className="font-medium text-foreground">{v.title}</td>
                  <td className="text-muted-foreground">{v.department}</td>
                  <td className="text-muted-foreground font-mono-data">{v.openSince}</td>
                  <td className="text-right">
                    <span className="font-mono-data text-primary font-semibold">{v.candidates}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Activity Feed */}
        <div className="col-span-3 panel">
          <div className="panel-header">
            <span className="text-xs font-semibold text-foreground uppercase tracking-wider">Активность</span>
          </div>
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
        </div>
      </div>

      {/* Recent Candidates */}
      <div className="panel">
        <div className="panel-header">
          <span className="text-xs font-semibold text-foreground uppercase tracking-wider">Последние кандидаты</span>
          <span className="text-xs text-muted-foreground">Сортировка: по дате обновления</span>
        </div>
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
      </div>
    </div>
  );
}