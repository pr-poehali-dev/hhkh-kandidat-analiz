import Icon from '@/components/ui/icon';
import { useState } from 'react';

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
        </div>

        <div className="py-12 flex flex-col items-center gap-3 text-muted-foreground">
          <Icon name={tab === 'logs' ? 'Activity' : tab === 'archive' ? 'Archive' : 'RefreshCw'} size={24} />
          <span className="text-sm">
            {tab === 'logs' && 'История действий появится здесь'}
            {tab === 'archive' && 'Архив кандидатов пуст'}
            {tab === 'repeat' && 'Повторных кандидатов нет'}
          </span>
        </div>
      </div>
    </div>
  );
}
