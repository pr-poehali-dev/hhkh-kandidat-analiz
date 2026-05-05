import { useHHResponses } from '@/hooks/useHHResponses';
import StatusBadge from '@/components/StatusBadge';
import Icon from '@/components/ui/icon';

export default function CandidateCard({ candidateId, onBack }: { candidateId: string; onBack: () => void }) {
  const { candidates } = useHHResponses();
  const c = candidates.find((x) => x.id === candidateId);
  if (!c) return null;

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
            <a
              href={`https://hh.ru/resume/${c.id.replace('hh-', '')}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-primary hover:underline flex items-center gap-1"
            >
              <Icon name="ExternalLink" size={11} />
              Открыть на HH.ru
            </a>
          </div>
          <div className="p-4 flex flex-col items-center justify-center gap-3 text-muted-foreground min-h-48">
            <Icon name="FileText" size={28} />
            <div className="text-sm text-center">
              Полное резюме доступно на HH.ru<br />
              <a
                href={`https://hh.ru/resume/${c.id.replace('hh-', '')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline text-xs mt-1 inline-block"
              >
                Открыть резюме →
              </a>
            </div>
          </div>
        </div>

        {/* Right: Test + Status */}
        <div className="col-span-3 flex flex-col gap-3">
          <div className="panel">
            <div className="panel-header">
              <span className="text-xs font-semibold text-foreground uppercase tracking-wider">Результат теста</span>
            </div>
            <div className="p-4 text-center text-xs text-muted-foreground">
              Тест не отправлен
            </div>
          </div>

          <div className="panel">
            <div className="panel-header">
              <span className="text-xs font-semibold text-foreground uppercase tracking-wider">История</span>
            </div>
            <div className="p-4 text-center text-xs text-muted-foreground">
              История пуста
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
