import React from 'react';
import { Search, Bell, ArrowUpDown, Filter, X, LayoutGrid, List } from 'lucide-react';

interface FilterBarProps {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  filterSubscribed: boolean;
  setFilterSubscribed: (subscribed: boolean) => void;
  selectedCategory?: string;
  setSelectedCategory?: (category: string) => void;
  sortBy: string;
  setSortBy: (sort: string) => void;
  viewMode?: 'grid' | 'list';
  setViewMode?: (mode: 'grid' | 'list') => void;
  gridCols?: 3 | 5 | 7;
  setGridCols?: (cols: 3 | 5 | 7) => void;
}

const CATEGORIES = [
  { id: 'ALL', label: 'Alle' },
  { id: 'Punktspiel', label: 'Punktspiel' },
  { id: 'Pokalspiel', label: 'Pokalspiel' },
  { id: 'Testspiel', label: 'Testspiel' },
  { id: 'Training', label: 'Training' },
  { id: 'Trainingslager', label: 'Trainingslager' },
];

export default function FilterBar({
  searchQuery,
  setSearchQuery,
  filterSubscribed,
  setFilterSubscribed,
  selectedCategory = 'ALL',
  setSelectedCategory,
  sortBy,
  setSortBy,
  viewMode = 'grid',
  setViewMode,
  gridCols = 5,
  setGridCols,
}: FilterBarProps) {
  return (
    <div className="space-y-4 my-8">
      {/* Category Chips - Preline Segmented Button Group */}
      {setSelectedCategory && (
        <div className="flex flex-wrap items-center gap-3">
          <span className="hidden sm:flex text-xs font-semibold text-gray-500 dark:text-zinc-400 shrink-0 items-center gap-1.5">
            <Filter className="w-3.5 h-3.5" />
            Kategorie:
          </span>
          <div className="inline-flex flex-wrap p-1 gap-1 rounded-xl bg-gray-100 border border-gray-200 dark:bg-zinc-900 dark:border-zinc-800">
            {CATEGORIES.map((cat) => {
              const isSelected = selectedCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`inline-block rounded-lg px-3 py-1.5 text-xs sm:text-sm font-medium transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-white text-gray-900 shadow-xs dark:bg-zinc-800 dark:text-zinc-100'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200/60 dark:text-zinc-400 dark:hover:text-zinc-200 dark:hover:bg-zinc-800/50'
                  }`}
                >
                  {cat.label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Main Filter & Search Control Bar */}
      <div className="flex flex-col lg:flex-row gap-4 items-center justify-between">
        {/* Search Input - Preline Form Input */}
        <div className="relative w-full lg:w-96">
          <label htmlFor="Search" className="sr-only">
            Suchen
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 start-0 flex items-center pointer-events-none ps-3 text-gray-400 dark:text-zinc-500">
              <Search className="w-4 h-4" />
            </div>
            <input
              type="text"
              id="Search"
              placeholder="Suchen nach Spiel..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="py-2.5 ps-9 pe-10 block w-full border border-gray-300 rounded-lg text-sm text-gray-900 placeholder:text-gray-400 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 dark:bg-zinc-900 dark:border-zinc-700 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:border-emerald-500 shadow-2xs transition-colors"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute inset-y-0 end-0 flex items-center pe-3 text-gray-400 hover:text-gray-600 dark:hover:text-zinc-200"
              >
                <span className="sr-only">Suche leeren</span>
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto justify-between lg:justify-end">
          {/* Subscription Filter Toggle */}
          <button
            onClick={() => setFilterSubscribed(!filterSubscribed)}
            className={`inline-flex items-center gap-2 rounded-lg border px-3.5 py-2 text-sm font-medium transition-all shadow-2xs cursor-pointer ${
              filterSubscribed
                ? 'bg-amber-50 border-amber-300 text-amber-700 dark:bg-amber-950/40 dark:border-amber-800/60 dark:text-amber-400'
                : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800'
            }`}
          >
            <Bell className={`w-4 h-4 ${filterSubscribed ? 'fill-amber-500' : ''}`} />
            <span>Abonniert</span>
          </button>

          {/* Sort Select */}
          <div className="relative">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="appearance-none rounded-lg border border-gray-300 bg-white py-2 px-3.5 pe-9 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 shadow-2xs cursor-pointer transition-colors"
            >
              <option value="newest" className="dark:bg-zinc-900">Neuste zuerst</option>
              <option value="oldest" className="dark:bg-zinc-900">Älteste zuerst</option>
              <option value="name" className="dark:bg-zinc-900">Name (A-Z)</option>
            </select>
            <ArrowUpDown className="pointer-events-none absolute end-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400 dark:text-zinc-400" />
          </div>

          {/* View Mode Toggle */}
          {setViewMode && (
            <div className="inline-flex rounded-lg border border-gray-200 bg-gray-100 p-1 dark:border-zinc-800 dark:bg-zinc-900">
              <button
                onClick={() => setViewMode('grid')}
                className={`inline-flex items-center justify-center rounded-md px-2.5 py-1.5 text-sm transition-all cursor-pointer ${
                  viewMode === 'grid'
                    ? 'bg-white text-gray-900 shadow-2xs dark:bg-zinc-800 dark:text-white'
                    : 'text-gray-500 hover:text-gray-900 dark:text-zinc-400 dark:hover:text-white'
                }`}
                title="Rasteransicht"
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`inline-flex items-center justify-center rounded-md px-2.5 py-1.5 text-sm transition-all cursor-pointer ${
                  viewMode === 'list'
                    ? 'bg-white text-gray-900 shadow-2xs dark:bg-zinc-800 dark:text-white'
                    : 'text-gray-500 hover:text-gray-900 dark:text-zinc-400 dark:hover:text-white'
                }`}
                title="Listenansicht"
              >
                <List className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Desktop Grid Column Switcher */}
          {viewMode === 'grid' && setGridCols && (
            <div className="hidden xl:inline-flex rounded-lg border border-gray-200 bg-gray-100 p-1 items-center gap-1 dark:border-zinc-800 dark:bg-zinc-900">
              <span className="px-2 text-xs text-gray-500 dark:text-zinc-400 font-medium">Spalten:</span>
              {([3, 5, 7] as const).map((cols) => (
                <button
                  key={cols}
                  onClick={() => setGridCols(cols)}
                  className={`inline-flex items-center justify-center rounded-md px-2.5 py-1 text-xs font-semibold transition-all cursor-pointer ${
                    gridCols === cols
                      ? 'bg-emerald-600 text-white shadow-2xs'
                      : 'text-gray-600 hover:text-gray-900 dark:text-zinc-400 dark:hover:text-white'
                  }`}
                >
                  {cols}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
