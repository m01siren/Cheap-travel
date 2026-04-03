import { Navigate, Route, Routes } from 'react-router-dom'
import { Header } from './components/common.jsx'
import { YandexMetrika } from './components/YandexMetrika.jsx'
import { FavoritesPage } from './pages/Favorites.jsx'
import { HomePage } from './pages/Home.jsx'
import { ResultsPage } from './pages/Results.jsx'
import { RouteDetailsPage } from './pages/RouteDetails.jsx'
import { SUPABASE_CONFIG_ERROR } from './lib/supabase.js'

function App() {
  return (
    <div className="min-h-screen text-white">
      <YandexMetrika />
      <Header />
      <main className="mx-auto w-full max-w-5xl px-4 py-6">
        {SUPABASE_CONFIG_ERROR ? (
          <div className="mb-4 rounded-2xl border border-red-300/40 bg-red-500/15 p-4 text-sm text-red-100">
            {SUPABASE_CONFIG_ERROR}
          </div>
        ) : null}
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/results" element={<ResultsPage />} />
          <Route path="/route/:id" element={<RouteDetailsPage />} />
          <Route path="/favorites" element={<FavoritesPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  )
}

export default App
