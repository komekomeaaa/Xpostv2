
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import ReactDOM from 'react-dom/client';
import { GoogleGenAI } from "@google/genai";

// Helper hook for localStorage
function useLocalStorage<T>(key: string, initialValue: T): [T, (value: T | ((val: T) => T)) => void] {
  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      console.error(error);
      return initialValue;
    }
  });

  const setValue = (value: T | ((val: T) => T)) => {
    try {
      const valueToStore = value instanceof Function ? value(storedValue) : value;
      setStoredValue(valueToStore);
      window.localStorage.setItem(key, JSON.stringify(valueToStore));
    } catch (error) {
      console.error(error);
    }
  };

  return [storedValue, setValue];
}

const initialSettings = {
    persona: 'あなたは鋭い洞察力を持つテクノロジー専門家です。',
    sources: [],
    scheduleTimes: ['09:00'],
    postsPerDay: 10,
    xApiKey: '',
    xApiSecretKey: '',
    xAccessToken: '',
    xAccessTokenSecret: '',
};

const PasswordInput = ({ label, value, onChange, id }) => {
    const [isVisible, setIsVisible] = useState(false);
    return (
        <div className="form-group">
            <label htmlFor={id}>{label}</label>
            <div className="password-input-wrapper">
                <input
                    id={id}
                    type={isVisible ? 'text' : 'password'}
                    className="input"
                    value={value}
                    onChange={onChange}
                />
                <button type="button" className="password-toggle-btn" onClick={() => setIsVisible(!isVisible)} aria-label={isVisible ? 'Hide password' : 'Show password'}>
                    <span className="material-icons">{isVisible ? 'visibility_off' : 'visibility'}</span>
                </button>
            </div>
        </div>
    );
};

