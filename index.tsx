
import React, { useState, useEffect, useCallback } from 'react';
import ReactDOM from 'react-dom/client';
import { GoogleGenAI } from "@google/genai";

// Helper hook for localStorage
function useLocalStorage<T>(key: string, initialValue: T): [T, React.Dispatch<React.SetStateAction<T>>] {
  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      console.error(error);
      return initialValue;
    }
  });

  const setValue: React.Dispatch<React.SetStateAction<T>> = (value) => {
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

const App = () => {
  const [sources, setSources] = useLocalStorage<string[]>('x-post-sources', []);
  const [persona, setPersona] = useLocalStorage<string>('x-post-persona', 'あなたは鋭い洞察力を持つテクノロジー専門家です。');
  const [scheduleTimes, setScheduleTimes] = useLocalStorage<string[]>('x-post-scheduleTimes', ['09:00']);
  const [postsPerDay, setPostsPerDay] = useLocalStorage<number>('x-post-postsPerDay', 10);
  
  const [sourceInput, setSourceInput] = useState('');
  const [timeInput, setTimeInput] = useState('12:00');

  const [generatedPost, setGeneratedPost] = useState<{ text: string; source: string; } | null>(null);
  const [history, setHistory] = useLocalStorage<{ text: string; source: string; date: string; }[]>('x-post-history', []);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const addSource = () => {
    if (sourceInput && !sources.includes(sourceInput)) {
      setSources([...sources, sourceInput]);
      setSourceInput('');
    }
  };

  const removeSource = (index: number) => {
    setSources(sources.filter((_, i) => i !== index));
  };
  
  const addScheduleTime = () => {
    if (timeInput && !scheduleTimes.includes(timeInput)) {
        setScheduleTimes([...scheduleTimes, timeInput].sort());
        setTimeInput('');
    }
  };

  const removeScheduleTime = (index: number) => {
    setScheduleTimes(scheduleTimes.filter((_, i) => i !== index));
  };

  const handleGeneratePost = useCallback(async () => {
    if (sources.length === 0) {
      setError('少なくとも1つの情報ソースURLを登録してください。');
      return;
    }
    setError(null);
    setIsLoading(true);
    setGeneratedPost(null);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      // Select a random source URL
      const randomSource = sources[Math.floor(Math.random() * sources.length)];
      
      const prompt = `
        ${persona}
        
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
        setHistory([newHistoryItem, ...history].slice(0, 50)); // Keep last 50 history items
      } else {
        setError("AIから有効な応答がありませんでした。");
      }
    } catch (err) {
      console.error(err);
      setError('投稿の生成中にエラーが発生しました。APIキーまたはプロンプトを確認してください。');
    } finally {
      setIsLoading(false);
    }
  }, [persona, sources, history, setHistory]);

  return (
    <>
      <header>
        <h1>X Auto Post AI</h1>
      </header>
      <main>
        <div className="full-width">
            <button className="btn btn-primary" onClick={handleGeneratePost} disabled={isLoading || sources.length === 0} style={{width: '100%', padding: '16px', fontSize: '1.2rem'}}>
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
          <div className="history-list">
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

        <section className="card full-width">
          <h2><span className="material-icons">settings</span>設定</h2>
          <div className="form-group">
            <label htmlFor="persona">AIへの指示 (ペルソナ)</label>
            <textarea
              id="persona"
              value={persona}
              onChange={(e) => setPersona(e.target.value)}
              placeholder="例: あなたはフレンドリーなマーケティング専門家です..."
            />
          </div>
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
                    {sources.map((source, index) => (
                    <li key={index} className="list-item">
                        <span>{source}</span>
                        <button onClick={() => removeSource(index)} className="btn btn-danger">
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
                    {scheduleTimes.map((time, index) => (
                        <li key={index} className="list-item">
                            <span>{time}</span>
                            <button onClick={() => removeScheduleTime(index)} className="btn btn-danger">
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
                    value={postsPerDay}
                    onChange={(e) => setPostsPerDay(Number(e.target.value))}
                    min="1"
                    max="50"
                />
            </div>
        </section>

      </main>
    </>
  );
};

const container = document.getElementById('root');
const root = ReactDOM.createRoot(container!);
root.render(<App />);
