import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyAkzqk_GY4AIsfWpu6SlRNp84rO1v5Uv1o",
  authDomain: "sfr-19046.firebaseapp.com",
  projectId: "sfr-19046",
  storageBucket: "sfr-19046.firebasestorage.app",
  messagingSenderId: "742966790051",
  appId: "1:742966790051:web:ce7c63e80c5671ac07fc16",
  measurementId: "G-90CSZXV9D2"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
