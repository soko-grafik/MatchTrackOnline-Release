import { Search, Bell, ArrowUpDown, Filter, X, LayoutGrid, List, Columns } from 'lucide-react';

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
      {/* Category Chips - HyperUI Button Group Style */}
      {setSelectedCategory && (
        <div className="flex flex-wrap items-center gap-3">
          <span className="hidden sm:flex text-xs font-medium text-zinc-400 shrink-0 items-center gap-1.5">
            <Filter className="w-4 h-4" />
            Kategorie:
          </span>
          <div className="flex flex-wrap rounded-lg border border-zinc-800 bg-zinc-900 p-1 gap-1">
            {CATEGORIES.map((cat) => {
              const isSelected = selectedCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`inline-block rounded-md px-3 py-1.5 text-xs sm:text-sm focus:relative transition-colors ${
                    isSelected
                      ? 'bg-zinc-800 text-white shadow-sm font-medium'
                      : 'text-zinc-400 hover:text-zinc-200'
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
        
        {/* Search Input - HyperUI with icon */}
        <div className="relative w-full lg:w-96">
          <label htmlFor="Search" className="sr-only"> Suchen </label>

          <input
            type="text"
            id="Search"
            placeholder="Suchen nach Spiel..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-md border-zinc-800 bg-zinc-900 py-2.5 pe-10 shadow-sm sm:text-sm text-white focus:border-primary focus:ring-primary px-3"
          />

          <span className="absolute inset-y-0 end-0 grid w-10 place-content-center">
            {searchQuery ? (
              <button onClick={() => setSearchQuery('')} className="text-zinc-400 hover:text-white">
                <span className="sr-only">Clear Search</span>
                <X className="h-4 w-4" />
              </button>
            ) : (
              <button type="button" className="text-zinc-400 hover:text-white">
                <span className="sr-only">Search</span>
                <Search className="h-4 w-4" />
              </button>
            )}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto justify-between lg:justify-end">
          {/* Subscription Filter Toggle */}
          <button
            onClick={() => setFilterSubscribed(!filterSubscribed)}
            className={`flex items-center gap-2 rounded-md border px-4 py-2 text-sm font-medium transition-colors ${
              filterSubscribed
                ? 'bg-amber-500/10 border-amber-500/50 text-amber-500'
                : 'border-zinc-800 bg-zinc-900 text-zinc-300 hover:bg-zinc-800'
            }`}
          >
            <Bell className={`w-4 h-4 ${filterSubscribed ? 'fill-amber-500' : ''}`} />
            <span>Abonniert</span>
          </button>

          {/* Sort Select - HyperUI */}
          <div className="relative">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="appearance-none rounded-md border-zinc-800 bg-zinc-900 py-2 px-4 pe-8 text-sm text-white focus:border-primary focus:ring-primary shadow-sm"
            >
              <option value="newest">Neuste zuerst</option>
              <option value="oldest">Älteste zuerst</option>
              <option value="name">Name (A-Z)</option>
            </select>
            <ArrowUpDown className="pointer-events-none absolute end-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
          </div>

          {/* View Mode Toggle */}
          {setViewMode && (
            <div className="inline-flex rounded-lg border border-zinc-800 bg-zinc-900 p-1">
              <button
                onClick={() => setViewMode('grid')}
                className={`inline-flex items-center justify-center rounded-md px-3 py-1.5 text-sm transition-colors ${
                  viewMode === 'grid'
                    ? 'bg-zinc-800 text-white shadow-sm'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`inline-flex items-center justify-center rounded-md px-3 py-1.5 text-sm transition-colors ${
                  viewMode === 'list'
                    ? 'bg-zinc-800 text-white shadow-sm'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                <List className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Desktop Grid Column Switcher */}
          {viewMode === 'grid' && setGridCols && (
            <div className="hidden xl:inline-flex rounded-lg border border-zinc-800 bg-zinc-900 p-1 items-center gap-1">
              <span className="px-2 text-xs text-zinc-500 font-medium">Spalten:</span>
              {([3, 5, 7] as const).map((cols) => (
                <button
                  key={cols}
                  onClick={() => setGridCols(cols)}
                  className={`inline-flex items-center justify-center rounded-md px-2.5 py-1 text-xs transition-colors ${
                    gridCols === cols
                      ? 'bg-primary text-white shadow-sm font-medium'
                      : 'text-zinc-400 hover:text-white'
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
