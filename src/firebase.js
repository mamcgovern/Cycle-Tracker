import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyCt2IeJomE22AxRnSX2diVIMmSUjeTwvEY",
  authDomain: "cycle-tracker-d7851.firebaseapp.com",
  projectId: "cycle-tracker-d7851",
  storageBucket: "cycle-tracker-d7851.firebasestorage.app",
  messagingSenderId: "509672414427",
  appId: "1:509672414427:web:301157984a4742acae80fe"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);