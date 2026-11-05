import React, { useState } from 'react';
import { Download, Search, ShieldCheck } from 'lucide-react';
import { ViewingSession } from '../types';

interface EarningsLedgerProps {
  sessions: ViewingSession[];
}

export const EarningsLedger: React.FC<EarningsLedgerProps> = ({ sessions }) => {
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');

  const categories = ['ALL', ...Array.from(new Set(sessions.map((s) => s.category)))];

  const filteredSessions = sessions.filter((s) => {
    const matchesSearch =
      s.campaignTitle.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.advertiser.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.verificationHash.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesCategory =
      categoryFilter === 'ALL' || s.category === categoryFilter;

    return matchesSearch && matchesCategory;
  });

  const totalNet = filteredSessions.reduce((acc, s) => acc + s.netEarnedUsd, 0);

  const handleExportCsv = () => {
    const headers = [
      'Session ID',
      'Completed At',
      'Advertiser',
      'Campaign Title',
      'Category',
      'Duration (s)',
      'Total Earned (USD)',
      'Verification Hash',
    ];

    const rows = filteredSessions.map((s) => [
      s.id,
      s.completedAt,
      `"${s.advertiser.replace(/"/g, '""')}"`,
      `"${s.campaignTitle.replace(/"/g, '""')}"`,
      s.category,
      s.watchedSeconds,
      s.netEarnedUsd.toFixed(2),
      s.verificationHash,
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `lazyearn-my-earnings-${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Header & CSV Export */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight">
            Your Personal Earnings History
          </h1>
          <p className="text-xs text-slate-400">
            Verified log of every completed ad session and your credited reward
          </p>
        </div>

        <button
          onClick={handleExportCsv}
          className="px-4 py-2 bg-[#0F172A] hover:bg-slate-800 border border-slate-700 rounded-lg text-xs font-medium text-white flex items-center gap-2 transition-colors whitespace-nowrap shrink-0"
        >
          <Download className="w-3.5 h-3.5 text-emerald-400" />
          <span>Download CSV Statement</span>
        </button>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-[#0F172A] border border-slate-800 rounded-xl p-4 flex flex-wrap items-center justify-between gap-4">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by session ID, advertiser, campaign, or verification code..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[#090D16] border border-slate-800 rounded-lg pl-9 pr-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 bg-[#090D16] p-1 rounded-lg border border-slate-800">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setCategoryFilter(cat)}
                className={`px-2.5 py-1 rounded text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                  categoryFilter === cat
                    ? 'bg-slate-800 text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Personal Earnings Table */}
      <div className="bg-[#0F172A] border border-slate-800 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-800 bg-[#090D16]/60 text-slate-400">
                <th className="py-3 px-4 font-medium">Session & Timestamp</th>
                <th className="py-3 px-4 font-medium">Campaign & Advertiser</th>
                <th className="py-3 px-4 font-medium text-right">Watch Progress</th>
                <th className="py-3 px-4 font-medium text-right">Total You Earned</th>
                <th className="py-3 px-4 font-medium text-right">Verification Code</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/70">
              {filteredSessions.map((ses) => (
                <tr
                  key={ses.id}
                  className="hover:bg-slate-800/40 transition-colors"
                >
                  <td className="py-3 px-4 font-mono whitespace-nowrap">
                    <div className="text-white font-semibold">{ses.id}</div>
                    <div className="text-[11px] text-slate-400">
                      {new Date(ses.completedAt).toLocaleString([], {
                        month: 'short',
                        day: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                      })}
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <div className="font-medium text-white line-clamp-1">
                      {ses.campaignTitle}
                    </div>
                    <div className="text-[11px] text-slate-400">
                      {ses.advertiser} · {ses.category} · {ses.watchedSeconds}s watched
                    </div>
                  </td>
                  <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-200">
                    100% ({ses.watchedSeconds}s / {ses.durationSec}s)
                  </td>
                  <td className="py-3 px-4 text-right font-mono tabular-nums font-bold text-emerald-400">
                    +${ses.netEarnedUsd.toFixed(2)}
                  </td>
                  <td className="py-3 px-4 text-right font-mono text-[11px] text-slate-400 whitespace-nowrap">
                    <span className="inline-flex items-center gap-1">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      {ses.verificationHash}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
            {filteredSessions.length > 0 && (
              <tfoot>
                <tr className="border-t-2 border-slate-700 bg-[#090D16] font-mono tabular-nums font-bold text-xs">
                  <td className="py-3.5 px-4 text-white" colSpan={2}>
                    Your Totals ({filteredSessions.length} Completed Viewing Sessions)
                  </td>
                  <td className="py-3.5 px-4 text-right text-slate-200">
                    100% Verified
                  </td>
                  <td className="py-3.5 px-4 text-right text-emerald-400">
                    +${totalNet.toFixed(2)} USD
                  </td>
                  <td className="py-3.5 px-4 text-right text-slate-400">
                    Verified
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
};
