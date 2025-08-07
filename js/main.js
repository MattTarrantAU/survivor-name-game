import { initializeApp } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js";
import { getFirestore, collection, getDocs, query, where, orderBy, limit } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js";
import { initNameGame } from './name-game.js';

// Firebase setup
const firebaseConfig = {
  apiKey: "AIzaSyAV3FwoLCdjtwHfT0Tx0NDl7_frurjqYGU",
  authDomain: "survivor-name-game.firebaseapp.com",
  projectId: "survivor-name-game",
  storageBucket: "survivor-name-game.appspot.com",
  messagingSenderId: "663348569542",
  appId: "1:663348569542:web:7e0e4dfb53f35e5fe4bec7",
  measurementId: "G-KRMCPQF7EQ"
};
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// DOM Elements
const mainMenu = document.getElementById('main-menu');
const gameMenuBtns = document.querySelectorAll('.game-menu-btn');
const backToMenuBtns = document.querySelectorAll('.back-to-menu-btn');
const nameGameContainer = document.getElementById('name-game-container');
const gridGameContainer = document.getElementById('grid-game-container');
const seasonCreatorContainer = document.getElementById('season-creator-container');
const adminLoginLink = document.getElementById('admin-login-link');
const adminLoginModal = document.getElementById('admin-login-modal');
const adminLoginBtn = document.getElementById('admin-login-btn');
const adminCancelBtn = document.getElementById('admin-cancel-btn');
const adminEmailInput = document.getElementById('admin-email');
const adminPasswordInput = document.getElementById('admin-password');
const adminError = document.getElementById('admin-error');
const adminPanelBtn = document.getElementById('admin-panel-btn');
const logoutLink = document.getElementById('logout-link');
const usernameInput = document.getElementById('username-input');
const leaderboardBtn = document.getElementById('leaderboard-btn');
const leaderboardModal = document.getElementById('leaderboard-modal');
const leaderboardCloseBtn = document.getElementById('leaderboard-close-btn');
const leaderboardTabBtns = document.querySelectorAll('.leaderboard-tab-btn');
const leaderboardContent = document.getElementById('leaderboard-content');

// View switching
function showView(viewId) {
  // Hide all main views (skip any that aren't found)
  mainMenu?.classList.add('hidden');
  nameGameContainer?.classList.add('hidden');
  gridGameContainer?.classList.add('hidden');
  seasonCreatorContainer?.classList.add('hidden');

  // Attempt to show the requested container
  const view = document.getElementById(viewId);
  if (view) {
    view.classList.remove('hidden');
  } else {
    // If something goes wrong, fall back to the main menu
    mainMenu?.classList.remove('hidden');
  }
}

// Auth state
onAuthStateChanged(auth, user => {
  const skipBtn = document.getElementById('skip-btn');
  if (user) {
    adminPanelBtn?.classList.remove('hidden');
    logoutLink?.classList.remove('hidden');
    adminLoginLink?.classList.add('hidden');
    skipBtn?.classList.remove('hidden');
    usernameInput.value = user.email.split('@')[0];
  } else {
    adminPanelBtn?.classList.add('hidden');
    logoutLink?.classList.add('hidden');
    adminLoginLink?.classList.remove('hidden');
    skipBtn?.classList.add('hidden');
  }
});

// Admin handlers
// Admin Panel Listeners
if (adminPanelBtn) {
  adminPanelBtn.addEventListener('click', e => {
    e.preventDefault();
    adminPanelModal?.classList.remove('hidden');
    // TODO: load admin panel content, e.g., castaway image check
    loadAdminCastawayCheck();
  });
}
if (adminPanelCloseBtn) {
  adminPanelCloseBtn.addEventListener('click', () => {
    adminPanelModal?.classList.add('hidden');
  });
}

// Function to load admin castaway image check
function loadAdminCastawayCheck() {
  const container = document.getElementById('admin-castaway-check-content');
  if (!container) return;
  // Example content: season selector and image preview
  container.innerHTML = `
    <label for="admin-season-select" class="block mb-2">Select Season:</label>
    <select id="admin-season-select" class="w-full p-2 mb-4 rounded bg-black/20 text-white">
      <option value="aus">AUS</option>
      <option value="us">US</option>
      <option value="nz">NZ</option>
      <option value="za">ZA</option>
    </select>
    <div id="admin-castaway-list" class="grid grid-cols-2 gap-4 overflow-y-auto max-h-64"></div>
function handleLogout() {
  signOut(auth).catch(e => console.error('Logout Error:', e));
}

// --- Leaderboard logic ---
async function openLeaderboard() {
  // 1) Show the modal
  leaderboardModal?.classList.remove('hidden');

  // 2) Reset tab highlights
  leaderboardTabBtns.forEach(b =>
    b.classList.remove('active-tab', 'text-[#a3db9a]', 'border-[#a3db9a]')
  );

  // 3) Highlight the default 'daily' tab
  const dailyBtn = document.querySelector('.leaderboard-tab-btn[data-leaderboard="daily"]');
  dailyBtn?.classList.add('active-tab', 'text-[#a3db9a]', 'border-[#a3db9a]');

  // 4) Fetch and display today's leaderboard
  await fetchAndDisplayLeaderboard('daily');
}

// Tab‐click handler: highlight and reload
leaderboardTabBtns.forEach(btn => {
  btn.addEventListener('click', async () => {
    // Clear prior highlights
    leaderboardTabBtns.forEach(b =>
      b.classList.remove('active-tab', 'text-[#a3db9a]', 'border-[#a3db9a]')
    );

    // Highlight the one you clicked
    btn.classList.add('active-tab', 'text-[#a3db9a]', 'border-[#a3db9a]');

    // Load its data
    await fetchAndDisplayLeaderboard(btn.dataset.leaderboard);
  });
});


// Event Listeners
gameMenuBtns.forEach(btn => btn.addEventListener('click', () => showView(btn.dataset.game + '-container')));
backToMenuBtns.forEach(btn => btn.addEventListener('click', () => showView('main-menu')));
adminLoginLink?.addEventListener('click', e => { e.preventDefault(); adminLoginModal?.classList.remove('hidden'); });
adminCancelBtn?.addEventListener('click', () => adminLoginModal?.classList.add('hidden'));
adminLoginBtn?.addEventListener('click', handleAdminLogin);
logoutLink?.addEventListener('click', e => { e.preventDefault(); handleLogout(); });
leaderboardBtn?.addEventListener('click', openLeaderboard);
leaderboardCloseBtn?.addEventListener('click', () => leaderboardModal?.classList.add('hidden'));
leaderboardTabBtns.forEach(btn => btn.addEventListener('click', () => {
  leaderboardTabBtns.forEach(b => b.classList.remove('active-tab','text-[#a3db9a]','border-[#a3db9a]'));
  btn.classList.add('active-tab','text-[#a3db9a]','border-[#a3db9a]');
  fetchAndDisplayLeaderboard(btn.dataset.leaderboard);
}));

// Initialization
initNameGame(db, auth);
