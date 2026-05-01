import { useState } from 'react';
import Icon from '@/components/ui/icon';

const templates = [
  { id: 't1', name: 'Приглашение на собеседование', type: 'email', used: 24 },
  { id: 't2', name: 'Отказ после тестового задания', type: 'email', used: 18 },
  { id: 't3', name: 'Тестовое задание — инструкция', type: 'email', used: 31 },
  { id: 't4', name: 'Оффер — шаблон', type: 'email', used: 7 },
];

const criteria = [
  { id: 'cr1', label: 'Минимальный опыт', value: '2 года', editable: true },
  { id: 'cr2', label: 'Проходной балл теста', value: '60/100', editable: true },
  { id: 'cr3', label: 'Максимальный срок обработки', value: '3 дня', editable: true },
  { id: 'cr4', label: 'Автоотправка теста', value: 'Включена', editable: true },
  { id: 'cr5', label: 'Автоотказ при балле <40', value: 'Включена', editable: true },
];

export default function Settings() {
  const [activeTab, setActiveTab] = useState<'criteria' | 'templates' | 'integrations'>('criteria');

  return (
    <div className="flex flex-col gap-3 animate-fade-in">
      <div className="grid grid-cols-12 gap-3">
        {/* Left nav */}
        <div className="col-span-2">
          <div className="panel">
            <div className="panel-header">
              <span className="text-xs font-semibold text-foreground uppercase tracking-wider">Настройки</span>
            </div>
            <div className="p-1 flex flex-col gap-0.5">
              {[
                { id: 'criteria', label: 'Критерии отбора', icon: 'SlidersHorizontal' },
                { id: 'templates', label: 'Шаблоны', icon: 'FileText' },
                { id: 'integrations', label: 'Интеграции', icon: 'Plug' },
              ].map((item) => (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id as typeof activeTab)}
                  className={`nav-item w-full text-left ${activeTab === item.id ? 'active' : ''}`}
                >
                  <Icon name={item.icon} size={13} className={activeTab === item.id ? 'text-primary' : ''} />
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="col-span-10">
          {activeTab === 'criteria' && (
            <div className="panel">
              <div className="panel-header">
                <span className="text-xs font-semibold text-foreground uppercase tracking-wider">Критерии отбора</span>
                <button className="text-xs bg-primary text-primary-foreground px-2 py-1 rounded hover:opacity-90">Сохранить</button>
              </div>
              <div className="p-4 flex flex-col gap-2">
                {criteria.map((cr) => (
                  <div key={cr.id} className="flex items-center justify-between py-2 border-b border-border/50">
                    <div>
                      <div className="text-sm text-foreground font-medium">{cr.label}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        defaultValue={cr.value}
                        className="bg-muted border border-border rounded px-2 py-1 text-xs text-foreground outline-none focus:border-primary w-32 text-right"
                      />
                      <button className="text-muted-foreground hover:text-foreground">
                        <Icon name="Pencil" size={12} />
                      </button>
                    </div>
                  </div>
                ))}

                <div className="mt-4">
                  <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Автоматические правила</div>
                  <div className="flex flex-col gap-2">
                    {[
                      { label: 'Отправлять тест при отклике на Backend-вакансии', on: true },
                      { label: 'Уведомлять HR при балле теста > 80', on: true },
                      { label: 'Автоматически переводить "Новые" → "Рассмотрение" через 24ч', on: false },
                    ].map((rule) => (
                      <div key={rule.label} className="flex items-center justify-between py-2 border-b border-border/50">
                        <span className="text-sm text-foreground">{rule.label}</span>
                        <div className={`w-10 h-5 rounded-full transition-colors cursor-pointer relative ${rule.on ? 'bg-primary' : 'bg-muted border border-border'}`}>
                          <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${rule.on ? 'translate-x-5' : 'translate-x-0.5'}`} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'templates' && (
            <div className="panel">
              <div className="panel-header">
                <span className="text-xs font-semibold text-foreground uppercase tracking-wider">Шаблоны сообщений</span>
                <button className="text-xs bg-primary text-primary-foreground px-2 py-1 rounded hover:opacity-90 flex items-center gap-1">
                  <Icon name="Plus" size={11} />
                  Новый шаблон
                </button>
              </div>
              <div className="p-4 flex flex-col gap-2">
                {templates.map((t) => (
                  <div key={t.id} className="border border-border rounded p-3 hover:border-primary/40 transition-colors cursor-pointer">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Icon name="Mail" size={13} className="text-muted-foreground" />
                        <span className="text-sm font-medium text-foreground">{t.name}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-muted-foreground font-mono-data">{t.used} использований</span>
                        <button className="text-xs text-primary hover:underline">Редактировать</button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'integrations' && (
            <div className="panel">
              <div className="panel-header">
                <span className="text-xs font-semibold text-foreground uppercase tracking-wider">Интеграции</span>
              </div>
              <div className="p-4 flex flex-col gap-3">
                {[
                  { name: 'HH.ru', desc: 'Автоматический импорт откликов с HeadHunter', status: 'Подключено', on: true, icon: 'Link' },
                  { name: 'Telegram Bot', desc: 'Уведомления и управление через Telegram', status: 'Не настроено', on: false, icon: 'MessageCircle' },
                  { name: 'Google Calendar', desc: 'Синхронизация собеседований с Google Calendar', status: 'Не настроено', on: false, icon: 'Calendar' },
                  { name: 'REST API', desc: 'Доступ к данным через внешний API', status: 'Активен', on: true, icon: 'Code2' },
                ].map((item) => (
                  <div key={item.name} className="border border-border rounded p-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-muted rounded flex items-center justify-center">
                        <Icon name={item.icon} size={14} className="text-foreground" />
                      </div>
                      <div>
                        <div className="text-sm font-medium text-foreground">{item.name}</div>
                        <div className="text-xs text-muted-foreground">{item.desc}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`text-xs ${item.on ? 'stat-up' : 'text-muted-foreground'}`}>{item.status}</span>
                      <button className={`text-xs px-2.5 py-1 rounded border transition-colors ${item.on ? 'border-border text-muted-foreground hover:text-foreground' : 'border-primary text-primary hover:bg-primary hover:text-primary-foreground'}`}>
                        {item.on ? 'Настроить' : 'Подключить'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
