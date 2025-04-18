// Import the functions you need from the SDKs you need
import { initializeApp, getApp, getApps } from 'firebase/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: 'AIzaSyB6Tln0f8mx4PWzDJWEpJNcNZ4nafrlSzg',
  authDomain: 'prepster-317ea.firebaseapp.com',
  projectId: 'prepster-317ea',
  storageBucket: 'prepster-317ea.firebasestorage.app',
  messagingSenderId: '400658814474',
  appId: '1:400658814474:web:89b4afb4fa50982ec4f1f3',
  measurementId: 'G-PKJ02S9CP2',
};

// Initialize Firebase
const app = !getApps.length ? initializeApp(firebaseConfig) : getApp();

export const auth = getAuth(app);
export const db = getFirestore(app);
