import { useState } from 'react';
import { candidates as mockCandidates, CandidateStatus, statusLabels } from '@/data/mockData';
import { useHHResponses } from '@/hooks/useHHResponses';
import StatusBadge from '@/components/StatusBadge';
import Icon from '@/components/ui/icon';

const statuses: CandidateStatus[] = ['new', 'review', 'test', 'interview', 'offer', 'reject'];
const sources = ['Все', 'HH.ru', 'Telegram', 'LinkedIn', 'Habr', 'SuperJob'];

export default function Responses({ onSelectCandidate }: { onSelectCandidate: (id: string) => void }) {
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterSource, setFilterSource] = useState('Все');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<string[]>([]);

  const { candidates: hhCandidates, loading, error, connected, refresh } = useHHResponses();

  // Если HH.ru подключён — показываем реальные данные, иначе моковые
  const allCandidates = connected ? hhCandidates : mockCandidates;

  const filtered = allCandidates.filter((c) => {
    if (filterStatus !== 'all' && c.status !== filterStatus) return false;
    if (filterSource !== 'Все' && c.source !== filterSource) return false;
    if (search && !c.name.toLowerCase().includes(search.toLowerCase()) && !c.position.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const toggleSelect = (id: string) => {
    setSelected((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  };

  return (
    <div className="flex flex-col gap-3 animate-fade-in">

      {/* HH Banner */}
      {connected && (
        <div className={`panel p-2.5 flex items-center gap-2 border-green-500/20 bg-green-500/5`}>
          <Icon name="CheckCircle2" size={13} className="text-green-500 shrink-0" />
          <span className="text-xs text-foreground">
            Данные из <strong>HH.ru</strong> — {loading ? 'загружается...' : `${hhCandidates.length} откликов`}
          </span>
          <button onClick={refresh} disabled={loading} className="ml-auto text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 disabled:opacity-50">
            <Icon name="RefreshCw" size={11} className={loading ? 'animate-spin' : ''} />
            Обновить
          </button>
        </div>
      )}

      {!connected && (
        <div className="panel p-2.5 flex items-center gap-2 border-yellow-500/20 bg-yellow-500/5">
          <Icon name="AlertCircle" size={13} className="text-yellow-500 shrink-0" />
          <span className="text-xs text-muted-foreground">
            Показаны <strong>тестовые данные</strong>. Подключите HH.ru в Настройках → Интеграции для загрузки реальных откликов.
          </span>
        </div>
      )}

      {error && (
        <div className="panel p-2.5 flex items-center gap-2 border-destructive/20 bg-destructive/5">
          <Icon name="AlertCircle" size={13} className="text-destructive shrink-0" />
          <span className="text-xs text-destructive">{error}</span>
        </div>
      )}

      {/* Toolbar */}
      <div className="panel p-2 flex items-center gap-2 flex-wrap">
        <div className="relative">
          <Icon name="Search" size={13} className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Поиск по имени, должности..."
            className="bg-muted border border-border rounded pl-7 pr-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground outline-none focus:border-primary w-64"
          />
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => setFilterStatus('all')}
            className={`px-2 py-1 rounded text-xs transition-colors ${filterStatus === 'all' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:text-foreground'}`}
          >
            Все ({allCandidates.length})
          </button>
          {statuses.map((s) => {
            const cnt = allCandidates.filter((c) => c.status === s).length;
            return (
              <button
                key={s}
                onClick={() => setFilterStatus(s)}
                className={`px-2 py-1 rounded text-xs transition-colors ${filterStatus === s ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:text-foreground'}`}
              >
                {statusLabels[s]} ({cnt})
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-1 ml-auto">
          <span className="text-xs text-muted-foreground">Источник:</span>
          {sources.map((src) => (
            <button
              key={src}
              onClick={() => setFilterSource(src)}
              className={`px-2 py-1 rounded text-xs transition-colors ${filterSource === src ? 'bg-secondary text-foreground' : 'bg-muted text-muted-foreground hover:text-foreground'}`}
            >
              {src}
            </button>
          ))}
        </div>
      </div>

      {/* Bulk Actions */}
      {selected.length > 0 && (
        <div className="panel p-2 flex items-center gap-3 border-primary/40 bg-primary/5">
          <span className="text-xs text-foreground">Выбрано: <strong>{selected.length}</strong></span>
          <button className="text-xs bg-muted px-2 py-1 rounded hover:bg-secondary transition-colors text-foreground">Отправить тест</button>
          <button className="text-xs bg-muted px-2 py-1 rounded hover:bg-secondary transition-colors text-foreground">Написать письмо</button>
          <button className="text-xs bg-destructive/20 text-destructive px-2 py-1 rounded hover:bg-destructive/30 transition-colors">Отклонить</button>
          <button className="text-xs text-muted-foreground ml-auto" onClick={() => setSelected([])}>Сбросить</button>
        </div>
      )}

      {/* Table */}
      <div className="panel">
        <div className="panel-header">
          <span className="text-xs font-semibold text-foreground uppercase tracking-wider">
            Отклики <span className="text-muted-foreground font-normal ml-1 font-mono-data">{filtered.length}</span>
          </span>
          <button className="text-xs bg-primary text-primary-foreground px-2 py-1 rounded flex items-center gap-1 hover:opacity-90">
            <Icon name="Plus" size={11} />
            Добавить вручную
          </button>
        </div>

        {loading && hhCandidates.length === 0 ? (
          <div className="p-8 flex flex-col items-center gap-3 text-muted-foreground">
            <Icon name="Loader2" size={24} className="animate-spin" />
            <span className="text-sm">Загружаем отклики с HH.ru...</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-8 flex flex-col items-center gap-2 text-muted-foreground">
            <Icon name="Inbox" size={24} />
            <span className="text-sm">Откликов не найдено</span>
          </div>
        ) : (
          <table className="w-full data-table">
            <thead>
              <tr>
                <th className="w-8">
                  <input type="checkbox" className="w-3 h-3" onChange={() => {}} />
                </th>
                <th>Кандидат</th>
                <th>Позиция</th>
                <th>Город</th>
                <th>Опыт</th>
                <th>Зарплата</th>
                <th>Источник</th>
                <th>Статус</th>
                <th>Тест</th>
                <th>Дата</th>
                <th className="w-8"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => (
                <tr key={c.id} className={`cursor-pointer ${selected.includes(c.id) ? 'bg-primary/5' : ''}`}>
                  <td onClick={(e) => { e.stopPropagation(); toggleSelect(c.id); }}>
                    <input type="checkbox" className="w-3 h-3" checked={selected.includes(c.id)} onChange={() => toggleSelect(c.id)} />
                  </td>
                  <td className="font-medium text-foreground" onClick={() => onSelectCandidate(c.id)}>
                    <div>{c.name}</div>
                    <div className="text-xs text-muted-foreground">{c.email}</div>
                  </td>
                  <td className="text-muted-foreground">{c.position}</td>
                  <td className="text-muted-foreground">{c.city}</td>
                  <td className="font-mono-data text-muted-foreground">{c.experience} лет</td>
                  <td className="font-mono-data text-foreground">{c.salary} ₽</td>
                  <td className="text-muted-foreground">{c.source}</td>
                  <td><StatusBadge status={c.status} /></td>
                  <td>
                    {c.score !== null ? (
                      <span className={`font-mono-data text-xs ${c.score >= 75 ? 'stat-up' : c.score >= 60 ? 'text-yellow-400' : 'stat-down'}`}>
                        {c.score}/100
                      </span>
                    ) : <span className="text-muted-foreground text-xs">—</span>}
                  </td>
                  <td className="text-muted-foreground font-mono-data text-xs">{c.appliedAt}</td>
                  <td>
                    <button className="text-muted-foreground hover:text-foreground" onClick={() => onSelectCandidate(c.id)}>
                      <Icon name="ChevronRight" size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
