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
import Set3SpoilersPage from './components/Set3SpoilersPage.jsx';
import MarketplacePage from './components/MarketplacePage.jsx';
import MyListingsPage from './components/MyListingsPage.jsx';
import SellerProfileSettingsPage from './components/SellerProfileSettingsPage.jsx';
import CardDetailPage from './components/CardDetailPage.jsx';
import MessagesPage from './components/MessagesPage.jsx';
import MessageThreadPage from './components/MessageThreadPage.jsx';
import AdminConversationsPage from './components/AdminConversationsPage.jsx';
import AdminPanelPage from './components/AdminPanelPage.jsx';

export default function App() {
  return (
    <AuthProvider>
      <PricesProvider>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/collection" element={<CollectionPage />} />
          <Route path="/u/:username" element={<ProfilePage />} />
          <Route path="/settings/seller" element={<SellerProfileSettingsPage />} />
          <Route path="/cards/:cardId" element={<CardDetailPage />} />
          <Route path="/marketplace" element={<MarketplacePage />} />
          <Route path="/marketplace/my-listings" element={<MyListingsPage />} />
          <Route path="/messages" element={<MessagesPage />} />
          <Route path="/messages/:conversationId" element={<MessageThreadPage />} />
          <Route path="/admin" element={<AdminPanelPage />} />
          <Route path="/admin/conversations" element={<AdminConversationsPage />} />
          <Route path="/decks" element={<DecksPage />} />
          <Route path="/builder" element={<DeckBuilder />} />
          <Route path="/builder/:deckId" element={<DeckBuilder />} />
          <Route path="/deck/:deckId" element={<DeckView />} />
          <Route path="/prices" element={<PriceListBuilder />} />
          <Route path="/set3-spoilers" element={<Set3SpoilersPage />} />
        </Routes>
      </PricesProvider>
    </AuthProvider>
  );
}
