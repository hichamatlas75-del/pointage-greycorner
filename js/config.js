/**
 * =========================================================================
 * GREY CORNER • POINTAGE & PRÉSENCES
 * Module 1 : Configuration Globale & Initialisation Firebase
 * =========================================================================
 */

const Config = Object.freeze({
  firebase: {
    apiKey: "AIzaSyC5al_6xWbJC8S0FAvaEnRmx9BvYtGgnAM",
    authDomain: "grey-corner-presence.firebaseapp.com",
    databaseURL: "https://grey-corner-presence-default-rtdb.europe-west1.firebasedatabase.app",
    projectId: "grey-corner-presence",
    storageBucket: "grey-corner-presence.firebasestorage.app",
    messagingSenderId: "730206093359",
    appId: "1:730206093359:web:59e3c145120807f29e46da"
  },
  geo: {
    cafeLat: 34.0343959,
    cafeLon: -5.0155941,
    maxRadiusMeters: 200
  },
  endpoints: {
    urgentMsgSheet: "https://docs.google.com/spreadsheets/d/1boSKTYt4TQW00j02eBCWPzDHngFZmSqPGBvDL1wsq64/gviz/tq?tqx=out:json&sheet=Messages_Urgent",
    gasExecUrl: "https://script.google.com/macros/s/AKfycbyZFLn4Z8KHsB60caPMkdAFTXHkJcd_aP_oxP5cI_nDG7kZf5MzFm-U7vYPcNEUD4HY1Q/exec",
    secret: "greycorner2026",
    empNodeDefault: "pointage"
  },
  timeZone: "GMT",
  categories: ["service", "bar", "cuisine", "caisse", "menage", "securite", "economat"]
});

// Initialisation Firebase
if (!firebase.apps.length) {
  firebase.initializeApp(Config.firebase);
}
const db = firebase.database();
const auth = firebase.auth();
auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL).catch(() => {});
