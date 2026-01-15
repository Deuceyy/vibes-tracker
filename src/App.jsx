import { Routes, Route } from 'react-router-dom';
import { AuthProvider } from './hooks/useAuth.jsx';
import { PricesProvider } from './hooks/usePrices.jsx';
import LandingPage from './components/LandingPage.jsx';
import CollectionPage from './components/CollectionPage.jsx';
import ProfilePage from './components/ProfilePage.jsx';
import DecksPage from './components/DecksPage.jsx';
import DeckBuilder from './components/DeckBuilder.jsx';
import DeckView from './components/DeckView.jsx';
import PriceListBuilder from './components/PriceListBuilder.jsx';

export default function App() {
  return (
    <AuthProvider>
      <PricesProvider>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/collection" element={<CollectionPage />} />
          <Route path="/u/:username" element={<ProfilePage />} />
          <Route path="/decks" element={<DecksPage />} />
          <Route path="/builder" element={<DeckBuilder />} />
          <Route path="/builder/:deckId" element={<DeckBuilder />} />
          <Route path="/deck/:deckId" element={<DeckView />} />
          <Route path="/prices" element={<PriceListBuilder />} />
        </Routes>
      </PricesProvider>
    </AuthProvider>
  );
}
