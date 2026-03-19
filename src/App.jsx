import { Navigate, Route, Routes } from 'react-router-dom'
import { Header } from './components/common.jsx'
import { FavoritesPage } from './pages/Favorites.jsx'
import { HomePage } from './pages/Home.jsx'
import { ResultsPage } from './pages/Results.jsx'
import { RouteDetailsPage } from './pages/RouteDetails.jsx'

function App() {
  return (
    <div className="min-h-screen text-white">
      <Header />
      <main className="mx-auto w-full max-w-5xl px-4 py-6">
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
