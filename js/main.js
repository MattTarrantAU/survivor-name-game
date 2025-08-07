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

// Admin panel elements
const adminPanelModal = document.getElementById('admin-panel-modal');
const adminPanelCloseBtn = document.getElementById('admin-panel-close-btn');

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
  `;
}

/**
 * Sign the current Firebase user out.
 */
function handleLogout() {
  signOut(auth).catch(e => {
    console.error('Logout Error:', e);
  });
}

/**
 * Handle an admin login attempt. Reads the email/password inputs,
 * attempts to sign in via Firebase Auth, and updates UI accordingly.
 */
function handleAdminLogin() {
  const email = adminEmailInput?.value?.trim();
  const password = adminPasswordInput?.value;
  if (!email || !password) {
    adminError.textContent = 'Please enter email and password.';
    adminError.classList.remove('hidden');
    return;
  }
  adminError.classList.add('hidden');
  signInWithEmailAndPassword(auth, email, password).then(() => {
    // Hide the login modal on success and clear inputs
    adminLoginModal?.classList.add('hidden');
    adminEmailInput.value = '';
    adminPasswordInput.value = '';
  }).catch(err => {
    adminError.textContent = err.message.replace('Firebase: ', '');
    adminError.classList.remove('hidden');
  });
}

/**
 * Fetch leaderboard scores from Firestore based on a time period and
 * update the leaderboard modal content. Accepts 'daily', 'monthly'
 * or 'all-time' as period.
 */
async function fetchAndDisplayLeaderboard(period) {
  // Ensure the leaderboard container exists
  if (!leaderboardContent) {
    console.error('Leaderboard container not found');
    return;
  }
  // Show a loading indicator
  leaderboardContent.innerHTML = '<p>Loading…</p>';
  try {
    // Build a query based on the selected period
    const ref = collection(db, 'leaderboard');
    let q;
    const now = new Date();
    let startDate;
    if (period === 'daily') {
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    } else if (period === 'monthly') {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    }
    if (period === 'all-time') {
      q = query(ref, orderBy('score', 'desc'), limit(20));
    } else {
      q = query(
        ref,
        where('timestamp', '>=', startDate),
        orderBy('timestamp', 'desc'),
        orderBy('score', 'desc'),
        limit(20)
      );
    }
    const snap = await getDocs(q);
    const scores = snap.docs.map(d => d.data());
    if (scores.length === 0) {
      leaderboardContent.innerHTML = '<p>No scores yet.</p>';
      return;
    }
    // Sort by score descending
    scores.sort((a, b) => b.score - a.score);
    let html = '<ol class="space-y-2 text-left">';
    scores.slice(0, 20).forEach((e, i) => {
      html += `<li class="p-2 rounded-md flex justify-between items-center ${i % 2 === 0 ? 'bg-black/20' : ''}"><div><span class="font-bold text-lg mr-2">${i + 1}.</span><span>${e.username}</span></div><span class="font-bold text-xl text-[#a3db9a]">${e.score}</span></li>`;
    });
    html += '</ol>';
    leaderboardContent.innerHTML = html;
  } catch (err) {
    console.error('Error fetching leaderboard:', err);
    leaderboardContent.innerHTML = '<p class="text-red-500">Error loading leaderboard.</p>';
  }
}

// --- Leaderboard logic ---
async function openLeaderboard() {
  // Show the leaderboard modal
  leaderboardModal?.classList.remove('hidden');
  // Clear any existing tab highlights
  leaderboardTabBtns.forEach(b =>
    b.classList.remove('active-tab', 'text-[#a3db9a]', 'border-[#a3db9a]')
  );
  // Highlight the default 'daily' tab
  const dailyBtn = document.querySelector(
    '.leaderboard-tab-btn[data-leaderboard="daily"]'
  );
  dailyBtn?.classList.add('active-tab', 'text-[#a3db9a]', 'border-[#a3db9a]');
  // Load today's leaderboard by default
  await fetchAndDisplayLeaderboard('daily');
}

// Handle tab click: highlight and reload
leaderboardTabBtns.forEach(btn => {
  btn.addEventListener('click', async () => {
    // Clear all highlights
    leaderboardTabBtns.forEach(b =>
      b.classList.remove('active-tab', 'text-[#a3db9a]', 'border-[#a3db9a]')
    );
    // Highlight the clicked tab
    btn.classList.add('active-tab', 'text-[#a3db9a]', 'border-[#a3db9a]');
    // Fetch the leaderboard for the selected period
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

// Initialization
initNameGame(db, auth);
