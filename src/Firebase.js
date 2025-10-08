// src/firebase.js
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { getStorage } from "firebase/storage";
import { getFunctions } from "firebase/functions"; // Added for Cloud Functions

// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyDR6RwgryleYXoO2l442WVX1Pu3hAsaTs8",
  authDomain: "eustech-c4332.firebaseapp.com",
  projectId: "eustech-c4332",
  storageBucket: "eustech-c4332.firebasestorage.app",
  messagingSenderId: "78506944447",
  appId: "1:78506944447:web:27ba9745783ee6a1ad630a",
  measurementId: "G-J1HYRTHNZZ",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize services
export const db = getFirestore(app);
export const auth = getAuth(app);
export const storage = getStorage(app);
export const functions = getFunctions(app); // Added for Cloud Functions
