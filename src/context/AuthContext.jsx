import React, { createContext, useContext, useEffect, useState } from 'react';
import { 
  onAuthStateChanged, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword,
  signOut 
} from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from '../services/firebase';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        // Fetch custom user claims or user profile from Firestore to determine role
        try {
          const userDoc = await getDoc(doc(db, 'users', user.uid));
          if (userDoc.exists()) {
            setUserRole(userDoc.data().role); // 'admin' or 'faculty'
            setCurrentUser({ ...user, ...userDoc.data() });
          } else {
            console.error("No user profile found in Firestore database. Falling back to default role.");
            setCurrentUser(user);
            setUserRole('faculty'); // Default fallback instead of guest for immediate usability safely
          }
        } catch (error) {
          console.error("Error fetching user role: ", error);
          setCurrentUser(user);
          setUserRole('faculty');
        }
      } else {
        setCurrentUser(null);
        setUserRole(null);
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const login = (email, password) => {
    return signInWithEmailAndPassword(auth, email, password);
  };

  const signup = async (email, password, name, department, facultyId) => {
    // 1. Create the user in Firebase Auth
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    
    // 2. Create the user profile in Firestore so we can save their role and details
    await setDoc(doc(db, 'users', user.uid), {
      name: name,
      email: email,
      department: department,
      facultyId: facultyId,
      role: 'faculty', // By default, new signups are 'faculty'
      createdAt: new Date()
    });
    
    return userCredential;
  };

  const logout = () => {
    return signOut(auth);
  };

  const value = {
    currentUser,
    userRole,
    login,
    signup,
    logout
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};
