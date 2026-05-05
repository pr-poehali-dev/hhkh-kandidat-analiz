import Icon from '@/components/ui/icon';

const DAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
const HOURS = ['09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00'];

const weekDates = Array.from({ length: 7 }, (_, i) => {
  const d = new Date();
  const day = d.getDay();
  const diff = i - (day === 0 ? 6 : day - 1);
  d.setDate(d.getDate() + diff);
  return d.toISOString().slice(0, 10);
});

const monthLabel = new Date(weekDates[0]).toLocaleString('ru', { month: 'long', year: 'numeric' });

export default function CalendarView() {
  return (
    <div className="flex flex-col gap-3 animate-fade-in">
      <div className="grid grid-cols-12 gap-3">
        {/* Weekly Grid */}
        <div className="col-span-9 panel">
          <div className="panel-header">
            <div className="flex items-center gap-3">
              <button className="text-muted-foreground hover:text-foreground"><Icon name="ChevronLeft" size={14} /></button>
              <span className="text-xs font-semibold text-foreground capitalize">{monthLabel}</span>
              <button className="text-muted-foreground hover:text-foreground"><Icon name="ChevronRight" size={14} /></button>
            </div>
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-yellow-500 inline-block"></span>Телефон</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-cyan-500 inline-block"></span>Видео</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500 inline-block"></span>Офис</span>
            </div>
          </div>
          <div className="overflow-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr>
                  <th className="w-14 px-2 py-2 text-muted-foreground font-normal border-b border-r border-border"></th>
                  {weekDates.map((date, i) => (
                    <th key={date} className="px-2 py-2 border-b border-r border-border font-normal text-center">
                      <div className="font-medium text-foreground">{DAYS[i]}</div>
                      <div className="text-muted-foreground font-mono-data">{date.slice(8)}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {HOURS.map((hour) => (
                  <tr key={hour} className="group">
                    <td className="px-2 py-2 text-muted-foreground font-mono-data border-r border-border text-right text-xs align-top">{hour}</td>
                    {weekDates.map((date) => (
                      <td key={date} className="border-r border-b border-border/30 p-0.5 align-top h-10 group-hover:bg-muted/10" />
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Sidebar */}
        <div className="col-span-3 flex flex-col gap-3">
          <div className="panel">
            <div className="panel-header">
              <span className="text-xs font-semibold text-foreground uppercase tracking-wider">Ближайшие</span>
              <button className="text-xs text-primary hover:underline flex items-center gap-1">
                <Icon name="Plus" size={11} />
                Добавить
              </button>
            </div>
            <div className="py-8 text-center text-xs text-muted-foreground">
              Собеседования появятся здесь
            </div>
          </div>

          <div className="panel">
            <div className="panel-header">
              <span className="text-xs font-semibold text-foreground uppercase tracking-wider">Интервьюеры</span>
            </div>
            <div className="py-6 text-center text-xs text-muted-foreground">
              Нет назначенных встреч
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
