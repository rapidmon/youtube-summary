'use client';

import { useState } from 'react';

export default function Home() {
  const [url, setUrl] = useState('');
  const [summary, setSummary] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [method, setMethod] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSummary('');

    try {
      const response = await fetch('/api/summarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });

      const data = await response.json();

      if (data.success) {
        setSummary(data.summary);
        setMethod(data.method = '영상 분석');
      } else {
        setError(data.error || '요약에 실패했습니다');
      }
    } catch {
      setError('서버 연결에 실패했습니다');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-gray-900 text-white p-8">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-4xl font-bold text-center mb-8">YouTube 영상 요약</h1>

        <form onSubmit={handleSubmit} className="mb-8">
          <div className="flex gap-4">
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="YouTube URL을 입력하세요"
              className="flex-1 px-4 py-3 rounded-lg bg-gray-800 border border-gray-700 focus:outline-none focus:border-blue-500"
            />
            <button
              type="submit"
              disabled={loading || !url}
              className="px-6 py-3 bg-blue-600 rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? '분석 중...' : '요약하기'}
            </button>
          </div>
        </form>

        {error && (
          <div className="p-4 bg-red-900/50 border border-red-500 rounded-lg mb-4">
            ❌ {error}
          </div>
        )}

        {summary && (
          <div className="bg-gray-800 rounded-lg p-6">
            <div className="text-sm text-gray-400 mb-4">{method}</div>
            <div className="prose prose-invert max-w-none whitespace-pre-wrap">
              {summary}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}