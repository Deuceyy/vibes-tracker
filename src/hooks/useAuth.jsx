import { createContext, useContext, useState, useEffect } from 'react';
import { signInWithPopup, signOut as firebaseSignOut, onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, setDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { auth, googleProvider, db } from '../firebase';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setUser(user);
      if (user) {
        const profileRef = doc(db, 'users', user.uid);
        const profileSnap = await getDoc(profileRef);
        if (profileSnap.exists()) {
          setUserProfile(profileSnap.data());
        } else {
          const username = user.email.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '');
          const newProfile = {
            username,
            displayName: user.displayName,
            photoURL: user.photoURL,
            createdAt: new Date().toISOString()
          };
          await setDoc(profileRef, newProfile);
          setUserProfile(newProfile);
        }
      } else {
        setUserProfile(null);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const signInWithGoogle = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error('Sign in error:', error);
    }
  };

  const signOut = async () => {
    try {
      await firebaseSignOut(auth);
    } catch (error) {
      console.error('Sign out error:', error);
    }
  };

  const updateUsername = async (newUsername) => {
    if (!user) return;
    const clean = newUsername.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (clean.length < 3) {
      alert('Username must be at least 3 characters');
      return;
    }
    const usersRef = collection(db, 'users');
    const q = query(usersRef, where('username', '==', clean));
    const snapshot = await getDocs(q);
    if (!snapshot.empty && snapshot.docs[0].id !== user.uid) {
      alert('Username already taken');
      return;
    }
    const profileRef = doc(db, 'users', user.uid);
    await setDoc(profileRef, { username: clean }, { merge: true });
    setUserProfile(prev => ({ ...prev, username: clean }));
  };

  return (
    <AuthContext.Provider value={{ user, userProfile, loading, signInWithGoogle, signOut, updateUsername }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
