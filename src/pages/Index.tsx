import { useState } from 'react';
import Icon from '@/components/ui/icon';
import Dashboard from '@/components/Dashboard';
import Responses from '@/components/Responses';
import CandidateCard from '@/components/CandidateCard';
import CalendarView from '@/components/CalendarView';
import HistoryView from '@/components/HistoryView';
import Settings from '@/components/Settings';
import { useCandidates } from '@/hooks/useCandidates';

type Section = 'dashboard' | 'responses' | 'card' | 'calendar' | 'history' | 'settings';

const nav = [
  { id: 'dashboard', label: 'Дашборд', icon: 'LayoutDashboard' },
  { id: 'responses', label: 'Отклики', icon: 'Users', badge: true },
  { id: 'calendar', label: 'Календарь', icon: 'CalendarDays', badge: false },
  { id: 'history', label: 'История', icon: 'Clock' },
  { id: 'settings', label: 'Настройки', icon: 'Settings2' },
];

export default function Index() {
  const [section, setSection] = useState<Section>('dashboard');
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(null);

  const handleSelectCandidate = (id: string) => {
    setSelectedCandidateId(id);
    setSection('card');
  };

  const handleBack = () => {
    setSection('responses');
    setSelectedCandidateId(null);
  };

  const { candidates } = useCandidates();
  const newCount = candidates.filter((c) => c.status === 'new').length;

  const getBadge = (id: string) => {
    if (id === 'responses') return newCount || null;
    return null;
  };

  const currentName = () => {
    if (section === 'dashboard') return 'Дашборд';
    if (section === 'responses') return 'Отклики';
    if (section === 'card') return candidates.find((c) => c.id === selectedCandidateId)?.name ?? 'Карточка';
    if (section === 'calendar') return 'Календарь';
    if (section === 'history') return 'История';
    if (section === 'settings') return 'Настройки';
    return '';
  };

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Sidebar */}
      <aside className="w-52 shrink-0 bg-sidebar flex flex-col border-r border-sidebar-border">
        {/* Logo */}
        <div className="px-3 py-3 border-b border-sidebar-border">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-primary rounded-sm flex items-center justify-center">
              <Icon name="Briefcase" size={14} className="text-primary-foreground" />
            </div>
            <div>
              <div className="text-sm font-semibold text-foreground">HireDesk</div>
              <div className="text-xs text-muted-foreground">HR платформа</div>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-2 flex flex-col gap-0.5">
          {nav.map((item) => {
            const isActive = section === item.id || (section === 'card' && item.id === 'responses');
            const badge = getBadge(item.id);
            return (
              <button
                key={item.id}
                onClick={() => { setSection(item.id as Section); setSelectedCandidateId(null); }}
                className={`nav-item w-full text-left justify-between ${isActive ? 'active' : ''}`}
              >
                <span className="flex items-center gap-2.5">
                  <Icon name={item.icon} size={14} className={isActive ? 'text-primary' : ''} />
                  {item.label}
                </span>
                {badge !== null && (
                  <span className="bg-primary/20 text-primary text-xs font-mono-data px-1.5 py-0.5 rounded-full leading-none">
                    {badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Bottom */}
        <div className="p-2 border-t border-sidebar-border">
          <div className="flex items-center gap-2 px-3 py-2">
            <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-xs text-primary font-medium shrink-0">
              АС
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs text-foreground truncate">Анна Семёнова</div>
              <div className="text-xs text-muted-foreground">HR Manager</div>
            </div>
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Bar */}
        <header className="h-10 shrink-0 border-b border-border flex items-center px-4 gap-3">
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <span>HireDesk</span>
            <Icon name="ChevronRight" size={11} />
            <span className="text-foreground">{currentName()}</span>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <div className="relative">
              <Icon name="Search" size={13} className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                placeholder="Быстрый поиск..."
                className="bg-muted border border-border rounded pl-7 pr-3 py-1 text-xs text-foreground placeholder:text-muted-foreground outline-none focus:border-primary w-48"
              />
            </div>
            <button className="relative text-muted-foreground hover:text-foreground">
              <Icon name="Bell" size={15} />
              <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-destructive rounded-full text-white text-xs flex items-center justify-center leading-none font-mono-data">3</span>
            </button>
            <button className="text-muted-foreground hover:text-foreground">
              <Icon name="HelpCircle" size={15} />
            </button>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-auto p-3">
          {section === 'dashboard' && <Dashboard />}
          {section === 'responses' && <Responses onSelectCandidate={handleSelectCandidate} />}
          {section === 'card' && selectedCandidateId && (
            <CandidateCard candidateId={selectedCandidateId} onBack={handleBack} />
          )}
          {section === 'calendar' && <CalendarView />}
          {section === 'history' && <HistoryView />}
          {section === 'settings' && <Settings />}
        </main>
      </div>
    </div>
  );
}