import { Routes, Route } from 'react-router-dom';
import { AuthProvider } from './hooks/useAuth.jsx';
import CollectionPage from './components/CollectionPage.jsx';
import ProfilePage from './components/ProfilePage.jsx';

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/" element={<CollectionPage />} />
        <Route path="/u/:username" element={<ProfilePage />} />
      </Routes>
    </AuthProvider>
  );
}
