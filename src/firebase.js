import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: 'AIzaSyCp4j95OsG89NYdbRnAYtyJlV58xJHeY60',
  authDomain: 'cinetrack-app-bb5bd.firebaseapp.com',
  projectId: 'cinetrack-app-bb5bd',
  storageBucket: 'cinetrack-app-bb5bd.firebasestorage.app',
  messagingSenderId: '560727509461',
  appId: '1:560727509461:web:dc5ae3022a4b451760955c',
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
