import { historyLogs, candidates } from '@/data/mockData';
import StatusBadge from '@/components/StatusBadge';
import Icon from '@/components/ui/icon';
import { useState } from 'react';

const repeatCandidates = candidates.filter((_, i) => i % 3 === 0);

export default function HistoryView() {
  const [tab, setTab] = useState<'logs' | 'archive' | 'repeat'>('logs');

  return (
    <div className="flex flex-col gap-3 animate-fade-in">
      <div className="panel">
        <div className="panel-header">
          <div className="flex gap-1">
            {[
              { id: 'logs', label: 'Лог действий', icon: 'Activity' },
              { id: 'archive', label: 'Архив', icon: 'Archive' },
              { id: 'repeat', label: 'Повторные кандидаты', icon: 'RefreshCw' },
            ].map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id as typeof tab)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs transition-colors ${tab === t.id ? 'bg-secondary text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
              >
                <Icon name={t.icon} size={11} />
                {t.label}
              </button>
            ))}
          </div>
          <span className="text-xs text-muted-foreground font-mono-data">
            {tab === 'logs' ? `${historyLogs.length} записей` : tab === 'archive' ? `${candidates.length} архивных` : `${repeatCandidates.length} повторных`}
          </span>
        </div>

        {tab === 'logs' && (
          <table className="w-full data-table">
            <thead>
              <tr>
                <th>Время</th>
                <th>Кандидат</th>
                <th>Действие</th>
                <th>Детали</th>
                <th>Пользователь</th>
              </tr>
            </thead>
            <tbody>
              {historyLogs.map((log) => (
                <tr key={log.id}>
                  <td className="font-mono-data text-muted-foreground">{log.timestamp}</td>
                  <td className="font-medium text-foreground">{log.candidateName}</td>
                  <td>
                    <span className="bg-muted border border-border text-xs px-1.5 py-0.5 rounded text-foreground">{log.action}</span>
                  </td>
                  <td className="text-muted-foreground">{log.details}</td>
                  <td className="text-muted-foreground">{log.user}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {tab === 'archive' && (
          <table className="w-full data-table">
            <thead>
              <tr>
                <th>Кандидат</th>
                <th>Позиция</th>
                <th>Итоговый статус</th>
                <th>Источник</th>
                <th>Тест</th>
                <th>Закрыт</th>
              </tr>
            </thead>
            <tbody>
              {candidates.map((c) => (
                <tr key={c.id}>
                  <td className="font-medium text-foreground">{c.name}</td>
                  <td className="text-muted-foreground">{c.position}</td>
                  <td><StatusBadge status={c.status} /></td>
                  <td className="text-muted-foreground">{c.source}</td>
                  <td>
                    {c.score !== null
                      ? <span className="font-mono-data text-xs text-foreground">{c.score}/100</span>
                      : <span className="text-muted-foreground text-xs">—</span>}
                  </td>
                  <td className="font-mono-data text-muted-foreground">{c.updatedAt}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {tab === 'repeat' && (
          <div className="p-4">
            <div className="text-xs text-muted-foreground mb-3">Кандидаты, которые откликались более одного раза</div>
            <table className="w-full data-table">
              <thead>
                <tr>
                  <th>Кандидат</th>
                  <th>Позиция</th>
                  <th>Откликов</th>
                  <th>Последний статус</th>
                  <th>Дата</th>
                </tr>
              </thead>
              <tbody>
                {repeatCandidates.map((c) => (
                  <tr key={c.id}>
                    <td className="font-medium text-foreground">{c.name}</td>
                    <td className="text-muted-foreground">{c.position}</td>
                    <td>
                      <span className="bg-primary/15 text-primary border border-primary/20 text-xs px-1.5 py-0.5 rounded font-mono-data">
                        {Math.floor(Math.random() * 2) + 2}
                      </span>
                    </td>
                    <td><StatusBadge status={c.status} /></td>
                    <td className="font-mono-data text-muted-foreground">{c.updatedAt}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
