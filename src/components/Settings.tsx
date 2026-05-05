import { useState, useEffect, useRef } from 'react';
import Icon from '@/components/ui/icon';

const HH_RESPONSES_URL = 'https://functions.poehali.dev/2a41e2d1-38ab-4c9b-aa98-6800a8333690';
const TESTS_SYNC_URL = 'https://functions.poehali.dev/f02fbdeb-8e4c-41b9-bbbc-619f2b6dbc83';

function PsytestsImport() {
  const [status, setStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle');
  const [result, setResult] = useState<{ imported: number; skipped: number; total: number } | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setStatus('uploading');
    setErrorMsg('');
    setResult(null);
    try {
      const buffer = await file.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      let binary = '';
      for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
      const base64 = btoa(binary);
      const res = await fetch(`${TESTS_SYNC_URL}?action=upload_csv`, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: base64,
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || 'Ошибка загрузки');
      setResult(data);
      setStatus('success');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Ошибка');
      setStatus('error');
    }
    if (fileRef.current) fileRef.current.value = '';
  };

  return (
    <div className="border border-border rounded overflow-hidden">
      <div className="p-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded flex items-center justify-center bg-blue-500/10">
            <Icon name="FileSpreadsheet" size={14} className="text-blue-500" />
          </div>
          <div>
            <div className="text-sm font-medium text-foreground">psytests.org — импорт результатов</div>
            <div className="text-xs text-muted-foreground">Загрузите CSV-файл с результатами тестов Кеттела и Беннета</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {status === 'uploading' && (
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Icon name="Loader2" size={11} className="animate-spin" /> Загрузка...
            </span>
          )}
          {status === 'success' && result && (
            <span className="text-xs stat-up flex items-center gap-1">
              <Icon name="CheckCircle2" size={11} />
              Импортировано: {result.imported}, пропущено: {result.skipped}
            </span>
          )}
          {status === 'error' && (
            <span className="text-xs text-destructive">{errorMsg}</span>
          )}
          <button
            onClick={() => fileRef.current?.click()}
            disabled={status === 'uploading'}
            className="text-xs px-2.5 py-1 rounded border border-primary text-primary hover:bg-primary hover:text-primary-foreground transition-colors disabled:opacity-50"
          >
            Загрузить CSV
          </button>
          <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={handleFile} />
        </div>
      </div>
      <div className="border-t border-border bg-muted/20 px-4 py-2 text-xs text-muted-foreground">
        Как скачать: psytests.org → Данные респондентов → зелёная иконка экспорта (справа от фильтров)
      </div>
    </div>
  );
}

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

function HHIntegration() {
  const [inputValue, setInputValue] = useState('');
  const [refreshValue, setRefreshValue] = useState('');
  const [status, setStatus] = useState<'idle' | 'checking' | 'connected' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [showInput, setShowInput] = useState(false);
  const [hhLogin, setHhLogin] = useState('');

  useEffect(() => {
    const saved = localStorage.getItem('hh_access_token');
    if (saved) {
      setStatus('connected');
      setHhLogin(localStorage.getItem('hh_login') || '');
    }
  }, []);

  const handleSave = () => {
    const t = inputValue.trim();
    if (!t) return;
    setErrorMsg('');
    try {
      localStorage.setItem('hh_access_token', t);
      if (refreshValue.trim()) localStorage.setItem('hh_refresh_token', refreshValue.trim());
      localStorage.setItem('hh_login', 'HH.ru работодатель');
      setHhLogin('HH.ru работодатель');
      setStatus('connected');
      setShowInput(false);
      setInputValue('');
      setRefreshValue('');
    } catch (e) {
      setStatus('error');
      setErrorMsg(e instanceof Error ? e.message : 'Ошибка проверки токена');
    }
  };

  const handleDisconnect = () => {
    localStorage.removeItem('hh_access_token');
    localStorage.removeItem('hh_refresh_token');
    localStorage.removeItem('hh_login');
    setHhLogin('');
    setStatus('idle');
    setShowInput(false);
    setInputValue('');
  };

  const isConnected = status === 'connected';

  return (
    <div className="border border-border rounded overflow-hidden">
      <div className="p-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`w-8 h-8 rounded flex items-center justify-center ${isConnected ? 'bg-green-500/10' : 'bg-muted'}`}>
            <Icon name="Link" size={14} className={isConnected ? 'text-green-500' : 'text-foreground'} />
          </div>
          <div>
            <div className="text-sm font-medium text-foreground">HH.ru</div>
            <div className="text-xs text-muted-foreground">
              {isConnected ? hhLogin || 'Аккаунт подключён' : 'Автоматический импорт откликов с HeadHunter'}
            </div>
            {status === 'error' && <div className="text-xs text-destructive mt-0.5">{errorMsg}</div>}
          </div>
        </div>
        <div className="flex items-center gap-3">
          {isConnected && (
            <span className="text-xs stat-up flex items-center gap-1">
              <Icon name="CheckCircle2" size={11} />
              Подключено
            </span>
          )}
          {status === 'checking' && (
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Icon name="Loader2" size={11} className="animate-spin" />
              Проверка...
            </span>
          )}
          {isConnected ? (
            <button onClick={handleDisconnect} className="text-xs px-2.5 py-1 rounded border border-border text-muted-foreground hover:text-destructive hover:border-destructive transition-colors">
              Отключить
            </button>
          ) : (
            <button onClick={() => setShowInput(!showInput)} className="text-xs px-2.5 py-1 rounded border border-primary text-primary hover:bg-primary hover:text-primary-foreground transition-colors">
              Подключить
            </button>
          )}
        </div>
      </div>

      {/* Инструкция + ввод токена */}
      {showInput && !isConnected && (
        <div className="border-t border-border bg-muted/30 p-4 flex flex-col gap-3">
          <div className="text-xs text-foreground font-medium">Как получить токен:</div>
          <ol className="flex flex-col gap-1.5 text-xs text-muted-foreground list-decimal list-inside">
            <li>Откройте <a href="https://dev.hh.ru/admin" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">dev.hh.ru/admin</a> и войдите как работодатель</li>
            <li>Перейдите в своё приложение <strong className="text-foreground">HEVSR</strong></li>
            <li>В разделе «Тестирование» нажмите <strong className="text-foreground">«Получить токен»</strong></li>
            <li>Скопируйте значение поля <strong className="text-foreground">access_token</strong> и вставьте ниже</li>
          </ol>
          <div className="flex flex-col gap-2">
            <input
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="access_token..."
              className="bg-background border border-border rounded px-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground outline-none focus:border-primary font-mono"
            />
            <input
              value={refreshValue}
              onChange={(e) => setRefreshValue(e.target.value)}
              placeholder="refresh_token (для автообновления)..."
              className="bg-background border border-border rounded px-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground outline-none focus:border-primary font-mono"
            />
            <button
              onClick={handleSave}
              disabled={!inputValue.trim()}
              className="text-xs px-3 py-1.5 rounded bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              Сохранить
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function Settings() {
  const [activeTab, setActiveTab] = useState<'criteria' | 'templates' | 'integrations'>('integrations');

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
                <HHIntegration />
                <PsytestsImport />
                {[
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