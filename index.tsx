
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
  const [view, setView] = useState('generator'); // 'generator', 'automation', or 'settings'

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
    alert('設定を保存しました。');
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

  const handlePostToX = () => {
    if (!generatedPost) return;
    const tweetText = encodeURIComponent(generatedPost.text);
    window.open(`https://twitter.com/intent/tweet?text=${tweetText}`, '_blank');
  };

  const downloadConfig = () => {
    const configData = {
      persona: savedSettings.persona,
      sources: savedSettings.sources
    };
    const blob = new Blob([JSON.stringify(configData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'config.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };
  
  const pythonScript = `
import os
import json
import random
import feedparser
import tweepy
from google.generativeai import configure, GenerativeModel

# --- 環境変数からAPIキーを読み込み ---
try:
    GEMINI_API_KEY = os.environ['GEMINI_API_KEY']
    X_API_KEY = os.environ['X_API_KEY']
    X_API_SECRET_KEY = os.environ['X_API_SECRET_KEY']
    X_ACCESS_TOKEN = os.environ['X_ACCESS_TOKEN']
    X_ACCESS_TOKEN_SECRET = os.environ['X_ACCESS_TOKEN_SECRET']
except KeyError as e:
    print(f"エラー: 環境変数 {e} が設定されていません。")
    exit(1)

# --- 設定ファイルを読み込み ---
try:
    with open('config.json', 'r', encoding='utf-8') as f:
        config = json.load(f)
    PERSONA = config['persona']
    SOURCES = config['sources']
except FileNotFoundError:
    print("エラー: config.json が見つかりません。")
    exit(1)

# --- Gemini APIのセットアップ ---
configure(api_key=GEMINI_API_KEY)
model = GenerativeModel('gemini-2.5-flash')

# --- X (Twitter) APIのセットアップ ---
client = tweepy.Client(
    consumer_key=X_API_KEY,
    consumer_secret=X_API_SECRET_KEY,
    access_token=X_ACCESS_TOKEN,
    access_token_secret=X_ACCESS_TOKEN_SECRET
)

def get_latest_article_from_rss(rss_url):
    """RSSフィードから最新の記事のタイトルとリンクを取得"""
    feed = feedparser.parse(rss_url)
    if not feed.entries:
        return None, None
    latest_entry = feed.entries[0]
    return latest_entry.title, latest_entry.link

def generate_post_text(persona, article_title, article_link):
    """Geminiを使って投稿文を生成"""
    prompt = f"""
        {persona}

        上記のペルソナに基づき、以下の記事の内容を要約し、X(Twitter)に投稿するためのユニークで魅力的な投稿文を140字以内で作成してください。
        投稿には絵文字を効果的に使用し、読者のエンゲージメントを高める工夫をしてください。
        最後に記事へのリンクを必ず含めてください。

        記事タイトル: {article_title}
        記事リンク: {article_link}
    """
    try:
        response = model.generate_content(prompt)
        return response.text
    except Exception as e:
        print(f"Gemini APIでの生成中にエラー: {e}")
        return None

def post_to_x(text):
    """Xに投稿"""
    try:
        client.create_tweet(text=text)
        print("投稿に成功しました。")
        print(f"内容: \\n{text}")
    except Exception as e:
        print(f"Xへの投稿中にエラー: {e}")

def main():
    """メインの処理"""
    if not SOURCES:
        print("情報ソースが設定されていません。")
        return

    # ランダムな情報ソースを選択
    source_url = random.choice(SOURCES)
    print(f"選択されたソース: {source_url}")

    # RSSから最新記事を取得 (RSS以外の場合は別途処理が必要)
    title, link = get_latest_article_from_rss(source_url)
    if not title:
        print(f"記事が見つかりませんでした: {source_url}")
        return
    
    print(f"取得した記事: {title}")

    # 投稿文を生成
    post_text = generate_post_text(PERSONA, title, link)

    if post_text:
        # Xに投稿
        post_to_x(post_text)

if __name__ == "__main__":
    main()
  `;

  const githubActionsYAML = `
name: X Auto Post Workflow

on:
  workflow_dispatch: # 手動実行を許可
  schedule:
    # 毎日午前9時 (UTC) に実行 (日本時間だと午後6時)
    # 好きな時間に変更してください: https://crontab.guru/
    - cron: '0 9 * * *'

jobs:
  build-and-post:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout repository
        uses: actions/checkout@v3

      - name: Set up Python
        uses: actions/setup-python@v4
        with:
          python-version: '3.10'

      - name: Install dependencies
        run: |
          python -m pip install --upgrade pip
          pip install google-generativeai tweepy feedparser

      - name: Run script
        env:
          GEMINI_API_KEY: \${{ secrets.GEMINI_API_KEY }}
          X_API_KEY: \${{ secrets.X_API_KEY }}
          X_API_SECRET_KEY: \${{ secrets.X_API_SECRET_KEY }}
          X_ACCESS_TOKEN: \${{ secrets.X_ACCESS_TOKEN }}
          X_ACCESS_TOKEN_SECRET: \${{ secrets.X_ACCESS_TOKEN_SECRET }}
        run: python your_script_name.py # ここをPythonスクリプトのファイル名に書き換えてください
  `;


  const renderGeneratorView = () => (
    <main className="main-grid">
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
                        <button className="btn btn-x" onClick={handlePostToX}>
                            <svg viewBox="0 0 24 24" aria-hidden="true" className="r-18jsvk2 r-4qtqp9 r-yyyyoo r-16y2uox r-8kz0gk r-dnmrzs r-bnwqim r-1plcrui r-lrvibr r-lrsllp"><g><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"></path></g></svg>
                            <span>Xに投稿する</span>
                        </button>
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

  const renderAutomationView = () => (
    <main>
      <section className="card full-width">
        <h2><span className="material-icons">smart_toy</span>自動投稿ワークフローの設定</h2>
        <div className="card-content">
          <p>このアプリは手動で投稿を生成しますが、以下の手順でGitHub Actionsを利用した完全自動投稿システムを構築できます。</p>
          
          <h3 className="settings-subtitle">ステップ1: 設定ファイルのダウンロード</h3>
          <p>まず、現在のペルソナと情報ソースの設定をファイルとしてダウンロードします。このファイルは後のPythonスクリプトで使用します。</p>
          <button onClick={downloadConfig} className="btn btn-secondary" style={{marginTop: '8px'}}><span className="material-icons">download</span> config.json をダウンロード</button>
          
          <h3 className="settings-subtitle">ステップ2: GitHubリポジトリの準備とSecretsの設定</h3>
          <p>
            1. あなたのGitHubアカウントに新しいリポジトリを作成します。<br />
            2. そのリポジトリの <strong>Settings &gt; Secrets and variables &gt; Actions</strong> に移動します。<br />
            3. 以下の5つのリポジトリシークレットを登録します。値は「設定」タブで入力したものを使用してください。
          </p>
          <ul className="list dense">
              <li className="list-item"><code>GEMINI_API_KEY</code></li>
              <li className="list-item"><code>X_API_KEY</code></li>
              <li className="list-item"><code>X_API_SECRET_KEY</code></li>
              <li className="list-item"><code>X_ACCESS_TOKEN</code></li>
              <li className="list-item"><code>X_ACCESS_TOKEN_SECRET</code></li>
          </ul>

          <h3 className="settings-subtitle">ステップ3: Pythonスクリプトの作成</h3>
          <p>リポジトリに、以下の内容でPythonファイルを作成します (例: <code>run_poster.py</code>)。ステップ1でダウンロードした <code>config.json</code> も同じ階層に配置してください。</p>
          <div className="code-block">
            <pre><code>{pythonScript.trim()}</code></pre>
            <button className="btn btn-icon copy-btn" onClick={() => navigator.clipboard.writeText(pythonScript.trim())}><span className="material-icons">content_copy</span></button>
          </div>
          <p className="caption">※このスクリプトは情報ソースがRSSフィードであることを前提としています。Webページを直接スクレイピングする場合は、BeautifulSoup4などのライブラリを追加で利用する必要があります。</p>

          <h3 className="settings-subtitle">ステップ4: GitHub Actions ワークフローの作成</h3>
          <p>リポジトリのルートに <code>.github/workflows/</code> というディレクトリを作成し、その中に以下の内容でYAMLファイルを作成します (例: <code>main.yml</code>)。</p>
          <div className="code-block">
            <pre><code>{githubActionsYAML.trim()}</code></pre>
            <button className="btn btn-icon copy-btn" onClick={() => navigator.clipboard.writeText(githubActionsYAML.trim())}><span className="material-icons">content_copy</span></button>
          </div>
          <p>これで準備は完了です。設定したスケジュールになると、GitHub Actionsが自動的にスクリプトを実行し、Xに投稿します。</p>
        </div>
      </section>
    </main>
  );

  const renderSettingsView = () => (
    <main>
        <section className="card full-width">
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
            <p className="caption">自動投稿スクリプトで使用するAPIキーです。安全のため、ここに入力した内容はブラウザのローカルストレージにのみ保存されます。</p>
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
                            placeholder="https://example.com/feed"
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
                    <label htmlFor="schedule">投稿スケジュール (自動化用メモ)</label>
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
                <label htmlFor="postsPerDay">1日の最大投稿回数 (自動化用メモ)</label>
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

  const renderContent = () => {
    switch (view) {
      case 'generator':
        return renderGeneratorView();
      case 'automation':
        return renderAutomationView();
      case 'settings':
        return renderSettingsView();
      default:
        return renderGeneratorView();
    }
  }

  return (
    <>
      <header>
        <h1><span className="material-icons" style={{fontSize: '2.5rem', color: '#1d9bf0'}}>smart_toy</span>X Auto Post AI</h1>
        <nav>
            <button className={`btn-nav ${view === 'generator' ? 'active' : ''}`} onClick={() => setView('generator')}>
                <span className="material-icons">auto_awesome</span>
                ジェネレーター
            </button>
            <button className={`btn-nav ${view === 'automation' ? 'active' : ''}`} onClick={() => setView('automation')}>
                <span className="material-icons">model_training</span>
                自動化
            </button>
            <button className={`btn-nav ${view === 'settings' ? 'active' : ''}`} onClick={() => setView('settings')}>
                <span className="material-icons">settings</span>
                設定
            </button>
        </nav>
      </header>
      {renderContent()}
    </>
  );
};

const container = document.getElementById('root');
const root = ReactDOM.createRoot(container!);
root.render(<App />);