const App = () => {
  const [savedSettings, setSavedSettings] = useLocalStorage('x-post-app-settings', initialSettings);
  const [settings, setSettings] = useState(savedSettings);
  const [view, setView] = useState('main'); // 'main' or 'settings'

  const [sourceInput, setSourceInput] = useState('');
  const [timeInput, setTimeInput] = useState('12:00');

  const [generatedPost, setGeneratedPost] = useState<{ text: string; source: string; } | null>(null);
  const [history, setHistory] = useLocalStorage<{ text: string; source: string; date: string; }[]>('x-post-history', []);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const areSettingsDirty = useMemo(() => JSON.stringify(settings) !== JSON.stringify(savedSettings), [settings, savedSettings]);
  
  const handleSettingsChange = (field: keyof typeof initialSettings, value: any) => {
    setSettings(prev => ({...prev, [field]: value}));
  };

  const addSource = () => {
    if (sourceInput && !settings.sources.includes(sourceInput)) {
      handleSettingsChange('sources', [...settings.sources, sourceInput]);
      setSourceInput('');
    }
  };

  const removeSource = (index: number) => {
    handleSettingsChange('sources', settings.sources.filter((_, i) => i !== index));
  };
  
  const addScheduleTime = () => {
    if (timeInput && !settings.scheduleTimes.includes(timeInput)) {
        handleSettingsChange('scheduleTimes', [...settings.scheduleTimes, timeInput].sort());
        setTimeInput('');
    }
  };

  const removeScheduleTime = (index: number) => {
    handleSettingsChange('scheduleTimes', settings.scheduleTimes.filter((_, i) => i !== index));
  };

  const handleSaveSettings = () => {
    setSavedSettings(settings);
    setView('main'); // Automatically return to main view after saving
  };
  
  const handleResetSettings = () => {
    setSettings(savedSettings);
  };

  const handleGeneratePost = useCallback(async () => {
    if (savedSettings.sources.length === 0) {
      setError('少なくとも1つの情報ソースURLを登録してください。');
      return;
    }
    setError(null);
    setIsLoading(true);
    setGeneratedPost(null);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const randomSource = savedSettings.sources[Math.floor(Math.random() * savedSettings.sources.length)];
      
      const prompt = `
        ${savedSettings.persona}
        
        上記のペルソナに基づき、以下の情報ソースの内容を要約し、X(Twitter)に投稿するためのユニークで魅力的な投稿文を140字以内で作成してください。
        投稿には絵文字を効果的に使用し、読者のエンゲージメントを高める工夫をしてください。
        
        情報ソース: ${randomSource}
      `;

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
      });

      const text = response.text;
      
      if(text) {
        const newPost = { text, source: randomSource };
        setGeneratedPost(newPost);
        const newHistoryItem = { ...newPost, date: new Date().toLocaleString('ja-JP') };
        setHistory([newHistoryItem, ...history].slice(0, 50));
      } else {
        setError("AIから有効な応答がありませんでした。");
      }
    } catch (err) {
      console.error(err);
      setError('投稿の生成中にエラーが発生しました。APIキーまたはプロンプトを確認してください。');
    } finally {
      setIsLoading(false);
    }
  }, [savedSettings, history, setHistory]);

  const renderMainView = () => (
    <main>
        <div className="full-width">
            <button className="btn btn-primary" onClick={handleGeneratePost} disabled={isLoading || savedSettings.sources.length === 0} style={{width: '100%', padding: '16px', fontSize: '1.2rem'}}>
                {isLoading ? '生成中...' : '✨ 新しい投稿を生成する'}
            </button>
        </div>
        
        <section className="card">
            <h2><span className="material-icons">preview</span>AI生成プレビュー</h2>
            <div className="generated-post-container">
            {isLoading && <div className="loader"></div>}
            {error && <div className="error-message">{error}</div>}
            {generatedPost && !isLoading && (
                <div className="generated-post">
                    <p>{generatedPost.text}</p>
                    <p className="source">参照元: {generatedPost.source}</p>
                </div>
            )}
            {!isLoading && !error && !generatedPost && <p>ここに生成された投稿が表示されます。</p>}
            </div>
        </section>

        <section className="card">
          <h2><span className="material-icons">history</span>投稿履歴</h2>
          <div className="history-list card-content">
             <ul className="list">
                {history.map((item, index) => (
                    <li key={index} className="list-item">
                        <p className="history-text">{item.text}</p>
                        <div className="history-meta">
                            <span>参照: {item.source}</span>
                            <span>{item.date}</span>
                        </div>
                    </li>
                ))}
            </ul>
          </div>
        </section>
    </main>
  );

  const renderSettingsView = () => (
    <main>
        <section className="card full-width">
          <div className="settings-header">
            <button className="btn btn-icon" onClick={() => setView('main')} aria-label="メイン画面に戻る">
              <span className="material-icons">arrow_back</span>
            </button>
            <h2><span className="material-icons">settings</span>設定</h2>
          </div>
          <div className="card-content">
            <div className="form-group">
                <label htmlFor="persona">AIへの指示 (ペルソナ)</label>
                <textarea
                id="persona"
                value={settings.persona}
                onChange={(e) => handleSettingsChange('persona', e.target.value)}
                placeholder="例: あなたはフレンドリーなマーケティング専門家です..."
                />
            </div>

            <hr className="divider" />
            <h3 className="settings-subtitle">X (Twitter) API連携</h3>
            <div className="settings-grid">
                <PasswordInput id="xApiKey" label="API Key" value={settings.xApiKey} onChange={e => handleSettingsChange('xApiKey', e.target.value)} />
                <PasswordInput id="xApiSecretKey" label="API Key Secret" value={settings.xApiSecretKey} onChange={e => handleSettingsChange('xApiSecretKey', e.target.value)} />
                <PasswordInput id="xAccessToken" label="Access Token" value={settings.xAccessToken} onChange={e => handleSettingsChange('xAccessToken', e.target.value)} />
                <PasswordInput id="xAccessTokenSecret" label="Access Token Secret" value={settings.xAccessTokenSecret} onChange={e => handleSettingsChange('xAccessTokenSecret', e.target.value)} />
            </div>

            <hr className="divider" />
            <h3 className="settings-subtitle">コンテンツ設定</h3>
            <div className="settings-grid">
                <div className="form-group">
                    <label htmlFor="sources">情報ソース (URL)</label>
                    <div className="flex-form">
                        <input
                            id="sources"
                            type="url"
                            className="input"
                            value={sourceInput}
                            onChange={(e) => setSourceInput(e.target.value)}
                            onKeyPress={(e) => e.key === 'Enter' && addSource()}
                            placeholder="https://example.com/article"
                        />
                        <button onClick={addSource} className="btn btn-primary">追加</button>
                    </div>
                    <ul className="list">
                        {settings.sources.map((source, index) => (
                        <li key={index} className="list-item">
                            <span>{source}</span>
                            <button onClick={() => removeSource(index)} className="btn btn-danger" aria-label={`Remove ${source}`}>
                                <span className="material-icons">delete</span>
                            </button>
                        </li>
                        ))}
                    </ul>
                </div>
                <div className="form-group">
                    <label htmlFor="schedule">投稿スケジュール</label>
                    <div className="flex-form">
                        <input 
                            id="schedule"
                            type="time" 
                            className="input" 
                            value={timeInput}
                            onChange={(e) => setTimeInput(e.target.value)}
                        />
                        <button onClick={addScheduleTime} className="btn btn-primary">追加</button>
                    </div>
                    <ul className="list">
                        {settings.scheduleTimes.map((time, index) => (
                            <li key={index} className="list-item">
                                <span>{time}</span>
                                <button onClick={() => removeScheduleTime(index)} className="btn btn-danger" aria-label={`Remove ${time}`}>
                                <span className="material-icons">delete</span>
                                </button>
                            </li>
                        ))}
                    </ul>
                </div>
            </div>
            <div className="form-group">
                <label htmlFor="postsPerDay">1日の最大投稿回数</label>
                <input
                    id="postsPerDay"
                    type="number"
                    className="input"
                    value={settings.postsPerDay}
                    onChange={(e) => handleSettingsChange('postsPerDay', Number(e.target.value))}
                    min="1"
                    max="50"
                />
            </div>
          </div>
          <div className="settings-actions">
                <button className="btn btn-secondary" onClick={handleResetSettings} disabled={!areSettingsDirty}>変更をリセット</button>
                <button className="btn btn-primary" onClick={handleSaveSettings} disabled={!areSettingsDirty}>設定を保存</button>
          </div>
        </section>
    </main>
  );

  return (
    <>
      <header>
        <h1>X Auto Post AI</h1>
        {view === 'main' && (
            <button className="btn btn-icon" onClick={() => setView('settings')} aria-label="設定を開く">
                <span className="material-icons">settings</span>
            </button>
        )}
      </header>
      {view === 'main' ? renderMainView() : renderSettingsView()}
    </>
  );
};

const container = document.getElementById('root');
const root = ReactDOM.createRoot(container!);
root.render(<App />);
