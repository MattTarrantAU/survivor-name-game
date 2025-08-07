import { collection, addDoc, doc, serverTimestamp, runTransaction, getDoc, setDoc, query, where, getDocs, orderBy, limit } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";
import { all_castaways_data } from './all-castaway-data.js';

export function initNameGame(db, auth) {

    // --- GAME STATE & CONSTANTS ---
    let currentCastaway;
    let nextCastawayToDisplay;
    let score = 0;
    let highScore = localStorage.getItem('survivorHighScore') || 0;
    let timerInterval;
    let usedCastaways = [];
    let gameResults = [];
    let activeAutocompleteIndex = -1;
    let currentUsername = "Anonymous";
    let activeGameCastaways = [];
    const ROUND_TIME = 30;
    
    const allPlayerNames = [...new Set(all_castaways_data.flatMap(p => {
        const names = [];
        if (p.name && typeof p.name === 'string') {
            names.push(p.name.toLowerCase());
        }
        if (p.acceptedAnswers && typeof p.acceptedAnswers === 'string') {
            p.acceptedAnswers.toLowerCase().split(',').forEach(n => names.push(n.trim()));
        }
        return names;
    }))];

    // --- DOM ELEMENTS ---
    const startScreen = document.getElementById('start-screen');
    const gamePlayScreen = document.getElementById('game-play-screen');
    const gameOverScreen = document.getElementById('game-over-screen');
    const startBtn = document.getElementById('start-btn');
    const playAgainBtn = document.getElementById('play-again-btn');
    const giveUpBtn = document.getElementById('give-up-btn');
    const skipBtn = document.getElementById('skip-btn');
    const guessInput = document.getElementById('guess-input');
    const castawayImage = document.getElementById('castaway-image');
    const currentScoreEl = document.getElementById('current-score');
    const highScoreEl = document.getElementById('high-score');
    const timerBar = document.getElementById('timer-bar');
    const finalScoreEl = document.getElementById('final-score');
    const newHighScoreMsg = document.getElementById('new-high-score-msg');
    const autocompleteList = document.getElementById('autocomplete-list');
    const correctAnswerInfo = document.getElementById('correct-answer-info');
    const usernameInput = document.getElementById('username-input');
    const playerRankInfo = document.getElementById('player-rank-info');
    const versionFilterCheckboxes = document.querySelectorAll('#version-filter input[type="checkbox"]');
    
    // Admin Elements
    const adminPanelModal = document.getElementById('admin-panel-modal');
    const adminCloseBtn = document.getElementById('admin-close-btn');
    const castawayCheckBtn = document.getElementById('castaway-check-btn');
    const castawayCheckSection = document.getElementById('castaway-check-section');
    const seasonSelect = document.getElementById('season-select');
    const playerDisplay = document.getElementById('player-display');
    const prevPlayerBtn = document.getElementById('prev-player-btn');
    const nextPlayerBtn = document.getElementById('next-player-btn');
    const playerNameDisplay = document.getElementById('player-name-display');
    const playerImageDisplay = document.getElementById('player-image-display');
    const acceptedNamesDisplay = document.getElementById('accepted-names-display');
    const imageUrlDisplay = document.getElementById('image-url-display');
    const tagsDisplay = document.getElementById('tags-display');
    const addTagInput = document.getElementById('add-tag-input');
    const addTagBtn = document.getElementById('add-tag-btn');
    const savePlayerChangesBtn = document.getElementById('save-player-changes-btn');
    const saveStatus = document.getElementById('save-status');

    // --- GAME LOGIC ---
 function startGame() {
  // Get the player’s name
  currentUsername = usernameInput.value.trim() || 'Anonymous';

  // 1) Grab the checkboxes _right here_
  const versionFilterCheckboxes = document.querySelectorAll(
    '#version-filter input[type="checkbox"]'
  );

  // 2) Turn that NodeList into an array and filter down to the checked ones
  const selectedCountries = [...versionFilterCheckboxes]
    .filter(cb => cb.checked)
    .map(cb => cb.dataset.country);

  // 3) If none checked, bail out
  if (selectedCountries.length === 0) {
    alert("Please select at least one Survivor version to play!");
    return;
  }

  // 4) Filter your castaway pool based on the countries
  activeGameCastaways = all_castaways_data.filter(player => {
    if (!player.season_key) return false;
    // Assuming season_key is like 'aus_S01', split on '_' and take the first part
    const country = player.season_key.split('_')[0];
    return selectedCountries.includes(country.toLowerCase());
  });

  if (activeGameCastaways.length === 0) {
    alert("No castaways match your selection. Try different versions!");
    return;
  }

  // 5) Swap screens
  startScreen.style.display    = 'none';
  gamePlayScreen.style.display = 'block';
  gameOverScreen.style.display = 'none';

  // 6) Reset state
  score         = 0;
  usedCastaways = [];
  gameResults   = [];
  currentScoreEl.innerText = score;
  highScoreEl.innerText    = highScore;

  // 7) Load the first castaway
  selectAndPreloadNext(true);
  displayCurrentCastaway();
}



    function displayCurrentCastaway() {
        if (!currentCastaway) {
             console.error("No castaway selected to display.");
             nextRound();
             return;
        }

        if (timerInterval) clearInterval(timerInterval);
        timerBar.classList.remove('transition-all');
        timerBar.style.width = '100%';
        timerBar.style.backgroundColor = '#22c55e';
        void timerBar.offsetWidth;
        timerBar.classList.add('transition-all');

        let timeLeft = ROUND_TIME;
        timerInterval = setInterval(() => {
            timeLeft--;
            const percentage = (timeLeft / ROUND_TIME) * 100;
            timerBar.style.width = `${percentage}%`;
            if (percentage < 50) timerBar.style.backgroundColor = '#f59e0b';
            if (percentage < 25) timerBar.style.backgroundColor = '#ef4444';
            if (timeLeft <= 0) handleIncorrectGuess();
        }, 1000);

        const imageUrl = getImageUrl(currentCastaway);
        castawayImage.src = imageUrl;
        usedCastaways.push(currentCastaway.name);
        guessInput.value = '';
        guessInput.focus();
        closeAutocomplete();
    }

    function nextRound() {
        currentCastaway = nextCastawayToDisplay;
        displayCurrentCastaway();
        selectAndPreloadNext();
    }

    function getImageUrl(castaway) {
        const key = castaway['season_key'];
        if (!key || typeof key !== 'string') {
            return 'https://placehold.co/300x400/1f2937/6b7280?text=Invalid+Data';
        }
        
        const [country, seasonNumStr] = key.split('_S');
        const seasonNum = parseInt(seasonNumStr);
        
        let countryCode = country.toLowerCase();
        if (countryCode === 'us') countryCode = 'usa';
        if (countryCode === 'sa') countryCode = 'za';
        
        const processedName = castaway.name.replace(/ /g, '_').replace(/[.'"]/g, '');
        const seasonFolder = `s${String(seasonNum).padStart(2, '0')}`;

        let prefix = `S${seasonNum}`;
        if (countryCode === 'aus') prefix = `AUS${seasonNum}`;
        else if (countryCode === 'nz') prefix = `NZ${seasonNum}`;
        else if (countryCode === 'za') prefix = `ZAS${seasonNum}`;
        
        const imageName = castaway.imageOverride || `${prefix}_${processedName}.webp`;
        
        return `https://survivornamegame.com/images/castaways/${countryCode}/${seasonFolder}/${imageName}`;
    }
    
    function selectAndPreloadNext(isFirstRound = false) {
        let available = activeGameCastaways.filter(c => c.name && !usedCastaways.includes(c.name));
        if (available.length === 0) {
            available = activeGameCastaways.filter(c => c.name);
            usedCastaways = [];
        }
        
        if (isFirstRound) {
            currentCastaway = available[Math.floor(Math.random() * available.length)];
            available = available.filter(c => c.name !== currentCastaway.name);
        }

        nextCastawayToDisplay = available[Math.floor(Math.random() * available.length)];
        if (nextCastawayToDisplay) {
            const img = new Image();
            img.src = getImageUrl(nextCastawayToDisplay);
        }
    }

    function checkGuess() {
        const userGuess = guessInput.value.toLowerCase().trim();
        const acceptedAnswersStr = currentCastaway.acceptedAnswers || currentCastaway.name || "";
        const accepted = acceptedAnswersStr.toLowerCase().split(',').map(n => n.trim());
        const correct = accepted.includes(userGuess);
        gameResults.push({ name: currentCastaway.name, guessedCorrectly: correct });
        
        if (correct) {
            score++;
            currentScoreEl.innerText = score;
            document.body.classList.add('flash-correct');
            setTimeout(() => document.body.classList.remove('flash-correct'), 500);
            nextRound();
        } else {
            handleIncorrectGuess();
        }
    }

    function handleIncorrectGuess() {
        const correct = gameResults.find(r => r.name === currentCastaway.name);
        if(!correct) {
            gameResults.push({ name: currentCastaway.name, guessedCorrectly: false });
        }
        document.body.classList.add('flash-incorrect');
        setTimeout(() => document.body.classList.remove('flash-incorrect'), 500);
        gameOver();
    }

    async function gameOver() {
        clearInterval(timerInterval);
        closeAutocomplete();
        const [country, seasonNum] = currentCastaway.season_key.split('_S');
        correctAnswerInfo.innerHTML = `The correct answer was: <br> <span class="text-red-400 font-semibold">${currentCastaway.name}</span> (${country} S${parseInt(seasonNum)})`;
        correctAnswerInfo.classList.remove('hidden');

        gamePlayScreen.style.display = 'none';
        gameOverScreen.style.display = 'block';
        
        finalScoreEl.innerText = score;

        if (score > highScore) {
            highScore = score;
            localStorage.setItem('survivorHighScore', highScore);
            newHighScoreMsg.style.display = 'block';
            triggerConfetti();
        } else {
            newHighScoreMsg.style.display = 'none';
        }
        
        if (score > 0) {
            playerRankInfo.classList.remove('hidden');
            playerRankInfo.innerHTML = 'Calculating your rank...';
            await submitScoreToFirebase();
        } else {
            playerRankInfo.classList.add('hidden');
        }
        playAgainBtn.focus();
    }
    
    async function submitScoreToFirebase() {
        try {
            const leaderboardRef = collection(db, "leaderboard");
            await addDoc(leaderboardRef, {
                username: currentUsername,
                score: score,
                timestamp: serverTimestamp()
            });

            const ranks = await getPlayerRanks(score);
            playerRankInfo.innerHTML = `
                Your Rank: 
                <span class="font-bold text-[#a3db9a]">#${ranks.daily}</span> Today | 
                <span class="font-bold text-[#a3db9a]">#${ranks.monthly}</span> This Month | 
                <span class="font-bold text-[#a3db9a]">#${ranks.allTime}</span> All-Time
            `;

            await runTransaction(db, async (transaction) => {
                for (const result of gameResults) {
                    if (!result.name) continue;
                    const playerDocRef = doc(db, "playerStats", result.name.replace(/ /g, '_'));
                    const playerDoc = await transaction.get(playerDocRef);
                    
                    let correct = playerDoc.exists() ? playerDoc.data().correctGuesses || 0 : 0;
                    let incorrect = playerDoc.exists() ? playerDoc.data().incorrectGuesses || 0 : 0;

                    if (result.guessedCorrectly) correct++;
                    else incorrect++;
                    
                    const total = correct + incorrect;
                    const recognitionRate = total > 0 ? (correct / total) : 0;
                    
                    transaction.set(playerDocRef, {
                        name: result.name,
                        correctGuesses: correct,
                        incorrectGuesses: incorrect,
                        recognitionRate: recognitionRate
                    }, { merge: true });
                }
            });
        } catch (error) {
            console.error("Error during score submission: ", error);
            playerRankInfo.innerHTML = '<span class="text-red-500">Could not calculate rank. (Is the Firestore index created?)</span>';
        }
    }

    async function getPlayerRanks(playerScore) {
        const leaderboardRef = collection(db, "leaderboard");
        const now = new Date();
        
        const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const dailyQuery = query(leaderboardRef, where('timestamp', '>=', startOfDay), orderBy('timestamp', 'desc'));
        
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const monthlyQuery = query(leaderboardRef, where('timestamp', '>=', startOfMonth), orderBy('timestamp', 'desc'));

        const allTimeQuery = query(leaderboardRef, orderBy('score', 'desc'), limit(1000));

        try {
            const [dailySnapshot, monthlySnapshot, allTimeSnapshot] = await Promise.all([
                getDocs(dailyQuery),
                getDocs(monthlyQuery),
                getDocs(allTimeQuery)
            ]);

            const getRank = (snapshot, score) => {
                const scores = snapshot.docs.map(doc => doc.data().score);
                const higherScores = scores.filter(s => s > score).length;
                return higherScores + 1;
            };

            return {
                daily: getRank(dailySnapshot, playerScore),
                monthly: getRank(monthlySnapshot, playerScore),
                allTime: getRank(allTimeSnapshot, playerScore)
            };
        } catch (error) {
            console.error("Error getting ranks:", error);
            throw error;
        }
    }

    function handleSkip() { nextRound(); }
    function giveUp() { handleIncorrectGuess(); }
    
    function triggerConfetti() {
        for (let i = 0; i < 100; i++) {
            const confetti = document.createElement('div');
            confetti.className = 'confetti';
            confetti.style.left = Math.random() * 100 + 'vw';
            confetti.style.animationDelay = Math.random() * 2 + 's';
            confetti.style.backgroundColor = `hsl(${Math.random() * 360}, 90%, 60%)`;
            document.body.appendChild(confetti);
            setTimeout(() => confetti.remove(), 4000);
        }
    }
    
    function updateAutocomplete() {
        const value = guessInput.value.toLowerCase();
        autocompleteList.innerHTML = '';
        activeAutocompleteIndex = -1;
        if (!value) {
            closeAutocomplete();
            return;
        }

        const filteredNames = allPlayerNames.filter(name => name.toLowerCase().startsWith(value)).slice(0, 50);

        if (filteredNames.length === 0) {
            closeAutocomplete();
            return;
        }

        filteredNames.forEach(name => {
            const item = document.createElement('div');
            item.className = 'p-3 hover:bg-gray-700 cursor-pointer';
            item.textContent = name.split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
            item.addEventListener('click', () => {
                guessInput.value = name;
                closeAutocomplete();
                checkGuess();
            });
            autocompleteList.appendChild(item);
        });

        autocompleteList.classList.remove('hidden');
    }

    function closeAutocomplete() {
        autocompleteList.classList.add('hidden');
        activeAutocompleteIndex = -1;
    }

    function handleAutocompleteKeydown(e) {
        const items = autocompleteList.children;
        if (autocompleteList.classList.contains('hidden') || !items.length) {
             if (e.key === 'Enter') checkGuess();
             return;
        }

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            activeAutocompleteIndex++;
            if (activeAutocompleteIndex >= items.length) activeAutocompleteIndex = 0;
            updateAutocompleteHighlight(items);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            activeAutocompleteIndex--;
            if (activeAutocompleteIndex < 0) activeAutocompleteIndex = items.length - 1;
            updateAutocompleteHighlight(items);
        } else if (e.key === 'Enter') {
             e.preventDefault();
            if (activeAutocompleteIndex > -1) {
                items[activeAutocompleteIndex].click();
            } else {
                checkGuess();
            }
        }
    }

    function updateAutocompleteHighlight(items) {
        for (let i = 0; i < items.length; i++) {
            if (i === activeAutocompleteIndex) {
                items[i].classList.add('autocomplete-active');
                items[i].scrollIntoView({ block: 'nearest' });
            } else {
                items[i].classList.remove('autocomplete-active');
            }
        }
    }

    // --- ADMIN PANEL LOGIC ---
    let adminPlayers = [];
    let currentAdminPlayerIndex = 0;
    let currentAdminPlayerTags = [];

    function openAdminPanel() {
        adminPanelModal.classList.remove('hidden');
        populateSeasonSelect();
    }
    
    function populateSeasonSelect() {
        const seasonsByCountry = all_castaways_data.reduce((acc, player) => {
            if (player && player.season_key && typeof player.season_key === 'string') {
                const [country, season] = player.season_key.split('_S');
                const countryUpper = country.toUpperCase();
                if (!acc[countryUpper]) {
                    acc[countryUpper] = new Set();
                }
                acc[countryUpper].add(parseInt(season));
            }
            return acc;
        }, {});

        seasonSelect.innerHTML = '<option selected disabled>Choose a season</option>';
        Object.keys(seasonsByCountry).sort().forEach(country => {
            const optgroup = document.createElement('optgroup');
            optgroup.label = country;
            const seasons = [...seasonsByCountry[country]].sort((a, b) => a - b);
            seasons.forEach(season => {
                const option = document.createElement('option');
                option.value = `${country}_S${String(season).padStart(2, '0')}`;
                option.textContent = `Season ${season}`;
                optgroup.appendChild(option);
            });
            seasonSelect.appendChild(optgroup);
        });
    }

    function handleSeasonSelect() {
        const selectedSeasonKey = seasonSelect.value;
        adminPlayers = all_castaways_data.filter(p => p.season_key === selectedSeasonKey);
        currentAdminPlayerIndex = 0;
        playerDisplay.classList.remove('hidden');
        displayAdminPlayer();
    }

    async function displayAdminPlayer() {
        const player = adminPlayers[currentAdminPlayerIndex];
        playerNameDisplay.textContent = player.name;
        const imageUrl = getImageUrl(player);
        playerImageDisplay.src = imageUrl;
        acceptedNamesDisplay.textContent = player.acceptedAnswers || player.name;
        imageUrlDisplay.textContent = imageUrl;

        saveStatus.textContent = 'Loading tags...';
        const playerDocRef = doc(db, "playerStats", player.name.replace(/ /g, '_'));
        const playerDoc = await getDoc(playerDocRef);
        
        currentAdminPlayerTags = [];
        if (playerDoc.exists() && playerDoc.data().tags) {
            currentAdminPlayerTags = playerDoc.data().tags;
        }
        renderAdminTags();
        saveStatus.textContent = '';
    }

    function renderAdminTags() {
        tagsDisplay.innerHTML = '';
        currentAdminPlayerTags.forEach(tag => {
            const tagEl = document.createElement('span');
            tagEl.className = 'bg-blue-800 text-blue-100 text-xs font-semibold px-2.5 py-0.5 rounded-full flex items-center';
            tagEl.textContent = tag;
            const removeBtn = document.createElement('button');
            removeBtn.className = 'ml-2 text-blue-300 hover:text-white';
            removeBtn.innerHTML = '&times;';
            removeBtn.onclick = () => {
                currentAdminPlayerTags = currentAdminPlayerTags.filter(t => t !== tag);
                renderAdminTags();
            };
            tagEl.appendChild(removeBtn);
            tagsDisplay.appendChild(tagEl);
        });
    }
    
    function addAdminTag() {
        const newTag = addTagInput.value.trim();
        if (newTag && !currentAdminPlayerTags.includes(newTag)) {
            currentAdminPlayerTags.push(newTag);
            renderAdminTags();
            addTagInput.value = '';
        }
    }

    async function saveAdminChanges() {
        const player = adminPlayers[currentAdminPlayerIndex];
        const playerDocRef = doc(db, "playerStats", player.name.replace(/ /g, '_'));
        saveStatus.textContent = 'Saving...';
        try {
            await setDoc(playerDocRef, { tags: currentAdminPlayerTags }, { merge: true });
            saveStatus.textContent = 'Saved successfully!';
            setTimeout(() => saveStatus.textContent = '', 2000);
        } catch (error) {
            console.error("Error saving tags: ", error);
            saveStatus.textContent = 'Error saving.';
        }
    }

        // --- EVENT LISTENERS ---
    if (startBtn) {
        startBtn.addEventListener('click', startGame);
    }
    if (playAgainBtn) {
        playAgainBtn.addEventListener('click', () => {
            gameOverScreen.style.display = 'none';
            startScreen.style.display    = 'block';
        });
    }
    if (giveUpBtn) {
        giveUpBtn.addEventListener('click', giveUp);
    }
    if (skipBtn) {
        skipBtn.addEventListener('click', handleSkip);
    }
    if (guessInput) {
        guessInput.addEventListener('input', updateAutocomplete);
        guessInput.addEventListener('keydown', handleAutocompleteKeydown);
    }

    // Admin Listeners
    const adminPanelBtnEl = document.getElementById('admin-panel-btn');
    if (adminPanelBtnEl) {
        adminPanelBtnEl.addEventListener('click', openAdminPanel);
    }
    if (adminCloseBtn) {
        adminCloseBtn.addEventListener('click', () => {
            if (adminPanelModal) adminPanelModal.classList.add('hidden');
        });
    }
    if (castawayCheckBtn) {
        castawayCheckBtn.addEventListener('click', () => {
            if (castawayCheckSection) castawayCheckSection.classList.toggle('hidden');
        });
    }
    if (seasonSelect) {
        seasonSelect.addEventListener('change', handleSeasonSelect);
    }
    if (prevPlayerBtn) {
        prevPlayerBtn.addEventListener('click', () => {
            currentAdminPlayerIndex = (currentAdminPlayerIndex - 1 + adminPlayers.length) % adminPlayers.length;
            displayAdminPlayer();
        });
    }
    if (nextPlayerBtn) {
        nextPlayerBtn.addEventListener('click', () => {
            currentAdminPlayerIndex = (currentAdminPlayerIndex + 1) % adminPlayers.length;
            displayAdminPlayer();
        });
    }
    if (addTagBtn) {
        addTagBtn.addEventListener('click', addAdminTag);
    }
    if (addTagInput) {
        addTagInput.addEventListener('keydown', e => {
            if (e.key === 'Enter') addAdminTag();
        });
    }
    if (savePlayerChangesBtn) {
        savePlayerChangesBtn.addEventListener('click', saveAdminChanges);
    }

    // Global “Enter” → Play Again
    document.addEventListener('keydown', e => {
        if (e.key === 'Enter' && gameOverScreen && !gameOverScreen.classList.contains('hidden')) {
            playAgainBtn?.click();
        }
    });

    
    // --- INITIALIZATION ---
    function loadFilterPreferences() {
        const prefs = JSON.parse(localStorage.getItem('survivorVersionPrefs'));
        if (prefs) {
            versionFilterCheckboxes.forEach(cb => {
                cb.checked = prefs[cb.dataset.country] !== false; // Default to true if not specified
            });
        }
    }

    function saveFilterPreferences() {
        const prefs = {};
        versionFilterCheckboxes.forEach(cb => {
            prefs[cb.dataset.country] = cb.checked;
        });
        localStorage.setItem('survivorVersionPrefs', JSON.stringify(prefs));
    }

    versionFilterCheckboxes.forEach(cb => cb.addEventListener('change', saveFilterPreferences));
    
    loadFilterPreferences();
    highScoreEl.innerText = highScore;
    // Initial preload and selection is now handled by startGame()
}

