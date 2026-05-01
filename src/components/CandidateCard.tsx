import { candidates, historyLogs } from '@/data/mockData';
import StatusBadge from '@/components/StatusBadge';
import Icon from '@/components/ui/icon';

export default function CandidateCard({ candidateId, onBack }: { candidateId: string; onBack: () => void }) {
  const c = candidates.find((x) => x.id === candidateId);
  if (!c) return null;

  const logs = historyLogs.filter((l) => l.candidateId === candidateId);

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
                { icon: 'Phone', label: c.phone },
                { icon: 'Mail', label: c.email },
                { icon: 'MapPin', label: c.city },
                { icon: 'Globe', label: c.source },
              ].map((row) => (
                <div key={row.label} className="flex items-center gap-2">
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
                { label: 'Опыт работы', value: `${c.experience} лет` },
                { label: 'Ожидаемая ЗП', value: `${c.salary} ₽` },
                { label: 'Дата отклика', value: c.appliedAt },
                { label: 'Обновлён', value: c.updatedAt },
              ].map((row) => (
                <div key={row.label} className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">{row.label}</span>
                  <span className="text-xs font-mono-data text-foreground">{row.value}</span>
                </div>
              ))}
            </div>
          </div>

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
        </div>

        {/* Center: Resume */}
        <div className="col-span-6 panel">
          <div className="panel-header">
            <span className="text-xs font-semibold text-foreground uppercase tracking-wider">Резюме</span>
            <button className="text-xs text-primary hover:underline flex items-center gap-1">
              <Icon name="Download" size={11} />
              Скачать PDF
            </button>
          </div>
          <div className="p-4">
            <div className="text-xs text-muted-foreground mb-4">Резюме загружено с {c.source}</div>

            <div className="flex flex-col gap-4">
              <div>
                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Опыт работы</div>
                <div className="flex flex-col gap-3">
                  <div className="border-l-2 border-primary/40 pl-3">
                    <div className="text-sm font-medium text-foreground">{c.position}</div>
                    <div className="text-xs text-muted-foreground">ООО «Технологии» · 2022 — н.в.</div>
                    <div className="text-xs text-foreground/70 mt-1">Разработка и поддержка продуктовых решений. Работа в команде {Math.ceil(c.experience * 1.5)} человек.</div>
                  </div>
                  {c.experience > 2 && (
                    <div className="border-l-2 border-border pl-3">
                      <div className="text-sm font-medium text-foreground">Junior {c.position}</div>
                      <div className="text-xs text-muted-foreground">ИП Решения · 2020 — 2022</div>
                    </div>
                  )}
                </div>
              </div>

              <div>
                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Образование</div>
                <div className="border-l-2 border-border pl-3">
                  <div className="text-sm font-medium text-foreground">Бакалавр, Прикладная информатика</div>
                  <div className="text-xs text-muted-foreground">МГУ им. Ломоносова · 2016 — 2020</div>
                </div>
              </div>

              <div>
                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Навыки</div>
                <div className="flex flex-wrap gap-1.5">
                  {[...c.tags, 'Git', 'Agile', 'English B2'].map((t) => (
                    <span key={t} className="bg-muted border border-border text-xs px-2 py-0.5 rounded text-foreground">{t}</span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Test + History */}
        <div className="col-span-3 flex flex-col gap-3">
          <div className="panel">
            <div className="panel-header">
              <span className="text-xs font-semibold text-foreground uppercase tracking-wider">Результат теста</span>
            </div>
            <div className="p-3">
              {c.score !== null ? (
                <div className="flex flex-col gap-2">
                  <div className="flex items-end gap-2">
                    <span className={`text-3xl font-semibold font-mono-data ${c.score >= 75 ? 'stat-up' : c.score >= 60 ? 'text-yellow-400' : 'stat-down'}`}>
                      {c.score}
                    </span>
                    <span className="text-sm text-muted-foreground mb-1">/100</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${c.score >= 75 ? 'bg-green-500' : c.score >= 60 ? 'bg-yellow-500' : 'bg-red-500'}`}
                      style={{ width: `${c.score}%` }}
                    />
                  </div>
                  <div className="text-xs text-muted-foreground">Проходной балл: 60/100</div>
                  {[
                    { label: 'Техн. знания', val: Math.round(c.score * 1.1 > 100 ? 97 : c.score * 1.1) },
                    { label: 'Логика', val: Math.round(c.score * 0.95) },
                    { label: 'Задачи', val: Math.round(c.score * 0.9) },
                  ].map((row) => (
                    <div key={row.label} className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground w-28 shrink-0">{row.label}</span>
                      <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                        <div className="h-full bg-primary/60 rounded-full" style={{ width: `${row.val}%` }} />
                      </div>
                      <span className="text-xs font-mono-data text-foreground">{row.val}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2 py-3 text-center">
                  <Icon name="ClipboardList" size={24} className="text-muted-foreground/50" />
                  <span className="text-xs text-muted-foreground">Тест ещё не пройден</span>
                  <button className="text-xs bg-primary text-primary-foreground px-3 py-1.5 rounded hover:opacity-90">Отправить тест</button>
                </div>
              )}
            </div>
          </div>

          <div className="panel flex-1">
            <div className="panel-header">
              <span className="text-xs font-semibold text-foreground uppercase tracking-wider">История</span>
            </div>
            <div className="divide-y divide-border/50">
              {logs.length > 0 ? logs.map((log) => (
                <div key={log.id} className="px-3 py-2">
                  <div className="flex items-start justify-between gap-1">
                    <span className="text-xs font-medium text-foreground">{log.action}</span>
                    <span className="text-xs text-muted-foreground font-mono-data shrink-0">{log.timestamp.slice(11)}</span>
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">{log.details}</div>
                  <div className="text-xs text-muted-foreground/60 mt-0.5">{log.user}</div>
                </div>
              )) : (
                <div className="px-3 py-4 text-xs text-muted-foreground text-center">Действий пока нет</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
