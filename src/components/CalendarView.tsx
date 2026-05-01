import { interviews } from '@/data/mockData';
import Icon from '@/components/ui/icon';

const typeIcon: Record<string, string> = {
  phone: 'Phone',
  video: 'Video',
  office: 'Building2',
};

const typeLabel: Record<string, string> = {
  phone: 'Телефон',
  video: 'Видео',
  office: 'Офис',
};

const typeColor: Record<string, string> = {
  phone: 'border-l-yellow-500',
  video: 'border-l-cyan-500',
  office: 'border-l-green-500',
};

const DAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
const HOURS = ['09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00'];

const weekDates = Array.from({ length: 7 }, (_, i) => {
  const d = new Date('2026-05-04');
  d.setDate(d.getDate() + i);
  return d.toISOString().slice(0, 10);
});

export default function CalendarView() {
  return (
    <div className="flex flex-col gap-3 animate-fade-in">
      <div className="grid grid-cols-12 gap-3">
        {/* Weekly Grid */}
        <div className="col-span-9 panel">
          <div className="panel-header">
            <div className="flex items-center gap-3">
              <button className="text-muted-foreground hover:text-foreground"><Icon name="ChevronLeft" size={14} /></button>
              <span className="text-xs font-semibold text-foreground">05 — 11 мая 2026</span>
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
                      <div className={`font-medium ${date === '2026-05-01' ? 'text-primary' : 'text-foreground'}`}>{DAYS[i]}</div>
                      <div className="text-muted-foreground font-mono-data">{date.slice(8)}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {HOURS.map((hour) => (
                  <tr key={hour} className="group">
                    <td className="px-2 py-2 text-muted-foreground font-mono-data border-r border-border text-right text-xs align-top">{hour}</td>
                    {weekDates.map((date) => {
                      const evt = interviews.find((iv) => iv.date === date && iv.time === hour);
                      return (
                        <td key={date} className="border-r border-b border-border/30 p-0.5 align-top h-10 group-hover:bg-muted/10 relative">
                          {evt && (
                            <div className={`border-l-2 ${typeColor[evt.type]} bg-muted/80 rounded-sm px-1.5 py-1 cursor-pointer hover:bg-secondary transition-colors`}>
                              <div className="font-medium text-foreground leading-tight">{evt.candidateName.split(' ')[0]}</div>
                              <div className="text-muted-foreground text-xs">{evt.position.split(' ')[0]}</div>
                            </div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Sidebar: Upcoming */}
        <div className="col-span-3 flex flex-col gap-3">
          <div className="panel">
            <div className="panel-header">
              <span className="text-xs font-semibold text-foreground uppercase tracking-wider">Ближайшие</span>
              <button className="text-xs text-primary hover:underline flex items-center gap-1">
                <Icon name="Plus" size={11} />
                Добавить
              </button>
            </div>
            <div className="divide-y divide-border/50">
              {interviews.map((iv) => (
                <div key={iv.id} className={`px-3 py-2.5 border-l-2 ${typeColor[iv.type]} cursor-pointer hover:bg-muted/20 transition-colors`}>
                  <div className="flex items-center justify-between gap-1">
                    <span className="font-medium text-foreground text-xs">{iv.candidateName}</span>
                    <span className="text-xs font-mono-data text-muted-foreground">{iv.time}</span>
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">{iv.position}</div>
                  <div className="flex items-center gap-2 mt-1">
                    <Icon name={typeIcon[iv.type]} size={10} className="text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">{typeLabel[iv.type]}</span>
                    <span className="text-xs text-muted-foreground ml-auto">{iv.date.slice(5).replace('-', '.')}</span>
                  </div>
                  <div className="text-xs text-muted-foreground/60 mt-0.5">{iv.interviewer}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="panel">
            <div className="panel-header">
              <span className="text-xs font-semibold text-foreground uppercase tracking-wider">Интервьюеры</span>
            </div>
            <div className="p-3 flex flex-col gap-2">
              {['Анна Семёнова', 'Игорь Тихонов', 'Михаил Орлов'].map((person) => {
                const cnt = interviews.filter((i) => i.interviewer === person).length;
                return (
                  <div key={person} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-5 h-5 rounded-full bg-muted flex items-center justify-center text-xs text-foreground">
                        {person[0]}
                      </div>
                      <span className="text-xs text-foreground">{person}</span>
                    </div>
                    <span className="text-xs font-mono-data text-muted-foreground">{cnt} встр.</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
